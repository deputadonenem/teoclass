import { createAdminClient } from "@/lib/supabase/admin";
import { calculateBodyHash } from "./verifier";

export type IdempotencyLockStatus = "acquired" | "replay" | "in_progress" | "tampering_conflict" | "error";

export interface IdempotencyLockResult {
  status: IdempotencyLockStatus;
  recordId?: string;
  cachedResponse?: {
    statusCode: number;
    body: any;
  };
  error?: string;
}

/**
 * Tenta adquirir atomicamente o lock de idempotência para o comando administrativo.
 * 
 * Regras Estritas:
 * 1. Chave única em (key_id, idempotency_key).
 * 2. Se já existe registro:
 *    a) Se o payload_hash for DIFERENTE: Rejeição imediata por ADULTERAÇÃO (tampering_conflict / 409).
 *    b) Se o status for 'completed': Retorna replay com a resposta em cache (sem reexecutar).
 *    c) Se o status for 'processing':
 *       - Se criado há menos de 60 segundos: Retorna 'in_progress' (evita corrida/concorrência paralela).
 *       - Se criado há mais de 60 segundos: Assume timeout/falha do worker anterior e permite recuperação.
 * 3. Se a tabela dedicada 'hub_admin_idempotency' (Migration 0017) ainda não existir no Supabase remoto,
 *    adota fallback seguro e auditável com 'hub_m2m_nonces' (Migration 0016).
 */
export async function acquireAdminIdempotencyLock(params: {
  keyId: string;
  idempotencyKey: string;
  operation: "activate" | "plan" | "status";
  tenantId: string;
  payload: unknown;
  correlationId?: string;
  operatorEmail?: string;
  operatorRole?: string;
}): Promise<IdempotencyLockResult> {
  const {
    keyId,
    idempotencyKey,
    operation,
    tenantId,
    payload,
    correlationId,
    operatorEmail,
    operatorRole,
  } = params;

  if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
    return {
      status: "error",
      error: "X-Hub-Idempotency-Key ausente ou inválida.",
    };
  }

  const cleanKey = idempotencyKey.trim();
  const payloadHash = calculateBodyHash(payload);
  const now = Date.now();
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  const admin = createAdminClient();

  try {
    // 1. Tentar inserção atômica na tabela dedicada hub_admin_idempotency
    const { data: inserted, error: insertError } = await (admin.from("hub_admin_idempotency") as any)
      .insert({
        key_id: keyId,
        idempotency_key: cleanKey,
        operation,
        tenant_id: tenantId,
        payload_hash: payloadHash,
        status: "processing",
        correlation_id: correlationId || null,
        operator_email: operatorEmail || null,
        operator_role: operatorRole || null,
        expires_at: new Date(now + TTL_MS).toISOString(),
      })
      .select("id")
      .single();

    if (!insertError && inserted) {
      return { status: "acquired", recordId: inserted.id };
    }

    // Se o erro for de tabela inexistente (PostgREST schema cache ou 42P01 antes da migration 0017 ser aplicada no remoto), usa fallback
    if (
      insertError &&
      (insertError.code === "42P01" ||
        insertError.code === "PGRST205" ||
        insertError.message?.includes("does not exist") ||
        insertError.message?.includes("Could not find the table") ||
        insertError.message?.includes("schema cache"))
    ) {
      return fallbackAcquireWithNonces({ keyId, idempotencyKey: cleanKey, operation, payloadHash });
    }

    // 2. Se falhou por unicidade (23505), consultar registro existente
    if (insertError && (insertError.code === "23505" || insertError.message?.includes("uq_hub_admin_idempotency_key"))) {
      const { data: existing, error: selectError } = await (admin.from("hub_admin_idempotency") as any)
        .select("id, payload_hash, status, response_status_code, response_body, created_at, updated_at")
        .eq("key_id", keyId)
        .eq("idempotency_key", cleanKey)
        .single();

      if (selectError || !existing) {
        return { status: "error", error: "Falha ao resolver estado de idempotência concorrente." };
      }

      // Regra 1: Mesma chave com payload diferente é violação crítica de integridade
      if (existing.payload_hash !== payloadHash) {
        return {
          status: "tampering_conflict",
          error: "Conflito de Idempotência: Mesma X-Hub-Idempotency-Key reenviada com corpo/parâmetros divergentes.",
        };
      }

      // Regra 2: Concluída com sucesso -> Retornar cache
      if (existing.status === "completed") {
        return {
          status: "replay",
          recordId: existing.id,
          cachedResponse: {
            statusCode: existing.response_status_code || 200,
            body: existing.response_body,
          },
        };
      }

      // Regra 3: Se em processamento há menos de 60 segundos, corrida concorrente ativa
      const createdAtMs = new Date(existing.updated_at || existing.created_at).getTime();
      const ageMs = now - createdAtMs;
      if (existing.status === "processing" && ageMs < 60000) {
        return {
          status: "in_progress",
          error: "Comando em processamento concorrente por outra instância. Aguarde antes de retentar.",
        };
      }

      // Se passou de 60 segundos em processing ou status 'failed', recupera para processar novamente
      const { error: updateError } = await (admin.from("hub_admin_idempotency") as any)
        .update({
          status: "processing",
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        return { status: "error", error: "Falha ao renovar lock de idempotência após timeout." };
      }

      return { status: "acquired", recordId: existing.id };
    }

    return { status: "error", error: insertError?.message || "Erro desconhecido ao adquirir trava de idempotência." };

  } catch (err: any) {
    console.error("[IDEMPOTENCY_ACQUIRE_EXCEPTION]", err);
    return { status: "error", error: err?.message || String(err) };
  }
}

/**
 * Registra a conclusão da operação administrativa gravando o resultado final em cache.
 */
export async function completeAdminIdempotency(params: {
  recordId?: string;
  keyId: string;
  idempotencyKey: string;
  statusCode: number;
  responseBody: any;
}): Promise<void> {
  const admin = createAdminClient();
  try {
    if (params.recordId) {
      await (admin.from("hub_admin_idempotency") as any)
        .update({
          status: "completed",
          response_status_code: params.statusCode,
          response_body: params.responseBody,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.recordId);
    } else {
      await (admin.from("hub_admin_idempotency") as any)
        .update({
          status: "completed",
          response_status_code: params.statusCode,
          response_body: params.responseBody,
          updated_at: new Date().toISOString(),
        })
        .eq("key_id", params.keyId)
        .eq("idempotency_key", params.idempotencyKey.trim());
    }
  } catch (err: any) {
    console.warn("[IDEMPOTENCY_COMPLETE_WARNING] Falha ao registrar cache de idempotência:", err?.message || err);
  }
}

/**
 * Libera ou marca como falha a chave de idempotência caso ocorra erro transitório,
 * garantindo que a requisição permaneça retentável.
 */
export async function releaseAdminIdempotency(params: {
  recordId?: string;
  keyId: string;
  idempotencyKey: string;
  operation?: string;
}): Promise<void> {
  const admin = createAdminClient();
  try {
    if (params.recordId) {
      await (admin.from("hub_admin_idempotency") as any)
        .delete()
        .eq("id", params.recordId);
    } else {
      await (admin.from("hub_admin_idempotency") as any)
        .delete()
        .eq("key_id", params.keyId)
        .eq("idempotency_key", params.idempotencyKey.trim());
    }

    // Fallback cleanup na hub_m2m_nonces caso tenha sido usado
    if (params.operation) {
      const fallbackNonce = `idemp:${params.operation}:${params.idempotencyKey.trim()}`;
      await (admin.from("hub_m2m_nonces") as any)
        .delete()
        .eq("nonce", fallbackNonce)
        .eq("key_id", params.keyId);
    }
  } catch (err: any) {
    console.warn("[IDEMPOTENCY_RELEASE_WARNING] Falha ao liberar trava de idempotência:", err?.message || err);
  }
}

/**
 * Fallback compatível com a Migration 0016 (hub_m2m_nonces) caso 0017 ainda não esteja aplicada.
 */
async function fallbackAcquireWithNonces(params: {
  keyId: string;
  idempotencyKey: string;
  operation: string;
  payloadHash: string;
}): Promise<IdempotencyLockResult> {
  const admin = createAdminClient();
  const nonceKey = `idemp:${params.operation}:${params.idempotencyKey}:${params.payloadHash.slice(0, 16)}`;
  const now = Date.now();
  const TTL_MS = 24 * 60 * 60 * 1000;

  try {
    // 1. Verificar se existe registro prévio com o prefixo da chave para detecção de conflito/tampering
    const prefix = `idemp:${params.operation}:${params.idempotencyKey}:`;
    const { data: existingNonces } = await (admin.from("hub_m2m_nonces") as any)
      .select("nonce")
      .eq("key_id", params.keyId)
      .like("nonce", `${prefix}%`);

    if (existingNonces && existingNonces.length > 0) {
      const match = existingNonces.find((n: any) => n.nonce === nonceKey);
      if (match) {
        return {
          status: "replay",
          cachedResponse: {
            statusCode: 200,
            body: {
              success: true,
              idempotent: true,
              message: "Operação já executada anteriormente (idempotent replay via fallback).",
            },
          },
        };
      } else {
        // Mesma chave com payload hash divergente!
        return {
          status: "tampering_conflict",
          error: "Conflito de Idempotência: Mesma X-Hub-Idempotency-Key reenviada com corpo/parâmetros divergentes.",
        };
      }
    }

    const { error } = await (admin.from("hub_m2m_nonces") as any).insert({
      key_id: params.keyId,
      nonce: nonceKey,
      request_timestamp: Math.floor(now / 1000),
      expires_at: new Date(now + TTL_MS).toISOString(),
    });

    if (!error) {
      return { status: "acquired" };
    }

    if (error.code === "23505" || error.message?.includes("uq_hub_m2m_nonces_key_nonce")) {
      return {
        status: "replay",
        cachedResponse: {
          statusCode: 200,
          body: {
            success: true,
            idempotent: true,
            message: "Operação já executada anteriormente (idempotent replay via fallback).",
          },
        },
      };
    }

    return { status: "error", error: error.message };
  } catch (err: any) {
    return { status: "error", error: err?.message || String(err) };
  }
}
