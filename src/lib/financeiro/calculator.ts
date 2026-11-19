import type { Receivable, SchoolFinancialMetrics } from "@/types/financeiro";

/**
 * Calcula a data de vencimento da N-ésima parcela a partir da primeira data
 */
export function calculateInstallmentDueDate(firstDueDateStr: string, installmentIndex: number): string {
  const date = new Date(firstDueDateStr + "T00:00:00");
  date.setMonth(date.getMonth() + installmentIndex);
  return date.toISOString().split("T")[0];
}

/**
 * Gera identificador de recibo único e auditável (ex: REC-2026-X8Y1Z)
 */
export function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `REC-${year}-${rand}`;
}

/**
 * Avalia se uma cobrança em aberto está vencida com base na data atual
 */
export function isReceivableOverdue(dueDateStr: string, status: string): boolean {
  if (status !== "em_aberto") return false;
  const today = new Date().toISOString().split("T")[0];
  return dueDateStr < today;
}

/**
 * Consolida métricas financeiras a partir de uma lista de recebíveis
 */
export function calculateFinancialMetrics(receivables: Receivable[]): SchoolFinancialMetrics {
  let totalReceivable = 0;
  let totalReceived = 0;
  let totalOverdue = 0;
  let totalPending = 0;
  let paidCount = 0;
  let overdueCount = 0;

  const today = new Date().toISOString().split("T")[0];

  receivables.forEach((rec) => {
    if (rec.status === "cancelado" || rec.status === "estornado") return;

    totalReceivable += Number(rec.final_amount);
    totalReceived += Number(rec.paid_amount);

    if (rec.status === "pago") {
      paidCount++;
    } else if (rec.status === "em_aberto") {
      if (rec.due_date < today) {
        totalOverdue += Number(rec.final_amount) - Number(rec.paid_amount);
        overdueCount++;
      } else {
        totalPending += Number(rec.final_amount) - Number(rec.paid_amount);
      }
    }
  });

  const totalChargesCount = receivables.filter(
    (r) => r.status !== "cancelado" && r.status !== "estornado"
  ).length;

  const defaultRate =
    totalReceivable > 0 ? Number(((totalOverdue / totalReceivable) * 100).toFixed(1)) : 0;

  return {
    totalReceivable: Number(totalReceivable.toFixed(2)),
    totalReceived: Number(totalReceived.toFixed(2)),
    totalOverdue: Number(totalOverdue.toFixed(2)),
    totalPending: Number(totalPending.toFixed(2)),
    defaultRatePercentage: defaultRate,
    totalChargesCount,
    paidChargesCount: paidCount,
    overdueChargesCount: overdueCount,
  };
}
