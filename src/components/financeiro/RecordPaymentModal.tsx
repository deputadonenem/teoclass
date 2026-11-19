"use client";

import React, { useState } from "react";
import type { Receivable, PaymentMethod } from "@/types/financeiro";
import { PAYMENT_METHOD_LABELS } from "@/types/financeiro";
import { recordPaymentAction } from "@/app/actions/financeiro";
import { DollarSign, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface RecordPaymentModalProps {
  receivable: Receivable;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  receivable,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const pendingAmount = Number(receivable.final_amount) - Number(receivable.paid_amount);
  const [amountPaid, setAmountPaid] = useState<string>(pendingAmount.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amountPaid);
    if (!val || val <= 0) {
      setErrorMessage("Informe um valor de pagamento válido.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await recordPaymentAction({
        receivable_id: receivable.id,
        amount_paid: val,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || "Falha ao registrar o pagamento.");
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Pagamento</h2>
              <p className="text-xs text-slate-500">Baixa manual de cobrança escolar.</p>
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

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Cobrança:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{receivable.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Aluno:</span>
              <span className="font-semibold">{receivable.student?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Valor Total:</span>
              <span className="font-bold">R$ {Number(receivable.final_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>Saldo Pendente:</span>
              <span className="font-bold">R$ {pendingAmount.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase text-slate-600 mb-1">
              Valor Recebido (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={pendingAmount}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-base font-bold focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-slate-600 mb-1">
              Forma de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium"
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold uppercase text-slate-600 mb-1">
              Observações / Comprovante
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Pago via PIX pelo responsável financeiro..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
            />
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
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow disabled:opacity-50"
            >
              {loading ? "Registrando..." : "Confirmar Baixa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
