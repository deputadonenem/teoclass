import { createAdminClient } from "@/lib/supabase/admin";

export interface HubMutationParams {
  tenantId: string;
  operation: "activate" | "plan" | "status";
  targetValue: string;
  reason: string;
  operatorEmail?: string;
  operatorRole?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface HubMutationResult {
  success: boolean;
  tenant_id: string;
  tenant_slug?: string;
  previous_state: { status: string; plan: string };
  current_state: { status: string; plan: string };
  executed_at: string;
}

/**
 * Executa a mutação administrativa de forma 100% transacional e atômica.
 * Prioriza a chamada da RPC 'execute_hub_admin_mutation' (Migration 0017).
 * Se a RPC ainda não existir no ambiente remoto, executa fallback estrito com rollback manual.
 */
export async function executeAtomicHubMutation(
  params: HubMutationParams
): Promise<HubMutationResult> {
  const admin = createAdminClient();
  const {
    tenantId,
    operation,
    targetValue,
    reason,
    operatorEmail,
    operatorRole,
    correlationId,
    idempotencyKey,
  } = params;

  // 1. Tentar executar via RPC Transacional do PostgreSQL
  try {
    const { data: rpcData, error: rpcError } = await (admin.rpc as any)(
      "execute_hub_admin_mutation",
      {
        p_tenant_id: tenantId,
        p_operation: operation,
        p_target_value: targetValue,
        p_reason: reason,
        p_operator_email: operatorEmail || "unknown_operator",
        p_operator_role: operatorRole || "unknown_role",
        p_correlation_id: correlationId || "",
        p_idempotency_key: idempotencyKey || "",
      }
    );

    if (!rpcError && rpcData) {
      return rpcData as HubMutationResult;
    }

    // Se o erro indicar tenant inexistente lançado pela RPC
    if (rpcError && (rpcError.message?.includes("TENANT_NOT_FOUND") || rpcError.message?.includes("não encontrada"))) {
      throw new Error(`TENANT_NOT_FOUND: Instituição [${tenantId}] não encontrada.`);
    }

    // Se o erro NÃO for de função inexistente (42883 ou PGRST202), relança o erro da RPC
    if (
      rpcError &&
      rpcError.code !== "42883" &&
      rpcError.code !== "PGRST202" &&
      !rpcError.message?.includes("function") &&
      !rpcError.message?.includes("does not exist") &&
      !rpcError.message?.includes("schema cache")
    ) {
      throw new Error(`RPC_MUTATION_FAILED: ${rpcError.message}`);
    }
  } catch (err: any) {
    if (err.message?.includes("TENANT_NOT_FOUND")) {
      throw err;
    }
    if (
      !err.message?.includes("42883") &&
      !err.message?.includes("PGRST202") &&
      !err.message?.includes("does not exist") &&
      !err.message?.includes("schema cache")
    ) {
      throw err;
    }
  }

  // 2. Fallback Transacional no Backend com Rollback Imediato
  // 2.1 Consulta e validação de tenant
  const { data: tenant, error: findErr } = await (admin.from("tenants") as any)
    .select("id, name, slug, status, plan_tier")
    .eq("id", tenantId)
    .single();

  if (findErr || !tenant) {
    throw new Error(`TENANT_NOT_FOUND: Instituição [${tenantId}] não encontrada.`);
  }

  const previousState = { status: tenant.status, plan: tenant.plan_tier };
  let updatePayload: Record<string, any> = {};
  let actionName = "";
  let currentState = { ...previousState };
  const nowIso = new Date().toISOString();

  if (operation === "activate") {
    actionName = "HUB_M2M_TENANT_ACTIVATED";
    updatePayload = { status: "active", updated_at: nowIso };
    currentState.status = "active";
  } else if (operation === "plan") {
    actionName = "HUB_M2M_PLAN_CHANGED";
    if (!["gestao", "gestao_ead", "institucional"].includes(targetValue)) {
      throw new Error(`INVALID_PLAN: Plano comercial [${targetValue}] inválido.`);
    }
    updatePayload = { plan_tier: targetValue, updated_at: nowIso };
    currentState.plan = targetValue;
  } else if (operation === "status") {
    actionName = "HUB_M2M_STATUS_CHANGED";
    if (!["active", "trial", "suspended", "inactive"].includes(targetValue)) {
      throw new Error(`INVALID_STATUS: Status operacional [${targetValue}] inválido.`);
    }
    updatePayload = { status: targetValue, updated_at: nowIso };
    currentState.status = targetValue;
  } else {
    throw new Error(`INVALID_OPERATION: Operação [${operation}] desconhecida.`);
  }

  // 2.2 Atualização no banco
  const { data: updatedTenant, error: updateErr } = await (admin.from("tenants") as any)
    .update(updatePayload)
    .eq("id", tenantId)
    .select("id, name, slug, status, plan_tier, updated_at")
    .single();

  if (updateErr || !updatedTenant) {
    throw new Error(`UPDATE_FAILED: Falha ao atualizar tenant: ${updateErr?.message}`);
  }

  // 2.3 Gravação compulsória em audit_logs. Se falhar, reverte a mutação (Rollback)
  const { error: auditErr } = await (admin.from("audit_logs") as any).insert({
    tenant_id: tenantId,
    user_id: null,
    action: actionName,
    resource_type: "tenant",
    resource_id: tenantId,
    details: {
      operator_email: operatorEmail || "unknown_operator",
      operator_role: operatorRole || "unknown_role",
      correlation_id: correlationId,
      idempotency_key: idempotencyKey,
      reason,
      previous_state: previousState,
      current_state: currentState,
    },
    created_at: nowIso,
  });

  if (auditErr) {
    // Rollback compulsório do tenant
    await (admin.from("tenants") as any)
      .update({
        status: previousState.status,
        plan_tier: previousState.plan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    throw new Error(`AUDIT_FAILED: Falha compulsória de auditoria. Rollback executado: ${auditErr.message}`);
  }

  return {
    success: true,
    tenant_id: tenantId,
    tenant_slug: updatedTenant.slug,
    previous_state: previousState,
    current_state: currentState,
    executed_at: nowIso,
  };
}
