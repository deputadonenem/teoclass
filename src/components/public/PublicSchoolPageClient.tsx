"use client";

import React, { useState } from "react";
import type { PublicSchoolInfo, SubmitLeadDTO } from "@/types/captacao";
import { submitPublicLeadAction, sendPublicChatMessageAction } from "@/app/actions/captacao";
import {
  BookOpen,
  Clock,
  GraduationCap,
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface PublicSchoolPageClientProps {
  school: PublicSchoolInfo;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export function PublicSchoolPageClient({ school }: PublicSchoolPageClientProps) {
  const { settings, courses } = school;

  // Estado do Formulário de Lead
  const [form, setForm] = useState<SubmitLeadDTO>({
    school_slug: school.slug,
    course_id: courses[0]?.id || null,
    full_name: "",
    email: "",
    phone: "",
    church_name: "",
    notes: "",
    source: "pagina_publica",
    lgpd_consent: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Estado do Chat de IA
  const [sessionToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`tc_chat_${school.tenant_id}`);
      if (stored) return stored;
      const newToken = "sess_" + Math.random().toString(36).substring(2, 12);
      sessionStorage.setItem(`tc_chat_${school.tenant_id}`, newToken);
      return newToken;
    }
    return "sess_init";
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: settings.ai_agent_welcome_message,
    },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Manipulador de Envio de Lead
  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await submitPublicLeadAction(form);
      if (res.error) {
        setSubmitError(res.error);
      } else {
        setSubmitSuccess(true);
      }
    } catch (err: any) {
      setSubmitError(err.message || "Falha ao enviar interesse.");
    } finally {
      setSubmitting(false);
    }
  };

  // Manipulador de Envio do Chat com IA
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || chatLoading) return;

    const userText = inputMsg.trim();
    setInputMsg("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setChatLoading(true);

    try {
      const res = await sendPublicChatMessageAction({
        school_slug: school.slug,
        session_token: sessionToken,
        message: userText,
      });

      if (res.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply! }]);
      } else if (res.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Desculpe, ocorreu uma instabilidade. Por favor, envie sua dúvida via formulário abaixo!",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Não foi possível obter resposta agora. Utilize nosso formulário de contato logo abaixo!",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header Institucional */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {school.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{school.name}</h1>
              <p className="text-xs text-slate-500 font-medium">Escola Teológica Oficial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#inscricao"
              className="text-xs sm:text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors shadow-xs"
            >
              Inscrever-se
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-white to-slate-100 py-16 px-4 border-b border-slate-200">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> Inscrições Abertas
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {settings.headline}
          </h2>
          {settings.subheadline && (
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              {settings.subheadline}
            </p>
          )}
          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <a
              href="#cursos"
              className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              Conhecer Cursos
            </a>
            <a
              href="#inscricao"
              className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Manifestar Interesse
            </a>
          </div>
        </div>
      </section>

      {/* Sobre a Instituição */}
      {settings.about_text && (
        <section className="py-12 px-4 max-w-4xl mx-auto text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-3">Sobre Nossa Escola</h3>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            {settings.about_text}
          </p>
        </section>
      )}

      {/* Catálogo de Cursos */}
      <section id="cursos" className="py-12 px-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Catálogo de Cursos</h3>
            <p className="text-sm text-slate-500">Formações bíblicas e teológicas com sólida fundamentação</p>
          </div>
          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
            {courses.length} curso(s) disponível(is)
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
            Nenhum curso publicado no momento. Entre em contato para saber sobre novas turmas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-md border border-amber-200">
                      {course.modality === "ead_assincrono"
                        ? "EAD Online"
                        : course.modality === "hibrido"
                        ? "Híbrido"
                        : "Presencial"}
                    </span>
                    {course.code && (
                      <span className="text-xs text-slate-400 font-mono">{course.code}</span>
                    )}
                  </div>

                  <h4 className="text-lg font-bold text-slate-900">{course.name}</h4>

                  <p className="text-xs text-slate-600 line-clamp-3">
                    {course.description || "Formação teológica sólida voltada para a edificação da Igreja."}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{course.workload_hours}h</span>
                    </div>
                    {course.duration_months && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{course.duration_months} meses</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  {course.price_info && course.price_info.installment_value > 0 ? (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Investimento</p>
                      <p className="text-sm font-bold text-slate-900">
                        {course.price_info.installments_count}x R$ {course.price_info.installment_value.toFixed(2)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Investimento</p>
                      <p className="text-xs font-semibold text-slate-600">Sob consulta</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setForm((prev) => ({ ...prev, course_id: course.id }));
                      const el = document.getElementById("inscricao");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                  >
                    Selecionar <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Formulário de Interesse / Inscrição */}
      <section id="inscricao" className="py-16 px-4 bg-slate-100 border-t border-slate-200">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-amber-100 text-amber-700 mb-3">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Manifestar Interesse</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Preencha os dados abaixo para receber informações sobre matrículas e grade curricular.
            </p>
          </div>

          {submitSuccess ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-lg font-bold text-emerald-900">Interesse Registrado com Sucesso!</h4>
              <p className="text-xs sm:text-sm text-emerald-700">
                Agradecemos o seu contato. A Secretaria Acadêmica da <strong>{school.name}</strong> entrará em contato em breve através do e-mail ou WhatsApp informado.
              </p>
              <button
                onClick={() => setSubmitSuccess(false)}
                className="text-xs font-semibold text-emerald-800 underline cursor-pointer pt-2"
              >
                Enviar nova manifestação
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitLead} className="space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Curso de Interesse *
                </label>
                <select
                  value={form.course_id || ""}
                  onChange={(e) => setForm({ ...form, course_id: e.target.value || null })}
                  className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">Selecione um curso...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.modality})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail de Contato *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={form.phone || ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Igreja ou Denominação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Igreja Batista Central, Presbiteriana, Assembleia..."
                  value={form.church_name || ""}
                  onChange={(e) => setForm({ ...form, church_name: e.target.value })}
                  className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dúvidas ou Observações
                </label>
                <textarea
                  rows={3}
                  placeholder="Escreva sua dúvida ou mensagem para a secretaria..."
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.lgpd_consent}
                    onChange={(e) => setForm({ ...form, lgpd_consent: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    required
                  />
                  <span>
                    Concordo em fornecer meus dados de contato para que a instituição <strong>{school.name}</strong> entre em contato sobre cursos e matrículas, em conformidade com a LGPD.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-bold text-sm rounded-lg transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? "Registrando interesse..." : "Enviar Manifestação de Interesse"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Widget Flutuante de Chat com IA */}
      {settings.ai_agent_enabled && (
        <div className="fixed bottom-6 right-6 z-50">
          {!chatOpen ? (
            <button
              onClick={() => setChatOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white p-3.5 rounded-full shadow-lg flex items-center gap-2.5 transition-transform hover:scale-105 cursor-pointer border border-slate-700"
            >
              <Bot className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold pr-1">Dúvidas? Fale com a IA</span>
            </button>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-80 sm:w-96 flex flex-col overflow-hidden max-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Header do Chat */}
              <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">{settings.ai_agent_name}</h4>
                    <p className="text-[10px] text-slate-300">Atendimento Virtual Oficial</p>
                  </div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Mensagens do Chat */}
              <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50 text-xs min-h-[260px] max-h-[340px]">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.role === "assistant" && (
                      <div className="h-6 w-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`p-3 rounded-xl max-w-[80%] leading-relaxed ${
                        m.role === "user"
                          ? "bg-amber-600 text-white rounded-br-none"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === "user" && (
                      <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                    <Bot className="w-3.5 h-3.5 animate-pulse" />
                    <span>Digitando resposta autorizada...</span>
                  </div>
                )}
              </div>

              {/* Input do Chat */}
              <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-slate-200 flex gap-2">
                <input
                  type="text"
                  placeholder="Pergunte sobre cursos, valores..."
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  disabled={chatLoading}
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !inputMsg.trim()}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white p-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Footer Público */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-10 px-4 text-xs border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <p className="font-bold text-slate-200">{school.name}</p>
            {settings.contact_email && <p>Contato: {settings.contact_email}</p>}
            {settings.contact_phone && <p>Telefone: {settings.contact_phone}</p>}
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Ambiente Acadêmico Seguro TeoClass</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
