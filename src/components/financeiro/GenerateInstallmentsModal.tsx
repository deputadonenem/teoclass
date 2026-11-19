"use client";

import React, { useState } from "react";
import type { FinancialPlan } from "@/types/financeiro";
import { generateEnrollmentInstallmentsAction } from "@/app/actions/financeiro";
import { Layers, X, AlertCircle, Loader2 } from "lucide-react";

interface GenerateInstallmentsModalProps {
  enrollments: Array<{
    id: string;
    enrollmentNumber: string;
    studentName: string;
    courseName: string;
  }>;
  plans: FinancialPlan[];
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export function GenerateInstallmentsModal({
  enrollments,
  plans,
  onClose,
  onSuccess,
}: GenerateInstallmentsModalProps) {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(
    enrollments.length > 0 ? enrollments[0].id : ""
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    plans.length > 0 ? plans[0].id : ""
  );
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [customDiscount, setCustomDiscount] = useState<string>("0");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentId || !selectedPlanId) {
      setErrorMessage("Selecione uma matrícula e um plano financeiro.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await generateEnrollmentInstallmentsAction({
        enrollment_id: selectedEnrollmentId,
        financial_plan_id: selectedPlanId,
        first_due_date: firstDueDate,
        custom_discount_percentage: parseFloat(customDiscount) || 0,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess(res.count);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Gerar Cobranças</h2>
              <p className="text-xs text-slate-500">Lançamento automático de mensalidades por matrícula.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold uppercase text-slate-600 mb-1">
              Aluno / Matrícula
            </label>
            <select
              value={selectedEnrollmentId}
              onChange={(e) => setSelectedEnrollmentId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
            >
              {enrollments.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.studentName} — {en.courseName} ({en.enrollmentNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold uppercase text-slate-600 mb-1">
              Plano Financeiro
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => {
                setSelectedPlanId(e.target.value);
                const pl = plans.find((p) => p.id === e.target.value);
                if (pl) setCustomDiscount(pl.discount_percentage.toString());
              }}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
            >
              {plans.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.installments_count}x de R$ {Number(pl.installment_value).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase text-slate-600 mb-1">
                Primeiro Vencimento
              </label>
              <input
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
                required
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-slate-600 mb-1">
                Bolsa / Desconto Aluno (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={customDiscount}
                onChange={(e) => setCustomDiscount(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
              />
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow disabled:opacity-50"
            >
              {loading ? "Gerando..." : "Gerar Parcelas"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
