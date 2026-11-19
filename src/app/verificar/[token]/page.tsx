import { verifyPublicDocumentAction } from "@/app/actions/documentos";
import {
  ShieldCheck,
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Building2,
  GraduationCap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autenticidade de Documento Acadêmico | TeoClass",
  description: "Consulta pública e verificação de autenticidade de certificados e históricos teológicos.",
};

export default async function PublicVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyPublicDocumentAction(token);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-between p-4 md:p-8">
      <div className="max-w-2xl mx-auto w-full pt-8">
        {/* Cabeçalho TeoClass */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4" />
            Portal de Autenticidade Documental
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Validação de Registro Acadêmico
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Conferência segura de autenticidade protegida por token criptográfico.
          </p>
        </div>

        {/* Card de Resultado da Verificação */}
        {result.valid ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 dark:border-slate-800 space-y-6">
            {/* Status do Documento */}
            <div
              className={`p-4 rounded-2xl flex items-center gap-3.5 ${
                result.is_revoked
                  ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
              }`}
            >
              {result.is_revoked ? (
                <XCircle className="w-7 h-7 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-7 h-7 flex-shrink-0" />
              )}
              <div>
                <div className="font-bold text-base">
                  {result.is_revoked
                    ? "DOCUMENTO REVOGADO / CANCELADO"
                    : "REGISTRO AUTÊNTICO E VÁLIDO"}
                </div>
                <div className="text-xs mt-0.5">
                  {result.is_revoked
                    ? `Motivo: ${result.revocation_reason || "Revogado administrativamente pela instituição."}`
                    : "Este documento foi emitido legitimamente pela instituição de ensino e confere com os registros oficiais."}
                </div>
              </div>
            </div>

            {/* Informações Públicas Seguras (LGPD-Compliant) */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">Documento:</span>
                <span className="font-semibold text-right">{result.title}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">Código de Registro:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {result.document_number}
                </span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">Instituição Emissora:</span>
                <span className="font-semibold">{result.institution?.name}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">Aluno Titular:</span>
                <span className="font-semibold">{result.student?.name}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">CPF (Parcial LGPD):</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {result.student?.cpf_masked}
                </span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">Curso:</span>
                <span className="font-semibold">{result.course?.name}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">Carga Horária:</span>
                <span className="font-semibold">{result.course?.workload_hours}h</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-slate-500">Data de Emissão:</span>
                <span>
                  {result.issued_at
                    ? new Date(result.issued_at).toLocaleDateString("pt-BR")
                    : "—"}
                </span>
              </div>
            </div>

            <div className="pt-2 text-center text-xs text-slate-400">
              Verificação eletrônica provida pela plataforma TeoClass. Todos os direitos reservados.
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Documento Não Encontrado
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              O token de verificação informado não corresponde a nenhum documento emitido ou o código
              de validação expirou.
            </p>
            <div className="pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-sm font-semibold hover:bg-slate-800 transition"
              >
                Voltar à Página Inicial
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé simples */}
      <footer className="text-center text-xs text-slate-400 py-6">
        TeoClass &copy; {new Date().getFullYear()} — Plataforma de Gestão e EAD Teológico
      </footer>
    </div>
  );
}
