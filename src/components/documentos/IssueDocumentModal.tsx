"use client";

import React, { useState } from "react";
import type { AcademicDocument, AcademicDocumentType } from "@/types/documentos";
import { issueAcademicDocumentAction } from "@/app/actions/documentos";
import {
  Award,
  FileText,
  GraduationCap,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface IssueDocumentModalProps {
  enrollments: Array<{
    id: string;
    enrollmentNumber: string;
    studentName: string;
    courseName: string;
    status: string;
  }>;
  onClose: () => void;
  onSuccess: (newDoc: AcademicDocument) => void;
}

export function IssueDocumentModal({
  enrollments,
  onClose,
  onSuccess,
}: IssueDocumentModalProps) {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(
    enrollments.length > 0 ? enrollments[0].id : ""
  );
  const [documentType, setDocumentType] = useState<AcademicDocumentType>("certificado_conclusao");
  const [customTitle, setCustomTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentId) {
      setErrorMessage("Selecione um aluno/matrícula.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await issueAcademicDocumentAction({
        enrollment_id: selectedEnrollmentId,
        document_type: documentType,
        custom_title: customTitle.trim() || undefined,
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || "Falha ao emitir o documento.");
      } else {
        onSuccess(res.data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const selectedEnrollment = enrollments.find((e) => e.id === selectedEnrollmentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Emitir Documento Acadêmico
              </h2>
              <p className="text-xs text-slate-500">
                Gere certificados, declarações ou históricos com QR Code de verificação.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Seleção do Tipo de Documento */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Tipo de Documento
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDocumentType("certificado_conclusao")}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  documentType === "certificado_conclusao"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Award className="w-4 h-4 mb-1 text-blue-600" />
                Certificado
              </button>
              <button
                type="button"
                onClick={() => setDocumentType("declaracao_matricula")}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  documentType === "declaracao_matricula"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileText className="w-4 h-4 mb-1 text-blue-600" />
                Declaração
              </button>
              <button
                type="button"
                onClick={() => setDocumentType("historico_escolar")}
                className={`p-3 rounded-xl border text-left text-xs transition ${
                  documentType === "historico_escolar"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <GraduationCap className="w-4 h-4 mb-1 text-blue-600" />
                Histórico
              </button>
            </div>
          </div>

          {/* Seleção do Aluno / Matrícula */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Aluno / Matrícula
            </label>
            <select
              value={selectedEnrollmentId}
              onChange={(e) => setSelectedEnrollmentId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500"
            >
              {enrollments.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.studentName} — {en.courseName} ({en.enrollmentNumber} / {en.status})
                </option>
              ))}
            </select>
          </div>

          {/* Título Customizado Opcional */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Título Personalizado (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Certificado de Bacharel em Teologia Sistemática"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Botões */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Emitindo...
                </>
              ) : (
                "Confirmar Emissão"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
