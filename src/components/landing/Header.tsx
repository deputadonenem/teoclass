"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

export function Header({
  onOpenDemo,
}: {
  onOpenDemo?: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
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
              Solicitar demonstração
            </button>
          </div>

          {/* Botão Mobile Menu Hamburger */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:text-[#0B1D33] hover:bg-slate-100 transition-colors"
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile Retrátil */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-2">
            <a
              href="#recursos"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-100"
            >
              Recursos
            </a>
            <a
              href="#para-quem-e"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-100"
            >
              Para quem é
            </a>
            <a
              href="#planos"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-100"
            >
              Planos
            </a>
            <a
              href="#sobre"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-800 hover:bg-slate-100"
            >
              Sobre
            </a>
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2.5">
            <Link
              href="/app/login"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Acessar sistema
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenDemo) onOpenDemo();
              }}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#C9973D] hover:bg-[#B38432] text-white text-sm font-semibold shadow-xs"
            >
              Solicitar demonstração
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
