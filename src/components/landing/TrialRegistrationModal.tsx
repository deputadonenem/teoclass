"use client";

import React, { useState } from "react";
import Link from "next/link";
import { registerTrialAction } from "@/app/actions/trial_registration";
import { resendTrialActivationAction } from "@/app/actions/trial_resend";
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
  RotateCcw,
  ExternalLink,
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
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    email: string;
    isResend?: boolean;
    pendingActivation?: boolean;
    tenantId?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResendFeedback(null);
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

      setSuccessData({
        email: adminEmail,
        isResend: res.isResend,
        pendingActivation: res.pendingActivation,
        tenantId: res.tenantId,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado ao cadastrar.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const targetEmail = successData?.email || adminEmail;
    if (!targetEmail) return;

    setResending(true);
    setResendFeedback(null);

    try {
      const res = await resendTrialActivationAction(targetEmail);
      setResendFeedback(res.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao reenviar e-mail de ativação.";
      setResendFeedback(msg);
    } finally {
      setResending(false);
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

        {successData ? (
          <div className="text-center space-y-4 py-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#C9973D] uppercase tracking-wider block">
                {successData.isResend ? "Cadastro Pendente Localizado" : "Cadastro Recebido com Sucesso"}
              </span>
              <h3 className="text-2xl font-bold text-[#0B1D33] font-serif">
                {successData.pendingActivation ? "Link de Ativação Enviado" : "Confirme seu E-mail"}
              </h3>
              <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed pt-1">
                Enviamos o link de ativação com acesso total para: <br />
                <strong className="text-slate-900">{successData.email}</strong>
              </p>
            </div>

            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Abra sua caixa de entrada (ou pasta de spam) e clique no link para definir sua senha de acesso e liberar seus <strong>7 dias gratuitos</strong>.
            </p>

            {/* Feedback do Reenvio */}
            {resendFeedback && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 max-w-sm mx-auto">
                {resendFeedback}
              </div>
            )}

            {/* Ações: Reenviar e Continuar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reenviando...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reenviar E-mail de Ativação</span>
                  </>
                )}
              </button>

              <Link
                href={
                  successData.tenantId
                    ? `/app/ativar?tenant_id=${successData.tenantId}`
                    : `/app/ativar`
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B1D33] hover:bg-[#132A47] text-white text-xs font-bold transition-colors"
                onClick={onClose}
              >
                <span>Continuar Ativação</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
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
                <div className="space-y-1">
                  <span>{errorMsg}</span>
                  {/* Se o erro for de e-mail já existente ou pendente, exibe atalho de reenvio/ativação */}
                  {adminEmail && adminEmail.includes("@") && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C9973D] hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reenviar link de ativação para este e-mail</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {resendFeedback && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                {resendFeedback}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Nome da Instituição */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome da Escola ou Seminário <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="Ex: Seminário Teológico Betel"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9973D] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nome do Responsável / Diretor <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Ex: Pr. Carlos Eduardo"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9973D] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* E-mail e WhatsApp em Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    E-mail Corporativo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="seu@seminario.com"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9973D] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Telefone / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      minLength={8}
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9973D] focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* CNPJ Opcional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  CNPJ da Instituição <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9973D] focus:bg-white transition-all"
                />
              </div>

              {/* Botão de Envio */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-[#DFB76C] via-[#C9973D] to-[#9E7224] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#C9973D]/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar Teste Grátis (7 Dias)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Link para quem já tem cadastro pendente ou ativo */}
              <div className="pt-2 text-center flex flex-col gap-1">
                <p className="text-[11px] text-slate-500">
                  Já iniciou o cadastro?{" "}
                  <Link
                    href="/app/ativar"
                    className="text-[#C9973D] font-bold hover:underline"
                    onClick={onClose}
                  >
                    Concluir ativação
                  </Link>
                </p>
                <p className="text-[11px] text-slate-500">
                  Instituição já ativada?{" "}
                  <Link
                    href="/app/login"
                    className="text-slate-700 font-semibold hover:underline"
                    onClick={onClose}
                  >
                    Acessar Login da Gestão
                  </Link>
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
