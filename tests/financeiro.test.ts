import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateInstallmentDueDate,
  generateReceiptNumber,
  isReceivableOverdue,
  calculateFinancialMetrics,
} from "../src/lib/financeiro/calculator.ts";
import type { Receivable } from "../src/types/financeiro.ts";

test("TeoClass — Cálculos e Regras do Financeiro Escolar (Lote 10)", async (t) => {
  await t.test("1. Cálculo sequencial de vencimento de parcelas mensais", () => {
    assert.equal(calculateInstallmentDueDate("2026-03-10", 0), "2026-03-10");
    assert.equal(calculateInstallmentDueDate("2026-03-10", 1), "2026-04-10");
    assert.equal(calculateInstallmentDueDate("2026-03-10", 2), "2026-05-10");
  });

  await t.test("2. Geração de número de recibo auditável", () => {
    const num = generateReceiptNumber();
    assert.match(num, /^REC-\d{4}-[A-Z0-9]{5}$/);
  });

  await t.test("3. Avaliação de parcelas vencidas", () => {
    assert.equal(isReceivableOverdue("2020-01-01", "em_aberto"), true);
    assert.equal(isReceivableOverdue("2035-01-01", "em_aberto"), false);
    assert.equal(isReceivableOverdue("2020-01-01", "pago"), false, "Parcela paga não fica vencida");
  });

  await t.test("4. Consolidação de métricas financeiras da escola e inadimplência", () => {
    const mockReceivables: Receivable[] = [
      {
        id: "rec-1",
        tenant_id: "t-1",
        student_id: "s-1",
        enrollment_id: "e-1",
        financial_plan_id: null,
        title: "Mensalidade 1",
        charge_type: "mensalidade",
        installment_number: 1,
        total_installments: 2,
        original_amount: 200,
        discount_amount: 0,
        final_amount: 200,
        due_date: "2020-01-10", // Vencida
        status: "em_aberto",
        paid_amount: 0,
        paid_at: null,
        notes: null,
        created_at: "",
        updated_at: "",
      },
      {
        id: "rec-2",
        tenant_id: "t-1",
        student_id: "s-1",
        enrollment_id: "e-1",
        financial_plan_id: null,
        title: "Mensalidade 2",
        charge_type: "mensalidade",
        installment_number: 2,
        total_installments: 2,
        original_amount: 200,
        discount_amount: 0,
        final_amount: 200,
        due_date: "2030-01-10", // A vencer
        status: "em_aberto",
        paid_amount: 0,
        paid_at: null,
        notes: null,
        created_at: "",
        updated_at: "",
      },
      {
        id: "rec-3",
        tenant_id: "t-1",
        student_id: "s-2",
        enrollment_id: "e-2",
        financial_plan_id: null,
        title: "Matrícula",
        charge_type: "matricula",
        installment_number: 1,
        total_installments: 1,
        original_amount: 100,
        discount_amount: 0,
        final_amount: 100,
        due_date: "2020-01-01",
        status: "pago",
        paid_amount: 100,
        paid_at: "2020-01-01",
        notes: null,
        created_at: "",
        updated_at: "",
      },
    ];

    const metrics = calculateFinancialMetrics(mockReceivables);
    assert.equal(metrics.totalReceivable, 500); // 200 + 200 + 100
    assert.equal(metrics.totalReceived, 100);
    assert.equal(metrics.totalOverdue, 200);
    assert.equal(metrics.totalPending, 200);
    assert.equal(metrics.paidChargesCount, 1);
    assert.equal(metrics.overdueChargesCount, 1);
    assert.equal(metrics.defaultRatePercentage, 40.0); // 200 / 500 = 40%
  });
});
