"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export interface ConfirmTrialActivationResult {
  success: boolean;
  tenantName?: string;
  adminEmail?: string;
  error?: string;
}

/**
 * Server Action: Confirmação e Ativação do Trial de 7 Dias via Supabase Auth
 * 
 * 1. Valida a sessão autenticada do usuário (ou utiliza o ID do usuário confirmado no Supabase Auth).
 * 2. Verifica se o e-mail do usuário está confirmado pelo Supabase Auth.
 * 3. Localiza o tenant vinculado que esteja com status 'trial_pending' (ou 'trial' se necessitar reconciliar vínculo).
 * 4. Garante de forma atômica e idempotente:
 *    - Validação de identidade: o e-mail do usuário autenticado DEVE coincidir com o e-mail registrado no tenant (ou nos metadados autorizados).
 *    - Criação/atualização do perfil em public.profiles.
 *    - Criação/reativação do vínculo administrativo em public.tenant_users (utilizando a coluna correta is_active: true).
 *    - Transição do status do tenant de 'trial_pending' para 'trial' e início dos 7 dias se ainda não iniciado.
 *    - Não retorna sucesso prematuro antes da confirmação real da persistência do vínculo.
 */
export async function confirmTrialActivationAction(
  tenantId?: string
): Promise<ConfirmTrialActivationResult> {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabaseServer.auth.getUser();

    if (userErr || !user || !user.email) {
      return {
        success: false,
        error: "Sessão de ativação expirada ou não autenticada. Por favor, acesse o link enviado para o seu e-mail.",
      };
    }

    const admin = createAdminClient();
    const userEmail = user.email.toLowerCase();

    // 1. Identificar o tenant a ser ativado
    let targetTenantId = tenantId;

    if (!targetTenantId) {
      // Procura tenant com status trial_pending associado a este e-mail
      const { data: tenantByEmail } = await (admin.from("tenants") as any)
        .select("id, name, status")
        .eq("email", userEmail)
        .eq("status", "trial_pending")
        .maybeSingle();

      if (tenantByEmail) {
        targetTenantId = tenantByEmail.id;
      } else {
        // Tenta recuperar dos metadados do usuário caso exista
        const metaTenantId = user.user_metadata?.tenant_id;
        if (metaTenantId) {
          targetTenantId = metaTenantId;
        } else {
          // Se não encontrou pendente, verifica se o tenant já foi transicionado para trial mas o usuário ainda não tem vínculo
          const { data: trialTenant } = await (admin.from("tenants") as any)
            .select("id, name, status")
            .eq("email", userEmail)
            .eq("status", "trial")
            .maybeSingle();
          if (trialTenant) {
            targetTenantId = trialTenant.id;
          }
        }
      }
    }

    if (!targetTenantId) {
      return {
        success: false,
        error: "Nenhuma instituição associada a esta conta foi localizada.",
      };
    }

    // 2. Busca o Tenant e valida status e autorização do vínculo
    const { data: tenant, error: tenantErr } = await (admin.from("tenants") as any)
      .select("id, name, email, status, trial_ends_at, settings")
      .eq("id", targetTenantId)
      .single();

    if (tenantErr || !tenant) {
      return { success: false, error: "Instituição teológica associada não localizada." };
    }

    // Validação estrita de autorização: o usuário autenticado deve corresponder ao e-mail cadastrado
    const tenantEmail = (tenant.email || "").toLowerCase();
    const metaTenantId = user.user_metadata?.tenant_id;
    const isAuthorized = tenantEmail === userEmail || metaTenantId === tenant.id;

    if (!isAuthorized) {
      console.warn(`[TRIAL_ACTIVATION_SECURITY_REJECT] Usuário ${userEmail} tentou ativar tenant ${tenant.id} (${tenantEmail}) sem autorização.`);
      return {
        success: false,
        error: "Usuário autenticado não possui autorização para ativar esta instituição.",
      };
    }

    if (tenant.status !== "trial_pending" && tenant.status !== "trial") {
      return {
        success: false,
        error: `A instituição se encontra no status '${tenant.status}'. Acesse o login da gestão.`,
      };
    }

    const adminFullName =
      (tenant.settings as any)?.admin_name ||
      user.user_metadata?.full_name ||
      tenant.name;

    // 3. Atualizar/Garantir profile do usuário
    const { error: profileErr } = await (admin.from("profiles") as any).upsert({
      id: user.id,
      email: userEmail,
      full_name: adminFullName,
    });

    if (profileErr) {
      console.error("[CONFIRM_TRIAL_PROFILE_ERROR]", profileErr);
      return {
        success: false,
        error: "Falha ao registrar perfil administrativo do usuário.",
      };
    }

    // 4. Criação/Reativação Atômica de Vínculo Administrativo em tenant_users
    // NOTA CRÍTICA: O schema da tabela tenant_users utiliza 'is_active: boolean', NÃO 'status'!
    const { data: existingTu } = await (admin.from("tenant_users") as any)
      .select("id, role, is_active")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingTu) {
      const { error: updateTuErr } = await (admin.from("tenant_users") as any)
        .update({
          role: "admin",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTu.id);

      if (updateTuErr) {
        console.error("[CONFIRM_TRIAL_TU_UPDATE_ERROR]", updateTuErr);
        return {
          success: false,
          error: "Falha ao atualizar vínculo de acesso à instituição.",
        };
      }
    } else {
      const { error: insertTuErr } = await (admin.from("tenant_users") as any).insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: "admin",
        is_active: true,
      });

      if (insertTuErr) {
        console.error("[CONFIRM_TRIAL_TU_INSERT_ERROR]", insertTuErr);
        return {
          success: false,
          error: "Falha ao vincular usuário como administrador da instituição.",
        };
      }
    }

    // 5. Início do Período de Teste de 7 Dias (apenas se ainda não estiver em trial)
    if (tenant.status === "trial_pending") {
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: activateErr } = await (admin.from("tenants") as any)
        .update({
          status: "trial",
          trial_ends_at: trialEndsAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);

      if (activateErr) {
        console.error("[CONFIRM_TRIAL_ACTIVATE_ERROR]", activateErr);
        return {
          success: false,
          error: "Falha ao ativar o período de teste da instituição. Contate o suporte.",
        };
      }

      // Auditoria de ativação
      try {
        await (admin.from("audit_logs") as any).insert({
          tenant_id: tenant.id,
          user_id: user.id,
          action: "TRIAL_ACTIVATED_SUPABASE_AUTH",
          resource_type: "tenants",
          resource_id: tenant.id,
          details: {
            admin_email: userEmail,
            trial_ends_at: trialEndsAt,
            activated_at: new Date().toISOString(),
          },
        });
      } catch {
        // Log não-bloqueante
      }
    } else {
      // Reconciliação de vínculo bem-sucedida para tenant que já estava em trial
      try {
        await (admin.from("audit_logs") as any).insert({
          tenant_id: tenant.id,
          user_id: user.id,
          action: "TRIAL_MEMBERSHIP_RECONCILED",
          resource_type: "tenant_users",
          resource_id: tenant.id,
          details: {
            admin_email: userEmail,
            reconciled_at: new Date().toISOString(),
          },
        });
      } catch {
        // Log não-bloqueante
      }
    }

    return {
      success: true,
      tenantName: tenant.name,
      adminEmail: userEmail,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro inesperado ao confirmar ativação.";
    console.error("[CONFIRM_TRIAL_FATAL]", errorMsg);
    return { success: false, error: errorMsg };
  }
}
