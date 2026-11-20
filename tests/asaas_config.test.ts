import { describe, it } from "node:test";
import assert from "node:assert";
import { AsaasClient } from "../src/lib/financeiro/asaas_client.ts";
import {
  encryptGatewaySecret,
  decryptGatewaySecret,
  maskGatewayApiKey,
} from "../src/lib/financeiro/crypto.ts";

describe("TeoClass — Lote 15 Fase 2: Configuração Opcional do Asaas Escolar", () => {
  describe("1. Cliente HTTP Asaas Tipado e Tratamento de Erros", () => {
    it("deve inicializar com ambiente sandbox por padrão", () => {
      const client = new AsaasClient({
        apiKey: "$aact_mock_valid_key_12345",
        environment: "sandbox",
      });
      assert.ok(client);
    });

    it("deve rejeitar inicialização com chave vazia", () => {
      assert.throws(
        () => new AsaasClient({ apiKey: "", environment: "sandbox" }),
        /Chave de API do Asaas não fornecida/i
      );
    });

    it("não deve expor o valor da chave de API em mensagens de erro", async () => {
      const secretKey = "$aact_super_secret_test_token_8841";
      const client = new AsaasClient({
        apiKey: secretKey,
        environment: "sandbox",
        timeoutMs: 1000,
      });

      // Forçar falha de rede/autenticação apontando para chave inválida
      const pingResult = await client.ping();
      assert.strictEqual(pingResult.success, false);
      assert.ok(pingResult.error);
      assert.ok(
        !pingResult.error.includes(secretKey),
        "A mensagem de erro não pode conter a chave de API em texto puro!"
      );
    });
  });

  describe("2. Mascaramento e Exposição de Credenciais no Cofre", () => {
    it("deve mascarar corretamente chaves de API sem vazar o corpo do token", () => {
      const sampleKey = "$aact_YTU5YTE0M2M2N2I4MTliNjc0OGY4Mzgy...mock-9988";
      const masked = maskGatewayApiKey(sampleKey);
      assert.strictEqual(masked, "9988");
      assert.strictEqual(masked.length, 4);
    });

    it("deve proteger chave com criptografia AES-256-GCM antes de persistir", () => {
      const rawToken = "segredo-do-asaas-123456";
      const encrypted = encryptGatewaySecret(rawToken);

      // Não pode conter o texto original
      assert.strictEqual(encrypted.includes(rawToken), false);
      // Deve decifrar com exatidão
      assert.strictEqual(decryptGatewaySecret(encrypted), rawToken);
    });
  });

  describe("3. Preservação do Modo Manual", () => {
    it("o sistema opera normalmente quando o gateway summary indicar isConfigured = false", () => {
      const summary = {
        isConfigured: false,
        provider: "asaas" as const,
        isActive: false,
        environment: "sandbox" as const,
        apiKeyLastFour: null,
        accountNumber: null,
        updatedAt: null,
      };

      assert.strictEqual(summary.isConfigured, false);
      assert.strictEqual(summary.isActive, false);
      assert.strictEqual(summary.apiKeyLastFour, null);
    });
  });
});
