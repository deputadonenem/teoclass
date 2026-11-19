"use client";

import React, { useState } from "react";
import type { AcademicDocument, AcademicDocumentType } from "@/types/documentos";
import { DOCUMENT_TYPE_LABELS } from "@/types/documentos";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { IssueDocumentModal } from "./IssueDocumentModal";
import { revokeAcademicDocumentAction } from "@/app/actions/documentos";
import {
  Award,
  FileText,
  Search,
  Filter,
  Plus,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Eye,
  XCircle,
  QrCode,
  GraduationCap,
} from "lucide-react";

interface CertificadosClientProps {
  initialDocuments: AcademicDocument[];
  enrollments: Array<{
    id: string;
    enrollmentNumber: string;
    studentName: string;
    courseName: string;
    status: string;
  }>;
  userRole: string;
}

export function CertificadosClient({
  initialDocuments,
  enrollments,
  userRole,
}: CertificadosClientProps) {
  const [documents, setDocuments] = useState<AcademicDocument[]>(initialDocuments);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const [previewDoc, setPreviewDoc] = useState<AcademicDocument | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [revokingDocId, setRevokingDocId] = useState<string | null>(null);
  const [revocationReason, setRevocationReason] = useState("");

  const canManage = userRole === "admin" || userRole === "secretaria";

  // Filtros
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.student?.full_name && doc.student.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "todos" ? true : doc.document_type === filterType;
    const matchesStatus = filterStatus === "todos" ? true : doc.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDocumentIssued = (newDoc: AcademicDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setIsIssueModalOpen(false);
    setPreviewDoc(newDoc);
  };

  const handleConfirmRevoke = async () => {
    if (!revokingDocId || !revocationReason.trim()) return;

    const res = await revokeAcademicDocumentAction({
      document_id: revokingDocId,
      reason: revocationReason,
    });

    if (res.success) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === revokingDocId
            ? { ...d, status: "revogado", revocation_reason: revocationReason }
            : d
        )
      );
      setRevokingDocId(null);
      setRevocationReason("");
    } else {
      alert(res.error || "Falha ao revogar o documento.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-7 h-7 text-blue-600" />
            Certificados & Documentos Acadêmicos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {canManage
              ? "Emissão, consulta, verificação pública por QR Code e revogação de registros."
              : "Consulte seus certificados, declarações de matrícula e históricos escolares emitidos."}
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            Emitir Documento
          </button>
        )}
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por código, título ou nome do aluno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
          >
            <option value="todos">Todos os tipos</option>
            <option value="certificado_conclusao">Certificados</option>
            <option value="declaracao_matricula">Declarações</option>
            <option value="historico_escolar">Históricos</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
          >
            <option value="todos">Todos os status</option>
            <option value="emitido">Emitidos</option>
            <option value="revogado">Revogados</option>
          </select>
        </div>
      </div>

      {/* Grid de Documentos */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
          <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">
            Nenhum Documento Acadêmico Encontrado
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {canManage
              ? "Clique em 'Emitir Documento' para gerar o primeiro certificado ou declaração."
              : "Você ainda não possui documentos ou certificados emitidos pela secretaria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`p-5 rounded-2xl border bg-white dark:bg-slate-900 flex flex-col justify-between transition-all ${
                doc.status === "revogado"
                  ? "border-rose-200 dark:border-rose-900/50 opacity-75"
                  : "border-slate-200 dark:border-slate-800 hover:shadow-md"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      doc.status === "emitido"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {doc.status === "emitido" ? "Válido" : "Revogado"}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2">
                  {doc.title}
                </h3>

                <div className="text-xs text-slate-500 space-y-1 mt-3">
                  <div className="flex items-center justify-between">
                    <span>Aluno:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {doc.student?.full_name || doc.metadata_snapshot.student.fullName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Registro:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {doc.document_number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Emissão:</span>
                    <span>{new Date(doc.issued_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>

                {doc.status === "revogado" && (
                  <div className="mt-3 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs">
                    <strong>Motivo:</strong> {doc.revocation_reason}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 transition flex-1 justify-center"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Visualizar / Imprimir
                </button>

                {canManage && doc.status === "emitido" && (
                  <button
                    onClick={() => setRevokingDocId(doc.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                    title="Revogar / Cancelar Documento"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Emissão */}
      {isIssueModalOpen && (
        <IssueDocumentModal
          enrollments={enrollments}
          onClose={() => setIsIssueModalOpen(false)}
          onSuccess={handleDocumentIssued}
        />
      )}

      {/* Modal de Pré-visualização e Impressão */}
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Modal de Confirmação de Revogação */}
      {revokingDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Revogar Documento Acadêmico
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Esta ação marcará o documento como revogado no registro público de autenticidade. O
              histórico será preservado para auditoria.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Motivo da Revogação
              </label>
              <textarea
                rows={3}
                placeholder="Informe o motivo formal do cancelamento..."
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => {
                  setRevokingDocId(null);
                  setRevocationReason("");
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={!revocationReason.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                Confirmar Revogação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
