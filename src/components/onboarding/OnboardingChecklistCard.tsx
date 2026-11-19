"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import type { OnboardingProgressDTO } from "@/types/onboarding";
import { toggleDismissOnboardingAction } from "@/app/actions/onboarding";

interface OnboardingChecklistCardProps {
  initialProgress: OnboardingProgressDTO;
}

export function OnboardingChecklistCard({ initialProgress }: OnboardingChecklistCardProps) {
  const [progress, setProgress] = useState<OnboardingProgressDTO>(initialProgress);
  const [isExpanded, setIsExpanded] = useState<boolean>(!initialProgress.isAllCompleted);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  // Se o usuário dispensou o card e todas estão concluídas, ou se optou por fechar
  if (progress.isDismissed) {
    return null;
  }

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      const res = await toggleDismissOnboardingAction(true);
      if (res.success) {
        setProgress((prev) => ({ ...prev, isDismissed: true }));
      }
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-900/10 via-indigo-50/50 to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-5 shadow-sm transition-all mb-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Guia de Início Rápido da Escola
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {progress.completedCount} de {progress.totalSteps} etapas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Complete os 4 passos fundamentais para começar a matricular alunos e operar o TeoClass.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isExpanded ? "Recolher etapas" : "Expandir etapas"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDismiss}
            disabled={isDismissing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Dispensar guia"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="mt-4">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
          <span>Progresso de Implantação</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">{progress.percent}%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 transition-all duration-500 rounded-full"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* Lista de Etapas (Expansível) */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-indigo-100/60 dark:border-slate-800">
          {progress.steps.map((step) => (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                step.isCompleted
                  ? "bg-white/80 dark:bg-slate-850/60 border-emerald-200/80 dark:border-emerald-950"
                  : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold flex items-center gap-1.5 ${
                      step.isCompleted
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {step.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    )}
                    {step.title}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                  {step.description}
                </p>
              </div>

              <Link
                href={step.href}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors w-full text-center ${
                  step.isCompleted
                    ? "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                }`}
              >
                {step.actionLabel}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
