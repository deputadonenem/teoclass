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
 * 3. Localiza o tenant vinculado que esteja com status 'trial_pending'.
 * 4. Garante de forma atômica e idempotente:
 *    - Transição do status do tenant de 'trial_pending' para 'trial'.
 *    - Início dos 7 dias exatos: trial_ends_at = now() + 7 days.
 *    - Vínculo do usuário como 'admin' em public.tenant_users com status 'active'.
 *    - Atualização do perfil em public.profiles.
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
        // Tenta recuperar dos metadados do usuário
        const metaTenantId = user.user_metadata?.tenant_id;
        if (metaTenantId) {
          targetTenantId = metaTenantId;
        }
      }
    }

    if (!targetTenantId) {
      return {
        success: false,
        error: "Nenhuma instituição pendente de ativação foi localizada para esta conta.",
      };
    }

    // 2. Busca o Tenant e valida status
    const { data: tenant, error: tenantErr } = await (admin.from("tenants") as any)
      .select("id, name, status, settings")
      .eq("id", targetTenantId)
      .single();

    if (tenantErr || !tenant) {
      return { success: false, error: "Instituição teológica associada não localizada." };
    }

    // Se já estiver em trial ativo, retorna sucesso idempotente
    if (tenant.status === "trial") {
      return {
        success: true,
        tenantName: tenant.name,
        adminEmail: userEmail,
      };
    }

    if (tenant.status !== "trial_pending") {
      return {
        success: false,
        error: `A instituição já se encontra no status '${tenant.status}'. Acesse o login da gestão.`,
      };
    }

    const adminFullName =
      (tenant.settings as any)?.admin_name ||
      user.user_metadata?.full_name ||
      tenant.name;

    // 3. Atualizar/Garantir profile do usuário
    await (admin.from("profiles") as any).upsert({
      id: user.id,
      email: userEmail,
      full_name: adminFullName,
    });

    // 4. Criação/Reativação Atômica de Vínculo Administrativo em tenant_users
    const { data: existingTu } = await (admin.from("tenant_users") as any)
      .select("id, role, status")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingTu) {
      await (admin.from("tenant_users") as any)
        .update({
          role: "admin",
          status: "active",
        })
        .eq("id", existingTu.id);
    } else {
      await (admin.from("tenant_users") as any).insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: "admin",
        status: "active",
      });
    }

    // 5. Início Oficial do Período de Teste de 7 Dias
    // Transiciona status para 'trial' e define trial_ends_at = now() + 7 days
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: activateErr } = await (admin.from("tenants") as any)
      .update({
        status: "trial",
        trial_ends_at: trialEndsAt,
      })
      .eq("id", tenant.id);

    if (activateErr) {
      console.error("[CONFIRM_TRIAL_ACTIVATE_ERROR]", activateErr);
      return {
        success: false,
        error: "Falha ao ativar o período de teste da instituição. Contate o suporte.",
      };
    }

    // 6. Auditoria de ativação
    try {
      await (admin.from("audit_logs") as any).insert({
        tenant_id: tenant.id,
        user_id: user.id,
        action: "TRIAL_ACTIVATED_SUPABASE_AUTH",
        entity: "tenants",
        entity_id: tenant.id,
        details: {
          admin_email: userEmail,
          trial_ends_at: trialEndsAt,
          activated_at: new Date().toISOString(),
        },
      });
    } catch {
      // Log não-bloqueante
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
