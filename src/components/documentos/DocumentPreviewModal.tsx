"use client";

import React, { useEffect, useState } from "react";
import type { AcademicDocument } from "@/types/documentos";
import { generateQrCodeDataUrl } from "@/lib/documentos/generator";
import {
  Award,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Building2,
  GraduationCap,
  Printer,
  X,
  FileText,
} from "lucide-react";

interface DocumentPreviewModalProps {
  document: AcademicDocument;
  onClose: () => void;
}

export function DocumentPreviewModal({ document, onClose }: DocumentPreviewModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const snap = document.metadata_snapshot;

  useEffect(() => {
    // URL pública para verificação de autenticidade
    const origin = typeof window !== "undefined" ? window.location.origin : "https://teoclass.com.br";
    const verificationUrl = `${origin}/verificar/${document.verification_token}`;
    generateQrCodeDataUrl(verificationUrl).then((url) => setQrCodeUrl(url));
  }, [document.verification_token]);

  const handlePrint = () => {
    window.print();
  };

  const isCertificate = document.document_type === "certificado_conclusao";
  const isTranscript = document.document_type === "historico_escolar";
  const isEnrollmentDeclaration = document.document_type === "declaracao_matricula";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      {/* Botões de Ação na Tela (ocultados na impressão) */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-50 print:hidden">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg font-medium text-sm transition"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Salvar PDF
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shadow hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Conteúdo do Documento no Formato A4 / Impressão */}
      <div className="bg-white text-slate-900 w-full max-w-4xl p-10 md:p-14 rounded-2xl shadow-2xl border border-slate-200 my-8 print:my-0 print:border-none print:shadow-none print:p-8 print:w-full">
        {/* Banner de Revogação caso o documento tenha sido cancelado */}
        {document.status === "revogado" && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-800 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <div className="font-bold">DOCUMENTO ACADÊMICO REVOGADO / CANCELADO</div>
              <div className="text-xs mt-0.5">
                Motivo: {document.revocation_reason || "Revogado administrativamente pela secretaria."} (Data:{" "}
                {document.revoked_at ? new Date(document.revoked_at).toLocaleDateString("pt-BR") : "—"})
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODELO 1: CERTIFICADO DE CONCLUSÃO (LAYOUT SOLENE E INSTITUCIONAL)
           ========================================================================= */}
        {isCertificate && (
          <div className="border-8 border-double border-amber-900/30 p-8 md:p-12 rounded-xl text-center relative overflow-hidden bg-gradient-to-b from-amber-50/20 to-transparent">
            {/* Brasão / Cabeçalho Solene */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 shadow-inner">
                <Award className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-serif font-bold tracking-wide text-slate-900 uppercase">
                {snap.institution.name}
              </h2>
              {snap.institution.cnpj && (
                <p className="text-xs text-slate-500 font-sans">
                  CNPJ: {snap.institution.cnpj}
                </p>
              )}
            </div>

            <div className="my-8">
              <span className="text-xs uppercase font-serif tracking-widest text-amber-800 font-semibold border-b border-amber-800/40 pb-1">
                Certificado de Conclusão Teológica
              </span>
            </div>

            {/* Texto de Concessão do Grau Teológico */}
            <p className="text-base font-serif text-slate-700 leading-relaxed max-w-2xl mx-auto">
              Certificamos para os devidos fins que o(a) aluno(a)
            </p>

            <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 my-4 tracking-normal">
              {snap.student.fullName}
            </h1>

            <p className="text-sm font-sans text-slate-600 mb-6">
              Portador(a) do CPF sob o nº {snap.student.cpfMasked}, matrícula nº{" "}
              <span className="font-mono font-semibold">{snap.enrollment.enrollmentNumber}</span>
            </p>

            <p className="text-base font-serif text-slate-700 leading-relaxed max-w-2xl mx-auto">
              concluiu com êxito todas as exigências acadêmicas e doutrinárias do curso de
            </p>

            <h3 className="text-2xl font-serif font-bold text-amber-950 my-3">
              {snap.course.name}
            </h3>

            <p className="text-sm font-serif text-slate-600">
              com carga horária total de{" "}
              <span className="font-bold">{snap.course.workloadHours} horas-aula</span>, obtendo média
              geral de{" "}
              <span className="font-bold">
                {snap.academicSummary.overallAverage !== null
                  ? snap.academicSummary.overallAverage.toFixed(1)
                  : "—"}
              </span>{" "}
              e situação de <span className="font-bold uppercase text-emerald-800">Aprovado</span>.
            </p>

            {/* Rodapé do Certificado com QR Code e Chancelas */}
            <div className="mt-14 pt-8 border-t border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-6 text-left">
              <div className="flex items-center gap-4">
                {qrCodeUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrCodeUrl}
                    alt="QR Code de Validação Pública"
                    className="w-24 h-24 border border-slate-300 p-1 rounded-lg bg-white"
                  />
                )}
                <div className="text-xs text-slate-500 font-sans space-y-1">
                  <div className="font-semibold text-slate-700">Autenticidade Institucional</div>
                  <div className="font-mono text-[11px] text-slate-800 font-bold">
                    Reg.: {document.document_number}
                  </div>
                  <div>Emitido em: {new Date(document.issued_at).toLocaleDateString("pt-BR")}</div>
                  <div className="text-[10px] text-slate-400">
                    Aponte a câmera para verificar a autenticidade
                  </div>
                </div>
              </div>

              {/* Assinatura Simbólica da Diretoria */}
              <div className="text-center md:text-right mt-6 md:mt-0">
                <div className="w-56 border-b border-slate-400 mb-1 mx-auto md:ml-auto" />
                <div className="text-xs font-serif font-semibold text-slate-800">
                  Diretoria & Secretaria Acadêmica
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  {snap.institution.name}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODELO 2: HISTÓRICO ESCOLAR / DECLARAÇÃO DE MATRÍCULA (PADRÃO OFICIAL)
           ========================================================================= */}
        {!isCertificate && (
          <div className="space-y-6 text-slate-800">
            {/* Cabeçalho da Escola */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">
                  {snap.institution.name}
                </h1>
                <p className="text-xs text-slate-600">
                  Secretaria de Registro e Controle Acadêmico
                  {snap.institution.cnpj ? ` • CNPJ: ${snap.institution.cnpj}` : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 rounded bg-slate-100 font-bold text-xs uppercase font-mono">
                  {document.document_number}
                </span>
                <div className="text-xs text-slate-500 mt-1">
                  Data de Emissão: {new Date(document.issued_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
            </div>

            {/* Título do Documento */}
            <div className="text-center py-2">
              <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">
                {isTranscript ? "HISTÓRICO ESCOLAR ACADÊMICO" : "DECLARAÇÃO DE MATRÍCULA"}
              </h2>
            </div>

            {/* Dados do Aluno e Matrícula */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Nome do Aluno:</span>
                <div className="font-bold text-sm text-slate-900">{snap.student.fullName}</div>
              </div>
              <div>
                <span className="text-slate-500">Documento / CPF:</span>
                <div className="font-bold text-sm text-slate-900">{snap.student.cpfMasked}</div>
              </div>
              <div>
                <span className="text-slate-500">Curso:</span>
                <div className="font-semibold text-slate-900">{snap.course.name}</div>
              </div>
              <div>
                <span className="text-slate-500">Matrícula / Status:</span>
                <div className="font-semibold text-slate-900 font-mono">
                  {snap.enrollment.enrollmentNumber} ({snap.enrollment.status})
                </div>
              </div>
            </div>

            {/* Corpo da Declaração de Matrícula */}
            {isEnrollmentDeclaration && (
              <div className="py-6 text-sm text-slate-700 leading-relaxed text-justify space-y-4">
                <p>
                  Declaramos para os devidos fins a quem possa interessar que o(a) estudante acima
                  qualificado(a) encontra-se regularmente matriculado(a) nesta instituição de ensino
                  teológico no curso de <strong>{snap.course.name}</strong>, com carga horária total de{" "}
                  <strong>{snap.course.workloadHours} horas</strong>.
                </p>
                <p>
                  Por ser a expressão da verdade, firmamos a presente declaração sob as normas regimentais
                  internas deste seminário.
                </p>
              </div>
            )}

            {/* Grade de Disciplinas e Médias no Histórico Escolar */}
            {isTranscript && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Disciplinas Cursadas e Rendimento Acadêmico
                </h3>
                <table className="w-full text-xs text-left border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5 border-b border-slate-200">Disciplina</th>
                      <th className="p-2.5 border-b border-slate-200 text-center">Carga</th>
                      <th className="p-2.5 border-b border-slate-200 text-center">Média</th>
                      <th className="p-2.5 border-b border-slate-200 text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snap.academicSummary.subjects.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium">
                          {s.name} {s.code && <span className="text-slate-400 font-mono">[{s.code}]</span>}
                        </td>
                        <td className="p-2.5 text-center">{s.workloadHours}h</td>
                        <td className="p-2.5 text-center font-bold">
                          {s.averageScore !== null ? s.averageScore.toFixed(1) : "—"}
                        </td>
                        <td className="p-2.5 text-center uppercase font-semibold text-[11px]">
                          {s.situation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <tr>
                      <td className="p-2.5">Média Geral / Resultado Acumulado</td>
                      <td className="p-2.5 text-center">{snap.course.workloadHours}h</td>
                      <td className="p-2.5 text-center">
                        {snap.academicSummary.overallAverage !== null
                          ? snap.academicSummary.overallAverage.toFixed(1)
                          : "—"}
                      </td>
                      <td className="p-2.5 text-center uppercase text-emerald-800">
                        {snap.academicSummary.situation}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Rodapé com QR Code */}
            <div className="pt-8 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {qrCodeUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-20 h-20 border border-slate-300 p-1 rounded bg-white"
                  />
                )}
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <div className="font-bold text-slate-700">Verificação de Autenticidade Digital</div>
                  <div className="font-mono text-slate-800">Token: {document.verification_token.slice(0, 24)}...</div>
                  <div>Aponte a câmera para verificar a integridade deste registro.</div>
                </div>
              </div>

              <div className="text-right">
                <div className="w-48 border-b border-slate-400 mb-1 ml-auto" />
                <div className="text-xs font-semibold text-slate-800">Secretaria Acadêmica</div>
                <div className="text-[10px] text-slate-500">Documento Emitido Eletronicamente</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
