"use client";

import React, { useState } from "react";

export function DemoModal({
  isOpen,
  onClose,
  initialPlan = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: string;
}) {
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [studentsCount, setStudentsCount] = useState("");
  const [planInterest, setPlanInterest] = useState(initialPlan || "Gestão + EAD");
  const [notes, setNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulação do envio de solicitação comercial
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
        
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-lg transition-colors"
          aria-label="Fechar modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!isSubmitted ? (
          <div>
            <div className="mb-6">
              <span className="text-xs font-bold text-[#C9973D] uppercase tracking-wider">
                Atendimento Consultivo
              </span>
              <h3 className="text-2xl font-bold text-[#0B1D33] tracking-tight font-serif mt-1">
                Solicitar Demonstração
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Preencha os dados da sua instituição para conversarmos com um consultor TeoClass.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Seu Nome *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Pr. Carlos Eduardo"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:border-[#C9973D]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nome da Instituição ou Igreja *
                </label>
                <input
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Ex: Seminário Teológico Betel"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:border-[#C9973D]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    E-mail Corporativo *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@seminario.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:border-[#C9973D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    WhatsApp / Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:border-[#C9973D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Plano de Interesse
                  </label>
                  <select
                    value={planInterest}
                    onChange={(e) => setPlanInterest(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:border-[#C9973D] bg-white"
                  >
                    <option value="Gestão">Gestão</option>
                    <option value="Gestão + EAD">Gestão + EAD (Recomendado)</option>
                    <option value="Institucional">Institucional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nº Estimado de Alunos
                  </label>
                  <select
                    value={studentsCount}
                    onChange={(e) => setStudentsCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:border-[#C9973D] bg-white"
                  >
                    <option value="">Selecione...</option>
                    <option value="1-50">Até 50 alunos</option>
                    <option value="51-200">51 a 200 alunos</option>
                    <option value="201-500">201 a 500 alunos</option>
                    <option value="500+">Mais de 500 alunos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mensagem ou Dúvida (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Conte um pouco sobre as necessidades da sua escola..."
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:border-[#C9973D]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-lg bg-[#C9973D] hover:bg-[#B38432] text-white text-sm font-semibold shadow-md transition-all cursor-pointer"
                >
                  Enviar Solicitação
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  Retornaremos o contato em horário comercial com uma apresentação guiada.
                </p>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-[#0B1D33] font-serif">
              Solicitação Recebida com Sucesso!
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              Obrigado, <strong className="text-slate-800">{name}</strong>. Nossa equipe entrará em contato em breve através do e-mail <strong>{email}</strong> ou WhatsApp.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  onClose();
                }}
                className="px-6 py-2.5 rounded-lg bg-[#0B1D33] text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
