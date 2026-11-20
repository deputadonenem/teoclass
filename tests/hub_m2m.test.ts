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

import {
  canonicalizeJson,
  calculateBodyHash,
  buildHubCanonicalMessage,
  generateHubHmacSignature,
  safeCompareSignatures,
  validateHubM2MRequest,
} from "../src/lib/hub/verifier.ts";

describe("TeoClass — Lote 16 Fase 1: Fundação M2M Alcântara Hub", () => {
  const mockSecret = "super-secret-hub-key-for-test-123456789";
  const mockKeyId = "test-teoclass-client-id";

  describe("1. Canonicalização Determinística de JSON e Hashing", () => {
    it("deve ordenar chaves alfabeticamente independentemente da ordem original", () => {
      const obj1 = { b: 2, a: 1, c: { y: "test", x: 10 } };
      const obj2 = { c: { x: 10, y: "test" }, a: 1, b: 2 };

      const canon1 = canonicalizeJson(obj1);
      const canon2 = canonicalizeJson(obj2);

      assert.strictEqual(canon1, '{"a":1,"b":2,"c":{"x":10,"y":"test"}}');
      assert.strictEqual(canon1, canon2, "Objetos equivalentes devem gerar o mesmo JSON canônico");
    });

    it("deve produzir bodyHash idêntico para JSONs com chaves desordenadas", () => {
      const payloadA = { tenantId: "t-1", status: "active", plan: "gestao_ead" };
      const payloadB = { plan: "gestao_ead", tenantId: "t-1", status: "active" };

      const hashA = calculateBodyHash(payloadA);
      const hashB = calculateBodyHash(payloadB);

      assert.strictEqual(hashA, hashB, "Hash SHA-256 deve ser estritamente igual");
      assert.strictEqual(hashA.length, 64, "SHA-256 deve ter 64 caracteres hexadecimais");
    });
  });

  describe("2. Construção de Mensagem Canônica e Assinatura HMAC-SHA256", () => {
    it("deve formatar mensagem sem corpo: timestamp:nonce:METHOD:path", () => {
      const msg = buildHubCanonicalMessage("1700000000", "nonce-123", "get", "/api/v1/hub/telemetry");
      assert.strictEqual(msg, "1700000000:nonce-123:GET:/api/v1/hub/telemetry");
    });

    it("deve formatar mensagem com corpo: timestamp:nonce:METHOD:path:bodyHash", () => {
      const body = { test: true };
      const expectedHash = calculateBodyHash(body);
      const msg = buildHubCanonicalMessage("1700000000", "nonce-123", "POST", "/api/v1/hub/sync", body);
      assert.strictEqual(msg, `1700000000:nonce-123:POST:/api/v1/hub/sync:${expectedHash}`);
    });

    it("deve gerar e validar assinatura válida usando chave secreta", () => {
      const message = "1700000000:nonce-123:GET:/api/v1/hub/telemetry";
      const signature = generateHubHmacSignature(mockSecret, message);

      assert.ok(signature.length === 64, "Assinatura HMAC deve ser hex de 64 caracteres");
      assert.strictEqual(safeCompareSignatures(signature, signature), true);
    });

    it("deve rejeitar assinaturas adulteradas ou inválidas", () => {
      const message = "1700000000:nonce-123:GET:/api/v1/hub/telemetry";
      const validSig = generateHubHmacSignature(mockSecret, message);
      const tamperedSig = validSig.slice(0, -2) + (validSig.slice(-2) === "aa" ? "bb" : "aa");

      assert.strictEqual(safeCompareSignatures(validSig, tamperedSig), false);
    });
  });

  describe("3. Validação de Segurança M2M e Fail-Closed", () => {
    it("deve falhar com 401 se qualquer cabeçalho obrigatório estiver ausente", async () => {
      const res = await validateHubM2MRequest({
        keyId: "",
        timestampStr: "1700000000",
        nonce: "n-1",
        signature: "sig-1",
        method: "GET",
        path: "/api/v1/hub/telemetry",
      });

      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.error?.includes("obrigatórios ausentes"));
    });

    it("deve falhar com 401 se timestamp for inválido ou numérico malformado", async () => {
      const res = await validateHubM2MRequest({
        keyId: mockKeyId,
        timestampStr: "timestamp-invalido",
        nonce: "n-1",
        signature: "sig-1",
        method: "GET",
        path: "/api/v1/hub/telemetry",
      });

      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.error?.includes("Timestamp inválido"));
    });

    it("deve falhar com 401 se timestamp estiver fora da janela de 300 segundos", async () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 350; // 350 segundos atrás
      const res = await validateHubM2MRequest({
        keyId: mockKeyId,
        timestampStr: expiredTimestamp.toString(),
        nonce: "n-1",
        signature: "sig-1",
        method: "GET",
        path: "/api/v1/hub/telemetry",
      });

      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.error?.includes("fora da janela permitida"));
    });

    it("deve falhar com 401 se o Key-Id for diferente do configurado no ambiente", async () => {
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const originalEnv = process.env.HUB_M2M_CLIENT_ID;
      process.env.HUB_M2M_CLIENT_ID = "legit-client-id";
      process.env.HUB_WEBHOOK_SECRET = "legit-secret-123456";

      try {
        const res = await validateHubM2MRequest({
          keyId: "attacker-key-id",
          timestampStr: nowSec,
          nonce: "n-attacker",
          signature: "some-sig",
          method: "GET",
          path: "/api/v1/hub/telemetry",
        });

        assert.strictEqual(res.valid, false);
        assert.strictEqual(res.statusCode, 401);
        assert.ok(res.error?.includes("não autorizado"));
      } finally {
        process.env.HUB_M2M_CLIENT_ID = originalEnv;
      }
    });

    it("deve aceitar assinatura válida com keyId e timestamp corretos dentro da janela", async () => {
      const nowSec = Math.floor(Date.now() / 1000).toString();
      const originalClientId = process.env.HUB_M2M_CLIENT_ID;
      const originalSecret = process.env.HUB_WEBHOOK_SECRET;

      process.env.HUB_M2M_CLIENT_ID = mockKeyId;
      process.env.HUB_WEBHOOK_SECRET = mockSecret;

      try {
        const nonce = `test-valid-nonce-${Date.now()}`;
        const pathStr = "/api/v1/hub/telemetry";
        const canonical = buildHubCanonicalMessage(nowSec, nonce, "GET", pathStr);
        const signature = generateHubHmacSignature(mockSecret, canonical);

        const res = await validateHubM2MRequest({
          keyId: mockKeyId,
          timestampStr: nowSec,
          nonce,
          signature,
          method: "GET",
          path: pathStr,
        });

        assert.strictEqual(res.valid, true);
        assert.strictEqual(res.keyId, mockKeyId);
      } finally {
        process.env.HUB_M2M_CLIENT_ID = originalClientId;
        process.env.HUB_WEBHOOK_SECRET = originalSecret;
      }
    });
  });

  describe("4. Estrutura e Invariantes da Migration 0016", () => {
    it("arquivo de migração 0016 deve existir com tabela hub_m2m_nonces", () => {
      const migrationPath = path.resolve(process.cwd(), "supabase/migrations/0016_hub_m2m_nonces.sql");
      assert.ok(fs.existsSync(migrationPath), "Migration 0016 deve existir");

      const sql = fs.readFileSync(migrationPath, "utf8");
      assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.hub_m2m_nonces"), "Deve criar hub_m2m_nonces");
      assert.ok(sql.includes("uq_hub_m2m_nonces_key_nonce UNIQUE (key_id, nonce)"), "Deve ter unicidade por key e nonce");
      assert.ok(sql.includes("REVOKE ALL ON public.hub_m2m_nonces FROM PUBLIC, anon, authenticated"), "Deve revogar acesso público");
      assert.ok(sql.includes("GRANT ALL ON public.hub_m2m_nonces TO service_role"), "Acesso exclusivo service_role");
    });
  });
});
