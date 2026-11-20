import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptGatewaySecret,
  decryptGatewaySecret,
  maskGatewayApiKey,
} from "./crypto";
import type {
  TenantGatewayConfig,
  TenantGatewayConfigInput,
  GatewayProvider,
} from "@/types/financeiro";

/**
 * Serviço de Gerenciamento do Cofre de Credenciais de Gateway
 * 
 * Regras Estritas:
 * 1. Usa createAdminClient() para contornar o bloqueio total do PostgREST.
 * 2. Jamais expõe a chave descriptografada em logs ou retornos ao frontend.
 * 3. Chave bruta nunca trafega para o cliente após ser salva.
 */

export interface SafeTenantGatewaySummary {
  isConfigured: boolean;
  provider: GatewayProvider;
  isActive: boolean;
  environment: "sandbox" | "production";
  apiKeyLastFour: string | null;
  accountNumber: string | null;
  updatedAt: string | null;
}

/**
 * Consulta a configuração pública/segura do gateway para o tenant (sem segredos).
 */
export async function getSafeTenantGatewayConfig(
  tenantId: string,
  provider: GatewayProvider = "asaas"
): Promise<SafeTenantGatewaySummary> {
  const admin = createAdminClient();

  const { data, error } = await (admin.from("tenant_gateway_configs") as any)
    .select("id, provider, is_active, environment, api_key_last_four, account_number, updated_at")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) {
    return {
      isConfigured: false,
      provider,
      isActive: false,
      environment: "sandbox",
      apiKeyLastFour: null,
      accountNumber: null,
      updatedAt: null,
    };
  }

  return {
    isConfigured: true,
    provider: data.provider,
    isActive: data.is_active,
    environment: data.environment,
    apiKeyLastFour: data.api_key_last_four,
    accountNumber: data.account_number,
    updatedAt: data.updated_at,
  };
}

/**
 * Salva com segurança as credenciais criptografadas de um tenant.
 */
export async function saveTenantGatewayConfig(
  tenantId: string,
  input: TenantGatewayConfigInput
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!input.api_key || input.api_key.trim().length < 8) {
      return { success: false, error: "Chave de API do gateway inválida ou muito curta." };
    }

    const cleanApiKey = input.api_key.trim();
    const apiKeyEncrypted = encryptGatewaySecret(cleanApiKey);
    const apiKeyLastFour = maskGatewayApiKey(cleanApiKey);

    let webhookTokenEncrypted: string | null = null;
    if (input.webhook_access_token && input.webhook_access_token.trim().length > 0) {
      webhookTokenEncrypted = encryptGatewaySecret(input.webhook_access_token.trim());
    }

    const admin = createAdminClient();

    const { error } = await (admin.from("tenant_gateway_configs") as any).upsert(
      {
        tenant_id: tenantId,
        provider: input.provider || "asaas",
        is_active: input.is_active ?? false,
        environment: input.environment,
        api_key_encrypted: apiKeyEncrypted,
        api_key_last_four: apiKeyLastFour,
        webhook_access_token_encrypted: webhookTokenEncrypted,
        account_number: (input as any).account_number || null,
        wallet_id: (input as any).wallet_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider" }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao cifrar e salvar credencial de gateway." };
  }
}

/**
 * Ativa ou desativa a integração de gateway do tenant com segurança.
 */
export async function toggleTenantGatewayActive(
  tenantId: string,
  isActive: boolean,
  provider: GatewayProvider = "asaas"
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await (admin.from("tenant_gateway_configs") as any)
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("provider", provider);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao alternar status do gateway." };
  }
}

/**
 * Remove/Desconecta totalmente a configuração de gateway de um tenant.
 */
export async function removeTenantGatewayConfig(
  tenantId: string,
  provider: GatewayProvider = "asaas"
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await (admin.from("tenant_gateway_configs") as any)
      .delete()
      .eq("tenant_id", tenantId)
      .eq("provider", provider);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao remover configuração de gateway." };
  }
}

/**
 * Recupera internamente a chave de API decifrada para operações server-side (privado/M2M).
 * NUNCA invocar este método para responder requisições de frontend!
 */
export async function getDecryptedGatewayApiKey(
  tenantId: string,
  provider: GatewayProvider = "asaas"
): Promise<{ apiKey: string; environment: "sandbox" | "production" } | null> {
  const admin = createAdminClient();

  const { data, error } = await (admin.from("tenant_gateway_configs") as any)
    .select("api_key_encrypted, environment, is_active")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data || !data.is_active || !data.api_key_encrypted) {
    return null;
  }

  const apiKey = decryptGatewaySecret(data.api_key_encrypted);
  return {
    apiKey,
    environment: data.environment,
  };
}

/**
 * Validação de Token de Webhook do Asaas (Mecanismo Oficial a ser verificado na Fase 3).
 * No Asaas, o webhook envia o token fixo configurado pela escola via header `asaas-access-token`.
 */
export async function verifyAsaasWebhookToken(
  tenantId: string,
  receivedHeaderToken: string
): Promise<boolean> {
  if (!receivedHeaderToken) return false;

  const admin = createAdminClient();
  const { data, error } = await (admin.from("tenant_gateway_configs") as any)
    .select("webhook_access_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (error || !data || !data.webhook_access_token_encrypted) {
    return false;
  }

  const expectedToken = decryptGatewaySecret(data.webhook_access_token_encrypted);
  return expectedToken === receivedHeaderToken.trim();
}
