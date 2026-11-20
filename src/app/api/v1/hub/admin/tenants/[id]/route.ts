import { NextRequest, NextResponse } from "next/server";
import {
  extractHubM2MHeaders,
  validateHubM2MRequest,
  validateOperatorRole,
} from "@/lib/hub/verifier";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/hub/admin/tenants/[id]
 * Detalhes corporativos de uma instituição teológica para o Alcântara Hub.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "ID da instituição é obrigatório." },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;

    // 1. Autenticação M2M
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

    // 3. Buscar Tenant no Banco
    const { data: tenant, error: tenantErr } = await (admin.from("tenants") as any)
      .select("id, name, slug, cnpj, email, phone, status, plan_tier, settings, created_at, updated_at")
      .eq("id", id)
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json(
        { error: `Instituição com ID [${id}] não encontrada.` },
        { status: 404 }
      );
    }

    // 4. Métricas de Uso da Escola (sem PII)
    const { count: activeStudentsCount } = await (admin.from("enrollments") as any)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "ativa");

    const { count: coursesCount } = await (admin.from("courses") as any)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);

    const isActive = tenant.status === "active";
    const isTrial = tenant.status === "trial";

    // 5. Mapeamento Sanitizado de Detalhes
    const detailsResponse = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        document: tenant.cnpj || undefined,
        status: tenant.status,
        plan: tenant.plan_tier,
        email: tenant.email || undefined,
        phone: tenant.phone || undefined,
        created_at: tenant.created_at,
        updated_at: tenant.updated_at,
      },
      subscription: {
        id: tenant.id,
        plan: tenant.plan_tier,
        status: tenant.status,
        billing_cycle: "monthly",
        amount: 0,
        trial_ends_at: null,
        current_period_start: tenant.created_at,
        current_period_end: null,
        grace_period_days: 5,
        last_payment_at: null,
        canceled_at: tenant.status === "inactive" ? tenant.updated_at : null,
        cancellation_reason: null,
        entitlement_validity: {
          is_valid: isActive || isTrial,
          is_trial_expired: false,
          calculated_status: tenant.status,
        },
      },
      asaas: {
        customer_id: null,
        subscription_id: null,
        customer_created: false,
        subscription_created: false,
      },
      usage_summary: {
        active_students_count: activeStudentsCount || 0,
        courses_count: coursesCount || 0,
      },
      recent_invoices: [],
    };

    return NextResponse.json(detailsResponse, { status: 200 });

  } catch (err: any) {
    console.error("[HUB_ADMIN_TENANT_DETAILS_FATAL] Erro interno:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar detalhes da instituição." },
      { status: 500 }
    );
  }
}
