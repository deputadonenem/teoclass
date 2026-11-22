"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/landing/Logo";
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Building2,
  Users,
  ShieldCheck,
  Briefcase,
  RotateCcw,
} from "lucide-react";

export default function TenantLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingActivationTenantId, setPendingActivationTenantId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setPendingActivationTenantId(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg("Credenciais inválidas. Verifique seu e-mail e senha.");
        setLoading(false);
        return;
      }

      if (data.user) {
        // 1. Verifica vínculos em tenant_users
        const { data: tenantUsers, error: tuErr } = await (supabase
          .from("tenant_users") as any)
          .select("id, is_active, tenant_id, role")
          .eq("user_id", data.user.id)
          .eq("is_active", true);

        if (tuErr || !tenantUsers || tenantUsers.length === 0) {
          // 2. Se não tem vínculo ativo, verifica se existe cadastro pendente de ativação (trial_pending)
          const { data: pendingTenant } = await (supabase
            .from("tenants") as any)
            .select("id, name, status")
            .eq("email", email.toLowerCase())
            .eq("status", "trial_pending")
            .maybeSingle();

          if (pendingTenant) {
            setPendingActivationTenantId(pendingTenant.id);
            setErrorMsg(
              `A sua instituição (${pendingTenant.name}) ainda está com a ativação pendente. Conclua a ativação para iniciar o seu período de teste de 7 dias.`
            );
            setLoading(false);
            return;
          }

          await supabase.auth.signOut();
          setErrorMsg(
            "Sua conta não possui vínculo ativo com nenhuma instituição teológica cadastrada."
          );
          setLoading(false);
          return;
        }

        // Se o usuário possuir estritamente papel 'aluno' e nenhum papel administrativo
        const hasAdminOrStaffRole = (tenantUsers as any[]).some(
          (tu: any) => tu.role && tu.role !== "aluno"
        );

        if (!hasAdminOrStaffRole) {
          // Bloqueia acesso administrativo e orienta o aluno a acessar via página da sua escola
          await supabase.auth.signOut();
          setErrorMsg(
            "Este portal é restrito à gestão e secretaria. O acesso do aluno deve ser realizado através da página pública institucional da sua escola teológica."
          );
          setLoading(false);
          return;
        }

        // Redirecionamento seguro para o painel de gestão
        router.push("/app/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado ao conectar.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-x-hidden font-sans select-none bg-[#0B1D33] text-white">
      {/* 
        ========================================================================
        1. BACKGROUND FOTOGRÁFICO ELEGANTE DE GESTÃO / ADMINISTRAÇÃO NA DIREITA
        ========================================================================
      */}
      <div
        className="fixed inset-0 bg-cover bg-right lg:bg-center transition-opacity duration-700 ease-in-out opacity-100 will-change-transform"
        style={{
          backgroundImage: "url('/img/bg_login_gestao.jpg')",
        }}
        aria-hidden="true"
      />

      {/* 
        GRADIENTE OPACADO E LIMPO NA ESQUERDA:
        Cobre a metade esquerda com azul-marinho profundo puro (#0B1D33),
        proporcionando legibilidade absoluta dos textos, e abre suavemente para a direita.
      */}
      <div
        className="fixed inset-0 bg-gradient-to-b from-[#0B1D33] via-[#0B1D33]/90 to-[#0B1D33] lg:bg-gradient-to-r lg:from-[#0B1D33] lg:via-[#0B1D33]/95 lg:to-[#0B1D33]/40 pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Detalhes sutis de textura / glow com azul institucional */}
      <div 
        className="fixed -top-32 -left-32 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none z-0" 
        aria-hidden="true" 
      />

      {/* 
        ========================================================================
        2. CABEÇALHO SUPERIOR ELEGANTE
        ========================================================================
      */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-5 sm:py-6 flex items-center justify-between">
        <Link href="/" className="focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] rounded-lg">
          <Logo variant="light" size="header" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition-colors bg-white/10 hover:bg-white/15 backdrop-blur-md px-4 py-2 rounded-lg border border-white/15 shadow-xs"
        >
          <span>← Voltar ao site</span>
        </Link>
      </header>

      {/* 
        ========================================================================
        3. ÁREA PRINCIPAL: COMPOSIÇÃO 2 COLUNAS EQUILIBRADAS (LOGIN EXCLUSIVO GESTÃO/SECRETARIA)
        ========================================================================
      */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Coluna Esquerda (Área Institucional Totalmente Limpa e com Alto Contraste) */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6 text-left">
            {/* Badge de Ambiente Institucional */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-slate-200 shadow-sm backdrop-blur-md">
              <Briefcase className="w-4 h-4 text-[#C9973D]" />
              <span>Ambiente Administrativo — Secretaria & Gestão Escolar</span>
            </div>

            {/* Título Principal Institucional */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white font-serif leading-tight">
                Plataforma Integrada para <br className="hidden sm:inline" />
                <span className="text-[#C9973D]">Institutos Teológicos</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-200 max-w-xl font-normal leading-relaxed">
                Gestão acadêmica completa, controle financeiro, controle de matrículas e ambiente EAD integrados em uma infraestrutura segura.
              </p>
            </div>

            {/* Três Pilares Visuais (Cards translúcidos limpos com ícones dourados) */}
            <div className="space-y-3 pt-2 max-w-lg">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-[#C9973D]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Secretaria Acadêmica & Alunos</h2>
                  <p className="text-xs text-slate-300">Emissão de boletins, atas e histórico com validade eclesiástica</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-[#C9973D]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Controle Financeiro & Mensalidades Asaas</h2>
                  <p className="text-xs text-slate-300">Cobranças via Pix e Boleto Asaas, conciliação e relatórios de fluxo</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-4 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#C9973D]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Governança & Multi-tenant Hermético</h2>
                  <p className="text-xs text-slate-300">Perfis de acesso granulares, auditoria de ações e blindagem por instituto</p>
                </div>
              </div>
            </div>

            {/* Citação Bíblica Sutil */}
            <div className="pt-2 text-xs text-slate-400 italic">
              &ldquo;Tudo seja feito com decência e ordem.&rdquo;
              <span className="block text-[11px] not-italic text-slate-500 mt-0.5">1 Coríntios 14:40</span>
            </div>
          </div>

          {/* Coluna Direita: Card de Autenticação Branco em Destaque (420-440px) */}
          <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end w-full">
            <div className="w-full max-w-[420px] sm:max-w-[440px]">
              <div className="bg-white text-slate-900 rounded-3xl p-7 sm:p-9 shadow-2xl border border-slate-100 relative">
                
                {/* Ícone e Cabeçalho do Card */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Building2 className="w-6 h-6 text-[#0B1D33]" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#0B1D33] font-serif">
                    Acesso da Gestão
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Entre com suas credenciais de operador, gestor ou docente.
                  </p>
                </div>

                {/* Mensagem de Erro com Transição */}
                {errorMsg && (
                  <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 leading-relaxed">
                      <span>{errorMsg}</span>
                      {pendingActivationTenantId && (
                        <div className="pt-1">
                          <Link
                            href={`/app/ativar?tenant_id=${pendingActivationTenantId}`}
                            className="inline-flex items-center gap-1.5 font-bold text-[#C9973D] hover:underline"
                          >
                            <span>Ir para a página de ativação do teste</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Formulário Supabase Auth */}
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Campo E-mail */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                      E-mail Institucional *
                    </label>
                    <div className="relative rounded-xl">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@instituto.com.br"
                        className="block w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
                      />
                    </div>
                  </div>

                  {/* Campo Senha */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Senha *
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setErrorMsg(
                            "Para recuperar sua senha administrativa, solicite ao suporte institucional ou verifique se sua conta foi ativada."
                          )
                        }
                        className="text-[11px] font-medium text-[#C9973D] hover:underline cursor-pointer"
                      >
                        Esqueceu sua senha?
                      </button>
                    </div>
                    <div className="relative rounded-xl">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sua senha"
                        className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden transition-colors cursor-pointer"
                        title={showPassword ? "Ocultar senha" : "Ver senha"}
                        aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Botão de Autenticação */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-[#C9973D] hover:bg-[#B38432] focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-[#C9973D] shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Autenticando...</span>
                        </>
                      ) : (
                        <>
                          <span>Acessar Painel de Gestão</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Rodapé Interno do Card */}
                <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500">
                    Sua escola ainda não possui TeoClass?{" "}
                    <Link
                      href="/"
                      className="text-[#C9973D] font-bold hover:underline"
                    >
                      Teste grátis por 7 dias
                    </Link>
                  </p>
                </div>

              </div>
            </div>
          </div>

        </div>
      </main>

      {/* 
        ========================================================================
        4. RODAPÉ INFERIOR ELEGANTE
        ========================================================================
      */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300 border-t border-white/10">
        <p>© {new Date().getFullYear()} TeoClass. Todos os direitos reservados.</p>
        <div className="flex items-center gap-4 text-slate-300">
          <span>Ambiente Seguro SSL 256-bit</span>
          <span>•</span>
          <Link href="/" className="hover:text-white transition-colors">
            Termos de Uso
          </Link>
        </div>
      </footer>
    </div>
  );
}
