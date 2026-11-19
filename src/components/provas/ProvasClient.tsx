"use client";

import React, { useState, useTransition, useMemo } from "react";
import type { Subject, SchoolClass } from "@/types/academico";
import type {
  Assessment,
  AssessmentQuestion,
  AssessmentAttempt,
  AssessmentQuestionInput,
  AssessmentInput,
} from "@/types/provas";
import {
  saveAssessmentQuestionAction,
  saveAssessmentAction,
  startAssessmentAttemptAction,
} from "@/app/actions/provas";
import { QuestionModal } from "./QuestionModal";
import { AssessmentModal } from "./AssessmentModal";
import { ExamPlayer } from "./ExamPlayer";
import {
  HelpCircle,
  Award,
  Plus,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  Layers,
  BookOpen,
  Calendar,
} from "lucide-react";

interface ProvasClientProps {
  subjects: Subject[];
  classes: SchoolClass[];
  initialQuestions: AssessmentQuestion[];
  initialAssessments: Assessment[];
  userRole: string;
  isTeacherAssigned?: boolean;
}

export function ProvasClient({
  subjects,
  classes,
  initialQuestions,
  initialAssessments,
  userRole,
  isTeacherAssigned = false,
}: ProvasClientProps) {
  const [activeTab, setActiveTab] = useState<"assessments" | "question_bank">("assessments");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    () => (subjects.length > 0 ? subjects[0].id : "")
  );

  const [questions, setQuestions] = useState<AssessmentQuestion[]>(initialQuestions);
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments);

  // Estado para execução de prova (Player)
  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttempt | null>(null);
  const [examResult, setExamResult] = useState<AssessmentAttempt | null>(null);

  // Modais
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<AssessmentQuestion | null>(null);

  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage =
    userRole === "admin" ||
    userRole === "secretaria" ||
    (userRole === "professor" && isTeacherAssigned);

  // Questões filtradas pela disciplina selecionada
  const filteredQuestions = useMemo(() => {
    if (!selectedSubjectId) return questions;
    return questions.filter((q) => q.subject_id === selectedSubjectId);
  }, [questions, selectedSubjectId]);

  // Avaliações filtradas
  const filteredAssessments = useMemo(() => {
    if (!selectedSubjectId) return assessments;
    return assessments.filter((a) => a.subject_id === selectedSubjectId);
  }, [assessments, selectedSubjectId]);

  // Handlers de Salvar
  const handleSaveQuestion = async (data: AssessmentQuestionInput, qId?: string) => {
    const res = await saveAssessmentQuestionAction(data, qId);
    if (res.success && res.data) {
      if (qId) {
        setQuestions((prev) => prev.map((q) => (q.id === qId ? res.data! : q)));
      } else {
        setQuestions((prev) => [res.data!, ...prev]);
      }
    }
    return res;
  };

  const handleSaveAssessment = async (data: AssessmentInput, aId?: string) => {
    const res = await saveAssessmentAction(data, aId);
    if (res.success && res.data) {
      if (aId) {
        setAssessments((prev) => prev.map((a) => (a.id === aId ? res.data! : a)));
      } else {
        setAssessments((prev) => [res.data!, ...prev]);
      }
    }
    return res;
  };

  // Iniciar Prova pelo Aluno
  const handleStartExam = (assessmentId: string) => {
    setActionError(null);
    startTransition(async () => {
      const res = await startAssessmentAttemptAction(assessmentId);
      if (!res.success || !res.data) {
        setActionError(res.error || "Não foi possível iniciar a prova.");
      } else {
        setActiveAttempt(res.data);
      }
    });
  };

  // Se o aluno está realizando a prova, renderiza o ExamPlayer
  if (activeAttempt) {
    return (
      <ExamPlayer
        attempt={activeAttempt}
        onFinish={(res) => {
          setActiveAttempt(null);
          setExamResult(res);
        }}
        onCancel={() => setActiveAttempt(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Topo do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              EAD Teológico
            </span>
            <h1 className="text-xl font-bold text-slate-900">Avaliações & Banco de Questões</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Provas teológicas, critérios de aprovação, tentativas e banco de questões por disciplina
          </p>
        </div>

        {/* Seletor de Disciplina e Ações */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-semibold text-slate-600">Disciplina:</div>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code || "Sem cód."})
              </option>
            ))}
          </select>

          {canManage && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedQuestion(null);
                  setQuestionModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Nova Questão
              </button>
              <button
                onClick={() => {
                  setSelectedAssessment(null);
                  setAssessmentModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Criar Prova
              </button>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Modal de Resultado pós-finalização */}
      {examResult && (
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-full ${
                examResult.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {examResult.passed ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {examResult.passed ? "Parabéns! Você foi Aprovado!" : "Avaliação Finalizada"}
              </h3>
              <p className="text-xs text-slate-500">
                Nota obtida: <span className="font-bold text-sm text-slate-900">{examResult.total_score}</span> / 10.0
                {examResult.status === "expirada" && " (Tempo limite esgotado)"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setExamResult(null)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Fechar Resultado
          </button>
        </div>
      )}

      {/* Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("assessments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "assessments"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Award className="w-4 h-4" /> Avaliações Disponíveis
        </button>

        {canManage && (
          <button
            onClick={() => setActiveTab("question_bank")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "question_bank"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <HelpCircle className="w-4 h-4" /> Banco de Questões ({filteredQuestions.length})
          </button>
        )}
      </div>

      {/* ABA 1: AVALIAÇÕES */}
      {activeTab === "assessments" && (
        <div className="space-y-4">
          {filteredAssessments.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 shadow-sm">
              <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma avaliação configurada</p>
              <p className="text-xs text-slate-400 mt-1">
                {canManage
                  ? "Crie a primeira prova no botão 'Criar Prova'."
                  : "Não há provas agendadas para esta disciplina no momento."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAssessments.map((ass) => (
                <div
                  key={ass.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-shadow space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600">
                        {ass.subject?.name || "Disciplina"}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => {
                            setSelectedAssessment(ass);
                            setAssessmentModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          title="Editar Avaliação"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{ass.title}</h3>
                    {ass.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{ass.description}</p>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                          Questões
                        </span>
                        <span className="font-bold text-slate-800">{ass.questions_count}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                          Duração
                        </span>
                        <span className="font-bold text-slate-800">{ass.duration_minutes} min</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                          Média
                        </span>
                        <span className="font-bold text-slate-800">{ass.passing_grade}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500">
                      {userRole === "aluno" ? (
                        <span>
                          Tentativas: {ass.user_attempts_count || 0}/{ass.max_attempts}
                          {ass.user_best_score != null && (
                            <strong className="text-emerald-700 ml-1">
                              • Melhor Nota: {ass.user_best_score}
                            </strong>
                          )}
                        </span>
                      ) : (
                        <span>Max. {ass.max_attempts} tentativas por aluno</span>
                      )}
                    </div>

                    {userRole === "aluno" && (
                      <button
                        disabled={!ass.user_can_attempt || isPending}
                        onClick={() => handleStartExam(ass.id)}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-40"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {ass.user_attempts_count && ass.user_attempts_count > 0
                          ? "Nova Tentativa"
                          : "Iniciar Prova"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: BANCO DE QUESTÕES */}
      {activeTab === "question_bank" && canManage && (
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 shadow-sm">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Nenhuma questão cadastrada</p>
              <p className="text-xs text-slate-400 mt-1">
                Adicione perguntas de múltipla escolha ou verdadeiro/falso para montar o banco da matéria.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        #{idx + 1}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold uppercase">
                        {q.question_type === "verdadeiro_falso" ? "V/F" : "Múltipla Escolha"} • {q.points} pt(s)
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedQuestion(q);
                        setQuestionModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm font-medium text-slate-800 font-serif leading-relaxed">
                    {q.prompt}
                  </p>

                  {/* Alternativas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {q.options?.map((opt, oIdx) => (
                      <div
                        key={opt.id}
                        className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                          opt.is_correct
                            ? "bg-emerald-50/70 border-emerald-300 text-emerald-800 font-semibold"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <span className="truncate">
                          <strong className="mr-1">{String.fromCharCode(65 + oIdx)}.</strong>
                          {opt.option_text}
                        </span>
                        {opt.is_correct && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
                            Gabarito
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                      <strong>Comentário:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <QuestionModal
        isOpen={questionModalOpen}
        onClose={() => setQuestionModalOpen(false)}
        onSave={handleSaveQuestion}
        subjectId={selectedSubjectId}
        question={selectedQuestion}
      />

      <AssessmentModal
        isOpen={assessmentModalOpen}
        onClose={() => setAssessmentModalOpen(false)}
        onSave={handleSaveAssessment}
        subjects={subjects}
        classes={classes}
        defaultSubjectId={selectedSubjectId}
        assessment={selectedAssessment}
      />
    </div>
  );
}
