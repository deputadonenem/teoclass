import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { getClassesAction, getEnrollmentsAction } from "@/app/actions/academico";
import {
  getClassPerformanceReportAction,
  getStudentReportCardAction,
} from "@/app/actions/desempenho";
import { DesempenhoTurmaClient } from "@/components/academico/DesempenhoTurmaClient";
import { BoletimView } from "@/components/academico/BoletimView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Boletim & Desempenho Acadêmico | TeoClass",
  description: "Acompanhamento de notas, médias, aprovações e desempenho de turmas teológicas.",
};

export default async function BoletimPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; enrollmentId?: string }>;
}) {
  const session = await requireTenantSession();
  const params = await searchParams;

  // CASO 1: Discente acessando diretamente seu boletim pessoal
  if (session.role === "aluno") {
    // Busca matrícula do aluno logado
    const enrollmentsRes = await getEnrollmentsAction();
    const studentEnrollments = enrollmentsRes.data || [];
    const activeEnrollment =
      studentEnrollments.find((e) => e.status === "ativa") || studentEnrollments[0];

    if (!activeEnrollment) {
      return (
        <div className="p-8 max-w-4xl mx-auto text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Nenhuma Matrícula Encontrada
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Você não possui nenhuma matrícula ativa vinculada ao seu usuário neste seminário.
          </p>
        </div>
      );
    }

    const { data: reportCard, error } = await getStudentReportCardAction(activeEnrollment.id);

    if (error || !reportCard) {
      return (
        <div className="p-8 max-w-4xl mx-auto text-center">
          <p className="text-sm text-rose-600">{error || "Não foi possível carregar o boletim."}</p>
        </div>
      );
    }

    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Meu Boletim Acadêmico
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Acompanhe suas avaliações realizadas, notas parciais, média acumulada e situação.
          </p>
        </div>

        <BoletimView reportCard={reportCard} />
      </div>
    );
  }

  // CASO 2: Admin, Secretaria ou Professor acessando Desempenho por Turma
  assertPermission(session.role, "academico:view");

  const classesRes = await getClassesAction();
  const classesList = classesRes.data || [];

  if (classesList.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Nenhuma Turma Cadastrada
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Cadastre turmas e alunos no módulo Acadêmico para acompanhar o desempenho e as notas.
        </p>
      </div>
    );
  }

  const selectedClassId = params.classId || classesList[0].id;
  const { data: classReport, error } = await getClassPerformanceReportAction(selectedClassId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Acompanhamento de Notas & Desempenho
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Visão consolidada de turmas, boletins individuais e aprovação acadêmica integrada às avaliações.
        </p>
      </div>

      {classReport ? (
        <DesempenhoTurmaClient
          initialReport={classReport}
          classes={classesList.map((c) => ({
            id: c.id,
            name: c.name,
            courseName: c.course?.name || "Curso",
          }))}
          selectedClassId={selectedClassId}
          userRole={session.role}
        />
      ) : (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-700 dark:text-rose-300">
          {error || "Falha ao carregar o relatório de desempenho da turma selecionada."}
        </div>
      )}
    </div>
  );
}
