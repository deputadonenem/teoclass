import { NextRequest, NextResponse } from "next/server";
import { validateHubM2MRequest } from "@/lib/hub/verifier";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Endpoint M2M: GET /api/v1/hub/telemetry
 * 
 * Invariantes de Segurança e Privacidade:
 * 1. Autenticação obrigatória M2M via HMAC-SHA256 (fail-closed).
 * 2. Proteção anti-replay via nonce e timestamp de 300s.
 * 3. ZERO PII / PHI: Não expõe nomes, e-mails, telefones, CPFs ou dados cadastrais.
 * 4. Retorna exclusivamente métricas agregadas operacionais do TeoClass para governança de planos no Hub.
 */
export async function GET(req: NextRequest) {
  try {
    const keyId = req.headers.get("x-hub-key-id") || "";
    const timestampStr = req.headers.get("x-hub-timestamp") || "";
    const nonce = req.headers.get("x-hub-nonce") || "";
    const signature = req.headers.get("x-hub-signature") || "";

    const url = new URL(req.url);
    const path = url.pathname; // /api/v1/hub/telemetry

    // 1. Validação Criptográfica M2M
    const authResult = await validateHubM2MRequest({
      keyId,
      timestampStr,
      nonce,
      signature,
      method: "GET",
      path,
    });

    if (!authResult.valid) {
      return NextResponse.json(
        { error: authResult.error || "Acesso negado: falha na autenticação M2M." },
        { status: authResult.statusCode || 401 }
      );
    }

    // 2. Consulta Métricas Agregadas no Banco (Zero PII/PHI)
    const admin = createAdminClient();

    // Contagem de tenants por status
    const { data: tenantsData } = await (admin.from("tenants") as any)
      .select("status, plan_tier");

    const tenants = tenantsData || [];
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter((t: any) => t.status === "active").length;
    const suspendedTenants = tenants.filter((t: any) => t.status === "suspended").length;

    const tenantsByPlan = {
      gestao: tenants.filter((t: any) => t.plan_tier === "gestao").length,
      gestao_ead: tenants.filter((t: any) => t.plan_tier === "gestao_ead").length,
      institucional: tenants.filter((t: any) => t.plan_tier === "institucional").length,
    };

    // Total de matrículas ativas (métrica de uso de faixa no Hub)
    const { count: activeEnrollmentsCount } = await (admin.from("enrollments") as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "ativa");

    // 3. Resposta Agregada Sanitizada (Zero Dados Pessoais)
    const telemetryPayload = {
      service: "teoclass-platform",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      metrics: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          suspended: suspendedTenants,
          byPlan: tenantsByPlan,
        },
        usage: {
          activeEnrollments: activeEnrollmentsCount || 0,
        },
      },
    };

    return NextResponse.json(telemetryPayload, { status: 200 });
  } catch (err: any) {
    console.error("Erro interno no endpoint de telemetria M2M Hub:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor de telemetria." },
      { status: 500 }
    );
  }
}
