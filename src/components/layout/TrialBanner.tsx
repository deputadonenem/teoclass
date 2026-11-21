import React from "react";
import Link from "next/link";
import { Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import type { Tenant } from "@/types/database";

interface TrialBannerProps {
  tenant: Tenant;
}

export function TrialBanner({ tenant }: TrialBannerProps) {
  const isTrial = tenant.status === "trial";
  const isExpired = tenant.status === "trial_expired";

  if (!isTrial && !isExpired) return null;

  // Calculado no Server Component / Renderização Segura
  let daysRemaining = 0;
  let hoursRemaining = 0;
  if (isTrial && tenant.trial_ends_at) {
    const diffMs = new Date(tenant.trial_ends_at).getTime() - new Date().getTime();
    if (diffMs > 0) {
      daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      hoursRemaining = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    }
  }

  if (isExpired) {
    return (
      <div className="bg-rose-900 border-b border-rose-800 text-white px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
            <span>
              <strong>Período de Teste Grátis Concluído:</strong> Suas operações administrativas foram pausadas temporariamente. Seus dados e configurações estão 100% preservados.
            </span>
          </div>
          <Link
            href="/#planos"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs shrink-0 transition-colors shadow-xs"
          >
            <span>Assinar Plano Definitivo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1D33] border-b border-slate-700/80 text-white px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#C9973D] shrink-0" />
          <span>
            <strong>Teste Grátis Ativo (Acesso Completo):</strong> Restam{" "}
            <span className="font-bold text-[#C9973D]">
              {daysRemaining} {daysRemaining === 1 ? "dia" : "dias"} e {hoursRemaining}h
            </span>{" "}
            com todos os recursos liberados (incluindo EAD e Portal do Aluno).
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/#planos"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#C9973D] hover:bg-[#B38432] text-white font-semibold text-xs shrink-0 transition-colors"
          >
            <span>Contratar Antecipadamente</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
