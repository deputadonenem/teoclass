import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface HubSignatureParams {
  keyId: string;
  timestampStr: string;
  nonce: string;
  signature: string;
  method: string;
  path: string; // Ex: /api/v1/hub/telemetry ou /api/v1/hub/admin/tenants
  body?: unknown;
  correlationId?: string;
  idempotencyKey?: string;
  operatorEmail?: string;
  operatorRole?: string;
}

export interface HubAuthValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  keyId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  operatorEmail?: string;
  operatorRole?: string;
}

/**
 * Papéis permitidos para operações corporativas do Hub.
 * Super Admin e Financeiro possuem alçada operacional de mutação; executivo e auditor apenas leitura.
 */
export const ALLOWED_OPERATOR_ROLES = ["super_admin", "financeiro", "executivo", "auditor", "admin", "operador"] as const;
export type HubOperatorRole = (typeof ALLOWED_OPERATOR_ROLES)[number];

export const MUTATION_OPERATOR_ROLES = ["super_admin", "financeiro", "admin"] as const;

/**
 * Canonicalização determinística de query strings ordenando por chave e valor.
 */
export function canonicalizeQueryString(searchParams: URLSearchParams | string): string {
  const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
  const entries: [string, string][] = [];

  params.forEach((value, key) => {
    entries.push([key, value]);
  });

  if (entries.length === 0) return "";

  entries.sort(([k1, v1], [k2, v2]) => {
    const kCmp = k1.localeCompare(k2);
    return kCmp !== 0 ? kCmp : v1.localeCompare(v2);
  });

  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/**
 * Gera path canônico com query string ordenada.
 */
export function getCanonicalPath(pathname: string, searchParams?: URLSearchParams | string): string {
  if (!searchParams) return pathname;
  const canonicalQuery = canonicalizeQueryString(searchParams);
  return canonicalQuery ? `${pathname}?${canonicalQuery}` : pathname;
}

/**
 * Canonicalização recursiva de JSON ordenando as chaves alfabeticamente.
 * Garante hash determinístico independente da ordem de serialização.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ":" + canonicalizeJson(val);
  });

  return "{" + pairs.join(",") + "}";
}

/**
 * Calcula o SHA-256 do corpo canonicalizado em hex.
 */
export function calculateBodyHash(body: unknown): string {
  if (body === undefined || body === null || body === "") {
    return crypto.createHash("sha256").update("").digest("hex");
  }
  const canonical = canonicalizeJson(body);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Constrói a mensagem canônica para assinatura HMAC-SHA256 no formato standard do Hub:
 * - Sem corpo: timestamp:nonce:METHOD:path
 * - Com corpo: timestamp:nonce:METHOD:path:bodyHash
 */
export function buildHubCanonicalMessage(
  timestamp: string,
  nonce: string,
  method: string,
  path: string,
  body?: unknown
): string {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (body !== undefined && body !== null && (typeof body !== "string" || body.trim().length > 0)) {
    const bodyHash = calculateBodyHash(body);
    return `${timestamp}:${nonce}:${normalizedMethod}:${normalizedPath}:${bodyHash}`;
  }

  return `${timestamp}:${nonce}:${normalizedMethod}:${normalizedPath}`;
}

/**
 * Constrói a mensagem canônica no formato estendido do Hub (adotado pelo AdminM2MClient em comandos corporativos):
 * payloadToSign = [
 *   timestamp,
 *   nonce,
 *   correlationId,
 *   idempotencyKey || '',
 *   method.toUpperCase(),
 *   path,
 *   bodyHash
 * ].join(':')
 */
export function buildHubExtendedCanonicalMessage(
  timestamp: string,
  nonce: string,
  correlationId: string,
  idempotencyKey: string,
  method: string,
  path: string,
  body?: unknown
): string {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const bodyHash = calculateBodyHash(body);

  return [
    timestamp,
    nonce,
    correlationId || "",
    idempotencyKey || "",
    normalizedMethod,
    normalizedPath,
    bodyHash,
  ].join(":");
}

/**
 * Gera a assinatura HMAC-SHA256 em hex.
 */
export function generateHubHmacSignature(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/**
 * Comparação em tempo constante contra Timing Attacks.
 */
export function safeCompareSignatures(expected: string, received: string): boolean {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  // Limpa prefixo 'sha256=' caso enviado
  const cleanReceived = received.startsWith("sha256=") ? received.slice(7) : received;
  const cleanExpected = expected.startsWith("sha256=") ? expected.slice(7) : expected;

  const bufA = Buffer.from(cleanExpected.toLowerCase(), "utf8");
  const bufB = Buffer.from(cleanReceived.toLowerCase(), "utf8");

  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extrai todos os cabeçalhos M2M e operador de uma requisição NextRequest / Request.
 */
export function extractHubM2MHeaders(req: Request) {
  const headers = req.headers;
  return {
    keyId: headers.get("x-hub-key-id") || headers.get("X-Hub-Key-Id") || "",
    timestampStr: headers.get("x-hub-timestamp") || headers.get("X-Hub-Timestamp") || "",
    nonce: headers.get("x-hub-nonce") || headers.get("X-Hub-Nonce") || "",
    signature: headers.get("x-hub-signature") || headers.get("X-Hub-Signature") || "",
    correlationId: headers.get("x-hub-correlation-id") || headers.get("X-Hub-Correlation-Id") || "",
    idempotencyKey: headers.get("x-hub-idempotency-key") || headers.get("X-Hub-Idempotency-Key") || "",
    operatorEmail: headers.get("x-hub-operator-email") || headers.get("X-Hub-Operator-Email") || "",
    operatorRole: headers.get("x-hub-operator-role") || headers.get("X-Hub-Operator-Role") || "",
  };
}

/**
 * Validador de Segurança M2M com Alcântara Hub (Fail-Closed).
 * 
 * Regras Estritas:
 * 1. Headers obrigatórios: X-Hub-Key-Id, X-Hub-Timestamp, X-Hub-Nonce, X-Hub-Signature.
 * 2. Janela máxima de tolerância: 300 segundos (5 minutos) contra relógio do servidor.
 * 3. Validação do Key-Id contra HUB_M2M_CLIENT_ID / HUB_M2M_ADMIN_KEY_ID e segredo correspondente.
 * 4. Validação HMAC-SHA256 suportando de forma transparente os contratos standard e extended do Hub.
 * 5. Registro e unicidade do Nonce em public.hub_m2m_nonces (anti-replay estrito de transporte).
 */
export async function validateHubM2MRequest(
  params: HubSignatureParams
): Promise<HubAuthValidationResult> {
  const {
    keyId,
    timestampStr,
    nonce,
    signature,
    method,
    path,
    body,
    correlationId,
    idempotencyKey,
    operatorEmail,
    operatorRole,
  } = params;

  // 1. Fail-closed: Headers obrigatórios
  if (!keyId || !timestampStr || !nonce || !signature) {
    return {
      valid: false,
      statusCode: 401,
      error: "Cabeçalhos M2M obrigatórios ausentes (X-Hub-Key-Id, X-Hub-Timestamp, X-Hub-Nonce, X-Hub-Signature).",
    };
  }

  // 2. Validação da Janela de Tempo (300 segundos)
  const reqTimestampSec = parseInt(timestampStr, 10);
  if (isNaN(reqTimestampSec) || reqTimestampSec <= 0) {
    return {
      valid: false,
      statusCode: 401,
      error: "X-Hub-Timestamp inválido (esperado timestamp numérico Unix em segundos).",
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const timeDifferenceSec = Math.abs(nowSec - reqTimestampSec);
  const MAX_TOLERANCE_SECONDS = 300;

  if (timeDifferenceSec > MAX_TOLERANCE_SECONDS) {
    return {
      valid: false,
      statusCode: 401,
      error: `Timestamp fora da janela permitida (diferença de ${timeDifferenceSec}s; máximo de ${MAX_TOLERANCE_SECONDS}s).`,
    };
  }

  // 3. Validação de Configuração do Servidor e Segredo M2M
  const configuredKeyId =
    process.env.HUB_M2M_CLIENT_ID ||
    process.env.HUB_M2M_ADMIN_KEY_ID ||
    process.env.ALCANTARA_HUB_ADMIN_KEY_ID;

  const configuredSecret =
    process.env.HUB_WEBHOOK_SECRET ||
    process.env.HUB_M2M_CLIENT_SECRET ||
    process.env.HUB_M2M_ADMIN_SECRET_KEY ||
    process.env.ALCANTARA_HUB_ADMIN_SECRET_KEY;

  if (!configuredKeyId || !configuredSecret) {
    return {
      valid: false,
      statusCode: 503,
      error: "Autenticação M2M não configurada no servidor (chaves do Alcântara Hub ausentes).",
    };
  }

  if (keyId !== configuredKeyId) {
    return {
      valid: false,
      statusCode: 401,
      error: "Identificador X-Hub-Key-Id desconhecido ou não autorizado.",
    };
  }

  // 4. Verificação Criptográfica da Assinatura HMAC (Suporte bi-direcional standard e extended)
  // Formato Standard Hub: `${timestamp}:${nonce}:${METHOD}:${path}[:${bodyHash}]`
  const canonicalMessageStandard = buildHubCanonicalMessage(timestampStr, nonce, method, path, body);
  const expectedSigStandard = generateHubHmacSignature(configuredSecret, canonicalMessageStandard);
  let isSignatureValid = safeCompareSignatures(expectedSigStandard, signature);

  // Formato Extended Hub: `${timestamp}:${nonce}:${correlationId}:${idempotencyKey}:${METHOD}:${path}:${bodyHash}`
  if (!isSignatureValid) {
    const canonicalMessageExt = buildHubExtendedCanonicalMessage(
      timestampStr,
      nonce,
      correlationId || "",
      idempotencyKey || "",
      method,
      path,
      body
    );
    const expectedSigExt = generateHubHmacSignature(configuredSecret, canonicalMessageExt);
    if (safeCompareSignatures(expectedSigExt, signature)) {
      isSignatureValid = true;
    }
  }

  if (!isSignatureValid) {
    return {
      valid: false,
      statusCode: 401,
      error: "Assinatura digital X-Hub-Signature inválida.",
    };
  }

  // 5. Anti-Replay de Transporte: Verificação e Persistência atômica do Nonce em hub_m2m_nonces
  try {
    const admin = createAdminClient();
    const expiresAt = new Date((reqTimestampSec + MAX_TOLERANCE_SECONDS + 60) * 1000).toISOString();

    const { error: nonceError } = await (admin.from("hub_m2m_nonces") as any).insert({
      key_id: keyId,
      nonce,
      request_timestamp: reqTimestampSec,
      expires_at: expiresAt,
    });

    if (nonceError) {
      if (nonceError.code === "23505" || nonceError.message?.includes("uq_hub_m2m_nonces_key_nonce")) {
        return {
          valid: false,
          statusCode: 401,
          error: "Tentativa de repetição de transporte detectada: X-Hub-Nonce já utilizado.",
        };
      }

      console.warn("Aviso ao persistir nonce M2M no banco:", nonceError.message);
    }
  } catch (err: any) {
    // Se o banco não estiver acessível, falha fail-closed
    console.error("Falha ao registrar nonce anti-replay no banco:", err?.message || err);
    return {
      valid: false,
      statusCode: 500,
      error: "Falha de persistência ao validar proteção anti-replay.",
    };
  }

  return {
    valid: true,
    keyId,
    correlationId,
    idempotencyKey,
    operatorEmail,
    operatorRole,
  };
}

/**
 * Validação rigorosa de autorização e identidade corporativa do operador do Hub.
 * Valida formato de e-mail e cargo com deny-by-default.
 */
export function validateOperatorRole(
  operatorRole?: string,
  isMutation: boolean = false,
  operatorEmail?: string
): { authorized: boolean; reason?: string } {
  if (!operatorRole || typeof operatorRole !== "string") {
    return {
      authorized: false,
      reason: "X-Hub-Operator-Role obrigatório para comandos administrativos.",
    };
  }

  if (isMutation && (!operatorEmail || !operatorEmail.includes("@"))) {
    return {
      authorized: false,
      reason: "X-Hub-Operator-Email com formato de e-mail corporativo válido é obrigatório para mutações contratuais.",
    };
  }

  const role = operatorRole.toLowerCase().trim();

  if (isMutation) {
    if (!MUTATION_OPERATOR_ROLES.includes(role as any)) {
      return {
        authorized: false,
        reason: `Cargo de operador [${operatorRole}] não possui alçada para realizar alterações contratuais/administrativas.`,
      };
    }
  } else {
    if (!ALLOWED_OPERATOR_ROLES.includes(role as any)) {
      return {
        authorized: false,
        reason: `Cargo de operador [${operatorRole}] não possui permissão para visualizar dados administrativos.`,
      };
    }
  }

  return { authorized: true };
}
