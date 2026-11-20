"use client";

import React, { useState } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Save,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  User,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import type { InstitutionSettingsDTO, UpdateInstitutionInput } from "@/types/configuracoes";
import { SchoolPaymentGatewaySettings } from "./SchoolPaymentGatewaySettings";
import {
  updateInstitutionAction,
  inviteTeamMemberAction,
  updateTeamMemberRoleAction,
  toggleTeamMemberStatusAction,
} from "@/app/actions/configuracoes";

interface ConfiguracoesClientProps {
  initialData: InstitutionSettingsDTO;
}

export function ConfiguracoesClient({ initialData }: ConfiguracoesClientProps) {
  const [data, setData] = useState<InstitutionSettingsDTO>(initialData);
  const [activeTab, setActiveTab] = useState<"instituicao" | "equipe" | "pagamentos" | "plano">("instituicao");

  // Form Instituição
  const [instForm, setInstForm] = useState<UpdateInstitutionInput>({
    name: initialData.tenant.name || "",
    trade_name: initialData.tenant.trade_name || "",
    cnpj: initialData.tenant.cnpj || "",
    email: initialData.tenant.email || "",
    phone: initialData.tenant.phone || "",
    website: (initialData.tenant as any).website || "",
    logo_url: (initialData.tenant as any).logo_url || "",
    primary_color: (initialData.tenant as any).primary_color || "#4f46e5",
    address_street: (initialData.tenant as any).address_street || "",
    address_city: (initialData.tenant as any).address_city || "",
    address_state: (initialData.tenant as any).address_state || "",
    address_postal_code: (initialData.tenant as any).address_postal_code || "",
  });

  // Modal Convidar Membro
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    full_name: "",
    role: "secretaria" as "secretaria" | "financeiro" | "professor",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Manipulador Salvar Dados Institucionais
  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await updateInstitutionAction(instForm);
      if (res.success) {
        setMessage({ type: "success", text: "Dados institucionais atualizados com sucesso!" });
      } else {
        setMessage({ type: "error", text: res.error || "Falha ao salvar dados." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro inesperado ao salvar." });
    } finally {
      setIsSaving(false);
    }
  };

  // Manipulador Convidar Membro
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await inviteTeamMemberAction(inviteForm);
      if (res.success) {
        setMessage({ type: "success", text: `Acesso atribuído com sucesso para ${inviteForm.email}!` });
        setIsInviteOpen(false);
        setInviteForm({ email: "", full_name: "", role: "secretaria" });
        // Recarrega página para sincronizar dados
        window.location.reload();
      } else {
        setMessage({ type: "error", text: res.error || "Falha ao convidar membro." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro inesperado ao convidar." });
    } finally {
      setIsSaving(false);
    }
  };

  // Manipulador Alterar Papel
  const handleChangeRole = async (
    membershipId: string,
    newRole: "admin" | "secretaria" | "financeiro" | "professor"
  ) => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await updateTeamMemberRoleAction({ membership_id: membershipId, role: newRole });
      if (res.success) {
        setMessage({ type: "success", text: "Perfil de acesso atualizado com sucesso!" });
        setData((prev) => ({
          ...prev,
          team_members: prev.team_members.map((m) =>
            m.id === membershipId ? { ...m, role: newRole } : m
          ),
        }));
      } else {
        setMessage({ type: "error", text: res.error || "Falha ao atualizar perfil." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao atualizar perfil." });
    } finally {
      setIsSaving(false);
    }
  };

  // Manipulador Alternar Status (Ativar / Suspender)
  const handleToggleStatus = async (membershipId: string, currentStatus: boolean) => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await toggleTeamMemberStatusAction({
        membership_id: membershipId,
        is_active: !currentStatus,
      });
      if (res.success) {
        setMessage({
          type: "success",
          text: !currentStatus ? "Acesso reativado com sucesso!" : "Acesso do membro suspenso.",
        });
        setData((prev) => ({
          ...prev,
          team_members: prev.team_members.map((m) =>
            m.id === membershipId ? { ...m, is_active: !currentStatus } : m
          ),
        }));
      } else {
        setMessage({ type: "error", text: res.error || "Falha ao alterar status." });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao alterar status." });
    } finally {
      setIsSaving(false);
    }
  };

  const planTier = data.plan_entitlements.plan_tier;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Configurações Institucionais
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão da escola, controle de equipe, perfis de acesso e recursos contratados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="w-3.5 h-3.5" />
            Plano: {planTier === "gestao" ? "Gestão Básica" : planTier === "gestao_ead" ? "Gestão + EAD" : "Institucional"}
          </span>
        </div>
      </div>

      {/* Alerta de Mensagem */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("instituicao")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "instituicao"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Dados da Escola
        </button>
        <button
          onClick={() => setActiveTab("equipe")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "equipe"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Users className="w-4 h-4" />
          Equipe & Acessos ({data.team_members.length})
        </button>
        <button
          onClick={() => setActiveTab("pagamentos")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "pagamentos"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Pagamentos da Escola
        </button>
        <button
          onClick={() => setActiveTab("plano")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "plano"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Plano & Entitlements
        </button>
      </div>

      {/* Tab 1: Dados da Instituição */}
      {activeTab === "instituicao" && (
        <form onSubmit={handleSaveInstitution} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome Oficial da Instituição *
              </label>
              <input
                type="text"
                required
                value={instForm.name}
                onChange={(e) => setInstForm({ ...instForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nome Fantasia / Sigla
              </label>
              <input
                type="text"
                value={instForm.trade_name || ""}
                onChange={(e) => setInstForm({ ...instForm, trade_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                CNPJ (Opcional)
              </label>
              <input
                type="text"
                value={instForm.cnpj || ""}
                onChange={(e) => setInstForm({ ...instForm, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                E-mail Institucional de Contato
              </label>
              <input
                type="email"
                value={instForm.email || ""}
                onChange={(e) => setInstForm({ ...instForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={instForm.phone || ""}
                onChange={(e) => setInstForm({ ...instForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Website Institucional
              </label>
              <input
                type="url"
                value={instForm.website || ""}
                onChange={(e) => setInstForm({ ...instForm, website: e.target.value })}
                placeholder="https://suaescola.com.br"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Identidade Visual & Cores
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL do Logotipo Oficial (PNG/SVG)
                </label>
                <input
                  type="url"
                  value={instForm.logo_url || ""}
                  onChange={(e) => setInstForm({ ...instForm, logo_url: e.target.value })}
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cor Primária da Instituição
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={instForm.primary_color || "#4f46e5"}
                    onChange={(e) => setInstForm({ ...instForm, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-xl border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={instForm.primary_color || "#4f46e5"}
                    onChange={(e) => setInstForm({ ...instForm, primary_color: e.target.value })}
                    className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Endereço Físico (Para Certificados e Contratos)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Logradouro / Número
                </label>
                <input
                  type="text"
                  value={instForm.address_street || ""}
                  onChange={(e) => setInstForm({ ...instForm, address_street: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={instForm.address_city || ""}
                  onChange={(e) => setInstForm({ ...instForm, address_city: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Estado (UF)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={instForm.address_state || ""}
                  onChange={(e) => setInstForm({ ...instForm, address_state: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  value={instForm.address_postal_code || ""}
                  onChange={(e) => setInstForm({ ...instForm, address_postal_code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Equipe & Membros */}
      {activeTab === "equipe" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Membros da Equipe Institucional
              </h2>
              <p className="text-xs text-slate-500">
                Gerencie quem tem permissão para operar os módulos da instituição.
              </p>
            </div>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Novo Membro
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="p-4 font-semibold">Nome & E-mail</th>
                    <th className="p-4 font-semibold">Perfil / Papel</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.team_members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold">
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {member.full_name}
                            </div>
                            <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" />
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={member.role}
                          disabled={isSaving}
                          onChange={(e) =>
                            handleChangeRole(
                              member.id,
                              e.target.value as "admin" | "secretaria" | "financeiro" | "professor"
                            )
                          }
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                        >
                          <option value="admin">Administrador</option>
                          <option value="secretaria">Secretaria</option>
                          <option value="financeiro">Financeiro</option>
                          <option value="professor">Professor</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            member.is_active
                              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          }`}
                        >
                          {member.is_active ? "Ativo" : "Suspenso"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          disabled={isSaving}
                          onClick={() => handleToggleStatus(member.id, member.is_active)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            member.is_active
                              ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          }`}
                        >
                          {member.is_active ? "Suspender Acesso" : "Reativar Acesso"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Pagamentos da Escola (Gateway Asaas) */}
      {activeTab === "pagamentos" && (
        <SchoolPaymentGatewaySettings initialSummary={data.gateway_summary} />
      )}

      {/* Tab 4: Plano & Entitlements */}
      {activeTab === "plano" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                Direitos e Recursos do Plano SaaS
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Recursos liberados para esta escola conforme a assinatura institucional.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase font-bold text-slate-400">Plano Contratado</span>
              <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                {planTier === "gestao"
                  ? "Gestão Básica"
                  : planTier === "gestao_ead"
                  ? "Gestão + EAD"
                  : "Institucional"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Secretaria, Alunos e Matrículas
                </span>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Liberado
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Cadastro de alunos, cursos simples/estruturados, turmas e documentos.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Financeiro Escolar & Mensalidades
                </span>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Liberado
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Contas a receber, geração de parcelas, recibos e controle de inadimplência.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                data.plan_entitlements.features.ead
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"
                  : "border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Sala de Aula EAD (Vídeos & Materiais)
                </span>
                {data.plan_entitlements.features.ead ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Liberado
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Requer Gestão + EAD
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Aulas com vídeos incorporados do YouTube e materiais PDF protegidos.
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                data.plan_entitlements.features.provas
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"
                  : "border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Banco de Questões & Provas Online
                </span>
                {data.plan_entitlements.features.provas ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Liberado
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Requer Gestão + EAD
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Sorteio de questões, tentativas auditáveis e correção automática no servidor.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              <strong>Política de Planos SaaS:</strong> Os administradores da instituição não
              possuem permissão para alterar o próprio plano diretamente. Mudanças e upgrades
              devem ser solicitados ao suporte ou contratados pelo Alcântara Hub. O downgrade de
              plano nunca exclui dados históricos ou aulas pré-existentes.
            </span>
          </div>
        </div>
      )}

      {/* Modal Convidar Membro */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Convidar Membro para a Equipe
              </h3>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  E-mail do Membro *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Papel Institucional *
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      role: e.target.value as "secretaria" | "financeiro" | "professor",
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium"
                >
                  <option value="secretaria">Secretaria (Matrículas e Alunos)</option>
                  <option value="financeiro">Financeiro (Mensalidades e Cobrança)</option>
                  <option value="professor">Professor (Aulas e Notas)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  Confirmar Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
