import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  encryptGatewaySecret,
  decryptGatewaySecret,
  maskGatewayApiKey,
} from "../src/lib/financeiro/crypto.ts";

describe("TeoClass — Lote 15 Fase 1: Fundação Segura Asaas Escolar", () => {
  describe("1. Criptografia Autenticada AES-256-GCM para Credenciais", () => {
    it("deve criptografar e descriptografar com sucesso uma chave de API Asaas", () => {
      const originalApiKey = "$aact_YTU5YTE0M2M2N2I4MTliNjc0OGY4Mzgy...mock-key";
      const encrypted = encryptGatewaySecret(originalApiKey);

      assert.notStrictEqual(encrypted, originalApiKey);
      assert.ok(encrypted.includes(":"), "Payload cifrado deve conter separadores de IV e Auth Tag");

      const parts = encrypted.split(":");
      assert.strictEqual(parts.length, 3, "Formato esperado: ivHex:authTagHex:ciphertextHex");

      const decrypted = decryptGatewaySecret(encrypted);
      assert.strictEqual(decrypted, originalApiKey, "Valor decifrado deve ser idêntico ao original");
    });

    it("deve gerar IVs aleatórios diferentes para a mesma chave de entrada", () => {
      const apiKey = "chave-secreta-identica-123";
      const enc1 = encryptGatewaySecret(apiKey);
      const enc2 = encryptGatewaySecret(apiKey);

      assert.notStrictEqual(enc1, enc2, "Cifras subsequentes devem possuir IVs e saídas distintas");
      assert.strictEqual(decryptGatewaySecret(enc1), apiKey);
      assert.strictEqual(decryptGatewaySecret(enc2), apiKey);
    });

    it("deve rejeitar e falhar na integridade caso o ciphertext ou a tag sejam adulterados", () => {
      const apiKey = "chave-super-secreta";
      const encrypted = encryptGatewaySecret(apiKey);
      const [iv, tag, ciphertext] = encrypted.split(":");

      // Modifica um byte do ciphertext
      const tamperedCipher = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === "aa" ? "bb" : "aa");
      const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;

      assert.throws(
        () => decryptGatewaySecret(tamperedPayload),
        /Unsupported state or unable to authenticate data|bad decrypt/i,
        "Deve lançar exceção de integridade GCM ao detectar adulteração"
      );
    });

    it("deve mascarar a chave de API exibindo apenas os 4 últimos dígitos", () => {
      assert.strictEqual(maskGatewayApiKey("1234567890"), "7890");
      assert.strictEqual(maskGatewayApiKey("$aact_asaas_prod_8841"), "8841");
      assert.strictEqual(maskGatewayApiKey("12"), "12");
    });
  });

  describe("2. Integridade Estrutural da Migration 0014 (DDL e RLS)", () => {
    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0014_school_gateway_asaas.sql");

    it("o arquivo de migração 0014 deve existir", () => {
      assert.ok(fs.existsSync(migrationPath), "Migration 0014 deve existir em supabase/migrations");
    });

    it("deve conter tabelas tenant_gateway_configs e gateway_events", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.tenant_gateway_configs"));
      assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.gateway_events"));
      assert.ok(sql.includes("ALTER TABLE public.receivables"));
    });

    it("deve garantir REVOKE total de PostgREST para clientes em tenant_gateway_configs", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.ok(sql.includes("REVOKE ALL ON public.tenant_gateway_configs FROM anon, authenticated"));
      assert.ok(sql.includes("GRANT ALL ON public.tenant_gateway_configs TO service_role"));
    });

    it("deve assegurar unicidade estrita de eventos para idempotência (tenant_id, provider, event_id)", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.ok(sql.includes("CONSTRAINT uq_gateway_events_idempotency UNIQUE (tenant_id, provider, event_id)"));
    });

    it("deve assegurar unicidade de cobranças em receivables (tenant_id, gateway_provider, gateway_charge_id)", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.ok(sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS uq_receivables_tenant_gateway_charge"));
      assert.ok(sql.includes("WHERE gateway_charge_id IS NOT NULL"));
    });

    it("deve conter triggers de imutabilidade de tenant_id", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.ok(sql.includes("trg_tenant_gateway_configs_tenant_immutable"));
      assert.ok(sql.includes("trg_gateway_events_tenant_immutable"));
      assert.ok(sql.includes("prevent_tenant_id_change"));
    });
  });

  describe("3. Preservação do Financeiro Manual e Compatibilidade", () => {
    it("as colunas de gateway em receivables devem ser puramente opcionais/anuláveis", () => {
      const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0014_school_gateway_asaas.sql");
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // Nenhuma das colunas adicionadas em receivables pode ser NOT NULL
      assert.ok(!sql.includes("ADD COLUMN IF NOT EXISTS gateway_provider VARCHAR(30) NOT NULL"));
      assert.ok(!sql.includes("ADD COLUMN IF NOT EXISTS gateway_charge_id VARCHAR(150) NOT NULL"));
      assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS gateway_charge_id VARCHAR(150)"));
    });
  });
});
