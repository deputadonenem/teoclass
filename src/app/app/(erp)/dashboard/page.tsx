import React from "react";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { ROLE_DEFINITIONS } from "@/lib/rbac/permissions";
import {
  getInstitutionDashboardMetricsAction,
  getTeacherDashboardMetricsAction,
} from "@/app/actions/dashboard";
import { getOnboardingProgressAction } from "@/app/actions/onboarding";
import { OnboardingChecklistCard } from "@/components/onboarding/OnboardingChecklistCard";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Users,
  GraduationCap,
  Award,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Painel Geral | TeoClass",
  description: "Indicadores acadêmicos, turmas e arrecadação da instituição teológica.",
};

export default async function DashboardPage() {
  const session = await requireTenantSession();

  // Se aluno, redireciona diretamente para o Portal do Aluno
  if (session.role === "aluno") {
    redirect("/app/portal");
  }

  const roleConfig = ROLE_DEFINITIONS[session.role];

  // Busca dados de acordo com o perfil
  const [instRes, teacherRes, onboardingRes] = await Promise.all([
    session.role !== "professor" ? getInstitutionDashboardMetricsAction() : Promise.resolve({ data: null }),
    session.role === "professor" ? getTeacherDashboardMetricsAction() : Promise.resolve({ data: null }),
    session.role === "admin" || session.role === "secretaria"
      ? getOnboardingProgressAction()
      : Promise.resolve({ data: null }),
  ]);

  const instMetrics = instRes.data;
  const teacherMetrics = teacherRes.data;
  const onboardingProgress = onboardingRes.data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner de Boas-vindas */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{session.tenant.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Olá, {session.profile.full_name.split(" ")[0]}!
          </h1>
          <p className="text-sm text-indigo-200 max-w-xl">
            Ambiente institucional TeoClass: gestão acadêmica, formação ministerial e indicadores em tempo real.
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 text-right">
          <span className="text-[10px] text-indigo-200 uppercase tracking-wider block">Perfil Ativo</span>
          <span className="text-sm font-bold text-white">{roleConfig?.label}</span>
        </div>
      </div>

      {/* Card de Onboarding Institucional (4 Etapas de Implantação) */}
      {onboardingProgress && (
        <OnboardingChecklistCard initialProgress={onboardingProgress} />
      )}

      {/* =========================================================================
          CENÁRIO A: VISÃO INSTITUCIONAL (ADMIN, SECRETARIA, FINANCEIRO)
         ========================================================================= */}
      {instMetrics && (
        <div className="space-y-6">
          {/* Grid de Indicadores Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 block">Alunos Cadastrados</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {instMetrics.totalActiveStudents}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {instMetrics.totalEnrollments} matrículas ativas
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 block">Cursos & Turmas</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {instMetrics.totalCourses}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {instMetrics.totalClasses} turmas ativas
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 block">Arrecadação Escolar</span>
                <span className="text-2xl font-bold text-emerald-600">
                  R$ {instMetrics.financial.totalReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">Valores quitados</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 block">Inadimplência</span>
                <span className="text-2xl font-bold text-rose-600">
                  {instMetrics.financial.defaultRatePercentage}%
                </span>
                <span className="text-xs text-rose-400 block mt-0.5">
                  R$ {instMetrics.financial.totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vencidos
                </span>
              </div>
            </div>
          </div>

          {/* Atalhos Operacionais e Matrículas Recentes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Atalhos Rápidos */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Ações Rápidas
              </h2>

              <div className="space-y-2 pt-2">
                <Link
                  href="/app/secretaria"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 flex items-center justify-between group transition"
                >
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Cadastrar Aluno / Matrícula
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                </Link>

                <Link
                  href="/app/academico/boletim"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 flex items-center justify-between group transition"
                >
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Acompanhar Desempenho & Notas
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                </Link>

                <Link
                  href="/app/financeiro"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 flex items-center justify-between group transition"
                >
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Contas a Receber & Baixa Manual
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                </Link>

                <Link
                  href="/app/certificados"
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 flex items-center justify-between group transition"
                >
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Emitir Certificado de Conclusão
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                </Link>
              </div>
            </div>

            {/* Matrículas Recentes */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Matrículas Recentes
                </h2>
                <Link href="/app/secretaria" className="text-xs text-blue-600 hover:underline">
                  Ver todas
                </Link>
              </div>

              {instMetrics.recentEnrollments.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Nenhuma matrícula recente registrada.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {instMetrics.recentEnrollments.map((en) => (
                    <div key={en.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">
                          {en.studentName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {en.courseName} • Matrícula: {en.enrollmentNumber}
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-medium">
                        {en.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CENÁRIO B: VISÃO DO PROFESSOR
         ========================================================================= */}
      {teacherMetrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 block">Turmas Atribuídas</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {teacherMetrics.assignedClassesCount}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 block">Disciplinas sob Responsabilidade</span>
              <span className="text-2xl font-bold text-blue-600">
                {teacherMetrics.assignedSubjectsCount}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500 block">Alunos nas Turmas</span>
              <span className="text-2xl font-bold text-emerald-600">
                {teacherMetrics.totalTaughtStudentsCount}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              Minhas Turmas Atribuídas
            </h2>

            {teacherMetrics.assignedClasses.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Nenhuma turma atribuída ao seu cadastro docente até o momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teacherMetrics.assignedClasses.map((c) => (
                  <div
                    key={c.classId}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{c.className}</h3>
                      <p className="text-xs text-slate-500">{c.courseName}</p>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {c.studentsCount} alunos matriculados
                      </span>
                    </div>
                    <Link
                      href={`/app/academico/boletim?classId=${c.classId}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border text-blue-600 hover:bg-slate-50 transition"
                    >
                      Ver Notas
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
