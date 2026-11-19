"use client";

import React, { useState } from "react";
import type { StudentReportCard, AcademicPerformanceSituation } from "@/types/desempenho";
import {
  FileSpreadsheet,
  Award,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  User,
  GraduationCap,
} from "lucide-react";
import clsx from "clsx";

interface BoletimViewProps {
  reportCard: StudentReportCard;
  onPrint?: () => void;
}

export function BoletimView({ reportCard, onPrint }: BoletimViewProps) {
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !prev[subjectId],
    }));
  };

  const getSituationBadge = (situation: AcademicPerformanceSituation) => {
    switch (situation) {
      case "aprovado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
          </span>
        );
      case "recuperacao":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" /> Recuperação
          </span>
        );
      case "reprovado":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <XCircle className="w-3.5 h-3.5" /> Reprovado
          </span>
        );
      case "em_andamento":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Clock className="w-3.5 h-3.5" /> Em Andamento
          </span>
        );
      case "nao_iniciado":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
            Não Iniciado
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Cabeçalho do Boletim */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Boletim Acadêmico
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Matrícula: {reportCard.enrollmentNumber}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            {reportCard.student.fullName}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {reportCard.course.name} {reportCard.schoolClass ? `• Turma: ${reportCard.schoolClass.name}` : ""}
          </p>
        </div>

        {/* Resumo do Desempenho Geral */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-right">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Média Geral</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {reportCard.overallAverage !== null ? reportCard.overallAverage.toFixed(1) : "—"}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Situação Geral</div>
            <div className="mt-0.5">{getSituationBadge(reportCard.overallSituation)}</div>
          </div>
          {onPrint && (
            <button
              onClick={onPrint}
              className="ml-2 p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Imprimir Boletim"
            >
              <Printer className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Disciplinas e Avaliações */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {reportCard.subjects.map((subj) => {
          const isExpanded = expandedSubjects[subj.subjectId];

          return (
            <div key={subj.subjectId} className="transition-colors hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
              <div
                onClick={() => toggleSubject(subj.subjectId)}
                className="p-5 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      {subj.subjectName}
                      {subj.subjectCode && (
                        <span className="text-xs font-normal text-slate-400 font-mono">
                          [{subj.subjectCode}]
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Carga: {subj.workloadHours}h</span>
                      {subj.teacherName && <span>• Professor: {subj.teacherName}</span>}
                      <span>• {subj.completedAssessmentsCount}/{subj.totalAssessmentsCount} provas realizadas</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Média</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {subj.averageScore !== null ? subj.averageScore.toFixed(1) : "—"}
                    </div>
                  </div>
                  <div className="w-32 flex justify-end">{getSituationBadge(subj.situation)}</div>
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Detalhes expandidos: Provas e Tentativas */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/40">
                  {subj.assessments.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 italic">
                      Nenhuma avaliação configurada para esta disciplina.
                    </p>
                  ) : (
                    <div className="space-y-3 mt-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Avaliações Realizadas
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {subj.assessments.map((ass) => (
                          <div
                            key={ass.assessmentId}
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-sm text-slate-900 dark:text-white">
                                {ass.title}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Nota Mínima: {ass.passingGrade.toFixed(1)} • Tentativas: {ass.attemptsMadeCount}/{ass.totalAttemptsAllowed}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {ass.finalScore !== null ? `${ass.finalScore.toFixed(1)} pts` : "Pendente"}
                              </div>
                              <div className="text-xs">
                                {ass.passed === true && (
                                  <span className="text-emerald-600 font-medium">Aprovado</span>
                                )}
                                {ass.passed === false && (
                                  <span className="text-rose-600 font-medium">Abaixo da média</span>
                                )}
                                {ass.passed === null && (
                                  <span className="text-slate-400">Não realizada</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
