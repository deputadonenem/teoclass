"use client";

import React, { useState } from "react";
import { registerTrialAction } from "@/app/actions/trial_registration";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  User,
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface TrialRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: string;
}

export function TrialRegistrationModal({
  isOpen,
  onClose,
  initialPlan = "Gestão + EAD",
}: TrialRegistrationModalProps) {
  const [institutionName, setInstitutionName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [cnpj, setCnpj] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await registerTrialAction({
        institutionName,
        tradeName: tradeName.trim() || undefined,
        adminName,
        adminEmail,
        adminPhone,
        cnpj: cnpj.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Falha ao registrar a instituição.");
        setLoading(false);
        return;
      }

      setSuccessEmail(adminEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado ao cadastrar.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-9 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-lg transition-colors cursor-pointer"
          aria-label="Fechar modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {successEmail ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#C9973D] uppercase tracking-wider block">
                Cadastro Recebido com Sucesso
              </span>
              <h3 className="text-2xl font-bold text-[#0B1D33] font-serif">
                Confirme seu E-mail
              </h3>
              <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed pt-2">
                Enviamos um link exclusivo de ativação para: <br />
                <strong className="text-slate-900">{successEmail}</strong>
              </p>
            </div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Abra sua caixa de entrada e clique no link para definir sua senha de acesso e liberar seus <strong>7 dias gratuitos</strong>.
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-[#C9973D] border border-amber-200 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Acesso Imediato Completo</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#0B1D33] tracking-tight font-serif">
                Teste Grátis por 7 Dias
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Cadastre sua escola teológica e experimente todos os recursos (incluindo Sala Virtual EAD e Portal do Aluno). Sem cartão de crédito.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nome da Escola ou Seminário *
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="Ex: Seminário Teológico Betel"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Responsável / Diretor *
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Ex: Pr. Carlos Eduardo"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    E-mail Corporativo *
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="seu@seminario.com"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  CNPJ da Instituição (Opcional)
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#C9973D] hover:bg-[#B38432] text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registrando Instituição...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar Teste Grátis (7 Dias)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sem cobrança automática • Cancelamento a qualquer momento</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
