import React from "react";
import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer id="sobre" className="bg-[#071322] text-slate-400 text-sm border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Coluna 1 e 2: Marca & Descrição */}
          <div className="lg:col-span-2 space-y-4">
            <Logo variant="light" size="footer" />
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm pt-2">
              Plataforma especializada em gestão acadêmica, financeira e ambiente EAD integrada para seminários, institutos bíblicos e escolas de formação cristã.
            </p>
            <div className="pt-2 text-xs text-slate-500">
              Desenvolvido com excelência por <strong className="text-slate-300">Alcântara Sistemas</strong>.
            </div>
          </div>

          {/* Coluna 3: Plataforma */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Plataforma
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#recursos" className="hover:text-white transition-colors">
                  Secretaria Acadêmica
                </a>
              </li>
              <li>
                <a href="#recursos" className="hover:text-white transition-colors">
                  Cursos & Turmas
                </a>
              </li>
              <li>
                <a href="#recursos" className="hover:text-white transition-colors">
                  Ambiente EAD
                </a>
              </li>
              <li>
                <a href="#recursos" className="hover:text-white transition-colors">
                  Cobranças & Pix Asaas
                </a>
              </li>
              <li>
                <a href="#recursos" className="hover:text-white transition-colors">
                  Certificados Digitais
                </a>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Institucional & Planos */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Institucional
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#para-quem-e" className="hover:text-white transition-colors">
                  Para Quem É
                </a>
              </li>
              <li>
                <a href="#planos" className="hover:text-white transition-colors">
                  Planos & Condições
                </a>
              </li>
              <li>
                <Link href="/app/login" className="hover:text-white transition-colors">
                  Acesso à Escola
                </Link>
              </li>
              <li>
                <Link href="/app/ativar" className="hover:text-white transition-colors">
                  Ativar Assinatura
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 5: Segurança & Suporte */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Segurança & Confiabilidade
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Isolamento Multi-tenant</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Auditoria & Criptografia</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Conformidade LGPD</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Infraestrutura em Nuvem</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Linha Inferior com Copyright e Links de Rodapé */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2026 TeoClass — Alcântara Sistemas. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-6">
            <span>Gestão Acadêmica e EAD Teológico</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
