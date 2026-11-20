"use client";

import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RefreshCw,
  PowerOff,
  Power,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Building,
  Loader2,
} from "lucide-react";
import {
  saveSchoolGatewayConfigAction,
  testAsaasConnectionAction,
  testSavedAsaasConnectionAction,
  toggleSchoolGatewayStatusAction,
  disconnectSchoolGatewayAction,
} from "@/app/actions/gateway_config";

interface SchoolPaymentGatewaySettingsProps {
  initialSummary?: {
    isConfigured: boolean;
    provider: string;
    isActive: boolean;
    environment: "sandbox" | "production";
    apiKeyLastFour: string | null;
    accountNumber: string | null;
    updatedAt: string | null;
  } | null;
}

export function SchoolPaymentGatewaySettings({
  initialSummary,
}: SchoolPaymentGatewaySettingsProps) {
  const [summary, setSummary] = useState(
    initialSummary || {
      isConfigured: false,
      provider: "asaas",
      isActive: false,
      environment: "sandbox" as "sandbox" | "production",
      apiKeyLastFour: null,
      accountNumber: null,
      updatedAt: null,
    }
  );

  const [isEditing, setIsEditing] = useState(!summary.isConfigured);
  const [environment, setEnvironment] = useState<"sandbox" | "production">(
    summary.environment || "sandbox"
  );
  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [isActiveOnSave, setIsActiveOnSave] = useState(true);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 1. Testa a chave informada no formulário
  const handleTestInputConnection = async () => {
    if (!apiKey || apiKey.trim().length < 8) {
      setFeedback({
        type: "error",
        text: "Informe a chave de API do Asaas para testar.",
      });
      return;
    }

    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await testAsaasConnectionAction({
        apiKey: apiKey.trim(),
        environment,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: `Conexão bem-sucedida! Conta identificada: ${res.accountName}`,
        });
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Falha ao validar chave com o Asaas.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro inesperado ao testar conexão com o Asaas.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 2. Testa a chave já salva no cofre
  const handleTestSavedConnection = async () => {
    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await testSavedAsaasConnectionAction();
      if (res.success) {
        setFeedback({
          type: "success",
          text: `Conexão ativa e verificada com sucesso! (${res.accountName})`,
        });
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Não foi possível conectar com a chave salva.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro inesperado ao testar conexão salva.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 3. Salva ou atualiza a credencial no cofre criptografado
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || apiKey.trim().length < 8) {
      setFeedback({
        type: "error",
        text: "Informe uma chave de API válida para salvar.",
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await saveSchoolGatewayConfigAction({
        apiKey: apiKey.trim(),
        environment,
        isActive: isActiveOnSave,
        webhookAccessToken: webhookToken.trim() || undefined,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          text: "Credenciais do Asaas salvas com sucesso no cofre seguro!",
        });
        setSummary({
          isConfigured: true,
          provider: "asaas",
          isActive: isActiveOnSave,
          environment,
          apiKeyLastFour: apiKey.trim().slice(-4),
          accountNumber: summary.accountNumber,
          updatedAt: new Date().toISOString(),
        });
        setIsEditing(false);
        setApiKey("");
        setWebhookToken("");
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Falha ao salvar configuração do Asaas.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro inesperado ao salvar credenciais.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Alterna ativação/desativação sem remover a chave salva
  const handleToggleStatus = async () => {
    const nextStatus = !summary.isActive;
    setIsToggling(true);
    setFeedback(null);
    try {
      const res = await toggleSchoolGatewayStatusAction(nextStatus);
      if (res.success) {
        setSummary({ ...summary, isActive: nextStatus });
        setFeedback({
          type: "success",
          text: nextStatus
            ? "Integração Asaas ativada com sucesso."
            : "Integração Asaas desativada. O financeiro operará 100% manual.",
        });
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Falha ao alternar status da integração.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro inesperado ao alterar status do gateway.",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // 5. Remove/Desconecta a conta Asaas
  const handleDisconnect = async () => {
    if (
      !confirm(
        "Tem certeza que deseja desconectar a conta Asaas da escola? As credenciais serão removidas do cofre."
      )
    ) {
      return;
    }

    setIsDisconnecting(true);
    setFeedback(null);
    try {
      const res = await disconnectSchoolGatewayAction();
      if (res.success) {
        setSummary({
          isConfigured: false,
          provider: "asaas",
          isActive: false,
          environment: "sandbox",
          apiKeyLastFour: null,
          accountNumber: null,
          updatedAt: null,
        });
        setIsEditing(true);
        setApiKey("");
        setFeedback({
          type: "success",
          text: "Conta Asaas desconectada com sucesso. A escola está operando em modo financeiro manual.",
        });
      } else {
        setFeedback({
          type: "error",
          text: res.error || "Falha ao desconectar Asaas.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro inesperado ao desconectar conta.",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Pagamentos da Escola (Gateway Asaas)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Integração opcional para recebimento automático de mensalidades e matrículas via Pix e Boleto.
          </p>
        </div>

        {summary.isConfigured && !isEditing && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                summary.isActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                  : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
              }`}
            >
              {summary.isActive ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" /> Pausado
                </>
              )}
            </span>
            <span className="text-xs font-medium uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {summary.environment}
            </span>
          </div>
        )}
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Estado 1: Conta Configurada (Visualização do Cofre Seguro) */}
      {summary.isConfigured && !isEditing && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium">Chave de API:</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                •••• •••• •••• {summary.apiKeyLastFour}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium">Ambiente Operacional:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase mt-0.5 block">
                {summary.environment === "sandbox" ? "Sandbox (Homologação)" : "Produção"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium">Modo de Operação:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {summary.isActive ? "Híbrido (Asaas + Manual)" : "Manual Exclusivo"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestSavedConnection}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700/80 transition-all flex items-center gap-2"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Testar Conexão
              </button>

              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isToggling}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 ${
                  summary.isActive
                    ? "text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/40"
                    : "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40"
                }`}
              >
                {isToggling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : summary.isActive ? (
                  <>
                    <PowerOff className="w-3.5 h-3.5" /> Pausar Cobranças Asaas
                  </>
                ) : (
                  <>
                    <Power className="w-3.5 h-3.5" /> Reativar Asaas
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900 transition-all flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" /> Substituir Chave
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-all flex items-center gap-1.5"
              >
                {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado 2: Formulário de Configuração / Edição de Credenciais */}
      {isEditing && (
        <form onSubmit={handleSaveConfig} className="space-y-5">
          <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-4 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
            <strong>Como obter a chave de API?</strong> Acesse o painel da sua conta no Asaas em{" "}
            <em>Minha Conta ➔ Integrações ➔ Chaves de API</em> e gere uma nova chave de acesso. As credenciais serão armazenadas em cofre criptografado com AES-256-GCM exclusivo para esta instituição.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ambiente Asaas *
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as "sandbox" | "production")}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
              >
                <option value="sandbox">Sandbox (Ambiente de Testes / Homologação)</option>
                <option value="production">Produção (Valores e Cobranças Reais)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status Inicial *
              </label>
              <select
                value={isActiveOnSave ? "active" : "inactive"}
                onChange={(e) => setIsActiveOnSave(e.target.value === "active")}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
              >
                <option value="active">Ativo (Habilitar emissão de cobranças)</option>
                <option value="inactive">Pausado (Manter apenas financeiro manual)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Chave de API do Asaas (API Key) *
            </label>
            <input
              type="password"
              required
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="$aact_YTU5YTE0M2M2N2I4MTli..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              A chave completa nunca será devolvida ao navegador após o salvamento.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleTestInputConnection}
              disabled={isTesting || !apiKey}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Testar Conexão com Asaas
            </button>

            <div className="flex items-center gap-2">
              {summary.isConfigured && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
              )}

              <button
                type="submit"
                disabled={isSaving || !apiKey}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Salvar Credenciais no Cofre
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
