"use server";

import { revalidatePath } from "next/cache";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { AsaasClient, type AsaasEnvironment } from "@/lib/financeiro/asaas_client";
import {
  getSafeTenantGatewayConfig,
  saveTenantGatewayConfig,
  toggleTenantGatewayActive,
  removeTenantGatewayConfig,
  getDecryptedGatewayApiKey,
  type SafeTenantGatewaySummary,
} from "@/lib/financeiro/gateway_vault";

/**
 * Server Actions para Configuração Opcional do Gateway Asaas da Escola (Lote 15 - Fase 2)
 * 
 * Regras e Invariantes de Segurança:
 * 1. Somente administradores da escola (role: 'admin') podem ler ou modificar.
 * 2. Validação rigorosa de tenant no servidor (requireTenantSession) antes de qualquer chamada service_role.
 * 3. Chaves e tokens completos nunca são expostos no retorno ou em logs.
 * 4. Teste de conexão não-destrutivo: apenas consulta a conta no Asaas sem cobranças.
 */

export interface TestAsaasConnectionInput {
  apiKey: string;
  environment: AsaasEnvironment;
}

export interface SaveAsaasConfigInput {
  apiKey: string;
  environment: AsaasEnvironment;
  isActive: boolean;
  webhookAccessToken?: string;
}

/**
 * Obtém a configuração pública/mascarada do gateway Asaas da instituição.
 */
export async function getSchoolGatewayConfigAction(): Promise<{
  data: SafeTenantGatewaySummary | null;
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();

    // Apenas Admin institucional tem acesso às configurações de gateway
    if (session.role !== "admin") {
      return { data: null, error: "Acesso negado: apenas administradores podem acessar configurações de pagamento." };
    }

    const summary = await getSafeTenantGatewayConfig(session.tenant.id, "asaas");
    return { data: summary, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Falha ao carregar configuração de pagamentos." };
  }
}

/**
 * Testa a conexão com o Asaas antes de salvar ou utilizando a chave informada.
 * Operação 100% não-destrutiva: não move dinheiro nem gera faturas.
 */
export async function testAsaasConnectionAction(
  input: TestAsaasConnectionInput
): Promise<{
  success: boolean;
  accountName?: string;
  error?: string;
}> {
  try {
    const session = await requireTenantSession();

    if (session.role !== "admin") {
      return { success: false, error: "Acesso negado: apenas administradores podem testar conexão de pagamentos." };
    }

    if (!input.apiKey || input.apiKey.trim().length < 8) {
      return { success: false, error: "Chave de API do Asaas inválida ou não informada." };
    }

    const client = new AsaasClient({
      apiKey: input.apiKey.trim(),
      environment: input.environment,
    });

    const pingResult = await client.ping();

    if (!pingResult.success) {
      return {
        success: false,
        error: pingResult.error || "Falha ao autenticar com a API do Asaas. Verifique a chave e o ambiente.",
      };
    }

    return {
      success: true,
      accountName: pingResult.account?.name || "Conta Asaas Conectada",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro inesperado ao testar conexão Asaas." };
  }
}

/**
 * Testa a conexão utilizando a credencial já salva no cofre do tenant.
 */
export async function testSavedAsaasConnectionAction(): Promise<{
  success: boolean;
  accountName?: string;
  error?: string;
}> {
  try {
    const session = await requireTenantSession();

    if (session.role !== "admin") {
      return { success: false, error: "Acesso negado: apenas administradores podem testar conexão de pagamentos." };
    }

    const savedCreds = await getDecryptedGatewayApiKey(session.tenant.id, "asaas");
    if (!savedCreds) {
      return { success: false, error: "Nenhuma credencial do Asaas configurada ou ativa neste tenant." };
    }

    const client = new AsaasClient({
      apiKey: savedCreds.apiKey,
      environment: savedCreds.environment,
    });

    const pingResult = await client.ping();
    if (!pingResult.success) {
      return {
        success: false,
        error: pingResult.error || "Falha ao conectar com o Asaas usando a credencial salva.",
      };
    }

    return {
      success: true,
      accountName: pingResult.account?.name || "Conta Asaas Ativa",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao verificar conexão salva do Asaas." };
  }
}

/**
 * Salva ou substitui com segurança as credenciais Asaas no cofre criptografado.
 */
export async function saveSchoolGatewayConfigAction(
  input: SaveAsaasConfigInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await requireTenantSession();

    if (session.role !== "admin") {
      return { success: false, error: "Acesso negado: apenas administradores podem alterar configurações de pagamento." };
    }

    if (!input.apiKey || input.apiKey.trim().length < 8) {
      return { success: false, error: "Chave de API do Asaas inválida." };
    }

    // Valida conexão com o Asaas antes de salvar para evitar salvar credencial inválida
    const client = new AsaasClient({
      apiKey: input.apiKey.trim(),
      environment: input.environment,
    });

    const pingResult = await client.ping();
    if (!pingResult.success) {
      return {
        success: false,
        error: `Não foi possível validar a chave com o Asaas: ${pingResult.error}`,
      };
    }

    const saveResult = await saveTenantGatewayConfig(session.tenant.id, {
      provider: "asaas",
      environment: input.environment,
      api_key: input.apiKey.trim(),
      webhook_access_token: input.webhookAccessToken?.trim() || undefined,
      is_active: input.isActive,
      ...(pingResult.account?.accountNumber ? { account_number: pingResult.account.accountNumber } : {}),
      ...(pingResult.account?.walletId ? { wallet_id: pingResult.account.walletId } : {}),
    });

    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "GATEWAY_CONFIG_UPDATED",
      resourceType: "tenant_gateway_configs",
      details: {
        provider: "asaas",
        environment: input.environment,
        isActive: input.isActive,
      },
    });

    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao salvar configuração do Asaas." };
  }
}

/**
 * Alterna o status (Ativo/Inativo) da integração Asaas da escola.
 */
export async function toggleSchoolGatewayStatusAction(
  isActive: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await requireTenantSession();

    if (session.role !== "admin") {
      return { success: false, error: "Acesso negado: apenas administradores podem alterar status do gateway." };
    }

    const res = await toggleTenantGatewayActive(session.tenant.id, isActive, "asaas");
    if (!res.success) {
      return { success: false, error: res.error };
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: isActive ? "GATEWAY_ACTIVATED" : "GATEWAY_DEACTIVATED",
      resourceType: "tenant_gateway_configs",
      details: { provider: "asaas", isActive },
    });

    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao alternar status da integração." };
  }
}

/**
 * Desconecta e remove as credenciais do Asaas do cofre da instituição.
 */
export async function disconnectSchoolGatewayAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await requireTenantSession();

    if (session.role !== "admin") {
      return { success: false, error: "Acesso negado: apenas administradores podem desconectar o gateway." };
    }

    const res = await removeTenantGatewayConfig(session.tenant.id, "asaas");
    if (!res.success) {
      return { success: false, error: res.error };
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "GATEWAY_DISCONNECTED",
      resourceType: "tenant_gateway_configs",
      details: { provider: "asaas" },
    });

    revalidatePath("/app/configuracoes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Falha ao desconectar Asaas." };
  }
}
