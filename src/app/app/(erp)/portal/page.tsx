import { requireTenantSession } from "@/lib/tenant/resolver";
import { getStudentPortalDataAction } from "@/app/actions/dashboard";
import { PortalClient } from "@/components/portal/PortalClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal do Aluno | TeoClass",
  description: "Ambiente do discente: aulas, notas, financeiro e certificados.",
};

export default async function PortalPage() {
  const session = await requireTenantSession();

  // Se o usuário não for aluno, redireciona para o dashboard geral
  if (session.role !== "aluno") {
    redirect("/app/dashboard");
  }

  const { data: portalData, error } = await getStudentPortalDataAction();

  if (error || !portalData) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Acesso ao Portal Indisponível
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          {error || "Não foi possível carregar os dados do portal do discente."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <PortalClient data={portalData} />
    </div>
  );
}
