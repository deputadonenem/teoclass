"use client";

import React, { useState } from "react";
import type { Lead, PublicPageSettings } from "@/types/captacao";
import { updateLeadStatusAction, updatePublicPageSettingsAction } from "@/app/actions/captacao";
import {
  Sparkles,
  Users,
  Bot,
  Globe,
  Settings,
  Mail,
  Phone,
  Church,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Save,
  AlertCircle,
} from "lucide-react";

interface CaptacaoDashboardClientProps {
  initialLeads: Lead[];
  initialSettings: PublicPageSettings | null;
  tenantSlug: string;
  userRole: string;
}

export function CaptacaoDashboardClient({
  initialLeads,
  initialSettings,
  tenantSlug,
  userRole,
}: CaptacaoDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"leads" | "settings">("leads");
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [settings, setSettings] = useState<PublicPageSettings>(
    initialSettings || {
      tenant_id: "",
      is_published: true,
      show_financial_values: false,
      headline: "Formação Teológica Ministerial",
      subheadline: "Cursos bíblicos e acadêmicos com excelência e fidelidade doutrinária.",
      about_text: "",
      contact_email: "",
      contact_phone: "",
      contact_whatsapp: "",
      address_display: "",
      ai_agent_enabled: true,
      ai_agent_name: "Assistente TeoClass",
      ai_agent_welcome_message: "Paz! Como posso ajudar você a conhecer nossos cursos?",
      ai_agent_instructions: "",
      ai_daily_limit_messages: 500,
    }
  );

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const filteredLeads = leads.filter((l) => {
    if (statusFilter === "todos") return true;
    return l.status === statusFilter;
  });

  const handleStatusChange = async (leadId: string, newStatus: Lead["status"]) => {
    try {
      const res = await updateLeadStatusAction(leadId, newStatus);
      if (res.success) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
        );
      }
    } catch (err) {
      console.error("Erro ao mudar status do lead:", err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);

    try {
      const res = await updatePublicPageSettingsAction(settings);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const publicUrl = `/escola/${tenantSlug}`;

  return (
    <div className="space-y-6">
      {/* Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Captação & Atendimento com IA</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão de leads interessados, página pública da escola e assistente virtual inteligente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            <Globe className="w-4 h-4 text-amber-400" />
            <span>Ver Página Pública</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab("leads")}
          className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === "leads"
              ? "border-amber-600 text-amber-800"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Interessados / Leads ({leads.length})</span>
        </button>

        {userRole === "admin" && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === "settings"
                ? "border-amber-600 text-amber-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações da Página & IA</span>
          </button>
        )}
      </div>

      {/* Aba de Leads */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">Filtrar por Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              >
                <option value="todos">Todos os status</option>
                <option value="novo">Novos</option>
                <option value="em_contato">Em contato</option>
                <option value="matriculado">Matriculados</option>
                <option value="descartado">Descartados</option>
              </select>
            </div>
            <span className="text-xs text-slate-400">
              Exibindo {filteredLeads.length} registro(s)
            </span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold">Nenhum interessado encontrado neste filtro.</p>
              <p className="text-xs text-slate-400">
                Os interessados que preencherem o formulário na página pública ou conversarem com a IA aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Nome & Contato</th>
                      <th className="py-3 px-4">Curso de Interesse</th>
                      <th className="py-3 px-4">Igreja / Cidade</th>
                      <th className="py-3 px-4">Origem</th>
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Status & Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{lead.full_name}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {lead.email}
                            </span>
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {lead.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{lead.course_name}</span>
                          {lead.notes && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5 max-w-xs truncate">
                              &ldquo;{lead.notes}&rdquo;
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {lead.church_name ? (
                            <span className="flex items-center gap-1">
                              <Church className="w-3.5 h-3.5 text-slate-400" />
                              {lead.church_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {lead.source === "chat_ia" ? "Chat IA" : "Página Pública"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value as any)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-hidden ${
                              lead.status === "novo"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : lead.status === "em_contato"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : lead.status === "matriculado"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            <option value="novo">Novo</option>
                            <option value="em_contato">Em Contato</option>
                            <option value="matriculado">Matriculado</option>
                            <option value="descartado">Descartado</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aba de Configurações da Página Pública & IA */}
      {activeTab === "settings" && userRole === "admin" && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs max-w-4xl">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-600" />
              Identidade da Página Pública
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina o texto de apresentação que visitantes verão ao acessar o link público da escola.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.is_published}
                  onChange={(e) => setSettings({ ...settings, is_published: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Página Pública Ativa e Acessível para Visitantes</span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.show_financial_values}
                  onChange={(e) => setSettings({ ...settings, show_financial_values: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Exibir Valores de Planos e Investimento no Catálogo Público</span>
              </label>
              <p className="text-[11px] text-slate-400 ml-6 mt-0.5">
                Quando desmarcado, os preços são ocultados e a página exibe &ldquo;Sob consulta&rdquo;.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Título Principal (Headline)
              </label>
              <input
                type="text"
                value={settings.headline}
                onChange={(e) => setSettings({ ...settings, headline: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subtítulo (Subheadline)
              </label>
              <input
                type="text"
                value={settings.subheadline || ""}
                onChange={(e) => setSettings({ ...settings, subheadline: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Texto &ldquo;Sobre Nós&rdquo; / Missão da Instituição
              </label>
              <textarea
                rows={3}
                value={settings.about_text || ""}
                onChange={(e) => setSettings({ ...settings, about_text: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail de Contato Exibido
              </label>
              <input
                type="email"
                value={settings.contact_email || ""}
                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone / WhatsApp Exibido
              </label>
              <input
                type="tel"
                value={settings.contact_phone || ""}
                onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="border-b border-slate-200 pb-4 pt-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-600" />
              Assistente Virtual com IA
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure o comportamento do agente que responde dúvidas de interessados na página pública.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.ai_agent_enabled}
                  onChange={(e) => setSettings({ ...settings, ai_agent_enabled: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Habilitar Assistente Virtual com IA na Página Pública</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Assistente
                </label>
                <input
                  type="text"
                  value={settings.ai_agent_name}
                  onChange={(e) => setSettings({ ...settings, ai_agent_name: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Limite Diário de Mensagens
                </label>
                <input
                  type="number"
                  min="50"
                  max="5000"
                  value={settings.ai_daily_limit_messages}
                  onChange={(e) =>
                    setSettings({ ...settings, ai_daily_limit_messages: parseInt(e.target.value) || 500 })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mensagem Inicial de Boas-Vindas
              </label>
              <input
                type="text"
                value={settings.ai_agent_welcome_message}
                onChange={(e) => setSettings({ ...settings, ai_agent_welcome_message: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instruções Especiais para a IA (Opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Enfatizar que as aulas do curso de Teologia iniciam em fevereiro; mencionar que oferecemos bolsas pastorais sob análise..."
                value={settings.ai_agent_instructions}
                onChange={(e) => setSettings({ ...settings, ai_agent_instructions: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500 resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                A IA sempre prioriza os dados reais do banco e nunca inventa preços ou prazos inexistentes.
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? "Salvando..." : "Salvar Configurações"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
