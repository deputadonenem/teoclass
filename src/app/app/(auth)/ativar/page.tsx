"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/landing/Logo";
import { confirmTrialActivationAction } from "@/app/actions/trial_activation";
import {
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
} from "lucide-react";

function ActivateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const tenantIdParam = searchParams.get("tenant_id") || undefined;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    tenantName?: string;
    adminEmail?: string;
  } | null>(null);

  // Verifica se o usuário chegou autenticado pelo link mágico/invite do Supabase Auth
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setCurrentUserEmail(session.user.email);
        } else {
          // Também escuta mudança no auth state caso o token do hash seja processado
          const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (newSession?.user?.email) {
              setCurrentUserEmail(newSession.user.email);
            }
          });
          return () => {
            authListener.subscription.unsubscribe();
          };
        }
      } catch (err) {
        console.error("Erro ao verificar sessão Supabase Auth:", err);
      } finally {
        setAuthChecking(false);
      }
    }
    checkSession();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      // 1. Atualiza a senha no Supabase Auth para a sessão do usuário
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateErr) {
        setErrorMsg(`Falha ao definir senha de acesso: ${updateErr.message}`);
        setLoading(false);
        return;
      }

      // 2. Invoca a Server Action para ativar o tenant, iniciar os 7 dias e vincular como admin
      const res = await confirmTrialActivationAction(tenantIdParam);

      if (!res.success) {
        setErrorMsg(res.error || "Falha ao ativar a conta e o teste gratuito.");
        setLoading(false);
        return;
      }

      setSuccessInfo({
        tenantName: res.tenantName,
        adminEmail: res.adminEmail || currentUserEmail || undefined,
      });

      setTimeout(() => {
        router.push("/app");
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar ativação.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  if (authChecking) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9973D] mx-auto" />
        <p className="text-xs text-slate-400">Verificando autenticação de acesso...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {/* Box Principal */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow Decorativo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9973D]/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -z-10" />

        {/* Header do Card */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Teste Grátis por 7 Dias</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Ativação de Conta Institucional
          </h2>
          <p className="text-xs text-slate-400">
            {currentUserEmail ? (
              <span>
                Conectado como <strong className="text-white">{currentUserEmail}</strong>. Defina sua senha mestra para concluir a ativação.
              </span>
            ) : (
              <span>Crie sua senha de administrador para iniciar o período de avaliação com acesso total.</span>
            )}
          </p>
        </div>

        {/* Feedback de Erro */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs leading-relaxed animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Feedback de Sucesso */}
        {successInfo ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4 animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Conta Ativada com Sucesso!</h3>
              <p className="text-xs text-slate-300">
                A instituição <strong>{successInfo.tenantName}</strong> foi habilitada no plano com acesso total durante 7 dias.
              </p>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 pt-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9973D]" />
              Redirecionando para o painel de gestão...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Criar Senha de Administrador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C9973D] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmação de Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha criada"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C9973D] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Dica de Segurança */}
            <div className="flex items-start gap-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Esta senha garante acesso irrestrito ao painel de gestão acadêmica, financeiro, EAD e secretaria. Guarde-a em segurança.
              </p>
            </div>

            {/* Botão de Ativação */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-gradient-to-r from-[#DFB76C] via-[#C9973D] to-[#9E7224] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#C9973D]/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Ativando Conta...</span>
                </>
              ) : (
                <>
                  <span>Concluir Ativação & Começar Teste</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Rodapé do Card */}
        <div className="pt-4 border-t border-slate-800 text-center">
          <Link
            href="/app/login"
            className="text-xs text-slate-400 hover:text-[#C9973D] transition-colors"
          >
            Já possui login e senha cadastrados? <span className="underline">Acessar login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ActivateTrialPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between relative selection:bg-[#C9973D] selection:text-white">
      {/* Background Decorativo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Topo / Marca */}
      <header className="p-6 md:p-8 flex items-center justify-center relative z-10">
        <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
          <Logo />
        </Link>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9973D]" />
            </div>
          }
        >
          <ActivateContent />
        </Suspense>
      </main>

      {/* Rodapé Institucional */}
      <footer className="p-6 text-center text-xs text-slate-400 relative z-10">
        <p>© {new Date().getFullYear()} TeoClass — Plataforma Especializada para Ensino Teológico.</p>
      </footer>
    </div>
  );
}
