import test from "node:test";
import assert from "node:assert/strict";
import {
  maskCpf,
  generateDocumentNumber,
  generateVerificationToken,
  generateQrCodeDataUrl,
} from "../src/lib/documentos/generator.ts";

test("TeoClass — Geração e Autenticidade de Documentos Acadêmicos (Lote 9)", async (t) => {
  await t.test("1. Mascaramento LGPD de CPF para verificação pública", () => {
    assert.equal(maskCpf("12345678901"), "123.***.***-01");
    assert.equal(maskCpf("123.456.789-01"), "123.***.***-01");
    assert.equal(maskCpf(null), "***.***.***-**");
    assert.equal(maskCpf(""), "***.***.***-**");
  });

  await t.test("2. Geração de números sequenciais legíveis por tipo de documento", () => {
    const certNum = generateDocumentNumber("certificado_conclusao");
    assert.match(certNum, /^TC-CERT-\d{4}-[A-Z0-9]{5}$/);

    const decNum = generateDocumentNumber("declaracao_matricula");
    assert.match(decNum, /^TC-DEC-\d{4}-[A-Z0-9]{5}$/);

    const histNum = generateDocumentNumber("historico_escolar");
    assert.match(histNum, /^TC-HIST-\d{4}-[A-Z0-9]{5}$/);
  });

  await t.test("3. Geração de tokens únicos de verificação", () => {
    const token1 = generateVerificationToken();
    const token2 = generateVerificationToken();
    assert.ok(token1.length >= 20);
    assert.notEqual(token1, token2, "Tokens gerados devem ser únicos");
  });

  await t.test("4. Geração de QR Code em formato Data URL PNG", async () => {
    const testUrl = "https://teoclass.com.br/verificar/abc123token";
    const dataUrl = await generateQrCodeDataUrl(testUrl);
    assert.ok(dataUrl.startsWith("data:image/png;base64,"));
  });
});
