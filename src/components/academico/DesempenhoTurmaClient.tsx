"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ClassPerformanceReport,
  StudentReportCard,
  AcademicPerformanceSituation,
} from "@/types/desempenho";
import { BoletimView } from "./BoletimView";
import { getStudentReportCardAction } from "@/app/actions/desempenho";
import {
  Users,
  Award,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Eye,
  ChevronRight,
  TrendingUp,
  GraduationCap,
} from "lucide-react";
import clsx from "clsx";

interface DesempenhoTurmaClientProps {
  initialReport: ClassPerformanceReport;
  classes: Array<{ id: string; name: string; courseName: string }>;
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  userRole: string;
}

export function DesempenhoTurmaClient({
  initialReport,
  classes,
  selectedClassId,
  userRole,
}: Omit<DesempenhoTurmaClientProps, "onSelectClass">) {
  const router = useRouter();
  const [report, setReport] = useState<ClassPerformanceReport>(initialReport);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSituation, setFilterSituation] = useState<string>("todos");
  const [selectedStudentEnrollmentId, setSelectedStudentEnrollmentId] = useState<string | null>(null);
  const [studentReportCard, setStudentReportCard] = useState<StudentReportCard | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Filtra alunos da turma
  const filteredStudents = report.students.filter((st) => {
    const matchesSearch =
      st.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.enrollmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (st.studentCpf && st.studentCpf.includes(searchTerm));

    const matchesSituation =
      filterSituation === "todos" ? true : st.situation === filterSituation;

    return matchesSearch && matchesSituation;
  });

  // Abre boletim detalhado de um aluno selecionado
  const handleOpenStudentBoletim = async (enrollmentId: string) => {
    setSelectedStudentEnrollmentId(enrollmentId);
    setLoadingStudent(true);
    try {
      const res = await getStudentReportCardAction(enrollmentId);
      if (res.data) {
        setStudentReportCard(res.data);
      }
    } finally {
      setLoadingStudent(false);
    }
  };

  const getSituationBadge = (situation: AcademicPerformanceSituation) => {
    switch (situation) {
      case "aprovado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Aprovado
          </span>
        );
      case "recuperacao":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" /> Recuperação
          </span>
        );
      case "reprovado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <XCircle className="w-3 h-3" /> Reprovado
          </span>
        );
      case "em_andamento":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Clock className="w-3 h-3" /> Em Andamento
          </span>
        );
      case "nao_iniciado":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
            Não Iniciado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Turma e Indicadores Rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Card Seletor */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Selecionar Turma
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => router.push(`/app/academico/boletim?classId=${e.target.value}`)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.courseName})
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-500 mt-2">
            Curso: <span className="font-semibold">{report.schoolClass.courseName}</span>
          </div>
        </div>

        {/* Indicador: Média da Turma */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Média Geral da Turma</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {report.classAverage !== null ? report.classAverage.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-slate-400">Escala de 0 a 10.0</div>
          </div>
        </div>

        {/* Indicador: Taxa de Aprovação */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Aprovação Direta</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {report.approvalRatePercentage.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-400">Nota mínima: {report.gradingPolicy.minimumPassingGrade.toFixed(1)}</div>
          </div>
        </div>

        {/* Indicador: Alunos Matriculados */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Matrículas</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {report.activeStudents} <span className="text-xs font-normal text-slate-400">/ {report.totalStudents} total</span>
            </div>
            <div className="text-xs text-slate-400">Alunos ativos na turma</div>
          </div>
        </div>
      </div>

      {/* Seção Principal: Tabela de Alunos ou Boletim Individual */}
      {selectedStudentEnrollmentId && studentReportCard ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedStudentEnrollmentId(null);
                setStudentReportCard(null);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              ← Voltar para a lista da turma
            </button>
            <span className="text-xs text-slate-400">Visualizando boletim individual</span>
          </div>

          <BoletimView reportCard={studentReportCard} onPrint={() => window.print()} />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Barra de Filtros e Busca */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por nome do aluno ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterSituation}
                onChange={(e) => setFilterSituation(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todas as situações</option>
                <option value="aprovado">Aprovado</option>
                <option value="recuperacao">Recuperação</option>
                <option value="reprovado">Reprovado</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="nao_iniciado">Não Iniciado</option>
              </select>
            </div>
          </div>

          {/* Tabela de Alunos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Aluno / Matrícula</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Média Geral</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Situação</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Provas Realizadas</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Nenhum aluno encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr
                      key={st.enrollmentId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {st.studentName}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          Matrícula: {st.enrollmentNumber}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {st.enrollmentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-slate-900 dark:text-white">
                        {st.overallAverage !== null ? st.overallAverage.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {getSituationBadge(st.situation)}
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-slate-500">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {st.assessmentsCompleted}
                        </span>{" "}
                        concluídas
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleOpenStudentBoletim(st.enrollmentId)}
                          disabled={loadingStudent}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Boletim
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
