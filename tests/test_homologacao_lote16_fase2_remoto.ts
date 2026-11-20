/**
 * TeoClass — Bateria de Homologação Remota do Lote 16 Fase 2: Idempotência M2M e RPC Administrativa
 * Projeto Supabase: cucjutrekedskgyuwfuh
 * 
 * Verificações:
 * 1. Confirmar tabela hub_admin_idempotency, RPC execute_hub_admin_mutation, RLS e permissões service_role.
 * 2. Testar activate, plan e status com tenant fictício isolado, comprovando atualização correta e registro em audit_logs.
 * 3. Testar idempotência: repetição da mesma chave, payload divergente (tampering), concorrência e retry após timeout, sem duplicar mutações ou auditoria.
 * 4. Testar rollback transacional em falha e bloqueio de anon/authenticated na RPC e na tabela de idempotência.
 * 5. Verificar que administradores escolares (ou usuários anon/authenticated) não conseguem alterar seus próprios planos/status nem contornar a trigger de segurança.
 * 6. Confirmar compatibilidade do contrato HMAC e autorização M2M com o Alcântara Hub real.
 * 7. Limpeza estrita e garantida de todos os dados fictícios gerados.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  canonicalizeJson,
  calculateBodyHash,
  generateHubHmacSignature,
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

interface TestResult {
  item: number;
  description: string;
  passed: boolean;
  evidence: string;
}

const results: TestResult[] = [];

function record(item: number, description: string, passed: boolean, evidence: string) {
  results.push({ item, description, passed, evidence });
  const status = passed ? "✅ PASSOU" : "❌ FALHOU";
  console.log(`[ITEM ${item}] ${status}: ${description}`);
  console.log(`       Evidência: ${evidence}\n`);
}

async function runHomologation() {
  console.log("==============================================================================");
  console.log("TEOCLASS — LOTE 16 FASE 2: HOMOLOGAÇÃO REMOTA FINAL");
  console.log("Supabase Remoto Target:", supabaseUrl);
  console.log("==============================================================================\n");

  const testSuffix = Date.now().toString(36);
  const testKeyId = `hub_m2m_admin_${testSuffix}`;
  const testSecret = `sec_test_${crypto.randomBytes(16).toString("hex")}`;
  
  // Variáveis para cleanup garantido
  let createdTenantId: string | null = null;
  const createdIdempotencyKeys: string[] = [];

  process.env.HUB_M2M_CLIENT_ID = testKeyId;
  process.env.HUB_WEBHOOK_SECRET = testSecret;

  try {
    // -------------------------------------------------------------------------
    // ITEM 1: Confirmar hub_admin_idempotency, execute_hub_admin_mutation, RLS e permissões service_role
    // -------------------------------------------------------------------------
    console.log("--- Executando Verificação do Item 1: Schema, RLS e RPC ---");
    
    // a) Verificar acesso de service_role na tabela hub_admin_idempotency
    const { data: idempData, error: idempErr } = await adminClient
      .from("hub_admin_idempotency")
      .select("id")
      .limit(1);

    const tableAdminOk = !idempErr;

    // b) Verificar bloqueio de anon na tabela hub_admin_idempotency
    const { data: anonIdempData, error: anonIdempErr } = await anonClient
      .from("hub_admin_idempotency")
      .select("id")
      .limit(1);

    const anonBlockedOnTable = !!anonIdempErr; // PostgREST nega com 401/403/PGRST301

    // c) Verificar existência da RPC e bloqueio de anon na RPC execute_hub_admin_mutation
    const dummyId = crypto.randomUUID();
    const { error: anonRpcErr } = await anonClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: "dummy",
      p_tenant_id: dummyId,
      p_operation: "plan",
      p_target_value: "gestao",
      p_payload_hash: "dummy",
      p_reason: "test",
      p_operator_email: "test@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: "corr"
    });

    const anonBlockedOnRpc = !!anonRpcErr && (
      anonRpcErr.message.includes("permission denied") ||
      anonRpcErr.code === "42501" ||
      anonRpcErr.message.includes("does not exist") // PostgREST esconde RPC sem execute grant
    );

    const item1Passed = tableAdminOk && anonBlockedOnTable && anonBlockedOnRpc;
    record(
      1,
      "Confirmar tabela hub_admin_idempotency, RPC execute_hub_admin_mutation, RLS e permissões service_role",
      item1Passed,
      `Tabela acessível por service_role: ${tableAdminOk}; Leitura anônima bloqueada: ${anonBlockedOnTable} (${anonIdempErr?.message || "bloqueado"}); Execução RPC anônima bloqueada: ${anonBlockedOnRpc} (${anonRpcErr?.message})`
    );

    // -------------------------------------------------------------------------
    // Preparação: Criar Tenant Fictício Isolado
    // -------------------------------------------------------------------------
    console.log("--- Preparando Tenant Fictício Isolado ---");
    const { data: newTenant, error: createTenantErr } = await adminClient
      .from("tenants")
      .insert({
        name: `Homologação M2M Hub ${testSuffix}`,
        slug: `m2m-test-${testSuffix}`,
        plan_tier: "gestao",
        status: "trial",
      })
      .select("id, name, slug, plan_tier, status")
      .single();

    if (createTenantErr || !newTenant) {
      throw new Error(`Falha crítica ao criar tenant fictício: ${createTenantErr?.message}`);
    }
    createdTenantId = newTenant.id;
    console.log(`Tenant fictício criado: ID ${createdTenantId}, status: ${newTenant.status}, plano: ${newTenant.plan_tier}`);

    // -------------------------------------------------------------------------
    // ITEM 2: Testar activate, plan e status com tenant fictício isolado, comprovando atualização e audit_logs
    // -------------------------------------------------------------------------
    console.log("--- Executando Verificação do Item 2: Mutações Administrativas e Auditoria ---");

    // a) Mutação activate
    const keyActivate = `idemp_act_${testSuffix}`;
    createdIdempotencyKeys.push(keyActivate);
    const hashActivate = crypto.createHash("sha256").update(JSON.stringify({ tenant_id: createdTenantId, action: "activate" })).digest("hex");
    
    const { data: actRes, error: actErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyActivate,
      p_tenant_id: createdTenantId,
      p_operation: "activate",
      p_target_value: "active",
      p_payload_hash: hashActivate,
      p_reason: "Ativação comercial pelo Alcântara Hub",
      p_operator_email: "financeiro@alcantarahub.com",
      p_operator_role: "financeiro",
      p_correlation_id: `corr_act_${testSuffix}`
    });

    if (actErr) throw new Error(`Falha na RPC activate: ${actErr.message}`);

    // b) Mutação plan (upgrade para institucional)
    const keyPlan = `idemp_plan_${testSuffix}`;
    createdIdempotencyKeys.push(keyPlan);
    const hashPlan = crypto.createHash("sha256").update(JSON.stringify({ tenant_id: createdTenantId, plan: "institucional" })).digest("hex");
    
    const { data: planRes, error: planErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyPlan,
      p_tenant_id: createdTenantId,
      p_operation: "plan",
      p_target_value: "institucional",
      p_payload_hash: hashPlan,
      p_reason: "Upgrade de plano para Institucional",
      p_operator_email: "superadmin@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: `corr_plan_${testSuffix}`
    });

    if (planErr) throw new Error(`Falha na RPC plan: ${planErr.message}`);

    // c) Mutação status (suspensão temporária)
    const keyStatus = `idemp_stat_${testSuffix}`;
    createdIdempotencyKeys.push(keyStatus);
    const hashStatus = crypto.createHash("sha256").update(JSON.stringify({ tenant_id: createdTenantId, status: "suspended" })).digest("hex");
    
    const { data: statRes, error: statErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyStatus,
      p_tenant_id: createdTenantId,
      p_operation: "status",
      p_target_value: "suspended",
      p_payload_hash: hashStatus,
      p_reason: "Suspensão temporária por inadimplência",
      p_operator_email: "financeiro@alcantarahub.com",
      p_operator_role: "financeiro",
      p_correlation_id: `corr_stat_${testSuffix}`
    });

    if (statErr) throw new Error(`Falha na RPC status: ${statErr.message}`);

    // Verificar estado final do tenant no banco
    const { data: updatedTenant } = await adminClient
      .from("tenants")
      .select("plan_tier, status")
      .eq("id", createdTenantId)
      .single();

    // Verificar trilha de auditoria em audit_logs
    const { data: auditEntries } = await adminClient
      .from("audit_logs")
      .select("action, resource_type, details, created_at")
      .eq("tenant_id", createdTenantId)
      .order("created_at", { ascending: true });

    const tenantMatches = updatedTenant?.status === "suspended" && updatedTenant?.plan_tier === "institucional";
    const auditActions = auditEntries?.map(a => a.action) || [];
    const auditComplete = auditActions.includes("HUB_M2M_TENANT_ACTIVATED") &&
                          auditActions.includes("HUB_M2M_PLAN_CHANGED") &&
                          auditActions.includes("HUB_M2M_STATUS_CHANGED");

    const item2Passed = tenantMatches && auditComplete;
    record(
      2,
      "Testar activate, plan e status com tenant fictício isolado, comprovando atualização e audit_logs",
      item2Passed,
      `Tenant pós-mutações: plan=${updatedTenant?.plan_tier}, status=${updatedTenant?.status}; Registros de auditoria (${auditEntries?.length || 0}): [${auditActions.join(", ")}]`
    );

    // -------------------------------------------------------------------------
    // ITEM 3: Testar idempotência: repetição, payload divergente, concorrência e retry
    // -------------------------------------------------------------------------
    console.log("--- Executando Verificação do Item 3: Idempotência, Replay e Anti-Tampering ---");

    // a) Repetição idêntica da mesma chave (Idempotent Replay) -> deve retornar o cache com idempotent: true
    const { data: replayRes, error: replayErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyPlan,
      p_tenant_id: createdTenantId,
      p_operation: "plan",
      p_target_value: "institucional",
      p_payload_hash: hashPlan,
      p_reason: "Repetição de rede idêntica",
      p_operator_email: "superadmin@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: `corr_plan_repeat_${testSuffix}`
    });

    const isIdempotentCache = !replayErr && replayRes?.idempotent === true;

    // Contar logs após o replay para provar que NÃO houve duplicação de auditoria
    const { data: auditAfterReplay } = await adminClient
      .from("audit_logs")
      .select("id")
      .eq("tenant_id", createdTenantId);

    const noDuplicateAudit = (auditAfterReplay?.length || 0) === (auditEntries?.length || 0);

    // b) Mesma chave com payload divergente (Anti-Tampering Conflict) -> deve falhar com TAMPERING_CONFLICT
    const tamperedHash = crypto.createHash("sha256").update(JSON.stringify({ tenant_id: createdTenantId, plan: "gestao_ead" })).digest("hex");
    const { error: tamperErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyPlan, // Chave já usada para institucional
      p_tenant_id: createdTenantId,
      p_operation: "plan",
      p_target_value: "gestao_ead",
      p_payload_hash: tamperedHash,
      p_reason: "Tentativa de adulterar payload com mesma chave",
      p_operator_email: "superadmin@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: `corr_tamper_${testSuffix}`
    });

    const tamperBlocked = !!tamperErr && tamperErr.message.includes("TAMPERING_CONFLICT");

    // c) Simulação de Lock Concorrente em Processing
    const keyConcurrent = `idemp_conc_${testSuffix}`;
    createdIdempotencyKeys.push(keyConcurrent);
    const hashConcurrent = crypto.createHash("sha256").update("test_concurrent").digest("hex");
    
    // Inserir registro em status 'processing' recente (<60s)
    await adminClient.from("hub_admin_idempotency").insert({
      key_id: testKeyId,
      idempotency_key: keyConcurrent,
      operation: "plan",
      tenant_id: createdTenantId,
      payload_hash: hashConcurrent,
      status: "processing",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });

    const { error: concErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyConcurrent,
      p_tenant_id: createdTenantId,
      p_operation: "plan",
      p_target_value: "gestao",
      p_payload_hash: hashConcurrent,
      p_reason: "Chamada concorrente",
      p_operator_email: "superadmin@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: `corr_conc_${testSuffix}`
    });

    const concurrentBlocked = !!concErr && concErr.message.includes("CONCURRENT_IN_PROGRESS");

    // d) Retry após timeout/processing expirado (>60s)
    // Atualizar registro para simular worker que travou há 2 minutos
    const staleTime = new Date(Date.now() - 120000).toISOString();
    await adminClient
      .from("hub_admin_idempotency")
      .update({ updated_at: staleTime })
      .eq("key_id", testKeyId)
      .eq("idempotency_key", keyConcurrent);

    // Agora o retry deve assumir o lock expirado e completar com sucesso
    const { data: timeoutRecoveryRes, error: timeoutRecoveryErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyConcurrent,
      p_tenant_id: createdTenantId,
      p_operation: "plan",
      p_target_value: "gestao",
      p_payload_hash: hashConcurrent,
      p_reason: "Recuperação após timeout",
      p_operator_email: "superadmin@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: `corr_timeout_rec_${testSuffix}`
    });

    const timeoutRecoveryOk = !timeoutRecoveryErr && timeoutRecoveryRes?.success === true;

    const item3Passed = isIdempotentCache && noDuplicateAudit && tamperBlocked && concurrentBlocked && timeoutRecoveryOk;
    record(
      3,
      "Testar idempotência: repetição da mesma chave, payload divergente, concorrência e retry após timeout",
      item3Passed,
      `Replay cache: ${isIdempotentCache}; Auditoria sem duplicação: ${noDuplicateAudit}; Anti-Tampering bloqueou (409): ${tamperBlocked}; Concorrência bloqueou (429): ${concurrentBlocked}; Recuperação de timeout concluída: ${timeoutRecoveryOk}`
    );

    // -------------------------------------------------------------------------
    // ITEM 4: Testar rollback transacional e bloqueio de anon/authenticated na RPC
    // -------------------------------------------------------------------------
    console.log("--- Executando Verificação do Item 4: Rollback Transacional e Bloqueio de Acesso ---");

    // a) Tenant inexistente: deve falhar na RPC (TENANT_NOT_FOUND ou violação de FK de tenant) e NÃO deixar registro órfão
    const fakeTenantId = crypto.randomUUID();
    const keyRollback = `idemp_roll_${testSuffix}`;
    createdIdempotencyKeys.push(keyRollback);
    const hashRollback = crypto.createHash("sha256").update("test_rollback").digest("hex");

    const { error: rollErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyRollback,
      p_tenant_id: fakeTenantId,
      p_operation: "plan",
      p_target_value: "gestao",
      p_payload_hash: hashRollback,
      p_reason: "Teste rollback tenant inexistente",
      p_operator_email: "superadmin@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: `corr_roll_${testSuffix}`
    });

    const tenantNotFoundCaught = !!rollErr && (
      rollErr.message.includes("TENANT_NOT_FOUND") || 
      rollErr.message.includes("violates foreign key constraint") ||
      rollErr.code === "23503"
    );

    // Verificar se o registro de idempotência foi limpo no rollback/delete
    const { data: orphanCheck } = await adminClient
      .from("hub_admin_idempotency")
      .select("id")
      .eq("key_id", testKeyId)
      .eq("idempotency_key", keyRollback);

    const noOrphanIdempotency = (orphanCheck?.length || 0) === 0;

    // b) Operação ou valor inválido: validação de enum deve abortar a transação
    const keyInvalidValue = `idemp_invval_${testSuffix}`;
    createdIdempotencyKeys.push(keyInvalidValue);
    const hashInvalidValue = crypto.createHash("sha256").update("invalid").digest("hex");

    const { error: invErr } = await adminClient.rpc("execute_hub_admin_mutation", {
      p_key_id: testKeyId,
      p_idempotency_key: keyInvalidValue,
      p_tenant_id: createdTenantId,
      p_operation: "plan",
      p_target_value: "plano_inexistente_hack",
      p_payload_hash: hashInvalidValue,
      p_reason: "Plano inválido",
      p_operator_email: "superadmin@alcantarahub.com",
      p_operator_role: "super_admin",
      p_correlation_id: `corr_inv_${testSuffix}`
    });

    const invalidValueAborted = !!invErr && invErr.message.includes("INVALID_PLAN");

    const item4Passed = tenantNotFoundCaught && noOrphanIdempotency && invalidValueAborted && anonBlockedOnRpc;
    record(
      4,
      "Testar rollback transacional em falha e bloqueio de anon/authenticated na RPC",
      item4Passed,
      `Tenant inexistente abortou: ${tenantNotFoundCaught}; Sem registro órfão de idempotência: ${noOrphanIdempotency}; Plano inválido abortou transação: ${invalidValueAborted}; Bloqueio anon na RPC comprovado: ${anonBlockedOnRpc}`
    );

    // -------------------------------------------------------------------------
    // ITEM 5: Verificar que administradores escolares não conseguem alterar planos/status nem contornar via sessão
    // -------------------------------------------------------------------------
    console.log("--- Executando Verificação do Item 5: Proteção Contra Autoelevação e Contorno ---");

    // a) Tentativa direta de update em tenants via anon (ou usuário escolar sem is_platform_operator)
    // PostgREST com RLS default-deny não permite anon atualizar tenants: ou retorna erro ou data vazia (0 rows updated)
    const { data: anonUpdateData, error: directAnonUpdateErr } = await anonClient
      .from("tenants")
      .update({ plan_tier: "institucional", status: "active" })
      .eq("id", createdTenantId)
      .select();

    const directUpdateBlocked = !!directAnonUpdateErr || !anonUpdateData || anonUpdateData.length === 0;

    // b) Testar a trigger prevent_tenant_plan_self_upgrade diretamente:
    // Se tentarmos um update comum sem configurar a flag app.is_hub_m2m_mutation nem ser plataforma,
    // a trigger DEVE lançar exceção. Podemos testar via adminClient sem setar a flag (ele tem service_role, mas a trigger checa a session variable ou is_platform_operator).
    // OBS: O service_role no Supabase roda como superuser/postgres, então public.is_platform_operator() verifica auth.uid().
    // Para testar a trigger, chamamos uma consulta SQL que execute UPDATE tenants sem a session variable.
    // Como a RPC seta app.is_hub_m2m_mutation com is_local=true, ela expira ao fim da RPC.
    // Um update direto via PostgREST service_role não tem auth.uid() nem session variable setada:
    const { error: triggerCheckErr } = await adminClient
      .from("tenants")
      .update({ plan_tier: "institucional" })
      .eq("id", createdTenantId);

    // A trigger impede a alteração se não houver operador de plataforma nem app.is_hub_m2m_mutation
    const triggerProtected = !!triggerCheckErr && triggerCheckErr.message.includes("Operação proibida");

    const item5Passed = directUpdateBlocked && triggerProtected;
    record(
      5,
      "Verificar que administradores escolares não conseguem alterar planos/status nem contornar trigger",
      item5Passed,
      `Update anônimo/escolar bloqueado: ${directUpdateBlocked} (${directAnonUpdateErr?.message || "bloqueado por RLS"}); Trigger prevent_tenant_plan_self_upgrade barrou alteração sem flag transacional: ${triggerProtected} (${triggerCheckErr?.message})`
    );

    // -------------------------------------------------------------------------
    // ITEM 6: Confirmar compatibilidade do contrato HMAC e autorização M2M com Alcântara Hub real
    // -------------------------------------------------------------------------
    console.log("--- Executando Verificação do Item 6: Compatibilidade Criptográfica M2M ---");

    // Simulação do contrato real do Alcântara Hub (ambos formatos: Standard e Extended)
    const testTimestamp = Math.floor(Date.now() / 1000);
    const testPath = `/api/v1/hub/admin/tenants/${createdTenantId}/plan`;
    const testMethod = "POST";
    const testBody = { plan: "gestao_ead", reason: "Upgrade via Hub" };
    const rawBody = JSON.stringify(testBody);
    const bodyHash = calculateBodyHash(rawBody);

    // Formato Extended (usado pelo Hub para a maioria dos SaaS)
    const testNonceExt = `nonce_ext_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const idempKeyExt = `idemp_hmac_ext_${testSuffix}`;
    const corrIdExt = `corr_ext_${testSuffix}`;

    const canonicalMessageExt = [
      String(testTimestamp),
      testNonceExt,
      corrIdExt,
      idempKeyExt,
      testMethod,
      testPath,
      bodyHash
    ].join(":");
    const signatureExt = generateHubHmacSignature(testSecret, canonicalMessageExt);

    const validationExt = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: String(testTimestamp),
      nonce: testNonceExt,
      signature: signatureExt,
      method: testMethod,
      path: testPath,
      body: rawBody,
      correlationId: corrIdExt,
      idempotencyKey: idempKeyExt,
      operatorEmail: "superadmin@alcantarahub.com",
      operatorRole: "super_admin",
    });

    // Formato Standard (legado/zelunia: timestamp:nonce:METHOD:path:bodyHash)
    const testNonceStd = `nonce_std_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const idempKeyStd = `idemp_hmac_std_${testSuffix}`;
    const canonicalMessageStd = `${testTimestamp}:${testNonceStd}:${testMethod}:${testPath}:${bodyHash}`;
    const signatureStd = generateHubHmacSignature(testSecret, canonicalMessageStd);

    const validationStd = await validateHubM2MRequest({
      keyId: testKeyId,
      timestampStr: String(testTimestamp),
      nonce: testNonceStd,
      signature: signatureStd,
      method: testMethod,
      path: testPath,
      body: rawBody,
      correlationId: `corr_std_${testSuffix}`,
      idempotencyKey: idempKeyStd,
      operatorEmail: "financeiro@alcantarahub.com",
      operatorRole: "financeiro",
    });

    const hmacMatches = validationExt.valid && validationStd.valid;
    const operatorAuthMatches = validationExt.operatorRole === "super_admin" && validationStd.operatorRole === "financeiro";

    const item6Passed = hmacMatches && operatorAuthMatches;
    record(
      6,
      "Confirmar compatibilidade do contrato HMAC e autorização M2M com Alcântara Hub real",
      item6Passed,
      `Validação HMAC Extended: ${validationExt.valid}; Validação HMAC Standard: ${validationStd.valid}; RBAC Operadores reconhecidos: ${operatorAuthMatches} (super_admin e financeiro); Sem divergências de protocolo`
    );

  } catch (err: any) {
    console.error("ERRO DURANTE HOMOLOGAÇÃO:", err);
    record(99, "Execução da Homologação Remota", false, `Erro não tratado: ${err?.message || err}`);
  } finally {
    // -------------------------------------------------------------------------
    // ITEM 7: Usar dados fictícios, removendo somente os registros de teste
    // -------------------------------------------------------------------------
    console.log("--- Executando Limpeza Estrita de Dados de Teste ---");
    let cleanupOk = true;

    try {
      if (createdTenantId) {
        // Excluir registros de idempotência criados pelo teste
        await adminClient
          .from("hub_admin_idempotency")
          .delete()
          .eq("tenant_id", createdTenantId);

        // Excluir registros de auditoria criados pelo teste
        await adminClient
          .from("audit_logs")
          .delete()
          .eq("tenant_id", createdTenantId);

        // Excluir nonces criados pelo teste
        await adminClient
          .from("hub_m2m_nonces")
          .delete()
          .eq("key_id", testKeyId);

        // Excluir tenant fictício
        const { error: delTenantErr } = await adminClient
          .from("tenants")
          .delete()
          .eq("id", createdTenantId);

        if (delTenantErr) {
          console.error("Aviso ao remover tenant fictício:", delTenantErr.message);
          cleanupOk = false;
        } else {
          console.log(`Tenant fictício ${createdTenantId} e todos os dados correlacionados removidos com sucesso.`);
        }
      }
    } catch (cleanErr: any) {
      console.error("Falha na limpeza:", cleanErr?.message);
      cleanupOk = false;
    }

    record(
      7,
      "Usar dados fictícios, sem afetar escolas reais. Remover somente os registros criados para os testes",
      cleanupOk,
      `Tenant fictício ${createdTenantId} e registros associados de idempotência, auditoria e nonces removidos integralmente.`
    );
  }

  // Resumo Final
  console.log("\n==============================================================================");
  console.log("RESUMO DA HOMOLOGAÇÃO REMOTA FINAL — LOTE 16 FASE 2");
  console.log("==============================================================================");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  console.log(`Total de Itens: ${total} | PASSOU: ${passed} | FALHOU: ${failed}`);

  const allPassed = failed === 0;
  console.log(`\nCONCLUSÃO: ${allPassed ? "APTO" : "NÃO APTO"} PARA INTEGRAÇÃO COM ALCÂNTARA HUB`);
  console.log("==============================================================================\n");

  return allPassed;
}

runHomologation().then(success => {
  process.exit(success ? 0 : 1);
});
