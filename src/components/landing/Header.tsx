"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

export function Header({
  onOpenDemo,
}: {
  onOpenDemo?: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Controle de abertura do menu com animação suave de 2 frames para disparar a transição CSS
  const openMenu = () => {
    setMobileMenuOpen(true);
    // Dispara o estado de animação no próximo frame para o navegador registrar a posição inicial
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
  };

  // Controle de fechamento suave com espera da transição de saída (380ms)
  const closeMenu = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setMobileMenuOpen(false);
      triggerButtonRef.current?.focus();
    }, 380);
  };

  // Bloqueio do scroll do body e safe area
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      // Foco automático no botão fechar dentro do drawer
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileMenuOpen]);

  // Tecla Escape para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 lg:h-24">
          {/* Logo Oficial */}
          <Link href="/" className="focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] rounded-lg py-1">
            <Logo variant="dark" size="header" />
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden lg:flex items-center gap-8">
            <a
              href="#recursos"
              className="text-sm font-medium text-slate-700 hover:text-[#0B1D33] transition-colors"
            >
              Recursos
            </a>
            <a
              href="#para-quem-e"
              className="text-sm font-medium text-slate-700 hover:text-[#0B1D33] transition-colors"
            >
              Para quem é
            </a>
            <a
              href="#planos"
              className="text-sm font-medium text-slate-700 hover:text-[#0B1D33] transition-colors"
            >
              Planos
            </a>
            <a
              href="#sobre"
              className="text-sm font-medium text-slate-700 hover:text-[#0B1D33] transition-colors"
            >
              Sobre
            </a>
          </nav>

          {/* Ações Desktop */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="/app/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50 transition-all shadow-xs"
            >
              <svg
                className="w-4 h-4 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Acessar sistema
            </Link>

            <button
              type="button"
              onClick={onOpenDemo}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#C9973D] hover:bg-[#B38432] text-white text-sm font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              Teste grátis por 7 dias
            </button>
          </div>

          {/* Botão Mobile Menu Hamburger */}
          <div className="flex items-center lg:hidden">
            <button
              ref={triggerButtonRef}
              type="button"
              onClick={openMenu}
              className="p-2.5 rounded-lg text-slate-700 hover:text-[#0B1D33] hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#C9973D]"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-offcanvas-menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        MENU MOBILE OFF-CANVAS PREMIUM (DRAWER LATERAL)
        - Desliza da direita para a esquerda (300ms ease-in-out)
        - Overlay escuro com fade-in/fade-out
        - Foco acessível e bloqueio de scroll
        ========================================================================
      */}
      {mobileMenuOpen && (
        <div
          id="mobile-offcanvas-menu"
          className="fixed inset-0 z-50 lg:hidden flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          {/* Overlay Escuro com Fade Suave */}
          <div
            className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-350 ease-out ${
              isAnimating ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* Painel Off-Canvas Deslizante com Easing Fluido */}
          <div
            ref={drawerRef}
            className={`relative z-10 w-[min(85vw,360px)] h-[100dvh] bg-white shadow-2xl flex flex-col justify-between transition-all duration-350 cubic-bezier transform will-change-transform ${
              isAnimating
                ? "translate-x-0 opacity-100"
                : "translate-x-full opacity-0"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Cabeçalho do Drawer: Logo + Botão Fechar */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <Link
                href="/"
                onClick={closeMenu}
                className="focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] rounded-md"
              >
                <Logo variant="dark" size="header" />
              </Link>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMenu}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#C9973D]"
                aria-label="Fechar menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Links de Navegação Verticais */}
            <nav className="flex-1 px-6 py-6 overflow-y-auto space-y-1">
              <a
                href="#recursos"
                onClick={closeMenu}
                className="flex items-center px-3 py-3 rounded-lg text-base font-semibold text-slate-800 hover:text-[#0B1D33] hover:bg-slate-50 transition-colors"
              >
                Recursos
              </a>
              <a
                href="#para-quem-e"
                onClick={closeMenu}
                className="flex items-center px-3 py-3 rounded-lg text-base font-semibold text-slate-800 hover:text-[#0B1D33] hover:bg-slate-50 transition-colors"
              >
                Para quem é
              </a>
              <a
                href="#planos"
                onClick={closeMenu}
                className="flex items-center px-3 py-3 rounded-lg text-base font-semibold text-slate-800 hover:text-[#0B1D33] hover:bg-slate-50 transition-colors"
              >
                Planos
              </a>
              <a
                href="#sobre"
                onClick={closeMenu}
                className="flex items-center px-3 py-3 rounded-lg text-base font-semibold text-slate-800 hover:text-[#0B1D33] hover:bg-slate-50 transition-colors"
              >
                Sobre
              </a>
            </nav>

            {/* Ações Inferiores: Acessar Sistema + Solicitar Demonstração */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-3">
              <Link
                href="/app/login"
                onClick={closeMenu}
                className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-all shadow-xs"
              >
                <svg
                  className="w-4 h-4 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Acessar sistema
              </Link>

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  if (onOpenDemo) onOpenDemo();
                }}
                className="w-full inline-flex items-center justify-center h-11 px-4 rounded-lg bg-[#C9973D] hover:bg-[#B38432] text-white text-sm font-semibold shadow-md transition-all cursor-pointer"
              >
                Teste grátis por 7 dias
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
