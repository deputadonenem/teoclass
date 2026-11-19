"use client";

import React, { useState } from "react";
import type { FinancialPlan, FinancialPlanInput } from "@/types/financeiro";
import { saveFinancialPlanAction } from "@/app/actions/financeiro";
import { DollarSign, X, AlertCircle, Loader2 } from "lucide-react";

interface FinancialPlanModalProps {
  courses: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  planToEdit?: FinancialPlan | null;
  onClose: () => void;
  onSuccess: (savedPlan: FinancialPlan) => void;
}

export function FinancialPlanModal({
  courses,
  classes,
  planToEdit,
  onClose,
  onSuccess,
}: FinancialPlanModalProps) {
  const [courseId, setCourseId] = useState(
    planToEdit?.course_id || (courses.length > 0 ? courses[0].id : "")
  );
  const [classId, setClassId] = useState(planToEdit?.class_id || "");
  const [name, setName] = useState(planToEdit?.name || "");
  const [description, setDescription] = useState(planToEdit?.description || "");
  const [enrollmentFee, setEnrollmentFee] = useState(planToEdit?.enrollment_fee?.toString() || "0");
  const [installmentValue, setInstallmentValue] = useState(planToEdit?.installment_value?.toString() || "150");
  const [installmentsCount, setInstallmentsCount] = useState(planToEdit?.installments_count?.toString() || "12");
  const [defaultDueDay, setDefaultDueDay] = useState(planToEdit?.default_due_day?.toString() || "10");
  const [discountPercentage, setDiscountPercentage] = useState(planToEdit?.discount_percentage?.toString() || "0");
  const [scholarshipNotes, setScholarshipNotes] = useState(planToEdit?.scholarship_notes || "");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Informe o nome do plano financeiro.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await saveFinancialPlanAction({
        id: planToEdit?.id,
        course_id: courseId,
        class_id: classId || null,
        name: name.trim(),
        description: description.trim() || null,
        enrollment_fee: parseFloat(enrollmentFee) || 0,
        installment_value: parseFloat(installmentValue) || 0,
        installments_count: parseInt(installmentsCount, 10) || 1,
        default_due_day: parseInt(defaultDueDay, 10) || 10,
        discount_percentage: parseFloat(discountPercentage) || 0,
        scholarship_notes: scholarshipNotes.trim() || null,
        is_active: true,
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || "Falha ao salvar plano.");
      } else {
        onSuccess(res.data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {planToEdit ? "Editar Plano Financeiro" : "Novo Plano Financeiro"}
              </h2>
              <p className="text-xs text-slate-500">Defina regras de mensalidade e bolsas por curso.</p>
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
            <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
              Nome do Plano
            </label>
            <input
              type="text"
              placeholder="Ex: Mensalidade Padrão 2026 — Bacharel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Curso
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Turma (Opcional)
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
              >
                <option value="">Todas as turmas do curso</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Taxa de Matrícula (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={enrollmentFee}
                onChange={(e) => setEnrollmentFee(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Valor Parcela (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={installmentValue}
                onChange={(e) => setInstallmentValue(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
                required
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Nº de Parcelas
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={installmentsCount}
                onChange={(e) => setInstallmentsCount(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Dia de Vencimento
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={defaultDueDay}
                onChange={(e) => setDefaultDueDay(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Desconto / Bolsa Padrão (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar Plano"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
