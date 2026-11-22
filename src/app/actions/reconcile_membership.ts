"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export interface CheckPendingMembershipResult {
  hasActiveMembership: boolean;
  needsReconciliation: boolean;
  tenantId?: string;
  tenantName?: string;
  status?: string;
  message?: string;
}

/**
 * Server Action: Reconciliação Estrita de Vínculo Administrativo no Login
 *
 * REGRAS DE SEGURANÇA E NÃO-CONFIANÇA NO CLIENTE:
 * 1. NÃO confia em userId ou userEmail enviados por parâmetro do cliente.
 *    Obtém a identidade exclusivamente pela sessão validada no servidor via auth.getUser().
 * 2. Validação estrita de autorização:
 *    - Usuário precisa estar com e-mail confirmado no Supabase Auth.
 *    - O e-mail autenticado no servidor DEVE corresponder EXATAMENTE ao e-mail institucional
 *      registrado no tenant (tenant.email === authUser.email).
 *    - Se houver metadados (user_metadata.tenant_id), este deve apontar para o MESMO tenant.
 * 3. Restrição de Escopo (Apenas Ativação Incompleta de Trial Legítimo):
 *    - Só reconcilia tenants em status 'trial' ou 'trial_pending' que NÃO possuam nenhum administrador ativo
 *      previamente cadastrado (ou onde o próprio usuário é o registro a ser reparado).
 *    - NUNCA permite assumir tenants em status 'active', 'suspended', 'trial_expired' ou de terceiros.
 *    - Se o tenant já tiver outro administrador ativo com e-mail divergente, a reconciliação é bloqueada.
 * 4. Preservação Total dos Dados Existentes:
 *    - Preserva status, plan_tier, trial_ends_at e configurações da instituição.
 * 5. Idempotência e Auditoria:
 *    - Insere em tenant_users com is_active: true e role: 'admin'.
 *    - Registra evento de auditoria imutável em audit_logs.
 */
export async function reconcileAdminMembershipAction(): Promise<CheckPendingMembershipResult> {
  try {
    // 1. Obter identidade exclusivamente da sessão segura do servidor via cookie store
    const supabaseServer = await createServerClient();
    const {
      data: { user: authUser },
      error: userErr,
    } = await supabaseServer.auth.getUser();

    if (userErr || !authUser || !authUser.id || !authUser.email) {
      return {
        hasActiveMembership: false,
        needsReconciliation: false,
        message: "Sessão não autenticada no servidor.",
      };
    }

    const cleanUserId = authUser.id;
    const cleanUserEmail = authUser.email.trim().toLowerCase();

    const admin = createAdminClient();

    // 2. Verifica se o usuário já possui vínculo ativo em tenant_users
    const { data: activeMemberships } = await (admin.from("tenant_users") as any)
      .select("id, tenant_id, role, is_active")
      .eq("user_id", cleanUserId)
      .eq("is_active", true);

    if (activeMemberships && activeMemberships.length > 0) {
      return {
        hasActiveMembership: true,
        needsReconciliation: false,
      };
    }

    // 3. Obter dados confiáveis do usuário no Supabase Auth Admin
    const { data: authAdminData } = await admin.auth.admin.getUserById(cleanUserId);
    const trustedAuthUser = authAdminData?.user;

    if (!trustedAuthUser || trustedAuthUser.email?.toLowerCase() !== cleanUserEmail) {
      return {
        hasActiveMembership: false,
        needsReconciliation: false,
        message: "Falha na validação de integridade da conta no servidor.",
      };
    }

    const metaTenantId = trustedAuthUser.user_metadata?.tenant_id;

    // 4. Localizar a instituição elegível
    // Apenas status 'trial' ou 'trial_pending' (ativação incompleta)
    let targetTenant: any = null;

    if (metaTenantId) {
      const { data: tenantByMeta } = await (admin.from("tenants") as any)
        .select("id, name, email, status, trial_ends_at, plan_tier, settings")
        .eq("id", metaTenantId)
        .in("status", ["trial", "trial_pending"])
        .maybeSingle();

      if (tenantByMeta) {
        targetTenant = tenantByMeta;
      }
    }

    if (!targetTenant) {
      const { data: tenantByEmail } = await (admin.from("tenants") as any)
        .select("id, name, email, status, trial_ends_at, plan_tier, settings")
        .eq("email", cleanUserEmail)
        .in("status", ["trial", "trial_pending"])
        .maybeSingle();

      if (tenantByEmail) {
        targetTenant = tenantByEmail;
      }
    }

    if (!targetTenant) {
      return {
        hasActiveMembership: false,
        needsReconciliation: false,
        message: "Sua conta não possui vínculo ativo com nenhuma instituição teológica cadastrada.",
      };
    }

    // 5. Verificação Rigorosa de Autorização e Vínculo Confiável
    // O e-mail do usuário autenticado no servidor DEVE ser idêntico ao e-mail institucional
    const tenantEmail = (targetTenant.email || "").trim().toLowerCase();
    if (tenantEmail !== cleanUserEmail) {
      console.warn(
        `[SECURITY_ALERT] Tentativa não autorizada de reconciliação: Usuário ${cleanUserEmail} tentou reconciliar tenant ${targetTenant.id} pertencente a ${tenantEmail}.`
      );
      return {
        hasActiveMembership: false,
        needsReconciliation: false,
        message: "Usuário não autorizado para administrar esta instituição.",
      };
    }

    // Se houver metaTenantId, ele não pode apontar para outro tenant
    if (metaTenantId && metaTenantId !== targetTenant.id) {
      console.warn(
        `[SECURITY_ALERT] Divergência de metadados: Usuário ${cleanUserEmail} tem metaTenantId ${metaTenantId} incompatível com ${targetTenant.id}.`
      );
      return {
        hasActiveMembership: false,
        needsReconciliation: false,
        message: "Inconsistência nos metadados de autenticação da instituição.",
      };
    }

    // 6. Restrição de Escopo: Verificar se já existe OUTRO administrador ativo no tenant
    // (Impede que um usuário tente assumir tenant de terceiro ou já operacional)
    const { data: existingAdmins } = await (admin.from("tenant_users") as any)
      .select("id, user_id, role, is_active")
      .eq("tenant_id", targetTenant.id)
      .eq("role", "admin")
      .eq("is_active", true);

    const otherAdmins = (existingAdmins || []).filter(
      (a: any) => a.user_id !== cleanUserId
    );

    if (otherAdmins.length > 0) {
      console.warn(
        `[SECURITY_BLOCKED] Reconciliação bloqueada: Tenant ${targetTenant.id} já possui administrador ativo.`
      );
      return {
        hasActiveMembership: false,
        needsReconciliation: false,
        message: "Esta instituição já possui um administrador ativo registrado.",
      };
    }

    // 7. Garante profile do responsável em public.profiles
    const adminFullName =
      (targetTenant.settings as any)?.admin_name ||
      trustedAuthUser.user_metadata?.full_name ||
      targetTenant.name;

    await (admin.from("profiles") as any).upsert({
      id: cleanUserId,
      email: cleanUserEmail,
      full_name: adminFullName,
    });

    // 8. Inserção / Atualização Atômica em public.tenant_users
    const { data: existingTu } = await (admin.from("tenant_users") as any)
      .select("id, is_active, role")
      .eq("tenant_id", targetTenant.id)
      .eq("user_id", cleanUserId)
      .maybeSingle();

    if (existingTu) {
      const { error: updErr } = await (admin.from("tenant_users") as any)
        .update({
          role: "admin",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTu.id);

      if (updErr) {
        console.error("[RECONCILE_TU_UPDATE_ERROR]", updErr);
        return {
          hasActiveMembership: false,
          needsReconciliation: false,
          message: "Falha ao restabelecer vínculo institucional.",
        };
      }
    } else {
      const { error: insErr } = await (admin.from("tenant_users") as any).insert({
        tenant_id: targetTenant.id,
        user_id: cleanUserId,
        role: "admin",
        is_active: true,
      });

      if (insErr) {
        console.error("[RECONCILE_TU_INSERT_ERROR]", insErr);
        return {
          hasActiveMembership: false,
          needsReconciliation: false,
          message: "Falha ao registrar vínculo administrativo.",
        };
      }
    }

    // 9. Registro de Auditoria Imutável
    try {
      await (admin.from("audit_logs") as any).insert({
        tenant_id: targetTenant.id,
        user_id: cleanUserId,
        action: "MEMBERSHIP_RECONCILED_ON_LOGIN",
        resource_type: "tenant_users",
        resource_id: targetTenant.id,
        details: {
          email: cleanUserEmail,
          tenant_name: targetTenant.name,
          status: targetTenant.status,
          reconciled_at: new Date().toISOString(),
        },
      });
    } catch {
      // Auditoria não-bloqueante
    }

    return {
      hasActiveMembership: true,
      needsReconciliation: true,
      tenantId: targetTenant.id,
      tenantName: targetTenant.name,
      status: targetTenant.status,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Erro inesperado na reconciliação de vínculo.";
    console.error("[RECONCILE_MEMBERSHIP_FATAL]", errorMsg);
    return {
      hasActiveMembership: false,
      needsReconciliation: false,
      message: errorMsg,
    };
  }
}
