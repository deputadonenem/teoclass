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
  GraduationCap,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface StudentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  schoolSlug: string;
  tenantId: string;
}

export function StudentLoginModal({
  isOpen,
  onClose,
  schoolName,
  schoolSlug,
  tenantId,
}: StudentLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  if (!isOpen) return null;

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg("Credenciais inválidas. Verifique seu e-mail e senha de aluno.");
        setLoading(false);
        return;
      }

      if (data.user) {
        // Validação estrita de vínculo do aluno com este tenant específico
        const { data: tenantUsers, error: tuErr } = await supabase
          .from("tenant_users")
          .select("id, is_active, tenant_id, role")
          .eq("user_id", data.user.id)
          .eq("tenant_id", tenantId)
          .eq("is_active", true);

        if (tuErr || !tenantUsers || tenantUsers.length === 0) {
          await supabase.auth.signOut();
          setErrorMsg(
            `Sua conta de aluno não possui matrícula ativa vinculada a ${schoolName}.`
          );
          setLoading(false);
          return;
        }

        // Define o cookie do tenant ativo para este instituto específico
        document.cookie = `teoclass_active_tenant=${tenantId}; path=/; max-age=31536000; SameSite=Lax`;

        // Redireciona diretamente para o Portal do Aluno
        router.push("/app/portal");
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
          aria-label="Fechar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Topo do Modal */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#C9973D] border border-amber-200/80 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-[#C9973D] uppercase tracking-wider block">
            {schoolName}
          </span>
          <h2 className="text-2xl font-bold text-[#0B1D33] font-serif mt-1">
            Portal do Aluno
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Acesse suas aulas, notas, materiais de estudo e certificados.
          </p>
        </div>

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Formulário de Login do Aluno */}
        <form onSubmit={handleStudentLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              E-mail do Aluno *
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
                className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Senha *
              </label>
              <button
                type="button"
                onClick={() =>
                  setErrorMsg(
                    `Para redefinir sua senha, solicite suporte à secretaria de ${schoolName}.`
                  )
                }
                className="text-[11px] font-medium text-[#C9973D] hover:underline cursor-pointer"
              >
                Esqueceu a senha?
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
                className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#C9973D] focus:bg-white focus:border-[#C9973D] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden transition-colors cursor-pointer"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#C9973D] hover:bg-[#B38432] focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-[#C9973D] shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Acessando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Portal do Aluno</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Acesso seguro com validação de matrícula</span>
        </div>
      </div>
    </div>
  );
}
