import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { getInstitutionSettingsAction } from "@/app/actions/configuracoes";
import { ConfiguracoesClient } from "@/components/configuracoes/ConfiguracoesClient";

export const metadata: Metadata = {
  title: "Configurações da Instituição | TeoClass",
  description: "Gerenciamento de dados institucionais, equipe, perfis de acesso e recursos do plano.",
};

export default async function ConfiguracoesPage() {
  const session = await requireTenantSession();

  // Apenas Administradores têm acesso às configurações gerais da escola
  if (session.role !== "admin") {
    redirect("/app/dashboard");
  }

  const { data, error } = await getInstitutionSettingsAction();

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-rose-800 dark:text-rose-200">
          <h2 className="text-lg font-bold mb-2">Erro ao carregar configurações</h2>
          <p className="text-sm">{error || "Não foi possível carregar as informações institucionais."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ConfiguracoesClient initialData={data} />
    </div>
  );
}
