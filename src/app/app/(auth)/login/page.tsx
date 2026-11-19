"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  BookOpen,
  Building2,
  Loader2,
  GraduationCap,
  ShieldCheck,
  Compass,
} from "lucide-react";

export default function TenantLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

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
        // Verifica se o usuário tem vínculo ativo com alguma instituição no TeoClass
        const { data: tenantUsers, error: tuErr } = await supabase
          .from("tenant_users")
          .select("id, is_active, tenant_id")
          .eq("user_id", data.user.id)
          .eq("is_active", true);

        if (tuErr || !tenantUsers || tenantUsers.length === 0) {
          await supabase.auth.signOut();
          setErrorMsg("Sua conta não possui vínculo ativo com nenhuma instituição teológica cadastrada.");
          setLoading(false);
          return;
        }

        router.push("/app/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocorreu um erro inesperado ao conectar.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-900/50 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-white leading-none">
              Teo<span className="text-indigo-400">Class</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
              Portal Institucional
            </span>
          </div>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Institucional Highlights */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Ambiente Seguro Multi-Tenant</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Acesso à sua <span className="text-indigo-400">Escola Teológica</span>.
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto lg:mx-0 leading-relaxed">
              Gestão acadêmica, ambiente do aluno, aulas EAD e certificações com total isolamento e segurança.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2 max-w-md mx-auto lg:mx-0">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
                <GraduationCap className="w-5 h-5 text-indigo-400 mb-1" />
                <span className="text-xs font-bold text-slate-200 block">Secretaria & Turmas</span>
                <span className="text-[11px] text-slate-500">Alunos e Matrículas</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-left">
                <Compass className="w-5 h-5 text-amber-400 mb-1" />
                <span className="text-xs font-bold text-slate-200 block">Portal do Aluno</span>
                <span className="text-[11px] text-slate-500">Aulas e Certificados</span>
              </div>
            </div>
          </div>

          {/* Right Column: Login Card */}
          <div className="lg:col-span-6 flex justify-center w-full">
            <div className="w-full max-w-md">
              <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100">
                <div className="mb-6 text-left">
                  <h2 className="text-xl font-bold text-slate-900">Entrar na Instituição</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Informe seu e-mail e senha cadastrados na secretaria.
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                        placeholder="seu.email@exemplo.com"
                        className="block w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Senha de Acesso *
                    </label>
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
                        className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                        title={showPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/25 text-sm font-semibold text-white bg-indigo-700 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Autenticando...</span>
                        </>
                      ) : (
                        <>
                          <span>Entrar no Sistema</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Card Footer Security Badge */}
                <div className="mt-6 pt-5 border-t border-slate-100 text-center flex items-center justify-center gap-2 text-slate-400 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ambiente TeoClass isolado por instituição.</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full bg-slate-950/80 border-t border-slate-800/80 py-4 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; 2026 TeoClass — Alcântara Sistemas. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
