"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSafeTenantGatewayConfig } from "@/lib/financeiro/gateway_vault";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { hasPlanModuleAccess } from "@/lib/rbac/entitlements";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  UpdateInstitutionInput,
  TeamMemberDTO,
  InviteTeamMemberInput,
  UpdateTeamMemberRoleInput,
  ToggleTeamMemberStatusInput,
  InstitutionSettingsDTO,
} from "@/types/configuracoes";

/**
 * Consulta Dados Institucionais, Membros da Equipe e Direitos de Plano
 * RBAC: Restrito a Administrador da Instituição
 */
export async function getInstitutionSettingsAction(): Promise<{
  data: InstitutionSettingsDTO | null;
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "config:manage_institution");

    const supabase = await createClient();

    // 1. Busca dados da instituição
    const { data: tenantData, error: tenantErr } = await (supabase.from("tenants") as any)
      .select("*")
      .eq("id", session.tenant.id)
      .single();

    if (tenantErr || !tenantData) {
      throw new Error("Falha ao carregar dados da instituição.");
    }

    // 2. Busca membros da equipe do tenant (exclui alunos discentes puros)
    const { data: teamData, error: teamErr } = await (supabase.from("tenant_users") as any)
      .select(`
        id,
        user_id,
        role,
        is_active,
        created_at,
        profile:profiles(id, email, full_name, avatar_url)
      `)
      .eq("tenant_id", session.tenant.id)
      .neq("role", "aluno")
      .order("created_at", { ascending: true });

    if (teamErr) {
      throw new Error(`Falha ao carregar membros da equipe: ${teamErr.message}`);
    }

    const team_members: TeamMemberDTO[] = (teamData || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      email: m.profile?.email || "",
      full_name: m.profile?.full_name || "Sem Nome",
      role: m.role,
      is_active: m.is_active,
      avatar_url: m.profile?.avatar_url || null,
      created_at: m.created_at,
    }));

    // 3. Monta direitos do plano e resumo seguro de gateway
    const plan_tier = tenantData.plan_tier || "gestao";
    const gatewaySummary = await getSafeTenantGatewayConfig(session.tenant.id, "asaas");

    const settingsDTO: InstitutionSettingsDTO = {
      tenant: tenantData,
      team_members,
      gateway_summary: gatewaySummary,
      plan_entitlements: {
        plan_tier,
        features: {
          ead: hasPlanModuleAccess(plan_tier, "ead"),
          provas: hasPlanModuleAccess(plan_tier, "provas"),
          financeiro: hasPlanModuleAccess(plan_tier, "financeiro"),
          certificados: hasPlanModuleAccess(plan_tier, "certificados"),
          captacao_ia: hasPlanModuleAccess(plan_tier, "captacao"),
        },
      },
    };

    return { data: settingsDTO, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Erro inesperado ao consultar configurações." };
  }
}

/**
 * Atualiza Dados Cadastrais e Identidade Visual da Instituição
 * RBAC: Restrito a Admin do Tenant
 * Proteção: plan_tier e status NUNCA são alterados por esta Server Action.
 */
export async function updateInstitutionAction(
  input: UpdateInstitutionInput
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "config:manage_institution");

    const name = (input.name || "").trim();
    if (name.length < 2 || name.length > 255) {
      return { success: false, error: "Nome da instituição deve ter entre 2 e 255 caracteres." };
    }

    const supabase = await createClient();

    // Atualiza apenas dados permitidos da instituição (sem alterar slug, plan_tier ou status)
    const updatePayload: Record<string, any> = {
      name,
      trade_name: input.trade_name ? input.trade_name.trim() : null,
      cnpj: input.cnpj ? input.cnpj.trim() : null,
      email: input.email ? input.email.trim().toLowerCase() : null,
      phone: input.phone ? input.phone.trim() : null,
      website: input.website ? input.website.trim() : null,
      logo_url: input.logo_url ? input.logo_url.trim() : null,
      primary_color: input.primary_color || "#4f46e5",
      address_street: input.address_street ? input.address_street.trim() : null,
      address_city: input.address_city ? input.address_city.trim() : null,
      address_state: input.address_state ? input.address_state.trim().toUpperCase() : null,
      address_postal_code: input.address_postal_code ? input.address_postal_code.trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: updErr } = await (supabase.from("tenants") as any)
      .update(updatePayload)
      .eq("id", session.tenant.id);

    if (updErr) {
      throw new Error(`Falha ao salvar dados institucionais: ${updErr.message}`);
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "INSTITUTION_SETTINGS_UPDATED",
      resourceType: "tenants",
      resourceId: session.tenant.id,
      details: { updated_by: session.profile.full_name },
    });

    revalidatePath("/app/configuracoes");
    revalidatePath("/app/dashboard");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao atualizar dados institucionais." };
  }
}

/**
 * Convida / Atribui um Novo Membro para a Equipe da Escola
 * RBAC: Restrito a Admin do Tenant
 * Blindagem: Impede criar outro admin pelo formulário padrão ou criar aluno por aqui.
 */
export async function inviteTeamMemberAction(
  input: InviteTeamMemberInput
): Promise<{ success: boolean; membershipId?: string; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "config:manage_team");

    const email = (input.email || "").trim().toLowerCase();
    const fullName = (input.full_name || "").trim();

    if (!email || !email.includes("@")) {
      return { success: false, error: "E-mail inválido." };
    }
    if (fullName.length < 2) {
      return { success: false, error: "Nome completo deve ter pelo menos 2 caracteres." };
    }
    if (!["secretaria", "financeiro", "professor"].includes(input.role)) {
      return { success: false, error: "Papel de equipe inválido para convite direto." };
    }

    const admin = createAdminClient();

    // 1. Verifica se já existe um usuário auth cadastrado com este e-mail
    let targetUserId: string;
    const { data: existingUser } = await (admin.from("profiles") as any)
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      targetUserId = existingUser.id;
    } else {
      // Cria novo usuário auth no Supabase com senha provisória ou padrão
      const initialPassword = input.initial_password || `TeoClass@${Math.random().toString(36).substring(2, 8)}!`;
      const { data: newUser, error: createAuthErr } = await admin.auth.admin.createUser({
        email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createAuthErr || !newUser.user) {
        throw new Error(`Falha ao provisionar acesso para ${email}: ${createAuthErr?.message}`);
      }
      targetUserId = newUser.user.id;

      // Garante criação/atualização de profile
      await (admin.from("profiles") as any).upsert({
        id: targetUserId,
        email,
        full_name: fullName,
      });
    }

    // 2. Verifica se o usuário já possui vínculo neste tenant
    const { data: existingMembership } = await (admin.from("tenant_users") as any)
      .select("id, is_active, role")
      .eq("tenant_id", session.tenant.id)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existingMembership) {
      if (existingMembership.is_active) {
        return {
          success: false,
          error: `Este usuário já faz parte da equipe da instituição com o papel '${existingMembership.role}'.`,
        };
      } else {
        // Reativa membership existente com o novo papel
        await (admin.from("tenant_users") as any)
          .update({
            role: input.role,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingMembership.id);

        return { success: true, membershipId: existingMembership.id, error: null };
      }
    }

    // 3. Insere novo vínculo na tabela tenant_users
    const { data: newMembership, error: memErr } = await (admin.from("tenant_users") as any)
      .insert({
        tenant_id: session.tenant.id,
        user_id: targetUserId,
        role: input.role,
        is_active: true,
      })
      .select("id")
      .single();

    if (memErr || !newMembership) {
      throw new Error(`Falha ao associar membro ao tenant: ${memErr?.message}`);
    }

    // Se o papel for 'professor', garante cadastro correspondente na tabela teachers caso não exista
    if (input.role === "professor") {
      const { data: existingTeacher } = await (admin.from("teachers") as any)
        .select("id")
        .eq("tenant_id", session.tenant.id)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!existingTeacher) {
        const parts = fullName.split(" ");
        const firstName = parts[0] || "Professor";
        const lastName = parts.slice(1).join(" ") || "Docente";
        await (admin.from("teachers") as any).insert({
          tenant_id: session.tenant.id,
          user_id: targetUserId,
          first_name: firstName,
          last_name: lastName,
          email,
          is_active: true,
        });
      }
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "TEAM_MEMBER_INVITED",
      resourceType: "tenant_users",
      resourceId: newMembership.id,
      details: { invited_email: email, role: input.role },
    });

    revalidatePath("/app/configuracoes");
    return { success: true, membershipId: newMembership.id, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro inesperado ao convidar membro de equipe." };
  }
}

/**
 * Altera o Papel de um Membro da Equipe
 * RBAC: Restrito a Admin do Tenant
 * Proteção: Impede autopromoção ou alteração do próprio papel do usuário logado.
 */
export async function updateTeamMemberRoleAction(
  input: UpdateTeamMemberRoleInput
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "config:manage_team");

    const supabase = await createClient();

    // 1. Busca o membership alvo para verificar identidade
    const { data: targetMem, error: findErr } = await (supabase.from("tenant_users") as any)
      .select("id, user_id, role")
      .eq("tenant_id", session.tenant.id)
      .eq("id", input.membership_id)
      .single();

    if (findErr || !targetMem) {
      return { success: false, error: "Membro da equipe não encontrado nesta instituição." };
    }

    // 2. Proteção contra alteração de si mesmo
    if (targetMem.user_id === session.user.id) {
      return {
        success: false,
        error: "Operação proibida: você não pode alterar seu próprio perfil de acesso.",
      };
    }

    // 3. Proteção do Último Administrador Ativo: impede rebaixar o único admin do tenant
    if (targetMem.role === "admin" && input.role !== "admin") {
      const { count: activeAdminsCount, error: countErr } = await (supabase.from("tenant_users") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("role", "admin")
        .eq("is_active", true);

      if (countErr || (activeAdminsCount !== null && activeAdminsCount <= 1)) {
        return {
          success: false,
          error: "Operação proibida: não é permitido alterar o papel do único administrador da instituição.",
        };
      }
    }

    // 3. Atualiza papel
    const { error: updErr } = await (supabase.from("tenant_users") as any)
      .update({
        role: input.role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetMem.id)
      .eq("tenant_id", session.tenant.id);

    if (updErr) {
      throw new Error(`Falha ao alterar perfil: ${updErr.message}`);
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "TEAM_MEMBER_ROLE_UPDATED",
      resourceType: "tenant_users",
      resourceId: targetMem.id,
      details: { previous_role: targetMem.role, new_role: input.role },
    });

    revalidatePath("/app/configuracoes");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao atualizar papel do membro." };
  }
}

/**
 * Ativa ou Suspende o Acesso de um Membro da Equipe
 * RBAC: Restrito a Admin do Tenant
 * Proteção: Impede desativar a si mesmo (evitando orfandade administrativa do tenant).
 */
export async function toggleTeamMemberStatusAction(
  input: ToggleTeamMemberStatusInput
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "config:manage_team");

    const supabase = await createClient();

    // 1. Busca o membership alvo
    const { data: targetMem, error: findErr } = await (supabase.from("tenant_users") as any)
      .select("id, user_id, role, is_active")
      .eq("tenant_id", session.tenant.id)
      .eq("id", input.membership_id)
      .single();

    if (findErr || !targetMem) {
      return { success: false, error: "Membro da equipe não localizado." };
    }

    // 2. Proteção contra desativar a si mesmo
    if (targetMem.user_id === session.user.id) {
      return {
        success: false,
        error: "Operação proibida: você não pode suspender seu próprio acesso.",
      };
    }

    // 3. Proteção do Último Administrador Ativo: impede suspender o único admin do tenant
    if (targetMem.role === "admin" && !input.is_active) {
      const { count: activeAdminsCount, error: countErr } = await (supabase.from("tenant_users") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("role", "admin")
        .eq("is_active", true);

      if (countErr || (activeAdminsCount !== null && activeAdminsCount <= 1)) {
        return {
          success: false,
          error: "Operação proibida: não é permitido suspender o único administrador ativo da instituição.",
        };
      }
    }

    // 3. Atualiza status
    const { error: updErr } = await (supabase.from("tenant_users") as any)
      .update({
        is_active: input.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetMem.id)
      .eq("tenant_id", session.tenant.id);

    if (updErr) {
      throw new Error(`Falha ao alterar status de acesso: ${updErr.message}`);
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: input.is_active ? "TEAM_MEMBER_REACTIVATED" : "TEAM_MEMBER_SUSPENDED",
      resourceType: "tenant_users",
      resourceId: targetMem.id,
      details: { member_user_id: targetMem.user_id, status: input.is_active },
    });

    revalidatePath("/app/configuracoes");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao alterar status do membro." };
  }
}
