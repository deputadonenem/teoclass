import React from "react";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { getLeadsAction } from "@/app/actions/captacao";
import { createClient } from "@/lib/supabase/server";
import { CaptacaoDashboardClient } from "@/components/captacao/CaptacaoDashboardClient";
import type { PublicPageSettings } from "@/types/captacao";

export default async function CaptacaoPage() {
  const session = await requireTenantSession();

  // Apenas Admin e Secretaria acessam o módulo de captação
  if (session.role !== "admin" && session.role !== "secretaria") {
    redirect("/app/dashboard");
  }

  const [leadsRes, supabase] = await Promise.all([
    getLeadsAction(),
    createClient(),
  ]);

  const { data: rawSettings } = await (supabase.from("public_page_settings") as any)
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .single();

  const settings: PublicPageSettings | null = rawSettings || null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CaptacaoDashboardClient
        initialLeads={leadsRes.data || []}
        initialSettings={settings}
        tenantSlug={session.tenant.slug}
        userRole={session.role}
      />
    </div>
  );
}
