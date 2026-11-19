"use client";

import React, { useState } from "react";
import type { StudentPortalData } from "@/types/dashboard";
import { BoletimView } from "@/components/academico/BoletimView";
import { DocumentPreviewModal } from "@/components/documentos/DocumentPreviewModal";
import type { AcademicDocument } from "@/types/documentos";
import {
  Compass,
  GraduationCap,
  BookOpen,
  Award,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  FileText,
  User,
} from "lucide-react";
import Link from "next/link";

interface PortalClientProps {
  data: StudentPortalData;
}

export function PortalClient({ data }: PortalClientProps) {
  const [activeTab, setActiveTab] = useState<"visao_geral" | "boletim" | "financeiro" | "certificados">("visao_geral");
  const [selectedDocPreview, setSelectedDocPreview] = useState<AcademicDocument | null>(null);

  const activeEnrollment = data.enrollments.find((e) => e.status === "ativa") || data.enrollments[0];
  const pendingCharges = data.financialReceivables.filter((r) => r.status === "em_aberto");
  const paidCharges = data.financialReceivables.filter((r) => r.status === "pago");

  return (
    <div className="space-y-6">
      {/* Banner de Boas-Vindas do Discente */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-sm border border-blue-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 mb-2">
            <Compass className="w-3.5 h-3.5" />
            Portal do Aluno
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Olá, {data.student.fullName.split(" ")[0]}!
          </h1>
          <p className="text-sm text-blue-200 mt-1">
            Seu ambiente acadêmico: acompanhe suas aulas, avaliações, notas e obrigações.
          </p>
        </div>

        {activeEnrollment && (
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 text-left md:text-right">
            <span className="text-[11px] uppercase font-semibold text-blue-200 block">Curso Ativo</span>
            <span className="text-base font-bold text-white block">{activeEnrollment.course.name}</span>
            <span className="text-xs text-blue-300 font-mono">Matrícula: {activeEnrollment.enrollmentNumber}</span>
          </div>
        )}
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("visao_geral")}
          className={`pb-3 text-sm font-semibold transition border-b-2 whitespace-nowrap ${
            activeTab === "visao_geral"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Visão Geral & Cursos
        </button>
        <button
          onClick={() => setActiveTab("boletim")}
          className={`pb-3 text-sm font-semibold transition border-b-2 whitespace-nowrap ${
            activeTab === "boletim"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Notas & Boletim
        </button>
        <button
          onClick={() => setActiveTab("financeiro")}
          className={`pb-3 text-sm font-semibold transition border-b-2 whitespace-nowrap ${
            activeTab === "financeiro"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Mensalidades ({pendingCharges.length})
        </button>
        <button
          onClick={() => setActiveTab("certificados")}
          className={`pb-3 text-sm font-semibold transition border-b-2 whitespace-nowrap ${
            activeTab === "certificados"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Documentos & Certificados ({data.documents.length})
        </button>
      </div>

      {/* ABA 1: VISÃO GERAL */}
      {activeTab === "visao_geral" && (
        <div className="space-y-6">
          {/* Cards Rápidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Matrículas Ativas</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.enrollments.filter((e) => e.status === "ativa").length}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Média Geral Acumulada</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {data.activeEnrollmentReport?.overallAverage !== null
                    ? data.activeEnrollmentReport?.overallAverage.toFixed(1)
                    : "—"}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Provas Concluídas</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {activeEnrollment?.academicSummary.completedAssessmentsCount || 0} /{" "}
                  {activeEnrollment?.academicSummary.totalAssessmentsCount || 0}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">Mensalidades em Aberto</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {pendingCharges.length}
                </span>
              </div>
            </div>
          </div>

          {/* Atalhos Rápidos para EAD e Provas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/app/ead"
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition group flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                    Acessar Sala de Aula EAD
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aulas em vídeo, materiais complementares em PDF e conteúdo teológico.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
            </Link>

            <Link
              href="/app/provas"
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition group flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                    Avaliações & Provas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inicie avaliações, resolva questões e confira o tempo de duração.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
            </Link>
          </div>

          {/* Lista de Cursos Matriculados */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              Minhas Matrículas
            </h2>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.enrollments.map((en) => (
                <div key={en.enrollmentId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900 dark:text-white">
                        {en.course.name}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {en.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span>Matrícula: {en.enrollmentNumber}</span>
                      {en.schoolClass && <span>• Turma: {en.schoolClass.name}</span>}
                      <span>• Carga: {en.course.workloadHours}h</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("boletim")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                    >
                      Ver Notas
                    </button>
                    <Link
                      href="/app/ead"
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow transition"
                    >
                      Acessar Aulas
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: BOLETIM ACADÊMICO */}
      {activeTab === "boletim" && (
        <div className="space-y-4">
          {data.activeEnrollmentReport ? (
            <BoletimView reportCard={data.activeEnrollmentReport} />
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border">
              <p className="text-slate-500">Nenhum boletim disponível no momento.</p>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: FINANCEIRO DO ALUNO */}
      {activeTab === "financeiro" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Minhas Mensalidades & Cobranças
            </h2>
            <span className="text-xs text-slate-500">
              {pendingCharges.length} pendente(s) • {paidCharges.length} quitada(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs border-b">
                <tr>
                  <th className="px-5 py-3 font-semibold">Descrição</th>
                  <th className="px-4 py-3 font-semibold text-center">Vencimento</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor</th>
                  <th className="px-4 py-3 font-semibold text-center">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.financialReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      Nenhuma mensalidade lançada para seu cadastro.
                    </td>
                  </tr>
                ) : (
                  data.financialReceivables.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{rec.title}</div>
                        <div className="text-xs text-slate-400">Parcela {rec.installment_number}/{rec.total_installments}</div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono text-xs">
                        {new Date(rec.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold">
                        R$ {Number(rec.final_amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            rec.status === "pago"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {rec.status === "pago" ? "Quitado" : "Em Aberto"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 4: CERTIFICADOS E DOCUMENTOS */}
      {activeTab === "certificados" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                Meus Documentos Oficiais
              </h2>
              <p className="text-xs text-slate-500">
                Certificados de conclusão e declarações emitidos com autenticidade verificável.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.documents.length === 0 ? (
              <div className="col-span-2 p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  Nenhum certificado ou declaração emitido pela secretaria até o momento.
                </p>
              </div>
            ) : (
              data.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      {doc.document_type === "certificado_conclusao"
                        ? "Certificado"
                        : "Declaração"}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                      {doc.title}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      Registro: {doc.document_number}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDocPreview(doc)}
                    className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 hover:bg-blue-100 transition"
                    title="Visualizar e Imprimir"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Pré-visualização de Documento */}
      {selectedDocPreview && (
        <DocumentPreviewModal
          document={selectedDocPreview}
          onClose={() => setSelectedDocPreview(null)}
        />
      )}
    </div>
  );
}
