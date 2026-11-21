import React from "react";

export function TargetAudience() {
  const audiences = [
    {
      title: "Seminários Teológicos",
      subtitle: "Para cursos de bacharelado, mestrado ministerial e formação avançada",
      points: [
        "Matrizes curriculares por período e semestres",
        "Controle rigoroso de notas, faltas e ementas",
        "Prontuário completo com histórico e documentação",
      ],
      icon: (
        <svg className="w-6 h-6 text-[#C9973D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: "Institutos Bíblicos & Escolas Ministeriais",
      subtitle: "Para escolas de liderança, ministério pastoral e missões",
      points: [
        "Inscrições e matrículas rápidas e centralizadas",
        "Aulas presenciais e transmissões gravadas integradas",
        "Gestão financeira simplificada com Pix e boletos automáticos",
      ],
      icon: (
        <svg className="w-6 h-6 text-[#C9973D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: "Igrejas Locais com EBD e Discipulado",
      subtitle: "Para congregações que oferecem cursos livres e formação contínua",
      points: [
        "Ambiente intuitivo e amigável para alunos de todas as idades",
        "Acesso facilitado pelo celular ou computador",
        "Emissão rápida de certificados de conclusão para celebrações",
      ],
      icon: (
        <svg className="w-6 h-6 text-[#C9973D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      title: "Plataformas Teológicas 100% Online",
      subtitle: "Para educadores que distribuem cursos e mentorias em escala",
      points: [
        "Videoaulas organizadas em módulos com suporte a Vimeo e YouTube",
        "Liberação de aulas e módulos com controle de acesso",
        "Emissão automatizada de certificados com autenticação pública",
      ],
      icon: (
        <svg className="w-6 h-6 text-[#C9973D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="para-quem-e" className="py-20 sm:py-24 bg-white border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabeçalho */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Flexibilidade & Escala
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1D33] tracking-tight font-serif">
            Desenvolvido para atender diferentes realidades de ensino bíblico
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Seja um seminário tradicional, uma escola ministerial intensiva ou uma rede de discipulado, o TeoClass adapta-se à sua metodologia.
          </p>
        </div>

        {/* Grade 2x2 de Segmentos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {audiences.map((aud) => (
            <div
              key={aud.title}
              className="p-8 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                    {aud.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0B1D33] tracking-tight">
                      {aud.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {aud.subtitle}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-2.5">
                  {aud.points.map((pt) => (
                    <div key={pt} className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-[#C9973D] shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="text-sm text-slate-700 leading-snug">
                        {pt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
