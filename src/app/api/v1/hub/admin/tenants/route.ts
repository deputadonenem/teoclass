import { NextRequest, NextResponse } from "next/server";
import {
  extractHubM2MHeaders,
  validateHubM2MRequest,
  validateOperatorRole,
} from "@/lib/hub/verifier";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/hub/admin/tenants
 * Consulta paginada, com busca e filtros de instituições (tenants) do TeoClass para o Alcântara Hub.
 * 
 * Regras Estritas:
 * 1. Autenticação HMAC-SHA256 M2M obrigatória.
 * 2. Validação de cargo do operador corporativo.
 * 3. Sanitização absoluta de dados: zero segredos de gateway, tokens ou senhas.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const searchParams = url.searchParams;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || searchParams.get("per_page") || "20", 10)));
    const search = (searchParams.get("search") || "").trim();
    const statusFilter = (searchParams.get("status") || "").trim();
    const planFilter = (searchParams.get("plan") || "").trim();

    // 1. Extração e Validação M2M
    const headers = extractHubM2MHeaders(req);
    const authResult = await validateHubM2MRequest({
      ...headers,
      method: "GET",
      path,
    });

    if (!authResult.valid) {
      return NextResponse.json(
        { error: authResult.error || "Acesso negado: falha na autenticação M2M." },
        { status: authResult.statusCode || 401 }
      );
    }

    // 2. Validação de Cargo do Operador
    const roleCheck = validateOperatorRole(headers.operatorRole, false);
    if (!roleCheck.authorized) {
      return NextResponse.json(
        { error: roleCheck.reason },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // 3. Montagem da Query no Supabase via service_role
    let query = (admin.from("tenants") as any)
      .select("id, name, slug, cnpj, email, phone, status, plan_tier, settings, created_at, updated_at", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,cnpj.ilike.%${search}%`);
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (planFilter) {
      query = query.eq("plan_tier", planFilter);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: tenantsData, count, error: queryError } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (queryError) {
      console.error("[HUB_ADMIN_TENANTS_ERROR] Falha ao consultar tenants:", queryError);
      return NextResponse.json(
        { error: "Erro ao consultar lista de instituições no banco." },
        { status: 500 }
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // 4. Mapeamento Sanitizado (compatível com TenantAdminSummary e ZeluniaAdminTenantSummary)
    const tenantsList = (tenantsData || []).map((t: any) => {
      const isActive = t.status === "active";
      const isTrial = t.status === "trial";
      const isSuspended = t.status === "suspended";

      return {
        id: t.id,
        external_tenant_id: t.id,
        name: t.name,
        slug: t.slug,
        document: t.cnpj || undefined,
        plan: t.plan_tier,
        plan_slug: t.plan_tier,
        status: t.status,
        subscription_status: t.status,
        is_active: isActive,
        created_at: t.created_at,
        updated_at: t.updated_at,
        lifecycle: {
          status: t.status,
          is_valid: isActive || isTrial,
          is_trial: isTrial,
          is_trial_expired: false,
          trial_ends_at: null,
          current_period_end: null,
          grace_period_days: 5,
          amount_monthly: 0,
        },
        financial_status: isSuspended ? "blocked" : "healthy",
      };
    });

    return NextResponse.json({
      product_slug: "teoclass",
      tenants: tenantsList,
      pagination: {
        page,
        limit,
        per_page: limit,
        total,
        total_pages: totalPages,
      },
    }, { status: 200 });

  } catch (err: any) {
    console.error("[HUB_ADMIN_TENANTS_FATAL] Erro interno no endpoint:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor administrativo M2M." },
      { status: 500 }
    );
  }
}
