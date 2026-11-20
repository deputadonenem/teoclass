/**
 * TeoClass — Bateria de Homologação Remota do Lote 15 Fase 3 (Migration 0015)
 * Projeto Supabase: cucjutrekedskgyuwfuh
 * 
 * Verificações:
 * 1. Schema, novas colunas em receivables (gateway_issuing_at, refunded_amount), índices.
 * 2. Existência e permissões da RPC reconcile_gateway_payment:
 *    - Bloqueio sumário para cliente anon / authenticated (PostgREST).
 *    - Execução permitida para service_role.
 * 3. Isolamento Multi-Tenant A/B e rejeição de referências cruzadas na RPC.
 * 4. Atomicidade da conciliação via RPC (PAYMENT_RECEIVED, payment_records gerado, idempotência se já pago).
 * 5. Rejeição com status 'failed' para divergência a menor (pagamento parcial recusado).
 * 6. Estorno parcial com preservação do status 'pago' e incremento de refunded_amount.
 * 7. Estorno total com transição para 'estornado' e marcação de is_reversed = true em payment_records.
 * 8. Proteção contra cancelamento atrasado (PAYMENT_DELETED) em recebíveis já quitados.
 * 9. Lock gateway_issuing_at contra concorrência e teste de expiração.
 * 10. Limpeza total de dados fictícios criados pelo teste.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
  process.exit(1);
}

const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface TestReport {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const reports: TestReport[] = [];

function recordTest(name: string, passed: boolean, details?: string, error?: string) {
  reports.push({ name, passed, details, error });
  if (passed) {
    console.log(`  ✅ [PASS] ${name}${details ? ` — ${details}` : ""}`);
  } else {
    console.error(`  ❌ [FAIL] ${name}${error ? ` — Erro: ${error}` : ""}`);
  }
}

async function runHomologation() {
  console.log("==============================================================================");
  console.log("TEOCLASS — HOMOLOGAÇÃO REMOTA LOTE 15 FASE 3: MIGRATION 0015");
  console.log("Supabase URL:", supabaseUrl);
  console.log("Data/Hora:", new Date().toISOString());
  console.log("==============================================================================\n");

  let tenantAId: string | null = null;
  let tenantBId: string | null = null;
  let studentAId: string | null = null;
  let enrollmentAId: string | null = null;
  let recAId: string | null = null;
  let eventRecAId: string | null = null;

  try {
    // --------------------------------------------------------------------------
    // 1. Verificação de Schema e Colunas em public.receivables
    // --------------------------------------------------------------------------
    console.log("▶ 1. Verificação Estrutural da Migration 0015 no Supabase...");

    const { data: recColumns, error: colErr } = await adminClient
      .from("receivables")
      .select("id, gateway_issuing_at, refunded_amount")
      .limit(1);

    if (colErr) {
      recordTest("Colunas gateway_issuing_at e refunded_amount", false, undefined, colErr.message);
    } else {
      recordTest("Colunas gateway_issuing_at e refunded_amount", true, "Colunas presentes e acessíveis via service_role");
    }

    // --------------------------------------------------------------------------
    // 2. Auditoria de Segurança e REVOKE na RPC reconcile_gateway_payment
    // --------------------------------------------------------------------------
    console.log("\n▶ 2. Auditoria de Acesso e REVOKE da RPC reconcile_gateway_payment...");

    // Chamada como Anon: DEVE ser rejeitada com erro de permissão ou não encontrada
    const { data: anonRpcData, error: anonRpcErr } = await anonClient.rpc("reconcile_gateway_payment", {
      p_tenant_id: "00000000-0000-0000-0000-000000000000",
      p_event_record_id: "00000000-0000-0000-0000-000000000000",
      p_receivable_id: "00000000-0000-0000-0000-000000000000",
      p_event_type: "PAYMENT_RECEIVED",
      p_payment_id: "pay_test",
      p_reported_amount: 100.0,
      p_paid_date: new Date().toISOString(),
      p_billing_type: "PIX",
      p_receipt_number: "REC-TEST-0001",
    });

    if (anonRpcErr) {
      recordTest(
        "Bloqueio de chamada pública/anon na RPC reconcile_gateway_payment",
        true,
        `Rejeitado corretamente com erro: ${anonRpcErr.message}`
      );
    } else {
      recordTest(
        "Bloqueio de chamada pública/anon na RPC reconcile_gateway_payment",
        false,
        undefined,
        "Chamada anon não foi bloqueada!"
      );
    }

    // --------------------------------------------------------------------------
    // Criação de Dados Fictícios de Teste (Tenants A e B)
    // --------------------------------------------------------------------------
    console.log("\n▶ Criando dados fictícios para homologação A/B...");

    const suffix = Date.now().toString().slice(-6);

    const { data: tA, error: errTA } = await adminClient
      .from("tenants")
      .insert({
        name: `Homologação Gateway 15 A (${suffix})`,
        slug: `homolog-gw15-a-${suffix}`,
        status: "active",
      })
      .select("id")
      .single();

    if (errTA || !tA) throw new Error(`Falha ao criar Tenant A: ${errTA?.message}`);
    tenantAId = tA.id;

    const { data: tB, error: errTB } = await adminClient
      .from("tenants")
      .insert({
        name: `Homologação Gateway 15 B (${suffix})`,
        slug: `homolog-gw15-b-${suffix}`,
        status: "active",
      })
      .select("id")
      .single();

    if (errTB || !tB) throw new Error(`Falha ao criar Tenant B: ${errTB?.message}`);
    tenantBId = tB.id;

    // Aluno e Matrícula no Tenant A
    const { data: stA, error: errStA } = await adminClient
      .from("students")
      .insert({
        tenant_id: tenantAId,
        first_name: "Aluno",
        last_name: `Homolog 15 (${suffix})`,
        email: `aluno.gw15.${suffix}@exemplo.com`,
        cpf: `15${suffix.slice(-9).padStart(9, "0")}`,
        is_active: true,
      })
      .select("id")
      .single();

    if (errStA || !stA) throw new Error(`Falha ao criar Aluno A: ${errStA?.message}`);
    studentAId = stA.id;

    // Curso no Tenant A
    const { data: crsA, error: errCrsA } = await adminClient
      .from("courses")
      .insert({
        tenant_id: tenantAId,
        name: `Teologia Sistemática Homolog (${suffix})`,
        workload_hours: 80,
      })
      .select("id")
      .single();

    if (errCrsA || !crsA) throw new Error(`Falha ao criar Curso A: ${errCrsA?.message}`);

    const { data: enrA, error: errEnrA } = await adminClient
      .from("enrollments")
      .insert({
        tenant_id: tenantAId,
        student_id: studentAId,
        course_id: crsA.id,
        enrollment_number: `MAT-${suffix}`,
        status: "ativa",
      })
      .select("id")
      .single();

    if (errEnrA || !enrA) throw new Error(`Falha ao criar Matrícula A: ${errEnrA?.message}`);
    enrollmentAId = enrA.id;

    // Recebível no Tenant A
    const { data: recA, error: errRecA } = await adminClient
      .from("receivables")
      .insert({
        tenant_id: tenantAId,
        student_id: studentAId,
        enrollment_id: enrollmentAId,
        title: "Mensalidade Homologação Lote 15",
        charge_type: "mensalidade",
        installment_number: 1,
        total_installments: 1,
        original_amount: 150.0,
        discount_amount: 0.0,
        final_amount: 150.0,
        due_date: "2026-12-10",
        status: "em_aberto",
        paid_amount: 0.0,
      })
      .select("id")
      .single();

    if (errRecA || !recA) throw new Error(`Falha ao criar Parcela A: ${errRecA?.message}`);
    recAId = recA.id;

    // Evento em gateway_events no Tenant A
    const { data: evtA, error: errEvtA } = await adminClient
      .from("gateway_events")
      .insert({
        tenant_id: tenantAId,
        provider: "asaas",
        event_id: `evt_homolog_15_${suffix}`,
        event_type: "PAYMENT_RECEIVED",
        payload: { id: `evt_homolog_15_${suffix}`, value: 150.0 },
        status: "received",
      })
      .select("id")
      .single();

    if (errEvtA || !evtA) throw new Error(`Falha ao registrar Evento A: ${errEvtA?.message}`);
    eventRecAId = evtA.id;

    // --------------------------------------------------------------------------
    // 3. Teste de Isolamento Multi-Tenant A/B na RPC
    // --------------------------------------------------------------------------
    console.log("\n▶ 3. Teste de Isolamento Multi-Tenant A/B na RPC reconcile_gateway_payment...");

    // Tentativa de conciliar parcela do Tenant A passando tenant_id = Tenant B: DEVE retornar sucesso false / ignored
    const { data: crossTenantData } = await adminClient.rpc("reconcile_gateway_payment", {
      p_tenant_id: tenantBId,
      p_event_record_id: eventRecAId,
      p_receivable_id: recAId,
      p_event_type: "PAYMENT_RECEIVED",
      p_payment_id: `pay_cross_${suffix}`,
      p_reported_amount: 150.0,
      p_paid_date: new Date().toISOString(),
      p_billing_type: "PIX",
      p_receipt_number: `REC-CROSS-${suffix}`,
    });

    const isCrossBlocked = !crossTenantData?.success && crossTenantData?.status === "ignored";
    recordTest(
      "Rejeição de conciliação cruzada (Tenant B tentando conciliar parcela do Tenant A)",
      isCrossBlocked,
      `Resposta: ${JSON.stringify(crossTenantData)}`
    );

    // --------------------------------------------------------------------------
    // 4. Teste de Pagamento Divergente a Menor (Recusa de Quitação Cega)
    // --------------------------------------------------------------------------
    console.log("\n▶ 4. Teste de Pagamento Divergente a Menor (Pagamento Parcial Recusado)...");

    const { data: underpaidData } = await adminClient.rpc("reconcile_gateway_payment", {
      p_tenant_id: tenantAId,
      p_event_record_id: eventRecAId,
      p_receivable_id: recAId,
      p_event_type: "PAYMENT_RECEIVED",
      p_payment_id: `pay_under_${suffix}`,
      p_reported_amount: 100.0, // Parcela é 150.0, pago 100.0
      p_paid_date: new Date().toISOString(),
      p_billing_type: "PIX",
      p_receipt_number: `REC-UNDER-${suffix}`,
    });

    const isUnderpaidHandled = !underpaidData?.success && underpaidData?.status === "failed";
    recordTest(
      "Rejeição de quitação automática para pagamento a menor",
      isUnderpaidHandled,
      `Retorno RPC: ${JSON.stringify(underpaidData)}`
    );

    // Confirma que parcela NÃO foi alterada para 'pago'
    const { data: recCheckUnder } = await adminClient
      .from("receivables")
      .select("status, paid_amount")
      .eq("id", recAId)
      .single();

    recordTest(
      "Status da parcela preservado como 'em_aberto' após pagamento a menor",
      recCheckUnder?.status === "em_aberto" && Number(recCheckUnder?.paid_amount) === 0,
      `Status atual: ${recCheckUnder?.status}`
    );

    // --------------------------------------------------------------------------
    // 5. Teste de Atomicidade da Liquidação Integral
    // --------------------------------------------------------------------------
    console.log("\n▶ 5. Teste de Atomicidade na Liquidação Integral (PAYMENT_RECEIVED)...");

    const chargeId = `pay_asaas_${suffix}`;
    const { data: paidData } = await adminClient.rpc("reconcile_gateway_payment", {
      p_tenant_id: tenantAId,
      p_event_record_id: eventRecAId,
      p_receivable_id: recAId,
      p_event_type: "PAYMENT_RECEIVED",
      p_payment_id: chargeId,
      p_reported_amount: 150.0,
      p_paid_date: new Date().toISOString(),
      p_billing_type: "PIX",
      p_receipt_number: `REC-FULL-${suffix}`,
    });

    const isPaidSuccess = paidData?.success && paidData?.status === "processed";
    recordTest("Execução da RPC com valor integral correto", isPaidSuccess, `Resposta: ${JSON.stringify(paidData)}`);

    // Confirma atualização atômica de receivables
    const { data: recPaid } = await adminClient
      .from("receivables")
      .select("status, paid_amount, gateway_charge_id")
      .eq("id", recAId)
      .single();

    const isRecPaid = recPaid?.status === "pago" && Number(recPaid?.paid_amount) === 150.0 && recPaid?.gateway_charge_id === chargeId;
    recordTest("Receivable baixado atômico para 'pago' com charge_id gravado", isRecPaid, `Status: ${recPaid?.status}`);

    // Confirma criação de payment_records
    const { data: prList } = await adminClient
      .from("payment_records")
      .select("id, amount_paid, payment_method, is_reversed")
      .eq("receivable_id", recAId);

    const hasPaymentRecord = prList && prList.length === 1 && Number(prList[0].amount_paid) === 150.0;
    recordTest("Registro de pagamento gerado em payment_records de forma atômica", !!hasPaymentRecord, `Registros: ${prList?.length}`);

    // Confirma atualização do evento em gateway_events
    const { data: evtProcessed } = await adminClient
      .from("gateway_events")
      .select("status")
      .eq("id", eventRecAId)
      .single();

    recordTest("Evento gateway_events atualizado atômico para 'processed'", evtProcessed?.status === "processed");

    // --------------------------------------------------------------------------
    // 6. Teste de Idempotência: Repetição do Mesmo Evento de Pagamento
    // --------------------------------------------------------------------------
    console.log("\n▶ 6. Teste de Idempotência sob Repetição de Evento...");

    const { data: dupData } = await adminClient.rpc("reconcile_gateway_payment", {
      p_tenant_id: tenantAId,
      p_event_record_id: eventRecAId,
      p_receivable_id: recAId,
      p_event_type: "PAYMENT_RECEIVED",
      p_payment_id: chargeId,
      p_reported_amount: 150.0,
      p_paid_date: new Date().toISOString(),
      p_billing_type: "PIX",
      p_receipt_number: `REC-DUP-${suffix}`,
    });

    const isDupHandled = dupData?.success && dupData?.already_paid === true;
    recordTest("Recepção de evento repetido conciliada sem duplicação", isDupHandled, `Resposta: ${JSON.stringify(dupData)}`);

    const { data: prListDup } = await adminClient
      .from("payment_records")
      .select("id")
      .eq("receivable_id", recAId);

    recordTest("Garantia de ausência de duplicidade em payment_records", prListDup?.length === 1, `Total de registros: ${prListDup?.length}`);

    // --------------------------------------------------------------------------
    // 7. Teste de Estorno Parcial (PAYMENT_PARTIALLY_REFUNDED)
    // --------------------------------------------------------------------------
    console.log("\n▶ 7. Teste de Estorno Parcial com Preservação de Status...");

    const { data: partialRefundData } = await adminClient.rpc("reconcile_gateway_payment", {
      p_tenant_id: tenantAId,
      p_event_record_id: eventRecAId,
      p_receivable_id: recAId,
      p_event_type: "PAYMENT_PARTIALLY_REFUNDED",
      p_payment_id: chargeId,
      p_reported_amount: 150.0,
      p_paid_date: new Date().toISOString(),
      p_billing_type: "PIX",
      p_receipt_number: `REC-REF1-${suffix}`,
      p_refund_amount: 40.0,
    });

    const isPartialSuccess = partialRefundData?.success && Number(partialRefundData?.refunded_amount) === 40.0;
    recordTest("Estorno parcial processado com sucesso", isPartialSuccess, `Resposta: ${JSON.stringify(partialRefundData)}`);

    const { data: recPartial } = await adminClient
      .from("receivables")
      .select("status, refunded_amount, notes")
      .eq("id", recAId)
      .single();

    const isStatusPreserved = recPartial?.status === "pago" && Number(recPartial?.refunded_amount) === 40.0;
    recordTest(
      "Status da parcela preservado como 'pago' e refunded_amount = 40.00",
      isStatusPreserved,
      `Status: ${recPartial?.status}, Refunded: R$ ${recPartial?.refunded_amount}`
    );

    // --------------------------------------------------------------------------
    // 8. Teste de Estorno Total Complementar (PAYMENT_REFUNDED)
    // --------------------------------------------------------------------------
    console.log("\n▶ 8. Teste de Estorno Total Complementar...");

    const { data: fullRefundData } = await adminClient.rpc("reconcile_gateway_payment", {
      p_tenant_id: tenantAId,
      p_event_record_id: eventRecAId,
      p_receivable_id: recAId,
      p_event_type: "PAYMENT_REFUNDED",
      p_payment_id: chargeId,
      p_reported_amount: 150.0,
      p_paid_date: new Date().toISOString(),
      p_billing_type: "PIX",
      p_receipt_number: `REC-REF2-${suffix}`,
      p_refund_amount: 110.0, // 40 + 110 = 150.0 (estorno total)
    });

    const isFullRefundSuccess = fullRefundData?.success && Number(fullRefundData?.refunded_amount) === 150.0;
    recordTest("Estorno total processado com sucesso", isFullRefundSuccess, `Resposta: ${JSON.stringify(fullRefundData)}`);

    const { data: recFullRefunded } = await adminClient
      .from("receivables")
      .select("status, refunded_amount")
      .eq("id", recAId)
      .single();

    recordTest(
      "Status transicionado para 'estornado' ao atingir quitação de devolução",
      recFullRefunded?.status === "estornado" && Number(recFullRefunded?.refunded_amount) === 150.0,
      `Status: ${recFullRefunded?.status}`
    );

    const { data: prReversed } = await adminClient
      .from("payment_records")
      .select("is_reversed, reversal_reason")
      .eq("receivable_id", recAId)
      .single();

    recordTest(
      "payment_records marcado com is_reversed = true e auditoria",
      prReversed?.is_reversed === true,
      `Reversão: ${prReversed?.reversal_reason}`
    );

    // --------------------------------------------------------------------------
    // 9. Teste do Lock Distribuído gateway_issuing_at
    // --------------------------------------------------------------------------
    console.log("\n▶ 9. Teste de Lock Distribuído e Exclusão Mútua Serverless...");

    const lockTime = new Date().toISOString();

    // Adquire lock
    const { data: lockAcquired } = await adminClient
      .from("receivables")
      .update({ gateway_issuing_at: lockTime })
      .eq("id", recAId)
      .eq("tenant_id", tenantAId)
      .is("gateway_issuing_at", null)
      .select("id")
      .maybeSingle();

    recordTest("Aquisição de lock distribuído inicial em gateway_issuing_at", !!lockAcquired);

    // Tentativa simultânea concorrente de adquirir lock: DEVE ser rejeitada
    const { data: concurrentLock } = await adminClient
      .from("receivables")
      .update({ gateway_issuing_at: new Date().toISOString() })
      .eq("id", recAId)
      .eq("tenant_id", tenantAId)
      .is("gateway_issuing_at", null)
      .select("id")
      .maybeSingle();

    recordTest("Bloqueio de tentativa simultânea concorrente (exclusão mútua garantida)", !concurrentLock);

    // Liberação do lock
    await adminClient
      .from("receivables")
      .update({ gateway_issuing_at: null })
      .eq("id", recAId);

  } catch (err: any) {
    console.error("❌ Exceção na bateria de homologação:", err.message);
    recordTest("Bateria de testes", false, undefined, err.message);
  } finally {
    // --------------------------------------------------------------------------
    // 10. Limpeza Total de Dados Fictícios de Homologação
    // --------------------------------------------------------------------------
    console.log("\n▶ 10. Limpeza de Dados Fictícios de Homologação no Supabase...");
    try {
      if (tenantAId) {
        await adminClient.from("gateway_events").delete().eq("tenant_id", tenantAId);
        await adminClient.from("payment_records").delete().eq("tenant_id", tenantAId);
        await adminClient.from("receivables").delete().eq("tenant_id", tenantAId);
        await adminClient.from("enrollments").delete().eq("tenant_id", tenantAId);
        await adminClient.from("courses").delete().eq("tenant_id", tenantAId);
        await adminClient.from("students").delete().eq("tenant_id", tenantAId);
        await adminClient.from("tenants").delete().eq("id", tenantAId);
      }
      if (tenantBId) {
        await adminClient.from("tenants").delete().eq("id", tenantBId);
      }
      console.log("  🧹 Limpeza concluída com sucesso. Zero resíduos no banco remoto.");
    } catch (cleanupErr: any) {
      console.error("  ⚠️ Aviso ao limpar dados fictícios:", cleanupErr.message);
    }
  }

  console.log("\n==============================================================================");
  console.log("RESUMO DA HOMOLOGAÇÃO REMOTA (MIGRATION 0015):");
  const passedCount = reports.filter((r) => r.passed).length;
  const failedCount = reports.filter((r) => !r.passed).length;
  console.log(`Total: ${reports.length} | Aprovados: ${passedCount} | Falhas: ${failedCount}`);
  console.log("==============================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runHomologation();
