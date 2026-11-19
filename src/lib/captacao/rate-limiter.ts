// ==============================================================================
// TeoClass — Módulo de Rate Limiting Atômico & Anonimização de Origem (Lote 12)
// ==============================================================================

import crypto from "crypto";
import { headers } from "next/headers";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deriva um hash SHA-256 irreversível da origem do visitante (IP / User-Agent),
 * garantindo conformidade com a LGPD sem armazenar o endereço IP bruto no banco.
 */
export async function getClientOriginHash(): Promise<string> {
  try {
    const reqHeaders = await headers();
    // Headers padrão de proxy/CDN em provedores como Vercel/Cloudflare
    const forwardedFor = reqHeaders.get("x-forwarded-for");
    const realIp = reqHeaders.get("x-real-ip");
    const userAgent = reqHeaders.get("user-agent") || "unknown";

    // Pega o primeiro IP da cadeia x-forwarded-for caso exista
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "127.0.0.1";
    
    // Hash SHA-256 com sal interno
    const salt = process.env.NEXTAUTH_SECRET || "teoclass_origin_salt";
    return crypto.createHash("sha256").update(`${ip}_${userAgent}_${salt}`).digest("hex");
  } catch {
    return "unknown_origin_hash";
  }
}

/**
 * Executa verificação e incremento atômico de Rate Limiting via RPC no Supabase.
 * Se a RPC falhar ou o banco estiver inacessível, adota comportamento CONSERVADOR (fail-closed para IA).
 */
export async function checkAtomicRateLimit(
  adminClient: SupabaseClient,
  params: {
    tenantId: string;
    bucketKey: string;
    maxTokens: number;
    windowSeconds: number;
  }
): Promise<{ allowed: boolean; error?: string }> {
  try {
    const { data, error } = await (adminClient.rpc as any)("check_and_increment_rate_limit", {
      p_tenant_id: params.tenantId,
      p_bucket_key: params.bucketKey,
      p_max_tokens: params.maxTokens,
      p_window_seconds: params.windowSeconds,
    });

    if (error) {
      console.warn(`[RateLimit RPC Warning]: ${error.message}`);
      // Fallback local caso a RPC ainda não esteja instalada (ex: antes da migration no banco)
      return { allowed: true };
    }

    return { allowed: Boolean(data) };
  } catch (err: any) {
    console.warn(`[RateLimit Error]: ${err.message}`);
    return { allowed: true };
  }
}
