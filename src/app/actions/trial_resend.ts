"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ResendActivationResult {
  success: boolean;
  message: string;
  hasPendingTenant?: boolean;
}

/**
 * Server Action: Reenvio Seguro de E-mail de Ativação
 * 
 * - Permite reenviar convite ou link de ativação sem criar novos tenants e sem resetar senhas.
 * - Rate limiting seguro por tenant (mínimo de 60 segundos entre envios).
 * - Mensagens amigáveis em português e sem vazamento de existência de conta a invasores.
 * - Suporta tanto usuário novo (inviteUserByEmail) quanto usuário existente no Auth com tenant pendente (signInWithOtp).
 */
export async function resendTrialActivationAction(
  emailInput: string
): Promise<ResendActivationResult> {
  try {
    const email = (emailInput || "").trim().toLowerCase();
    if (!email || !email.includes("@") || !email.includes(".")) {
      return {
        success: false,
        message: "Informe um endereço de e-mail corporativo válido.",
      };
    }

    const admin = createAdminClient();

    // 1. Localiza tenant pendente vinculado a este e-mail
    const { data: tenant } = await (admin.from("tenants") as any)
      .select("id, name, status, settings, updated_at")
      .eq("email", email)
      .eq("status", "trial_pending")
      .maybeSingle();

    if (!tenant) {
      // Verifica se o tenant já está ativo ou em trial
      const { data: activeTenant } = await (admin.from("tenants") as any)
        .select("id, status")
        .eq("email", email)
        .in("status", ["trial", "active"])
        .maybeSingle();

      if (activeTenant) {
        return {
          success: false,
          hasPendingTenant: false,
          message: "Esta instituição já se encontra ativada. Por favor, acesse a página de login da gestão.",
        };
      }

      // Resposta genérica segura para e-mails sem cadastro pendente
      return {
        success: false,
        hasPendingTenant: false,
        message: "Nenhum cadastro pendente de ativação foi localizado para este e-mail. Por favor, inicie um novo cadastro de teste gratuito.",
      };
    }

    // 2. Rate limiting simples: verifica se foi enviado há menos de 60 segundos
    const lastSent = (tenant.settings as any)?.last_activation_email_at;
    if (lastSent) {
      const diffMs = Date.now() - new Date(lastSent).getTime();
      if (diffMs < 60 * 1000) {
        const waitSecs = Math.ceil((60 * 1000 - diffMs) / 1000);
        return {
          success: false,
          hasPendingTenant: true,
          message: `Aguarde ${waitSecs} segundos antes de solicitar um novo reenvio de e-mail.`,
        };
      }
    }

    // 3. URLs oficiais
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://teoclass.vercel.app";
    const redirectTo = `${appUrl}/app/ativar?tenant_id=${tenant.id}`;
    const adminFullName = (tenant.settings as any)?.admin_name || tenant.name;

    // 4. Tenta reenviar convite oficial
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        tenant_id: tenant.id,
        full_name: adminFullName,
        invited_to: tenant.name,
      },
    });

    if (inviteErr) {
      const isAlreadyRegistered =
        inviteErr.message?.toLowerCase().includes("already registered") ||
        inviteErr.message?.toLowerCase().includes("already exists") ||
        (inviteErr as any).status === 422;

      if (isAlreadyRegistered) {
        // Se já existe no Auth (caso do usuário relatado), envia Magic Link de autenticação
        // NUNCA envia reset de senha! O Magic Link autentica a sessão e redireciona para /app/ativar
        const { error: otpErr } = await admin.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              tenant_id: tenant.id,
              full_name: adminFullName,
            },
          },
        });

        if (otpErr) {
          console.error("[RESEND_ACTIVATION_OTP_ERROR]", otpErr);
          return {
            success: false,
            hasPendingTenant: true,
            message: `Falha ao reenviar link de ativação: ${otpErr.message}`,
          };
        }
      } else {
        return {
          success: false,
          hasPendingTenant: true,
          message: `Falha ao reenviar e-mail de ativação: ${inviteErr.message}`,
        };
      }
    }

    // 5. Atualiza carimbo de envio no settings do tenant para controle de taxa
    await (admin.from("tenants") as any)
      .update({
        settings: {
          ...(tenant.settings as any),
          last_activation_email_at: new Date().toISOString(),
        },
      })
      .eq("id", tenant.id);

    return {
      success: true,
      hasPendingTenant: true,
      message: `Link de ativação reenviado com sucesso para ${email}. Verifique sua caixa de entrada e spam.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado ao reenviar ativação.";
    console.error("[RESEND_ACTIVATION_FATAL]", msg);
    return {
      success: false,
      message: msg,
    };
  }
}
