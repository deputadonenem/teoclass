"use client";

import React, { useState } from "react";

interface PlanItem {
  id: "gestao" | "gestao_ead" | "institucional";
  name: string;
  badge: string | null;
  subtitle: string;
  priceValue: string;
  pricePeriod: string;
  priceNote: string;
  primaryFeatures: string[];
  allModules: {
    category: string;
    items: string[];
  }[];
  buttonText: string;
  featured: boolean;
}

export function Pricing({
  onSelectPlan,
}: {
  onSelectPlan?: (planName: string) => void;
}) {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const toggleAccordion = (planId: string) => {
    setExpandedPlan((prev) => (prev === planId ? null : planId));
  };

  const plans: PlanItem[] = [
    {
      id: "gestao",
      name: "Gestão",
      badge: null,
      subtitle: "Para escolas que precisam organizar secretaria, turmas, notas e cobranças.",
      priceValue: "Sob consulta",
      pricePeriod: "",
      priceNote: "Proposta conforme o porte da instituição",
      primaryFeatures: [
        "Faixa inicial escalonada por alunos ativos",
        "Secretaria acadêmica e matrículas",
        "Gestão financeira escolar integrada",
        "Emissão de certificados padrão",
      ],
      allModules: [
        {
          category: "Módulos Inclusos",
          items: [
            "Secretaria Acadêmica: matrículas, rematrículas e prontuário",
            "Gestão de Cursos e Turmas com professores e disciplinas",
            "Lançamento de notas, frequências e boletins",
            "Financeiro Escolar: controle de mensalidades e Pix/Boleto Asaas",
            "Emissão e autenticação de certificados digitais",
            "Sem Portal do Aluno, sem página pública e sem EAD",
          ],
        },
      ],
      buttonText: "Solicitar proposta",
      featured: false,
    },
    {
      id: "gestao_ead",
      name: "Gestão + EAD",
      badge: "Plano Completo",
      subtitle: "Gestão integrada com página pública, Portal do Aluno e EAD.",
      priceValue: "Sob consulta",
      pricePeriod: "",
      priceNote: "Proposta conforme o porte da instituição",
      primaryFeatures: [
        "Tudo do plano Gestão incluso",
        "Página pública institucional exclusiva",
        "Portal do Aluno e Sala Virtual EAD",
        "Banco de questões e provas online",
      ],
      allModules: [
        {
          category: "Módulos Inclusos",
          items: [
            "Todos os recursos e módulos do plano Gestão",
            "Página Pública Oficial da Escola Teológica por slug",
            "Portal do Aluno individual para videoaulas e materiais",
            "Ambiente Virtual EAD com suporte a vídeos (Vimeo/YouTube)",
            "Trilhas de estudo com apostilas em PDF e materiais de apoio",
            "Banco de questões e avaliações rotativas online",
            "Correção automática de provas no servidor",
          ],
        },
      ],
      buttonText: "Solicitar proposta",
      featured: true,
    },
    {
      id: "institucional",
      name: "Institucional",
      badge: null,
      subtitle: "Para convenções, múltiplos polos e grandes seminários teológicos.",
      priceValue: "Sob consulta",
      pricePeriod: "",
      priceNote: "Proposta sob medida conforme a estrutura",
      primaryFeatures: [
        "Alunos e polos ilimitados por instituto",
        "Página pública institucional e Portal do Aluno",
        "Todos os módulos da plataforma habilitados",
        "Suporte técnico prioritário dedicado",
      ],
      allModules: [
        {
          category: "Módulos Inclusos",
          items: [
            "Todos os recursos dos planos Gestão e Gestão + EAD",
            "Página pública personalizada com Área do Aluno integrada",
            "Suporte a múltiplos polos, extensões e institutos afiliados",
            "Personalizações e integrações sob demanda",
            "Treinamento dedicado da equipe acadêmica e financeira",
            "SLA de atendimento prioritário e consultivo",
          ],
        },
      ],
      buttonText: "Falar com consultor",
      featured: false,
    },
  ];

  return (
    <section id="planos" className="py-20 sm:py-24 bg-[#F8F9FA] border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabeçalho da Seção de Planos */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-bold tracking-widest text-[#C9973D] uppercase">
            PLANOS & CONDIÇÕES
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1D33] tracking-tight font-serif">
            Planos para diferentes etapas da sua instituição
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Escolha o modelo ideal para a quantidade de alunos e a metodologia da sua escola teológica.
          </p>
        </div>

        {/* 3 Cards de Planos em Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const isExpanded = expandedPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-md ${
                  plan.featured
                    ? "bg-[#0B1D33] text-white ring-2 ring-[#C9973D] shadow-xl lg:-translate-y-2"
                    : "bg-white text-slate-900 border border-slate-200/90"
                }`}
              >
                {/* Badge Superior Neutro (ex: "Plano Completo") */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full bg-[#C9973D] text-white text-xs font-bold tracking-wide uppercase shadow-sm">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Nome do Plano */}
                  <h3
                    className={`text-2xl font-bold tracking-tight mb-2 ${
                      plan.featured ? "text-white" : "text-[#0B1D33]"
                    }`}
                  >
                    {plan.name}
                  </h3>

                  {/* Subtítulo Descritivo */}
                  <p
                    className={`text-xs sm:text-sm leading-relaxed mb-6 min-h-[40px] ${
                      plan.featured ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    {plan.subtitle}
                  </p>

                  {/* Bloco de Preço */}
                  <div className="mb-6 pb-6 border-b border-slate-200/40">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                          plan.featured ? "text-[#C9973D]" : "text-[#0B1D33]"
                        }`}
                      >
                        {plan.priceValue}
                      </span>
                      {plan.pricePeriod && (
                        <span
                          className={`text-sm font-medium ${
                            plan.featured ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {plan.pricePeriod}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] mt-1.5 font-medium ${
                        plan.featured ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {plan.priceNote}
                    </p>
                  </div>

                  {/* Lista Resumida de Recursos com Checks */}
                  <ul className="space-y-3 mb-6">
                    {plan.primaryFeatures.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <span
                          className={`flex items-center justify-center w-4 h-4 rounded-full shrink-0 mt-0.5 ${
                            plan.featured
                              ? "bg-[#C9973D]/25 text-[#C9973D]"
                              : "bg-amber-100 text-[#C9973D]"
                          }`}
                        >
                          <svg
                            className="w-2.5 h-2.5 stroke-[3]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-medium leading-snug ${
                            plan.featured ? "text-slate-200" : "text-slate-700"
                          }`}
                        >
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Área de Ações e Expansão de Módulos */}
                <div className="space-y-4 pt-4 border-t border-slate-200/40">
                  {/* Botão Principal de Conversão */}
                  <button
                    type="button"
                    onClick={() => onSelectPlan && onSelectPlan(plan.name)}
                    className={`w-full min-h-[46px] py-3 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer text-center shadow-xs ${
                      plan.featured
                        ? "bg-[#C9973D] hover:bg-[#B38432] text-white hover:shadow-md"
                        : "bg-[#0B1D33] hover:bg-slate-800 text-white"
                    }`}
                  >
                    {plan.buttonText}
                  </button>

                  {/* Expansão Acessível "Módulos Inclusos" */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleAccordion(plan.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`modules-${plan.id}`}
                      className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 transition-colors cursor-pointer ${
                        plan.featured
                          ? "text-[#C9973D] hover:text-amber-300"
                          : "text-slate-600 hover:text-[#0B1D33]"
                      }`}
                    >
                      <span>{isExpanded ? "Ocultar módulos" : "Módulos inclusos"}</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : "rotate-0"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Conteúdo Expansível dos Módulos Reais */}
                    {isExpanded && (
                      <div
                        id={`modules-${plan.id}`}
                        className={`mt-3 p-3.5 rounded-lg text-left text-xs space-y-2 border animate-in fade-in duration-200 ${
                          plan.featured
                            ? "bg-slate-900/80 border-slate-700 text-slate-300"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        {plan.allModules.map((modGroup) => (
                          <div key={modGroup.category} className="space-y-1.5">
                            <span
                              className={`block font-bold text-[11px] uppercase tracking-wider ${
                                plan.featured ? "text-amber-400" : "text-[#0B1D33]"
                              }`}
                            >
                              {modGroup.category}
                            </span>
                            <ul className="space-y-1 pl-1">
                              {modGroup.items.map((item) => (
                                <li key={item} className="flex items-start gap-1.5 leading-snug">
                                  <span className="text-[#C9973D] mt-0.5">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
