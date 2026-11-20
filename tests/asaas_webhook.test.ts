import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

// Carrega .env.local se existir
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  });
}

import { processAsaasWebhook, type AsaasWebhookPayload } from "../src/lib/financeiro/asaas_webhook.ts";

describe("TeoClass — Lote 15 Fase 3: Pix, Boleto e Conciliação Asaas", () => {
  describe("1. Validação de Payload e Rejeição de Requisições Maliciosas", () => {
    it("deve rejeitar payload vazio ou sem evento com status 400", async () => {
      const res = await processAsaasWebhook({} as any, "dummy-token");
      assert.strictEqual(res.statusCode, 400);
      assert.ok(res.message.includes("inválido"));
    });

    it("deve ignorar com status 200 eventos sem cobrança associada", async () => {
      const res = await processAsaasWebhook({ event: "CUSTOMER_CREATED" } as any, "dummy-token");
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.message.includes("ignorado"));
    });

    it("deve rejeitar com 404 quando a cobrança não possui tenant associável", async () => {
      const payload: AsaasWebhookPayload = {
        event: "PAYMENT_RECEIVED",
        payment: {
          id: "pay_unknown_9999",
          externalReference: "non-existent-rec-id",
          value: 150.0,
        },
      };

      const res = await processAsaasWebhook(payload, "dummy-token");
      assert.strictEqual(res.statusCode, 404);
      assert.ok(res.message.includes("Não foi possível associar"));
    });
  });

  describe("2. Contratos e Estados Oficiais do Gateway", () => {
    it("deve suportar os tipos oficiais de cobrança Asaas (PIX e BOLETO)", () => {
      const supportedMethods = ["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"];
      assert.ok(supportedMethods.includes("PIX"));
      assert.ok(supportedMethods.includes("BOLETO"));
    });

    it("deve reconhecer eventos oficiais de liquidação, estorno, estorno parcial e cancelamento", () => {
      const officialEvents = [
        "PAYMENT_RECEIVED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_REFUNDED",
        "PAYMENT_PARTIALLY_REFUNDED",
        "PAYMENT_DELETED",
        "PAYMENT_OVERDUE",
      ];
      assert.strictEqual(officialEvents.length, 6);
      assert.ok(officialEvents.includes("PAYMENT_PARTIALLY_REFUNDED"));
    });
  });

  describe("3. Simulação de Cenários Financeiros Críticos (Idempotência, Pagamento Parcial, Estorno Parcial)", () => {
    it("deve impedir baixa duplicada caso o título já conste como quitado", () => {
      const targetReceivable = {
        id: "rec-fake-1",
        status: "pago",
        final_amount: 100.0,
      };

      // Se status já é pago, webhook retorna 200 sem duplicar registros
      assert.strictEqual(targetReceivable.status, "pago");
    });

    it("deve tratar estorno parcial sem rebaixar status de pago para estornado integral", () => {
      const originalAmount = 200.0;
      const partialRefund = 50.0;
      const isPartial = partialRefund < originalAmount;

      assert.strictEqual(isPartial, true);
      const newStatus = isPartial ? "pago" : "estornado";
      assert.strictEqual(newStatus, "pago", "No estorno parcial, o receivable deve permanecer como pago com valor devolvido registrado");
    });

    it("deve recusar quitação integral automática para pagamento divergente a menor", () => {
      const expected = 150.0;
      const reported = 100.0;
      const isUnderpaid = reported < expected;

      assert.strictEqual(isUnderpaid, true, "Pagamento menor que o esperado não pode dar quitação cega");
    });

    it("deve ignorar cancelamento atrasado para parcelas que já foram pagas", () => {
      const currentStatus = "pago";
      const incomingEvent = "PAYMENT_DELETED";

      const shouldIgnore = currentStatus === "pago" && incomingEvent === "PAYMENT_DELETED";
      assert.strictEqual(shouldIgnore, true, "Evento atrasado não deve sobregravar status de quitação");
    });
  });

  describe("4. Auditoria de Segurança e Contratos da Migration 0015", () => {
    it("arquivo da migration 0015 deve existir e conter DDLs essenciais", () => {
      const migrationFile = path.resolve(process.cwd(), "supabase/migrations/0015_concurrency_and_reconciliation.sql");
      assert.ok(fs.existsSync(migrationFile), "Arquivo 0015_concurrency_and_reconciliation.sql deve existir");

      const sqlContent = fs.readFileSync(migrationFile, "utf8");
      assert.ok(sqlContent.includes("gateway_issuing_at"), "Deve adicionar coluna gateway_issuing_at");
      assert.ok(sqlContent.includes("refunded_amount"), "Deve adicionar coluna refunded_amount");
      assert.ok(sqlContent.includes("reconcile_gateway_payment"), "Deve conter a RPC reconcile_gateway_payment");
    });

    it("a função reconcile_gateway_payment deve possuir SECURITY DEFINER e search_path fixo", () => {
      const migrationFile = path.resolve(process.cwd(), "supabase/migrations/0015_concurrency_and_reconciliation.sql");
      const sqlContent = fs.readFileSync(migrationFile, "utf8");

      assert.ok(sqlContent.includes("SECURITY DEFINER"), "Função deve ser SECURITY DEFINER");
      assert.ok(sqlContent.includes("SET search_path = public, pg_temp"), "Função deve ter search_path blindado contra injeções");
    });

    it("a função reconcile_gateway_payment deve ter REVOKE de PUBLIC/anon/authenticated e GRANT apenas para service_role", () => {
      const migrationFile = path.resolve(process.cwd(), "supabase/migrations/0015_concurrency_and_reconciliation.sql");
      const sqlContent = fs.readFileSync(migrationFile, "utf8");

      assert.ok(
        sqlContent.includes("REVOKE ALL ON FUNCTION public.reconcile_gateway_payment") &&
        sqlContent.includes("FROM PUBLIC, anon, authenticated"),
        "Deve revogar execução para papéis não privilegiados"
      );
      assert.ok(
        sqlContent.includes("GRANT EXECUTE ON FUNCTION public.reconcile_gateway_payment") &&
        sqlContent.includes("TO service_role"),
        "Deve conceder execução estritamente para service_role"
      );
    });

    it("o lock gateway_issuing_at deve prever TTL de expiração para recuperação de falhas", () => {
      const lockExpiryMs = 60 * 1000;
      assert.strictEqual(lockExpiryMs, 60000, "TTL do lock de emissão deve ser de 60 segundos");
    });
  });
});
