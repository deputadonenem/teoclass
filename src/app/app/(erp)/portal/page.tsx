import { requireTenantSession } from "@/lib/tenant/resolver";
import { getStudentPortalDataAction } from "@/app/actions/dashboard";
import { PortalClient } from "@/components/portal/PortalClient";
import { hasPlanModuleAccess } from "@/lib/rbac/entitlements";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal do Aluno | TeoClass",
  description: "Ambiente do discente: aulas, notas, financeiro e certificados.",
};

export default async function PortalPage() {
  const session = await requireTenantSession();

  // 1. Verificação estrita de Entitlement do Plano da Instituição
  const hasPortalAccess = hasPlanModuleAccess(
    session.tenant.plan_tier,
    "portal_aluno"
  );

  if (!hasPortalAccess) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-serif">
          Portal do Aluno Indisponível no Plano Contratado
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          O plano contratado por sua instituição (<strong>{session.tenant.plan_tier.toUpperCase()}</strong>) não inclui o módulo de Portal do Aluno individual e Sala Virtual. Para habilitar o acesso aos alunos, solicite à administração o upgrade para o plano <strong>Gestão + EAD</strong>.
        </p>
      </div>
    );
  }

  // 2. Se o usuário não for aluno, redireciona para o dashboard geral
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
