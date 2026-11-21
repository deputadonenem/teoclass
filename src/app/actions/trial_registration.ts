"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { cleanCnpj } from "@/lib/utils/cnpj";

export interface RegisterTrialInput {
  institutionName: string;
  tradeName?: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  cnpj?: string;
}

export interface RegisterTrialResult {
  success: boolean;
  tenantSlug?: string;
  isResend?: boolean;
  error?: string;
}

/**
 * Gera um slug amigável e único a partir do nome da instituição.
 */
function generateSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Server Action: Cadastro Público de Teste Grátis (7 Dias) com Supabase Auth
 * 
 * 1. Valida dados de entrada (nome, e-mail, telefone, CNPJ) e previne duplicidade.
 * 2. Suporta reenvio seguro de convite se o tenant já estiver em 'trial_pending'.
 * 3. Cria/recupera o tenant em status 'trial_pending' (os 7 dias ainda NÃO são iniciados aqui).
 * 4. Dispara convite nativo do Supabase Auth (admin.auth.admin.inviteUserByEmail) com redirecionamento para /app/ativar.
 * 5. Caso o usuário já exista no Supabase Auth em pendência, gera link de convite ou instrui acesso.
 */
export async function registerTrialAction(
  input: RegisterTrialInput
): Promise<RegisterTrialResult> {
  try {
    const institutionName = (input.institutionName || "").trim();
    const adminName = (input.adminName || "").trim();
    const adminEmail = (input.adminEmail || "").trim().toLowerCase();
    const adminPhone = (input.adminPhone || "").trim();
    const rawCnpj = input.cnpj ? cleanCnpj(input.cnpj) : null;

    // 1. Validações preliminares de integridade
    if (institutionName.length < 3) {
      return { success: false, error: "O nome da instituição deve ter no mínimo 3 caracteres." };
    }
    if (adminName.length < 3) {
      return { success: false, error: "Informe o nome completo do responsável institucional." };
    }
    if (!adminEmail || !adminEmail.includes("@") || !adminEmail.includes(".")) {
      return { success: false, error: "Informe um endereço de e-mail corporativo válido." };
    }
    if (adminPhone.length < 8) {
      return { success: false, error: "Informe um telefone/WhatsApp de contato válido." };
    }

    const admin = createAdminClient();

    // 2. Prevenção de Abuso e Suporte a Reenvio Seguro
    let tenantId: string;
    let tenantSlug: string;
    let isResend = false;

    const { data: existingTenantEmail } = await (admin.from("tenants") as any)
      .select("id, name, slug, status")
      .eq("email", adminEmail)
      .maybeSingle();

    if (existingTenantEmail) {
      if (existingTenantEmail.status === "active" || existingTenantEmail.status === "trial") {
        return {
          success: false,
          error: "Já existe uma instituição ativa vinculada a este e-mail. Por favor, acesse o login da gestão.",
        };
      }
      if (existingTenantEmail.status === "trial_expired") {
        return {
          success: false,
          error: "O período de teste desta instituição já foi concluído. Entre em contato para contratar o plano.",
        };
      }
      if (existingTenantEmail.status === "trial_pending") {
        // Reenvio seguro para cadastro pendente ainda não ativado
        tenantId = existingTenantEmail.id;
        tenantSlug = existingTenantEmail.slug;
        isResend = true;
      } else {
        return {
          success: false,
          error: `Instituição vinculada a este e-mail está com status '${existingTenantEmail.status}'. Contate o suporte.`,
        };
      }
    } else {
      // Verifica CNPJ se fornecido
      if (rawCnpj) {
        const { data: existingCnpj } = await (admin.from("tenants") as any)
          .select("id, name")
          .eq("cnpj", rawCnpj)
          .maybeSingle();

        if (existingCnpj) {
          return {
            success: false,
            error: "Este CNPJ já possui cadastro na plataforma TeoClass.",
          };
        }
      }

      // 3. Geração de Slug Único
      let baseSlug = generateSlug(institutionName);
      if (!baseSlug || baseSlug.length < 2) {
        baseSlug = "instituto-teologico";
      }

      const reserved = ["app", "api", "escola", "verificar", "img", "_next", "favicon.ico"];
      if (reserved.includes(baseSlug)) {
        baseSlug = `${baseSlug}-online`;
      }

      let finalSlug = baseSlug;
      let counter = 1;
      while (true) {
        const { data: slugCheck } = await (admin.from("tenants") as any)
          .select("id")
          .eq("slug", finalSlug)
          .maybeSingle();

        if (!slugCheck) break;
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      // 4. Criação do Tenant com status 'trial_pending'
      const { data: createdTenant, error: tenantErr } = await (admin.from("tenants") as any)
        .insert({
          name: institutionName,
          trade_name: input.tradeName ? input.tradeName.trim() : null,
          slug: finalSlug,
          cnpj: rawCnpj,
          email: adminEmail,
          phone: adminPhone,
          status: "trial_pending",
          plan_tier: "gestao_ead", // Durante o trial, liberamos o plano completo
          settings: {
            created_via: "trial_landing_page",
            admin_name: adminName,
          },
        })
        .select("id, slug, name")
        .single();

      if (tenantErr || !createdTenant) {
        console.error("[TRIAL_REGISTER_ERROR] Falha ao criar tenant:", tenantErr);
        return { success: false, error: "Falha ao registrar a instituição. Tente novamente mais tarde." };
      }

      tenantId = createdTenant.id;
      tenantSlug = createdTenant.slug;
    }

    // 5. Disparo do Convite Nativo via Supabase Auth
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://teoclass.vercel.app";
    const redirectTo = `${appUrl}/app/ativar?tenant_id=${tenantId}`;

    // Dispara convite oficial do Supabase Auth
    // Se o usuário já existir no auth.users, inviteUserByEmail retornará que o usuário já existe
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      adminEmail,
      {
        redirectTo,
        data: {
          tenant_id: tenantId,
          full_name: adminName,
          invited_to: institutionName,
        },
      }
    );

    if (inviteErr) {
      console.warn("[TRIAL_SUPABASE_INVITE_WARN]", inviteErr.message);

      // Se o usuário já existir no Auth, tentamos gerar o link de login mágico/recuperação ou enviar reset
      const isAlreadyRegistered =
        inviteErr.message?.toLowerCase().includes("already registered") ||
        inviteErr.message?.toLowerCase().includes("already exists") ||
        (inviteErr as any).status === 422;

      if (isAlreadyRegistered) {
        // Envia link para redefinir senha e acessar a ativação
        const { error: resetErr } = await admin.auth.resetPasswordForEmail(adminEmail, {
          redirectTo,
        });

        if (resetErr) {
          console.error("[TRIAL_SUPABASE_RESET_FAIL]", resetErr);
          return {
            success: false,
            isResend,
            error: "E-mail já cadastrado no sistema. Não foi possível enviar as instruções de ativação. Entre em contato com o suporte.",
          };
        }
      } else {
        return {
          success: false,
          isResend,
          error: `Falha ao enviar e-mail de ativação via Supabase Auth: ${inviteErr.message}`,
        };
      }
    }

    return {
      success: true,
      tenantSlug,
      isResend,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro inesperado ao registrar teste gratuito.";
    console.error("[REGISTER_TRIAL_FATAL]", errorMsg);
    return { success: false, error: errorMsg };
  }
}
