import React from "react";

export function Pricing({
  onSelectPlan,
}: {
  onSelectPlan?: (planName: string) => void;
}) {
  const plans = [
    {
      id: "gestao",
      name: "Gestão",
      badge: null,
      subtitle: "Ideal para escolas que precisam organizar o dia a dia acadêmico.",
      features: [
        "Secretaria e matrículas",
        "Alunos e turmas",
        "Financeiro completo",
        "Relatórios acadêmicos",
        "Prontuário e histórico do aluno",
        "Emissão de certificados padrão",
      ],
      buttonText: "Ver detalhes do plano",
      buttonStyle: "border border-slate-300 text-slate-800 hover:bg-slate-50",
      featured: false,
      icon: (
        <svg className="w-8 h-8 text-[#C9973D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: "gestao_ead",
      name: "Gestão + EAD",
      badge: "Mais escolhido",
      subtitle: "Gestão completa com ambiente EAD integrado para cursos presenciais, semipresenciais ou 100% online.",
      features: [
        "Tudo do plano Gestão",
        "Ambiente EAD (videoaulas e avaliações)",
        "Materiais e trilhas de estudo",
        "Acompanhamento do aluno em tempo real",
        "Provas e questionários online",
        "Certificados digitais com validação pública",
      ],
      buttonText: "Ver detalhes do plano",
      buttonStyle: "bg-[#C9973D] hover:bg-[#B38432] text-white shadow-md",
      featured: true,
      icon: (
        <svg className="w-8 h-8 text-[#C9973D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
    },
    {
      id: "institucional",
      name: "Institucional",
      badge: null,
      subtitle: "Solução personalizada para instituições maiores ou com necessidades específicas.",
      features: [
        "Todos os recursos da plataforma",
        "Personalizações sob demanda",
        "Suporte prioritário dedicado",
        "Implantação assistida com treinamento",
        "Múltiplos polos e congregações",
        "Integrações dedicadas de sistema",
      ],
      buttonText: "Falar com um consultor",
      buttonStyle: "border border-slate-300 text-slate-800 hover:bg-slate-50",
      featured: false,
      icon: (
        <svg className="w-8 h-8 text-[#C9973D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="planos" className="py-20 sm:py-24 bg-[#0B1D33] text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabeçalho da Seção de Planos */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <span className="text-xs font-bold tracking-widest text-[#C9973D] uppercase">
            PLANOS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-serif">
            Planos para diferentes etapas da sua instituição
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Escolha o plano ideal para o momento da sua escola teológica.
          </p>
        </div>

        {/* 3 Cards de Planos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 flex flex-col justify-between transition-all duration-200 bg-white text-slate-900 shadow-xl ${
                  plan.featured
                    ? "ring-2 ring-[#C9973D] lg:-translate-y-2"
                    : "border border-slate-200"
                }`}
              >
                {/* Badge de Destaque Superior (Mais Escolhido) */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#C9973D] text-white text-xs font-bold tracking-wide uppercase shadow-sm">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Ícone */}
                  <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mb-5">
                    {plan.icon}
                  </div>

                  {/* Nome do Plano */}
                  <h3 className="text-2xl font-bold text-[#0B1D33] tracking-tight mb-2">
                    {plan.name}
                  </h3>

                  {/* Subtítulo */}
                  <p className="text-sm text-slate-600 leading-relaxed mb-6 min-h-[44px]">
                    {plan.subtitle}
                  </p>

                  {/* Divisor */}
                  <div className="w-full h-px bg-slate-200 mb-6" />

                  {/* Lista de Recursos com Checks */}
                  <ul className="space-y-3.5 mb-8">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-[#C9973D] shrink-0 mt-0.5">
                          <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <span className="text-sm font-medium text-slate-700 leading-snug">
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Botão de Ação */}
                <button
                  type="button"
                  onClick={() => onSelectPlan && onSelectPlan(plan.name)}
                  className={`w-full py-3.5 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer text-center ${plan.buttonStyle}`}
                >
                  {plan.buttonText}
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
