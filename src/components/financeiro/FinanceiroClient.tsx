"use client";

import React, { useState } from "react";
import type {
  Receivable,
  FinancialPlan,
  SchoolFinancialMetrics,
  ReceivableStatus,
} from "@/types/financeiro";
import {
  RECEIVABLE_STATUS_LABELS,
  CHARGE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/types/financeiro";
import { FinancialPlanModal } from "./FinancialPlanModal";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { GenerateInstallmentsModal } from "./GenerateInstallmentsModal";
import { AsaasChargeModal } from "./AsaasChargeModal";
import { reversePaymentAction } from "@/app/actions/financeiro";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Layers,
  Search,
  Filter,
  Eye,
  RotateCcw,
  QrCode,
} from "lucide-react";

interface FinanceiroClientProps {
  initialReceivables: Receivable[];
  initialPlans: FinancialPlan[];
  initialMetrics: SchoolFinancialMetrics | null;
  courses: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  enrollments: Array<{
    id: string;
    enrollmentNumber: string;
    studentName: string;
    courseName: string;
  }>;
  userRole: string;
}

export function FinanceiroClient({
  initialReceivables,
  initialPlans,
  initialMetrics,
  courses,
  classes,
  enrollments,
  userRole,
}: FinanceiroClientProps) {
  const [receivables, setReceivables] = useState<Receivable[]>(initialReceivables);
  const [plans, setPlans] = useState<FinancialPlan[]>(initialPlans);
  const [metrics, setMetrics] = useState<SchoolFinancialMetrics | null>(initialMetrics);

  const [activeTab, setActiveTab] = useState<"cobrancas" | "planos">("cobrancas");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // Modais
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [paymentModalReceivable, setPaymentModalReceivable] = useState<Receivable | null>(null);
  const [asaasModalReceivable, setAsaasModalReceivable] = useState<Receivable | null>(null);

  const canManage = userRole === "admin" || userRole === "financeiro";

  // Filtro de cobranças
  const filteredReceivables = receivables.filter((rec) => {
    const matchesSearch =
      rec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.student?.full_name && rec.student.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.enrollment?.enrollment_number && rec.enrollment.enrollment_number.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === "todos" ? true : rec.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ReceivableStatus) => {
    switch (status) {
      case "pago":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pago
          </span>
        );
      case "vencido":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" /> Vencido
          </span>
        );
      case "em_aberto":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Clock className="w-3.5 h-3.5" /> Em Aberto
          </span>
        );
      case "cancelado":
      case "estornado":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <XCircle className="w-3.5 h-3.5" /> {RECEIVABLE_STATUS_LABELS[status]}
          </span>
        );
      default:
        return null;
    }
  };

  const handleReversePayment = async (paymentId: string) => {
    const reason = prompt("Informe o motivo do estorno do pagamento:");
    if (!reason || reason.trim().length < 5) {
      alert("O estorno requer uma justificativa formal com ao menos 5 caracteres.");
      return;
    }

    const res = await reversePaymentAction({ payment_id: paymentId, reason });
    if (res.success) {
      window.location.reload();
    } else {
      alert(res.error || "Falha ao estornar pagamento.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Gestão Financeira Escolar
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Controle interno de mensalidades, matrículas, descontos, baixas manuais e inadimplência.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlanModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              Novo Plano
            </button>
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow transition"
            >
              <Layers className="w-4 h-4" />
              Gerar Parcelas
            </button>
          </div>
        )}
      </div>

      {/* Indicadores Financeiros Rápidos */}
      {metrics && userRole !== "aluno" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500">Total Arrecadado</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              R$ {metrics.totalReceived.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{metrics.paidChargesCount} parcelas pagas</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500">Total a Vencer</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              R$ {metrics.totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Dentro do prazo</div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500">Inadimplência (Vencido)</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">
              R$ {metrics.totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-rose-500 mt-0.5">
              {metrics.overdueChargesCount} parcelas em atraso ({metrics.defaultRatePercentage}%)
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-500">Total Previsto</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              R$ {metrics.totalReceivable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{metrics.totalChargesCount} lançamentos</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {canManage && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab("cobrancas")}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "cobrancas"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Contas a Receber & Parcelas
          </button>
          <button
            onClick={() => setActiveTab("planos")}
            className={`pb-3 text-sm font-semibold transition border-b-2 ${
              activeTab === "planos"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Planos Financeiros por Curso
          </button>
        </div>
      )}

      {/* Conteúdo Tab: Cobranças */}
      {activeTab === "cobrancas" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Barra de Filtro */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por aluno, matrícula ou cobrança..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
              >
                <option value="todos">Todos os status</option>
                <option value="em_aberto">Em Aberto</option>
                <option value="pago">Pago</option>
                <option value="vencido">Vencido</option>
              </select>
            </div>
          </div>

          {/* Tabela de Recebíveis */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs border-b">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Cobrança / Aluno</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Tipo</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Vencimento</th>
                  <th className="px-4 py-3.5 font-semibold text-right">Valor Final</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Situação</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Nenhuma cobrança encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredReceivables.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{rec.title}</div>
                        <div className="text-xs text-slate-500">
                          {rec.student?.full_name} ({rec.enrollment?.enrollment_number})
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-medium">
                          {CHARGE_TYPE_LABELS[rec.charge_type]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-xs">
                        {new Date(rec.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                        R$ {Number(rec.final_amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-center">{getStatusBadge(rec.status)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && rec.status !== "pago" && (
                            <>
                              <button
                                onClick={() => setAsaasModalReceivable(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition"
                                title="Emitir Pix / Boleto Asaas"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                {rec.gateway_charge_id ? "Ver Asaas" : "Asaas"}
                              </button>

                              <button
                                onClick={() => setPaymentModalReceivable(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
                                title="Baixa manual na tesouraria"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Baixar
                              </button>
                            </>
                          )}
                          {canManage && rec.status === "pago" && rec.payments && rec.payments.length > 0 && (
                            <button
                              onClick={() => handleReversePayment(rec.payments![0].id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-rose-600 hover:bg-rose-50 transition"
                              title="Estornar pagamento"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Estornar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo Tab: Planos Financeiros */}
      {activeTab === "planos" && canManage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((pl) => (
            <div
              key={pl.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div>
                <span className="text-xs font-semibold uppercase text-emerald-600">
                  {pl.course?.name || "Curso"}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">{pl.name}</h3>
                {pl.description && <p className="text-xs text-slate-500 mt-1">{pl.description}</p>}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Mensalidade:</span>
                  <span className="font-bold">
                    {pl.installments_count}x de R$ {Number(pl.installment_value).toFixed(2)}
                  </span>
                </div>
                {Number(pl.enrollment_fee) > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa Matrícula:</span>
                    <span className="font-semibold">R$ {Number(pl.enrollment_fee).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Vencimento Padrão:</span>
                  <span>Todo dia {pl.default_due_day}</span>
                </div>
                {Number(pl.discount_percentage) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Bolsa / Desconto Padrão:</span>
                    <span>{pl.discount_percentage}%</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {isPlanModalOpen && (
        <FinancialPlanModal
          courses={courses}
          classes={classes}
          onClose={() => setIsPlanModalOpen(false)}
          onSuccess={(saved) => {
            setPlans((prev) => [saved, ...prev]);
            setIsPlanModalOpen(false);
          }}
        />
      )}

      {isGenerateModalOpen && (
        <GenerateInstallmentsModal
          enrollments={enrollments}
          plans={plans}
          onClose={() => setIsGenerateModalOpen(false)}
          onSuccess={(count) => {
            alert(`${count} cobrança(s) gerada(s) com sucesso.`);
            setIsGenerateModalOpen(false);
            window.location.reload();
          }}
        />
      )}

      {paymentModalReceivable && (
        <RecordPaymentModal
          receivable={paymentModalReceivable}
          onClose={() => setPaymentModalReceivable(null)}
          onSuccess={() => {
            setPaymentModalReceivable(null);
            window.location.reload();
          }}
        />
      )}

      {asaasModalReceivable && (
        <AsaasChargeModal
          isOpen={Boolean(asaasModalReceivable)}
          receivable={asaasModalReceivable}
          onClose={() => setAsaasModalReceivable(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
