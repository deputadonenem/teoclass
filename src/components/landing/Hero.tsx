import React from "react";

export function Hero({
  onOpenDemo,
}: {
  onOpenDemo?: () => void;
}) {
  const checklistItems = [
    "Matrículas e secretaria",
    "Gestão financeira",
    "Cursos e turmas",
    "EAD com videoaulas",
    "Avaliações e notas",
    "Certificados digitais",
  ];

  const checklistCol1 = [
    "Matrículas e secretaria",
    "Gestão financeira",
    "Cursos e turmas",
  ];

  const checklistCol2 = [
    "EAD com videoaulas",
    "Avaliações e notas",
    "Certificados digitais",
  ];

  return (
    <section className="relative w-full overflow-hidden bg-[#0B1D33] text-white">
      {/* 
        ========================================================================
        1. VERSÃO DESKTOP (lg e acima: a partir de 1024px)
        Preserva INTEGRALMENTE a implementação aprovada no desktop:
        - Imagem bg_hero.png como background-image cover
        - Conteúdo restrito à coluna azul esquerda
        - Proporções, tipografia e botões aprovados
        ========================================================================
      */}
      <div
        className="hidden lg:flex relative w-full overflow-hidden bg-no-repeat bg-[#0B1D33]"
        style={{
          backgroundImage: "url('/img/bg_hero.png')",
          backgroundPosition: "center top",
          backgroundSize: "cover",
        }}
      >
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-8 pt-10 sm:pt-12 lg:pt-14 pb-44 sm:pb-52 lg:pb-60">
          <div className="w-full max-w-[420px] text-left space-y-5">
            {/* Badge */}
            <div>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B1D33]/90 border border-slate-700/80 text-xs font-medium text-slate-200 shadow-sm backdrop-blur-xs">
                <svg
                  className="w-4 h-4 text-[#C9973D] shrink-0"
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
                <span>Gestão acadêmica e EAD em uma só plataforma</span>
              </span>
            </div>

            {/* Título com destaque dourado */}
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight text-white leading-[1.15] font-serif">
              Sua instituição ensina.{" "}
              <span className="text-[#C9973D] block">
                O TeoClass organiza
              </span>{" "}
              todo o resto.
            </h1>

            {/* Subtítulo */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              A plataforma completa para escolas teológicas, seminários e
              institutos bíblicos que desejam mais organização, eficiência e
              alcance na formação ministerial.
            </p>

            {/* Checklist em 2 colunas no desktop */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
              <div className="space-y-2.5">
                {checklistCol1.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#C9973D]/25 text-[#C9973D] shrink-0">
                      <svg
                        className="w-3 h-3 stroke-[2.5]"
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
                    <span className="text-xs sm:text-sm font-medium text-slate-200">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                {checklistCol2.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#C9973D]/25 text-[#C9973D] shrink-0">
                      <svg
                        className="w-3 h-3 stroke-[2.5]"
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
                    <span className="text-xs sm:text-sm font-medium text-slate-200">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões de Ação no desktop */}
            <div className="flex flex-row items-center gap-3.5 pt-2">
              <a
                href="#recursos"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#C9973D] hover:bg-[#B38432] text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Conhecer o TeoClass
              </a>

              <button
                type="button"
                onClick={onOpenDemo}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-600 bg-[#0B1D33]/80 hover:bg-[#0B1D33] text-slate-200 hover:text-white text-sm font-medium transition-all cursor-pointer backdrop-blur-xs"
              >
                <svg
                  className="w-4 h-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Solicitar demonstração
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        2. VERSÃO MOBILE & TABLET (abaixo de 1024px: 360px, 390px, 430px, 768px)
        Fidelidade Estrita ao Mockup Mobile:
        - Fundo azul-marinho profundo uniforme (#0B1D33)
        - Badge compacto
        - Título H1 expressivo e proporcional
        - Subtítulo
        - Checklist em 2 colunas com checks dourados
        - Botão dourado "Conhecer o TeoClass" em largura total
        - Botão contorno "Solicitar demonstração" em largura total
        - Imagem bg_hero.png com enquadramento completo (proporção natural 1440x700)
        ========================================================================
      */}
      <div className="lg:hidden flex flex-col w-full bg-[#0B1D33]">
        {/* Bloco Superior: Conteúdo Textual e Ações */}
        <div className="w-full px-5 py-7 sm:px-8 sm:py-9 space-y-4 sm:space-y-5">
          {/* Badge */}
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d2238] border border-slate-700/80 text-[11px] font-medium text-slate-200">
              <svg
                className="w-3.5 h-3.5 text-[#C9973D] shrink-0"
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
              <span>Gestão acadêmica e EAD em uma só plataforma</span>
            </span>
          </div>

          {/* Título Principal */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-[1.18] font-serif">
            Sua instituição ensina.{" "}
            <span className="text-[#C9973D] block">
              O TeoClass organiza
            </span>{" "}
            todo o resto.
          </h1>

          {/* Subtítulo */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            A plataforma completa para escolas teológicas, seminários e
            institutos bíblicos que desejam mais organização, eficiência e
            alcance na formação ministerial.
          </p>

          {/* Checklist em 2 Colunas exatamente como no mockup */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-0.5">
            <div className="space-y-2">
              {checklistCol1.map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#C9973D]/25 text-[#C9973D] shrink-0">
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
                  <span className="text-[11px] sm:text-xs font-medium text-slate-200 truncate">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {checklistCol2.map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#C9973D]/25 text-[#C9973D] shrink-0">
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
                  <span className="text-[11px] sm:text-xs font-medium text-slate-200 truncate">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Botões de Ação Mobile Empilhados em Largura Total */}
          <div className="flex flex-col gap-2.5 pt-2">
            <a
              href="#recursos"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-[#C9973D] hover:bg-[#B38432] text-white text-sm font-semibold shadow-md transition-all text-center"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Conhecer o TeoClass
            </a>

            <button
              type="button"
              onClick={onOpenDemo}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-slate-600 bg-[#0d2238] hover:bg-[#122b46] text-slate-200 hover:text-white text-sm font-medium transition-all cursor-pointer text-center"
            >
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Solicitar demonstração
            </button>
          </div>
        </div>

        {/* Bloco Inferior: Fotografia na proporção natural (1440x700 -> aspect-[1440/700]) */}
        <div
          className="w-full aspect-[1440/700] bg-no-repeat bg-cover bg-center"
          style={{
            backgroundImage: "url('/img/bg_hero.png')",
          }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
