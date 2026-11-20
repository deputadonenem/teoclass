/**
 * TeoClass — Bateria de Homologação Remota do Lote 16 Fase 1: M2M Alcântara Hub
 * Projeto Supabase: cucjutrekedskgyuwfuh
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  canonicalizeJson,
  calculateBodyHash,
  buildHubCanonicalMessage,
  generateHubHmacSignature,
  safeCompareSignatures,
  validateHubM2MRequest,
} from "../src/lib/hub/verifier.ts";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"](.*)['"]$/, "$1");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error("Configuração de ambiente ausente no .env.local!");
  process.exit(1);
}

const anonClient = createSupabaseClient(supabaseUrl, anonKey);
const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);

async function runHomologation() {
  console.log("==============================================================================");
  console.log("TEOCLASS — LOTE 16 FASE 1: HOMOLOGAÇÃO REMOTA M2M ALCÂNTARA HUB");
  console.log("Supabase Remoto Target:", supabaseUrl);
  console.log("==============================================================================\n");

  const testKeyId = `hub_m2m_test_key_${Date.now()}`;
  const testSecret = `hub_sec_remote_test_${crypto.randomBytes(16).toString("hex")}`;
  const createdNonceIds: string[] = [];

  // Configura variáveis de ambiente temporárias para o verificador
  process.env.HUB_M2M_CLIENT_ID = testKeyId;
  process.env.HUB_WEBHOOK_SECRET = testSecret;

  try {
    // -------------------------------------------------------------------------
    // 1. Confirmação de Schema e Acesso service_role
    // -------------------------------------------------------------------------
    console.log("[TESTE 1] Inspecionando tabela hub_m2m_nonces via service_role...");
    const { data: initialCheck, error: checkErr } = await adminClient
      .from("hub_m2m_nonces")
      .select("id")
      .limit(1);

    if (checkErr) {
      throw new Error(`Tabela hub_m2m_nonces não encontrada ou inacessível: ${checkErr.message}`);
    }
    console.log("  -> Tabela hub_m2m_nonces ativa e acessível pelo service_role.");

    // -------------------------------------------------------------------------
    // 2. Bloqueio Rigoroso de anon / authenticated (PostgREST / REVOKE / RLS)
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 2] Validando REVOKE total e bloqueio PostgREST para clientes anon...");
    const { data: anonSelect, error: anonSelectErr } = await anonClient
      .from("hub_m2m_nonces")
      .select("*");

    if (!anonSelectErr) {
      throw new Error("FALHA DE SEGURANÇA: anon conseguiu consultar hub_m2m_nonces!");
    }
    console.log("  -> Bloqueio de SELECT anônimo confirmado com erro:", anonSelectErr.message);

    const { error: anonInsertErr } = await anonClient
      .from("hub_m2m_nonces")
      .insert({
        key_id: "malicious_key",
        nonce: "malicious_nonce",
        request_timestamp: Date.now(),
        expires_at: new Date(Date.now() + 600000).toISOString(),
      });

    if (!anonInsertErr) {
      throw new Error("FALHA DE SEGURANÇA: anon conseguiu inserir em hub_m2m_nonces!");
    }
    console.log("  -> Bloqueio de INSERT anônimo confirmado com erro:", anonInsertErr.message);

    // -------------------------------------------------------------------------
    // 3. Teste de Inserção Legítima e Persistência de Nonce
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 3] Inserção de nonce legítimo via service_role...");
    const nonce1 = `nonce_legit_${Date.now()}_1`;
    const nowTs = Date.now();
    const expiresAt = new Date(nowTs + 600000).toISOString();

    const { data: insertedNonce, error: insertErr } = await adminClient
      .from("hub_m2m_nonces")
      .insert({
        key_id: testKeyId,
        nonce: nonce1,
        request_timestamp: nowTs,
        expires_at: expiresAt,
      })
      .select("id, key_id, nonce, expires_at")
      .single();

    if (insertErr || !insertedNonce) {
      throw new Error(`Falha ao inserir nonce via service_role: ${insertErr?.message}`);
    }
    createdNonceIds.push(insertedNonce.id);
    console.log(`  -> Nonce gravado com sucesso. ID: ${insertedNonce.id}`);

    // -------------------------------------------------------------------------
    // 4. Teste de Replay Attack (Violação de UNIQUE key_id, nonce)
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 4] Teste de Replay Attack: tentando reutilizar o mesmo nonce...");
    const { error: replayErr } = await adminClient
      .from("hub_m2m_nonces")
      .insert({
        key_id: testKeyId,
        nonce: nonce1,
        request_timestamp: nowTs,
        expires_at: expiresAt,
      });

    if (!replayErr) {
      throw new Error("FALHA CRÍTICA: Replay attack foi aceito no banco!");
    }
    const isUniqueViolation =
      replayErr.message.includes("unique") ||
      replayErr.message.includes("duplicate") ||
      replayErr.code === "23505";
    if (!isUniqueViolation) {
      throw new Error(`Erro inesperado ao barrar replay: ${replayErr.message}`);
    }
    console.log("  -> Replay attack barrado com sucesso pela constraint UNIQUE(key_id, nonce).");

    // -------------------------------------------------------------------------
    // 5. Teste de Concorrência Real (5 instâncias tentando gravar o mesmo nonce simultaneamente)
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 5] Teste de Concorrência: 5 instâncias concorrentes com o mesmo nonce...");
    const nonceConcurrent = `nonce_conc_${Date.now()}`;
    const promises = Array.from({ length: 5 }).map(() =>
      adminClient
        .from("hub_m2m_nonces")
        .insert({
          key_id: testKeyId,
          nonce: nonceConcurrent,
          request_timestamp: nowTs,
          expires_at: expiresAt,
        })
        .select("id")
    );

    const results = await Promise.all(promises);
    const successList = results.filter((r) => !r.error && r.data && r.data.length > 0);
    const errorList = results.filter((r) => r.error);

    console.log(`  -> Resultado da corrida: ${successList.length} sucesso e ${errorList.length} rejeições.`);
    if (successList.length !== 1 || errorList.length !== 4) {
      throw new Error(`Concorrência falhou: esperava 1 sucesso e 4 rejeições, obteve ${successList.length}/${errorList.length}`);
    }
    if (successList[0]?.data?.[0]?.id) {
      createdNonceIds.push(successList[0].data[0].id);
    }
    console.log("  -> Exclusão mútua garantida sob concorrência rigorosa no Supabase remoto.");

    // -------------------------------------------------------------------------
    // 6. Teste do Verificador M2M contra o Contrato Real do Hub
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 6] Validação de HMAC-SHA256 e Contrato Criptográfico...");

    // 6.1 GET sem corpo
    const getPath = "/api/v1/hub/telemetry";
    const getNonce = `nonce_m2m_get_${Date.now()}`;
    const getTimestamp = Math.floor(Date.now() / 1000).toString();
    const getCanonical = `${getTimestamp}:${getNonce}:GET:${getPath}`;
    const getSig = crypto.createHmac("sha256", testSecret).update(getCanonical).digest("hex");

    const getResult = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: getTimestamp,
      nonce: getNonce,
      signature: getSig,
      method: "GET",
      path: getPath,
    });

    if (!getResult.valid) {
      throw new Error(`Falha ao validar requisição GET legítima: ${getResult.error}`);
    }
    console.log("  -> GET sem corpo validado com sucesso (valid: true).");

    // 6.2 Teste de Replay no Verificador com o banco remoto
    const replayResult = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: getTimestamp,
      nonce: getNonce, // Reutilizando mesmo nonce
      signature: getSig,
      method: "GET",
      path: getPath,
    });

    if (replayResult.valid || replayResult.statusCode !== 401) {
      throw new Error(`Replay pelo verificador não retornou 401 Replay detectado. Resultado: ${JSON.stringify(replayResult)}`);
    }
    console.log("  -> Replay barrado no verificador com HTTP 401:", replayResult.error);

    // 6.3 POST com corpo e canonicalização JSON
    const postPath = "/api/v1/hub/echo";
    const postNonce = `nonce_m2m_post_${Date.now()}`;
    const postTimestamp = Math.floor(Date.now() / 1000).toString();
    // Payload com chaves propositalmente fora de ordem
    const rawPayload = {
      zeta: 123,
      alpha: "primeiro",
      nested: { b: 2, a: 1 },
      array: [3, 2, 1],
    };
    const bodyHash = calculateBodyHash(rawPayload);
    const postCanonical = `${postTimestamp}:${postNonce}:POST:${postPath}:${bodyHash}`;
    const postSig = crypto.createHmac("sha256", testSecret).update(postCanonical).digest("hex");

    const postResult = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: postTimestamp,
      nonce: postNonce,
      signature: postSig,
      method: "POST",
      path: postPath,
      body: rawPayload,
    });

    if (!postResult.valid) {
      throw new Error(`Falha ao validar requisição POST legítima: ${postResult.error}`);
    }
    console.log("  -> POST com payload canonicalizado validado com sucesso (valid: true).");

    // -------------------------------------------------------------------------
    // 7. Testes Adversariais (Fail-Closed, Adulteração, Timestamp Skew)
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 7] Bateria de Testes Adversariais...");

    // 7.1 Assinatura Adulterada
    const badSigRes = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: Math.floor(Date.now() / 1000).toString(),
      nonce: `nonce_bad_sig_${Date.now()}`,
      signature: "0000000000000000000000000000000000000000000000000000000000000000",
      method: "GET",
      path: getPath,
    });
    if (badSigRes.valid || badSigRes.statusCode !== 401) {
      throw new Error("Assinatura adulterada não foi rejeitada com 401!");
    }
    console.log("  -> Assinatura adulterada rejeitada com HTTP 401:", badSigRes.error);

    // 7.2 Timestamp fora de janela (skew de 305 segundos no passado)
    const oldTs = (Math.floor(Date.now() / 1000) - 305).toString();
    const oldNonce = `nonce_old_${Date.now()}`;
    const oldSig = crypto
      .createHmac("sha256", testSecret)
      .update(`${oldTs}:${oldNonce}:GET:${getPath}`)
      .digest("hex");

    const oldRes = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: oldTs,
      nonce: oldNonce,
      signature: oldSig,
      method: "GET",
      path: getPath,
    });
    if (oldRes.valid || oldRes.statusCode !== 401) {
      throw new Error("Timestamp expirado (>300s) não foi rejeitado com 401!");
    }
    console.log("  -> Timestamp fora da janela (305s atrás) rejeitado com HTTP 401:", oldRes.error);

    // 7.3 Headers Ausentes
    const missingRes = await validateHubM2MRequest({
      keyId: "",
      timestampStr: "",
      nonce: "",
      signature: "",
      method: "GET",
      path: getPath,
    });
    if (missingRes.valid || missingRes.statusCode !== 401) {
      throw new Error("Headers ausentes não retornaram 401!");
    }
    console.log("  -> Headers ausentes rejeitados com HTTP 401:", missingRes.error);

    // 7.4 Configuração Ausente no Servidor (Fail-Closed)
    delete process.env.HUB_M2M_CLIENT_ID;
    delete process.env.HUB_WEBHOOK_SECRET;
    const noConfigRes = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: Math.floor(Date.now() / 1000).toString(),
      nonce: `nonce_noconf_${Date.now()}`,
      signature: "abcdef123456",
      method: "GET",
      path: getPath,
    });
    if (noConfigRes.valid || noConfigRes.statusCode !== 503) {
      throw new Error("Configuração ausente não resultou em HTTP 503 Fail-Closed!");
    }
    console.log("  -> Servidor sem credenciais rejeita sumariamente com HTTP 503:", noConfigRes.error);

    // Restaura ambiente para testes subsequentes
    process.env.HUB_M2M_CLIENT_ID = testKeyId;
    process.env.HUB_WEBHOOK_SECRET = testSecret;

    // -------------------------------------------------------------------------
    // 8. Teste do Endpoint de Telemetria (/api/v1/hub/telemetry)
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 8] Verificação do Endpoint de Telemetria e Ausência de PII...");
    const { GET: telemetryHandler } = await import("../src/app/api/v1/hub/telemetry/route.ts");

    // 8.1 Acesso sem autenticação (Anônimo)
    const anonTelemetryReq = new Request("https://teoclass.test/api/v1/hub/telemetry", { method: "GET" });
    const anonTelemetryRes = await telemetryHandler(anonTelemetryReq as any);
    if (anonTelemetryRes.status !== 401) {
      throw new Error(`Acesso anônimo à telemetria não foi barrado com 401! Status: ${anonTelemetryRes.status}`);
    }
    console.log(`  -> Acesso anônimo à telemetria barrado com HTTP ${anonTelemetryRes.status}.`);

    // 8.2 Acesso com Assinatura M2M Válida
    const telemNonce = `nonce_telem_${Date.now()}`;
    const telemTs = Math.floor(Date.now() / 1000).toString();
    const telemCanonical = `${telemTs}:${telemNonce}:GET:/api/v1/hub/telemetry`;
    const telemSig = crypto.createHmac("sha256", testSecret).update(telemCanonical).digest("hex");

    const validTelemetryReq = new Request("https://teoclass.test/api/v1/hub/telemetry", {
      method: "GET",
      headers: {
        "x-hub-key-id": testKeyId,
        "x-hub-timestamp": telemTs,
        "x-hub-nonce": telemNonce,
        "x-hub-signature": telemSig,
      },
    });

    const validTelemetryRes = await telemetryHandler(validTelemetryReq as any);
    if (validTelemetryRes.status !== 200) {
      const errBody = await validTelemetryRes.text();
      throw new Error(`Falha no endpoint de telemetria: status ${validTelemetryRes.status} - ${errBody}`);
    }

    const telemetryData = await validTelemetryRes.json();
    console.log("  -> Resposta da telemetria recebida:", JSON.stringify(telemetryData, null, 2));

    // Valida estrutura e ausência absoluta de PII
    if (telemetryData.service !== "teoclass-platform" || typeof telemetryData.metrics !== "object") {
      throw new Error("Estrutura da telemetria inválida!");
    }
    const serialized = JSON.stringify(telemetryData).toLowerCase();
    const forbiddenPiiTerms = ["cpf", "email", "name", "nome", "phone", "telefone", "aluno", "student", "teacher", "professor", "password", "secret", "token"];
    for (const term of forbiddenPiiTerms) {
      if (serialized.includes(`"${term}"`)) {
        throw new Error(`Possível vazamento de PII/Segredo detectado na telemetria: campo '${term}' presente.`);
      }
    }
    console.log("  -> Auditoria de PII aprovada: Zero dados pessoais ou de escolas expostos.");

  } finally {
    // -------------------------------------------------------------------------
    // 9. Limpeza Total de Dados Fictícios do Supabase Remoto
    // -------------------------------------------------------------------------
    console.log("\n[TESTE 9] Limpando dados fictícios criados pelo teste no Supabase remoto...");
    const { error: cleanErr, count } = await adminClient
      .from("hub_m2m_nonces")
      .delete({ count: "exact" })
      .eq("key_id", testKeyId);

    if (cleanErr) {
      console.warn("  -> Aviso ao limpar nonces:", cleanErr.message);
    } else {
      console.log(`  -> Limpeza concluída: ${count ?? 0} registros removidos. Banco preservado sem resíduos.`);
    }
  }

  console.log("\n==============================================================================");
  console.log("HOMOLOGAÇÃO REMOTA LOTE 16 FASE 1 CONCLUÍDA COM 100% DE SUCESSO!");
  console.log("==============================================================================");
}

runHomologation().catch((err) => {
  console.error("\n❌ FALHA NA HOMOLOGAÇÃO REMOTA:", err);
  process.exit(1);
});
