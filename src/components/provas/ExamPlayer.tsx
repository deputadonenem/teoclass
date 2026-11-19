"use client";

import React, { useState, useEffect } from "react";
import type { AssessmentAttempt } from "@/types/provas";
import { submitAssessmentAttemptAction } from "@/app/actions/provas";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Award,
} from "lucide-react";

interface ExamPlayerProps {
  attempt: AssessmentAttempt;
  onFinish: (result: AssessmentAttempt) => void;
  onCancel: () => void;
}

export function ExamPlayer({ attempt, onFinish, onCancel }: ExamPlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(() => {
    const expires = new Date(attempt.expires_at).getTime();
    const diff = Math.floor((expires - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const questions = attempt.snapshot_questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  const doSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payloadAnswers = Object.entries(answers).map(([qId, optId]) => ({
        question_id: qId,
        selected_option_id: optId,
      }));

      const res = await submitAssessmentAttemptAction({
        attempt_id: attempt.id,
        answers: payloadAnswers,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error || "Erro ao submeter prova.");
        setIsSubmitting(false);
      } else {
        onFinish(res.data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Ocorreu um erro ao processar o envio.");
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    await doSubmit();
  };

  // Timer regressivo com setInterval baseado no timestamp estrito
  useEffect(() => {
    const expiresTimestamp = new Date(attempt.expires_at).getTime();

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresTimestamp - Date.now()) / 1000));
      setTimeLeftSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (!isSubmitting) {
          doSubmit();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.expires_at]);

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-w-4xl mx-auto space-y-6">
      {/* Topo com Cronômetro e Progresso */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold truncate">
              {attempt.assessment?.title || "Avaliação em Andamento"}
            </h2>
            <p className="text-[11px] text-slate-400">
              Questão {currentQuestionIndex + 1} de {questions.length} • Respondidas: {answeredCount}/
              {questions.length}
            </p>
          </div>
        </div>

        {/* Cronômetro */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm font-bold ${
            timeLeftSeconds < 300
              ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
              : "bg-slate-800 text-emerald-400 border border-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{formatTime(timeLeftSeconds)}</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {errorMessage && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Navegação Rápida de Questões */}
        <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = idx === currentQuestionIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-1"
                    : isAnswered
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Questão Atual */}
        {currentQuestion && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Questão #{currentQuestionIndex + 1} ({currentQuestion.points} pts)
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {currentQuestion.question_type === "verdadeiro_falso"
                  ? "Verdadeiro ou Falso"
                  : "Múltipla Escolha"}
              </span>
            </div>

            <h3 className="text-base font-medium text-slate-900 font-serif leading-relaxed">
              {currentQuestion.prompt}
            </h3>

            {/* Alternativas */}
            <div className="space-y-2.5 pt-2">
              {currentQuestion.options.map((opt, oIdx) => {
                const isSelected = answers[currentQuestion.id] === opt.id;
                return (
                  <label
                    key={opt.id}
                    onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 text-sm font-sans">
                      <span className="font-semibold text-slate-500 mr-2">
                        {String.fromCharCode(65 + oIdx)}.
                      </span>
                      {opt.option_text}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Rodapé de Navegação e Envio */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            disabled={currentQuestionIndex === 0 || isSubmitting}
            onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          <div className="flex items-center gap-3">
            {currentQuestionIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={doSubmit}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Finalizar e Submeter Prova
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
