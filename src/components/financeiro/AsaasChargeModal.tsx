"use client";

import React, { useState } from "react";
import {
  QrCode,
  FileText,
  Copy,
  Check,
  ExternalLink,
  X,
  Loader2,
  AlertCircle,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { issueSchoolChargeAction, type IssueSchoolChargeResult } from "@/app/actions/cobranca_asaas";

interface AsaasChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  receivable: {
    id: string;
    title: string;
    installment_number: number;
    total_installments: number;
    final_amount: number;
    due_date: string;
    status: string;
    gateway_provider?: string | null;
    gateway_charge_id?: string | null;
    gateway_invoice_url?: string | null;
    gateway_pix_qrcode?: string | null;
    gateway_pix_image_url?: string | null;
    gateway_payment_method?: string | null;
  } | null;
  onSuccess?: () => void;
}

export function AsaasChargeModal({
  isOpen,
  onClose,
  receivable,
  onSuccess,
}: AsaasChargeModalProps) {
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO">("PIX");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se já possuir dados do gateway carregados
  const [chargeData, setChargeData] = useState<IssueSchoolChargeResult | null>(
    receivable?.gateway_charge_id
      ? {
          success: true,
          receivableId: receivable.id,
          gatewayChargeId: receivable.gateway_charge_id,
          billingType: (receivable.gateway_payment_method as any) || "PIX",
          invoiceUrl: receivable.gateway_invoice_url,
          pixQrCode: receivable.gateway_pix_qrcode,
          pixImageUrl: receivable.gateway_pix_image_url,
        }
      : null
  );

  if (!isOpen || !receivable) return null;

  const handleIssueCharge = async (type: "PIX" | "BOLETO") => {
    setIsLoading(true);
    setError(null);
    setBillingType(type);

    try {
      const res = await issueSchoolChargeAction({
        receivableId: receivable.id,
        billingType: type,
      });

      if (res.success) {
        setChargeData(res);
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || "Falha ao emitir cobrança no Asaas.");
      }
    } catch {
      setError("Erro inesperado ao comunicar com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (chargeData?.pixQrCode) {
      navigator.clipboard.writeText(chargeData.pixQrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cobrança Asaas (Pix / Boleto)
            </h3>
            <p className="text-xs text-slate-500">
              {receivable.title} • Parcela {receivable.installment_number}/{receivable.total_installments}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200 dark:border-rose-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="my-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block">Valor da Mensalidade</span>
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              R$ {Number(receivable.final_amount).toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block">Vencimento</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {new Date(receivable.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>

        {/* Estado 1: Cobrança já emitida ou gerada agora */}
        {chargeData?.gatewayChargeId ? (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Cobrança ativa no Asaas ({chargeData.billingType})
              </span>
              <span className="font-mono text-[11px] opacity-80">{chargeData.gatewayChargeId}</span>
            </div>

            {/* Visualização Pix */}
            {chargeData.pixQrCode && (
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                {chargeData.pixImageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={chargeData.pixImageUrl}
                    alt="QR Code Pix"
                    className="w-44 h-44 rounded-lg bg-white p-2 border border-slate-200 shadow-sm"
                  />
                )}
                <div className="w-full flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={chargeData.pixQrCode}
                    className="w-full text-xs font-mono px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shrink-0 flex items-center gap-1.5 shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>
            )}

            {/* Link Boleto / Fatura */}
            {chargeData.invoiceUrl && (
              <a
                href={chargeData.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all border border-slate-200 dark:border-slate-700"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                Abrir Boleto Bancário / Fatura Asaas
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            )}
          </div>
        ) : (
          /* Estado 2: Opções de Emissão Inicial */
          <div className="space-y-3">
            <p className="text-xs text-slate-500 text-center">
              Selecione o formato desejado para emitir na conta Asaas da escola:
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleIssueCharge("PIX")}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-left transition-all group flex flex-col justify-between"
              >
                <QrCode className="w-6 h-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Pix Dinâmico
                  </span>
                  <span className="text-[11px] text-slate-400">
                    QR Code e cópia-e-cola com baixa instantânea
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleIssueCharge("BOLETO")}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-left transition-all group flex flex-col justify-between"
              >
                <FileText className="w-6 h-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Boleto Bancário
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Linha digitável com código de barras
                  </span>
                </div>
              </button>
            </div>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Gerando cobrança no Asaas com segurança...
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
