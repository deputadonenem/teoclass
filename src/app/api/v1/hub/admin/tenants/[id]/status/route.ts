import { NextRequest, NextResponse } from "next/server";
import {
  extractHubM2MHeaders,
  validateHubM2MRequest,
  validateOperatorRole,
} from "@/lib/hub/verifier";
import {
  acquireAdminIdempotencyLock,
  completeAdminIdempotency,
  releaseAdminIdempotency,
} from "@/lib/hub/idempotency";
import { executeAtomicHubMutation } from "@/lib/hub/mutation_service";

export const dynamic = "force-dynamic";

export const VALID_TENANT_STATUSES = ["active", "trial", "suspended", "inactive"] as const;
export type ValidTenantStatus = (typeof VALID_TENANT_STATUSES)[number];

function normalizeTenantStatus(statusInput: string): ValidTenantStatus | null {
  const s = statusInput.toLowerCase().trim();
  if (s === "active") return "active";
  if (s === "trial") return "trial";
  if (s === "suspended") return "suspended";
  if (s === "inactive" || s === "canceled" || s === "cancelled") return "inactive";
  return null;
}

/**
 * POST /api/v1/hub/admin/tenants/[id]/status
 * Gestão de ciclo de vida e suspensão/reativação administrativa pelo Alcântara Hub.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { id } = await context.params;
  const url = new URL(req.url);
  const path = url.pathname;

  // 1. Extração e Validação Criptográfica M2M
  const headers = extractHubM2MHeaders(req);
  const authResult = await validateHubM2MRequest({
    ...headers,
    method: "POST",
    path,
    body,
  });

  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error || "Acesso negado: falha na autenticação M2M." },
      { status: authResult.statusCode || 401 }
    );
  }

  // 2. Validação de Autorização do Operador (Mutação)
  const roleCheck = validateOperatorRole(headers.operatorRole, true, headers.operatorEmail);
  if (!roleCheck.authorized) {
    return NextResponse.json(
      { error: roleCheck.reason },
      { status: 403 }
    );
  }

  // 3. Validação de Parâmetros
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "ID da instituição é obrigatório." },
      { status: 400 }
    );
  }

  const rawStatus = String(body.status || body.subscription_status || "").trim();
  const normalizedStatus = normalizeTenantStatus(rawStatus);

  if (!normalizedStatus) {
    return NextResponse.json(
      {
        error: `Status operacional inválido. Valores aceitos: ${VALID_TENANT_STATUSES.join(", ")} (ou 'canceled').`,
      },
      { status: 400 }
    );
  }

  const idempotencyKey = headers.idempotencyKey || body.idempotency_key;
  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      { error: "X-Hub-Idempotency-Key é obrigatório para alteração de status." },
      { status: 400 }
    );
  }

  // 4. Aquisição de Lock de Idempotência
  const lockResult = await acquireAdminIdempotencyLock({
    keyId: headers.keyId,
    idempotencyKey,
    operation: "status",
    tenantId: id,
    payload: body,
    correlationId: headers.correlationId,
    operatorEmail: headers.operatorEmail,
    operatorRole: headers.operatorRole,
  });

  if (lockResult.status === "tampering_conflict") {
    return NextResponse.json(
      { error: lockResult.error },
      { status: 409 }
    );
  }

  if (lockResult.status === "in_progress") {
    return NextResponse.json(
      { error: lockResult.error },
      { status: 429 }
    );
  }

  if (lockResult.status === "replay") {
    return NextResponse.json(
      lockResult.cachedResponse?.body || {
        success: true,
        idempotent: true,
        message: "Operação já executada anteriormente (idempotent replay).",
        tenant_id: id,
      },
      { status: lockResult.cachedResponse?.statusCode || 200 }
    );
  }

  if (lockResult.status === "error") {
    return NextResponse.json(
      { error: lockResult.error || "Erro ao processar trava de idempotência." },
      { status: 500 }
    );
  }

  const reason = String(body.reason || `Transição de status para [${normalizedStatus}] pelo Alcântara Hub`).trim();

  try {
    // 5. Execução Atômica de Mutação e Trilha de Auditoria
    const mutationResult = await executeAtomicHubMutation({
      tenantId: id,
      operation: "status",
      targetValue: normalizedStatus,
      reason,
      operatorEmail: headers.operatorEmail,
      operatorRole: headers.operatorRole,
      correlationId: headers.correlationId,
      idempotencyKey,
    });

    const responsePayload = {
      success: true,
      idempotent: false,
      message: `Status da instituição alterado para [${normalizedStatus}] com sucesso pelo Alcântara Hub.`,
      tenant_id: id,
      tenant_slug: mutationResult.tenant_slug,
      previous_state: mutationResult.previous_state,
      current_state: mutationResult.current_state,
      executed_at: mutationResult.executed_at,
    };

    // 6. Gravação de Conclusão na Tabela de Idempotência
    await completeAdminIdempotency({
      recordId: lockResult.recordId,
      keyId: headers.keyId,
      idempotencyKey,
      statusCode: 200,
      responseBody: responsePayload,
    });

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (err: any) {
    await releaseAdminIdempotency({
      recordId: lockResult.recordId,
      keyId: headers.keyId,
      idempotencyKey,
      operation: `status:${id}`,
    });

    const isNotFound = err.message?.includes("TENANT_NOT_FOUND");
    const statusCode = isNotFound ? 404 : 500;

    return NextResponse.json(
      { error: err.message || "Erro interno ao processar alteração de status." },
      { status: statusCode }
    );
  }
}
