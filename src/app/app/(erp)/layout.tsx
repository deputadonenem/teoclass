import React from "react";
import { redirect } from "next/navigation";
import { resolveTenantSession } from "@/lib/tenant/resolver";
import { TenantProvider } from "@/contexts/TenantContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await resolveTenantSession();

  // Caso não esteja autenticado ou não possua vínculo, redireciona para login seguro
  if (!result.success) {
    redirect("/app/login");
  }

  const { session } = result;

  return (
    <TenantProvider
      initialTenant={session.tenant}
      initialProfile={session.profile}
      initialRole={session.role}
      initialUserTenants={session.availableTenants}
    >
      <SidebarProvider>
        <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TenantProvider>
  );
}
