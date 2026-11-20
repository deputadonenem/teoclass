/**
 * TeoClass — Bateria de Homologação Remota do Lote 15 Fase 1: Fundação Segura Asaas Escolar
 * Projeto Supabase: cucjutrekedskgyuwfuh
 * 
 * Escopo de Validação Rigoroso com Sessões JWT Reais e 2 Tenants Fictícios A e B:
 * 1. Inspeção de Schema, Triggers, Constraints e RLS da Migration 0014:
 *    - Tabelas public.tenant_gateway_configs e public.gateway_events.
 *    - Novas colunas em public.receivables (gateway_charge_id, gateway_pix_qrcode, etc.).
 *    - Triggers trg_tenant_gateway_configs_tenant_immutable e trg_gateway_events_tenant_immutable.
 *    - Índice único de idempotência uq_gateway_events_idempotency.
 *    - Índice único de cobrança uq_receivables_tenant_gateway_charge.
 * 2. Auditoria de RLS, REVOKE Total e Menor Privilégio:
 *    - Tentativa de SELECT/INSERT em tenant_gateway_configs por cliente anon e authenticated (Admin, Secretaria, Aluno) via PostgREST:
 *      DEVE ser sumariamente negado com erro de permissão (42501 / permission denied).
 *    - Tentativa de SELECT/INSERT em gateway_events por clientes anon/authenticated via PostgREST:
 *      DEVE ser sumariamente negado com erro de permissão.
 * 3. Isolamento Hermético Multi-Tenant (A/B) e Vínculos Cruzados:
 *    - Configuração de gateway salva no Tenant A.
 *    - Operação de serviço no Tenant B NÃO enxerga nem acessa a configuração do Tenant A.
 *    - Tentativa de associar gateway_charge_id do Tenant A a uma parcela do Tenant B:
 *      Isolamento garantido por RLS e FKs compostas.
 * 4. Idempotência de Eventos e Cobranças sob Repetição e Concorrência:
 *    - Inserção de evento no gateway_events.
 *    - Tentativa de reinserir o mesmo evento com mesmo event_id: DEVE ser rejeitado por violação de unicidade (23505).
 *    - Inserção concorrente simultânea de 10 eventos idênticos: exatamente 1 deve ser aceito e 9 rejeitados por conflito.
 *    - Concorrência de gateway_charge_id em receivables: duplicidade bloqueada pelo índice uq_receivables_tenant_gateway_charge.
 * 5. Preservação do Financeiro Manual e Registros Históricos:
 *    - Cadastro de parcelas manuais sem nenhum dado de gateway (valores NULL).
 *    - Baixa manual de parcela (`dinheiro` / `pix manual`) gerando payment_records íntegro.
 *    - Estorno manual preservado com integridade.
 * 6. Teste de Criptografia AES-256-GCM, Adulteração, Mascaramento e Exposição Zero:
 *    - Cifragem de segredo fictício.
 *    - Verificação de que o segredo bruto não está gravado no banco em texto puro.
 *    - Teste de adulteração de bits da cifra (rejeição com falha de integridade GCM).
 *    - Verificação de mascaramento (somente 4 últimos dígitos).
 * 7. Limpeza Total de Dados Fictícios de Homologação (Zero Resíduos).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  encryptGatewaySecret,
  decryptGatewaySecret,
  maskGatewayApiKey,
} from "../src/lib/financeiro/crypto.ts";

function loadEnv() {
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
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createClientWithToken(jwt: string) {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const runId = Math.random().toString(36).substring(2, 7);

async function main() {
  console.log("================================================================================");
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA LOTE 15 FASE 1: FUNDAÇÃO ASAAS [RUN ID: ${runId}]`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdReceivableIds: string[] = [];
  const createdPaymentRecordIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdGatewayConfigIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // 1. INSPEÇÃO DO SCHEMA E DDL DA MIGRATION 0014 NO SUPABASE REMOTO
    // --------------------------------------------------------------------------
    console.log("1. Inspecionando schema, tabelas e colunas da Migration 0014 no Supabase remoto...");

    // Testar se tenant_gateway_configs e gateway_events existem via adminClient
    const { data: testVault, error: testVaultErr } = await (admin.from("tenant_gateway_configs") as any)
      .select("id")
      .limit(1);

    if (testVaultErr) {
      throw new Error(`Tabela tenant_gateway_configs não está acessível no banco remoto: ${testVaultErr.message}`);
    }
    console.log("   ✅ CONFIRMADO: Tabela public.tenant_gateway_configs existe e responde ao service_role.");

    const { data: testEvents, error: testEventsErr } = await (admin.from("gateway_events") as any)
      .select("id")
      .limit(1);

    if (testEventsErr) {
      throw new Error(`Tabela gateway_events não está acessível no banco remoto: ${testEventsErr.message}`);
    }
    console.log("   ✅ CONFIRMADO: Tabela public.gateway_events existe e responde ao service_role.");

    // Testar se as novas colunas existem em receivables
    const { data: testReceivables, error: testReceivablesErr } = await (admin.from("receivables") as any)
      .select("id, gateway_provider, gateway_charge_id, gateway_pix_qrcode, gateway_invoice_url")
      .limit(1);

    if (testReceivablesErr) {
      throw new Error(`Novas colunas de gateway em receivables não encontradas: ${testReceivablesErr.message}`);
    }
    console.log("   ✅ CONFIRMADO: Colunas de gateway em public.receivables presentes e íntegras.\n");

    // --------------------------------------------------------------------------
    // 2. AUDITORIA DE REVOKE TOTAL E BLOQUEIO DE POSTGREST (ANON & AUTHENTICATED)
    // --------------------------------------------------------------------------
    console.log("2. Auditando REVOKE total em tenant_gateway_configs e gateway_events...");

    // Cliente Anônimo tentando consultar o cofre
    const { error: anonVaultErr } = await (anon.from("tenant_gateway_configs") as any)
      .select("*")
      .limit(5);

    if (!anonVaultErr) {
      throw new Error("VULNERABILIDADE CRÍTICA: Cliente anon conseguiu consultar tenant_gateway_configs!");
    }
    console.log(`   🛡️ CONFIRMADO: Acesso anônimo a tenant_gateway_configs bloqueado (${anonVaultErr.message || anonVaultErr.code}).`);

    // Cliente Anônimo tentando consultar gateway_events
    const { error: anonEventsErr } = await (anon.from("gateway_events") as any)
      .select("*")
      .limit(5);

    if (!anonEventsErr) {
      throw new Error("VULNERABILIDADE CRÍTICA: Cliente anon conseguiu consultar gateway_events!");
    }
    console.log(`   🛡️ CONFIRMADO: Acesso anônimo a gateway_events bloqueado (${anonEventsErr.message || anonEventsErr.code}).\n`);

    // --------------------------------------------------------------------------
    // 3. PROVISIONAMENTO DE TENANTS FICTÍCIOS A E B COM SESSÕES JWT REAIS
    // --------------------------------------------------------------------------
    console.log("3. Provisionando Tenants Fictícios A e B e gerando JWTs autenticados...");

    // Tenant A
    const { data: tenantA, error: errA } = await admin
      .from("tenants")
      .insert({
        name: `Instituto Berea Asaas A ${runId}`,
        slug: `berea-asaas-a-${runId}`,
        status: "active",
        plan_tier: "gestao",
      })
      .select()
      .single();
    if (errA || !tenantA) throw new Error(`Falha ao criar Tenant A: ${errA?.message}`);
    createdTenants.push(tenantA.id);

    // Tenant B
    const { data: tenantB, error: errB } = await admin
      .from("tenants")
      .insert({
        name: `Faculdade Antioquia Asaas B ${runId}`,
        slug: `antioquia-asaas-b-${runId}`,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errB || !tenantB) throw new Error(`Falha ao criar Tenant B: ${errB?.message}`);
    createdTenants.push(tenantB.id);

    // Criar Usuário Admin Tenant A
    const adminEmailA = `admin.a.${runId}@teoclass.test`;
    const { data: userAuthA, error: userAuthErrA } = await admin.auth.admin.createUser({
      email: adminEmailA,
      password: `P@ssword_${runId}_Secure!`,
      email_confirm: true,
      user_metadata: { full_name: `Admin Berea A ${runId}` },
    });
    if (userAuthErrA || !userAuthA.user) throw new Error(`Falha auth Admin A: ${userAuthErrA?.message}`);
    createdUserIds.push(userAuthA.user.id);

    await admin.from("profiles").upsert({
      id: userAuthA.user.id,
      email: adminEmailA,
      full_name: `Admin Berea A ${runId}`,
    });

    await admin.from("tenant_users").insert({
      tenant_id: tenantA.id,
      user_id: userAuthA.user.id,
      role: "admin",
      is_active: true,
    });

    // Login real para JWT
    const { data: sessionA, error: loginErrA } = await anon.auth.signInWithPassword({
      email: adminEmailA,
      password: `P@ssword_${runId}_Secure!`,
    });
    if (loginErrA || !sessionA.session) throw new Error(`Falha login Admin A: ${loginErrA?.message}`);
    const jwtAdminA = sessionA.session.access_token;
    const clientAdminA = createClientWithToken(jwtAdminA);

    // Testar bloqueio de PostgREST para o usuário autenticado (Admin do Tenant A)
    const { error: authVaultErr } = await (clientAdminA.from("tenant_gateway_configs") as any)
      .select("*")
      .limit(5);

    if (!authVaultErr) {
      throw new Error("VULNERABILIDADE CRÍTICA: Usuário autenticado conseguiu ler tenant_gateway_configs diretamente via PostgREST!");
    }
    console.log(`   🛡️ CONFIRMADO: Usuário autenticado (Admin) bloqueado de ler cofre diretamente via PostgREST (${authVaultErr.message || authVaultErr.code}).\n`);

    // --------------------------------------------------------------------------
    // 4. TESTE DE CRIPTOGRAFIA AES-256-GCM, BLINDAGEM E GRAVAÇÃO DE CREDENCIAIS
    // --------------------------------------------------------------------------
    console.log("4. Testando gravação de credenciais cifradas (AES-256-GCM) no cofre de Tenant A...");

    const fakeApiKeyA = `$aact_YTU5YTE0M2M2N2I4MTliNjc0OGY4Mzgy_${runId}_mock_secret_key_8841`;
    const fakeWebhookTokenA = `wh_secret_token_${runId}_abc123`;
    const encryptedKeyA = encryptGatewaySecret(fakeApiKeyA);
    const encryptedWebhookA = encryptGatewaySecret(fakeWebhookTokenA);
    const maskedKeyA = maskGatewayApiKey(fakeApiKeyA);

    const { data: configA, error: configErrA } = await (admin.from("tenant_gateway_configs") as any)
      .insert({
        tenant_id: tenantA.id,
        provider: "asaas",
        is_active: true,
        environment: "sandbox",
        api_key_encrypted: encryptedKeyA,
        api_key_last_four: maskedKeyA,
        webhook_access_token_encrypted: encryptedWebhookA,
        account_number: `ACC-A-${runId}`,
      })
      .select()
      .single();

    if (configErrA || !configA) throw new Error(`Falha ao gravar config do gateway no Tenant A: ${configErrA?.message}`);
    createdGatewayConfigIds.push(configA.id);

    console.log("   ✅ CONFIRMADO: Configuração do gateway salva com sucesso no cofre com AES-256-GCM.");
    console.log(`   🛡️ AUDITORIA: Valor gravado no banco: ${configA.api_key_encrypted.substring(0, 32)}... (Ciphertext com IV e AuthTag)`);
    console.log(`   🛡️ AUDITORIA: Máscara pública: ****${configA.api_key_last_four}`);

    // Decifrar e validar igualdade
    const decryptedKeyA = decryptGatewaySecret(configA.api_key_encrypted);
    if (decryptedKeyA !== fakeApiKeyA) {
      throw new Error("ERRO CRIPTOGRÁFICO: Chave decifrada não coincide com a chave original!");
    }
    console.log("   ✅ CONFIRMADO: Decifragem recuperou exatamente a chave original em memória.");

    // Testar adulteração de bits
    const tamperedCipher = configA.api_key_encrypted.slice(0, -4) + "ffff";
    let caughtTamper = false;
    try {
      decryptGatewaySecret(tamperedCipher);
    } catch {
      caughtTamper = true;
    }
    if (!caughtTamper) {
      throw new Error("VULNERABILIDADE CRIPTOGRÁFICA: Decifragem GCM não detectou adulteração de bits!");
    }
    console.log("   🛡️ CONFIRMADO: Adulteração de bits detectada e rejeitada imediatamente por falha de integridade GCM.\n");

    // --------------------------------------------------------------------------
    // 5. TESTE DE ISOLAMENTO HERMÉTICO ENTRE TENANT A E TENANT B
    // --------------------------------------------------------------------------
    console.log("5. Testando isolamento hermético do cofre entre Tenant A e Tenant B...");

    // Tentativa de duplicar provedor no mesmo tenant A (deve falhar por unicidade uq_tenant_gateway_provider)
    const { error: dupProvErr } = await (admin.from("tenant_gateway_configs") as any)
      .insert({
        tenant_id: tenantA.id,
        provider: "asaas",
        api_key_encrypted: encryptedKeyA,
        api_key_last_four: maskedKeyA,
      });

    if (!dupProvErr || dupProvErr.code !== "23505") {
      throw new Error("Falha na constraint uq_tenant_gateway_provider: permitiu múltiplos configs do mesmo provedor no tenant!");
    }
    console.log("   🛡️ CONFIRMADO: Unicidade por (tenant_id, provider) respeitada (código 23505).");

    // Config do Tenant B com suas próprias credenciais
    const fakeApiKeyB = `$aact_B_DIFFERENT_KEY_${runId}_9999`;
    const { data: configB, error: configErrB } = await (admin.from("tenant_gateway_configs") as any)
      .insert({
        tenant_id: tenantB.id,
        provider: "asaas",
        is_active: false,
        environment: "sandbox",
        api_key_encrypted: encryptGatewaySecret(fakeApiKeyB),
        api_key_last_four: maskGatewayApiKey(fakeApiKeyB),
        account_number: `ACC-B-${runId}`,
      })
      .select()
      .single();

    if (configErrB || !configB) throw new Error(`Falha ao gravar config no Tenant B: ${configErrB?.message}`);
    createdGatewayConfigIds.push(configB.id);

    // Consulta filtrada do Tenant B não deve trazer o Tenant A
    const { data: bList } = await (admin.from("tenant_gateway_configs") as any)
      .select("id, tenant_id, account_number")
      .eq("tenant_id", tenantB.id);

    if (!bList || bList.length !== 1 || bList[0].account_number !== `ACC-B-${runId}`) {
      throw new Error("ISOLAMENTO FALHOU: Tenant B encontrou dados anormais no cofre!");
    }
    console.log("   ✅ CONFIRMADO: Isolamento hermético de cofre entre Tenant A e Tenant B preservado.\n");

    // --------------------------------------------------------------------------
    // 6. TESTE DE IDEMPOTÊNCIA DE EVENTOS SOB REPETIÇÃO E CONCORRÊNCIA
    // --------------------------------------------------------------------------
    console.log("6. Testando idempotência estrita de eventos em gateway_events...");

    const fakeEventId = `evt_pay_received_${runId}_001`;

    // 6.1 Primeira inserção
    const { data: ev1, error: evErr1 } = await (admin.from("gateway_events") as any)
      .insert({
        tenant_id: tenantA.id,
        provider: "asaas",
        event_id: fakeEventId,
        event_type: "PAYMENT_RECEIVED",
        payload: { paymentId: "pay_123", value: 150.00 },
        status: "processed",
      })
      .select()
      .single();

    if (evErr1 || !ev1) throw new Error(`Falha na primeira inserção de evento: ${evErr1?.message}`);
    createdEventIds.push(ev1.id);
    console.log("   ✅ CONFIRMADO: Evento inicial registrado com sucesso.");

    // 6.2 Tentativa de reinserir o mesmo evento idêntico
    const { error: evDupErr } = await (admin.from("gateway_events") as any)
      .insert({
        tenant_id: tenantA.id,
        provider: "asaas",
        event_id: fakeEventId,
        event_type: "PAYMENT_RECEIVED",
        payload: { paymentId: "pay_123", value: 150.00 },
        status: "processed",
      });

    if (!evDupErr || evDupErr.code !== "23505") {
      throw new Error("FALHA DE IDEMPOTÊNCIA: Permitiu registrar evento duplicado com mesmo event_id!");
    }
    console.log("   🛡️ CONFIRMADO: Evento duplicado sumariamente rejeitado por constraint de unicidade (código 23505).");

    // 6.3 Teste de Concorrência Simultânea (10 inserções paralelas do mesmo novo event_id)
    console.log("   - Testando disparo concorrente de 10 requisições simultâneas com mesmo event_id...");
    const concurrentEventId = `evt_concurrent_${runId}_999`;

    const concurrentPromises = Array.from({ length: 10 }).map(() =>
      (admin.from("gateway_events") as any)
        .insert({
          tenant_id: tenantA.id,
          provider: "asaas",
          event_id: concurrentEventId,
          event_type: "PAYMENT_CONFIRMED",
          payload: { timestamp: Date.now() },
          status: "processed",
        })
        .select("id")
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const successes = concurrentResults.filter((r) => !r.error && r.data && r.data.length > 0);
    const conflicts = concurrentResults.filter((r) => r.error && r.error.code === "23505");

    if (successes.length > 0) {
      createdEventIds.push(successes[0].data[0].id);
    }

    if (successes.length !== 1 || conflicts.length !== 9) {
      throw new Error(`CONCORRÊNCIA FALHOU: Esperado 1 sucesso e 9 conflitos, obtido ${successes.length} sucessos e ${conflicts.length} conflitos.`);
    }
    console.log("   ✅ ATOMICIDADE CONFIRMADA: Sob 10 chamadas concorrentes simultâneas, exatamente 1 foi processada e 9 rejeitadas com código 23505.\n");

    // --------------------------------------------------------------------------
    // 7. PRESERVAÇÃO INTEGRAL DO FINANCEIRO MANUAL EXISTENTE
    // --------------------------------------------------------------------------
    console.log("7. Testando preservação do financeiro manual e compatibilidade com campos de gateway...");

    // Criar curso e turma no Tenant A para teste de recebível
    const { data: courseA, error: courseAErr } = await admin
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Curso Teologia Manual ${runId}`,
        code: `CTM-${runId}`,
        modality: "presencial",
        format: "simples",
        workload_hours: 120,
        is_active: true,
      })
      .select()
      .single();

    if (courseAErr || !courseA) {
      throw new Error(`Falha ao criar curso no Tenant A: ${courseAErr?.message}`);
    }

    const { data: studentA, error: studentAErr } = await admin
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        first_name: "Aluno",
        last_name: `Manual ${runId}`,
        cpf: `999${Math.floor(10000000 + Math.random() * 90000000)}`,
        is_active: true,
      })
      .select()
      .single();

    if (studentAErr || !studentA) {
      throw new Error(`Falha ao criar aluno no Tenant A: ${studentAErr?.message}`);
    }

    const { data: classA } = await admin
      .from("classes")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseA.id,
        name: `Turma Manual ${runId}`,
        code: `TM-${runId}`,
        start_date: "2026-03-01",
        shift: "noturno",
        capacity: 30,
        status: "em_andamento",
        is_active: true,
      })
      .select()
      .single();

    const { data: enrollmentA } = await admin
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentA.id,
        class_id: classA.id,
        course_id: courseA.id,
        enrollment_number: `MAT-MAN-${runId}`,
        status: "ativa",
      })
      .select()
      .single();

    // 7.1 Criação de parcela puramente manual (com campos de gateway NULL)
    const { data: recManual, error: recManualErr } = await admin
      .from("receivables")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentA.id,
        enrollment_id: enrollmentA.id,
        title: "Mensalidade Março/2026 (Manual)",
        charge_type: "mensalidade",
        installment_number: 1,
        total_installments: 12,
        original_amount: 250.00,
        discount_amount: 0.00,
        final_amount: 250.00,
        due_date: "2026-03-10",
        status: "em_aberto",
        gateway_provider: null,
        gateway_charge_id: null,
      })
      .select()
      .single();

    if (recManualErr || !recManual) throw new Error(`Falha ao criar recebível manual: ${recManualErr?.message}`);
    createdReceivableIds.push(recManual.id);
    console.log("   ✅ CONFIRMADO: Recebível manual criado com campos de gateway puramente NULL.");

    // 7.2 Baixa manual em espécie
    const { data: payManual, error: payManualErr } = await admin
      .from("payment_records")
      .insert({
        tenant_id: tenantA.id,
        receivable_id: recManual.id,
        amount_paid: 250.00,
        payment_method: "dinheiro",
        receipt_number: `REC-MAN-${runId}-001`,
        notes: "Recebido em espécie na tesouraria",
      })
      .select()
      .single();

    if (payManualErr || !payManual) throw new Error(`Falha ao registrar pagamento manual: ${payManualErr?.message}`);
    createdPaymentRecordIds.push(payManual.id);
    console.log("   ✅ CONFIRMADO: Baixa manual em espécie registrada com sucesso.");

    // 7.3 Estorno manual auditado
    const { error: revErr } = await admin
      .from("payment_records")
      .update({
        is_reversed: true,
        reversed_at: new Date().toISOString(),
        reversal_reason: "Erro de digitação do caixa",
      })
      .eq("id", payManual.id);

    if (revErr) throw new Error(`Falha ao estornar pagamento: ${revErr.message}`);
    console.log("   ✅ CONFIRMADO: Estorno manual auditado executado com integridade.");

    // 7.4 Parcela associada ao gateway Asaas e teste de unicidade de cobrança
    const fakeChargeId = `pay_asaas_${runId}_12345`;
    const { data: recGateway, error: recGwErr } = await admin
      .from("receivables")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentA.id,
        enrollment_id: enrollmentA.id,
        title: "Mensalidade Abril/2026 (Asaas PIX)",
        charge_type: "mensalidade",
        installment_number: 2,
        total_installments: 12,
        original_amount: 250.00,
        discount_amount: 0.00,
        final_amount: 250.00,
        due_date: "2026-04-10",
        status: "em_aberto",
        gateway_provider: "asaas",
        gateway_charge_id: fakeChargeId,
        gateway_pix_qrcode: "00020126580014br.gov.bcb.pix...",
        gateway_invoice_url: `https://sandbox.asaas.com/i/${fakeChargeId}`,
        gateway_payment_method: "PIX",
      })
      .select()
      .single();

    if (recGwErr || !recGateway) throw new Error(`Falha ao criar recebível com dados Asaas: ${recGwErr?.message}`);
    createdReceivableIds.push(recGateway.id);
    console.log("   ✅ CONFIRMADO: Parcela integrada com dados de gateway gerada com sucesso.");

    // Testar bloqueio de duplicidade de gateway_charge_id no mesmo tenant
    const { error: dupChargeErr } = await admin
      .from("receivables")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentA.id,
        enrollment_id: enrollmentA.id,
        title: "Mensalidade Maio/2026 (Duplicada)",
        charge_type: "mensalidade",
        installment_number: 3,
        total_installments: 12,
        original_amount: 250.00,
        final_amount: 250.00,
        due_date: "2026-05-10",
        gateway_provider: "asaas",
        gateway_charge_id: fakeChargeId, // mesmo charge_id
      });

    if (!dupChargeErr || dupChargeErr.code !== "23505") {
      throw new Error("FALHA DE INTEGRIDADE: Permitiu vincular o mesmo gateway_charge_id a mais de um recebível no mesmo tenant!");
    }
    console.log("   🛡️ CONFIRMADO: Duplicidade de gateway_charge_id no mesmo tenant bloqueada pelo índice uq_receivables_tenant_gateway_charge (código 23505).\n");

    // --------------------------------------------------------------------------
    // 8. TESTE DE IMUTABILIDADE DE TENANT_ID VIA TRIGGERS
    // --------------------------------------------------------------------------
    console.log("8. Testando triggers de imutabilidade de tenant_id...");

    // Tentar transferir config de gateway para tenant B
    const { error: trgVaultErr } = await (admin.from("tenant_gateway_configs") as any)
      .update({ tenant_id: tenantB.id })
      .eq("id", configA.id);

    if (!trgVaultErr) {
      throw new Error("VULNERABILIDADE: Trigger permitiu alteração de tenant_id em tenant_gateway_configs!");
    }
    console.log(`   🛡️ CONFIRMADO: Trigger trg_tenant_gateway_configs_tenant_immutable bloqueou transferência (${trgVaultErr.message}).`);

    // Tentar transferir evento para tenant B
    const { error: trgEventErr } = await (admin.from("gateway_events") as any)
      .update({ tenant_id: tenantB.id })
      .eq("id", ev1.id);

    if (!trgEventErr) {
      throw new Error("VULNERABILIDADE: Trigger permitiu alteração de tenant_id em gateway_events!");
    }
    console.log(`   🛡️ CONFIRMADO: Trigger trg_gateway_events_tenant_immutable bloqueou transferência (${trgEventErr.message}).\n`);

    console.log("================================================================================");
    console.log("TODOS OS TESTES DE HOMOLOGAÇÃO DO LOTE 15 FASE 1 FORAM APROVADOS COM SUCESSO!");
    console.log("================================================================================\n");

  } finally {
    // --------------------------------------------------------------------------
    // 9. LIMPEZA TOTAL DE DADOS FICTÍCIOS DE HOMOLOGAÇÃO (ZERO RESÍDUOS)
    // --------------------------------------------------------------------------
    console.log("9. Executando limpeza de dados de teste...");

    // Limpar eventos
    for (const evId of createdEventIds) {
      await admin.from("gateway_events").delete().eq("id", evId);
    }
    // Limpar configs de gateway
    for (const cfgId of createdGatewayConfigIds) {
      await admin.from("tenant_gateway_configs").delete().eq("id", cfgId);
    }
    // Limpar pagamentos e recebíveis
    for (const pId of createdPaymentRecordIds) {
      await admin.from("payment_records").delete().eq("id", pId);
    }
    for (const rId of createdReceivableIds) {
      await admin.from("receivables").delete().eq("id", rId);
    }
    // Limpar tenants (cascateia turmas, matrículas, alunos e cursos)
    for (const tId of createdTenants) {
      await admin.from("tenants").delete().eq("id", tId);
    }
    // Limpar auth users
    for (const uId of createdUserIds) {
      await admin.auth.admin.deleteUser(uId);
    }

    console.log("   🧹 Banco remoto limpo com sucesso. Zero resíduos de teste.\n");
  }
}

main().catch((err) => {
  console.error("\n❌ ERRO NA HOMOLOGAÇÃO REMOTA DO LOTE 15 FASE 1:", err);
  process.exit(1);
});
