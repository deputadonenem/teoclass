import { BookOpen, ShieldCheck, GraduationCap, ArrowRight, Layers, Award } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Header Institucional */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-900 flex items-center justify-center text-white shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-slate-900">Teo<span className="text-indigo-900">Class</span></span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full border border-indigo-150">
                SaaS Teológico
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ambiente Local Ativo
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-6">
          <Award className="w-3.5 h-3.5" />
          Fase de Fundação — Lote 1.1 Concluído
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-3xl leading-tight">
          Gestão acadêmica e EAD para <span className="text-indigo-900">instituições teológicas</span>.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
          Uma plataforma independente, concebida para atender seminários, institutos bíblicos e escolas cristãs com simplicidade, segurança e controle.
        </p>

        {/* Status Card */}
        <div className="mt-10 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-left max-w-xl w-full">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Status da Instalação Local</span>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">v0.1.0-alpha</span>
          </div>

          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Next.js 16 (App Router) + React 19 + TypeScript Strict</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Tailwind CSS 4 + Isolamento Multi-tenant Planejado</span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Estrutura de Migrations e Arquitetura Preparadas</span>
            </div>
          </div>
        </div>

        {/* Pilares */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl text-left">
          <div className="p-5 bg-white border border-slate-200 rounded-xl">
            <h3 className="font-semibold text-slate-900 text-base">Secretaria & Alunos</h3>
            <p className="mt-2 text-sm text-slate-600">
              Processos desburocratizados, matrículas flexíveis e cadastros adequados à realidade de alunos adultos.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl">
            <h3 className="font-semibold text-slate-900 text-base">Cursos & EAD</h3>
            <p className="mt-2 text-sm text-slate-600">
              Formatos simples e estruturados com aulas, materiais protegidos e avaliações com correção no servidor.
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl">
            <h3 className="font-semibold text-slate-900 text-base">Financeiro & Certificados</h3>
            <p className="mt-2 text-sm text-slate-600">
              Gestão de mensalidades, integração opcional com Asaas próprio da escola e emissão com validação pública por QR Code.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>&copy; 2026 TeoClass — Alcântara Sistemas. Todos os direitos reservados.</span>
          <span>Ambiente de Desenvolvimento Local</span>
        </div>
      </footer>
    </div>
  );
}
