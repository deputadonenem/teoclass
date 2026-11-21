import React from "react";

interface BenefitCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

function BenefitCard({ title, description, icon }: BenefitCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 sm:p-7 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
      <div>
        {/* Ícone em moldura arredondada suave */}
        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#C9973D] mb-5 shadow-inner">
          {icon}
        </div>

        {/* Título */}
        <h3 className="text-lg font-bold text-[#0B1D33] tracking-tight mb-2">
          {title}
        </h3>

        {/* Descrição */}
        <p className="text-sm text-slate-600 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

export function Benefits() {
  const benefits = [
    {
      title: "Secretaria Acadêmica",
      description:
        "Matrículas, rematrículas, prontuário completo do aluno, histórico acadêmico e emissão de documentos oficiais em poucos cliques.",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      title: "Cursos e Turmas",
      description:
        "Gestão completa de cursos, períodos, turmas, professores, disciplinas e cargas horárias com matrizes curriculares organizadas.",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
    {
      title: "EAD Integrado",
      description:
        "Ambiente de aprendizagem com videoaulas, materiais didáticos, avaliações online e acompanhamento detalhado do progresso do aluno.",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 14l9-5-9-5-9 5 9 5z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
          />
        </svg>
      ),
    },
    {
      title: "Financeiro",
      description:
        "Controle de mensalidades, planos de pagamento, inadimplência e integração com Asaas para emissão de Boletos e Pix automatizados.",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      title: "Certificados",
      description:
        "Emissão digital e segura de certificados de conclusão com código de autenticidade, validação pública e modelos personalizados.",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      title: "Relatórios e Gestão",
      description:
        "Indicadores acadêmicos, taxas de evasão, fluxo financeiro e métricas de desempenho para tomada de decisões estratégicas da liderança.",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
  ];

  return (
    <section id="recursos" className="py-20 sm:py-24 bg-[#F7F5F1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabeçalho da Seção */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1D33] tracking-tight font-serif">
            Tudo o que sua escola precisa para crescer com organização
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Recursos integrados, simples de usar e pensados para a realidade
            das instituições teológicas e cristãs.
          </p>
        </div>

        {/* Grade de 6 Cards de Benefícios */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {benefits.map((benefit) => (
            <BenefitCard
              key={benefit.title}
              title={benefit.title}
              description={benefit.description}
              icon={benefit.icon}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
