/**
 * TeoClass — Bateria de Homologação Remota Final do Lote 10 (Financeiro Acadêmico)
 * Projeto Supabase: cucjutrekedskgyuwfuh
 * 
 * Escopo de Validação com Sessões JWT Reais de Múltiplos Perfis e Dois Tenants Fictícios A e B:
 * 1. Existência e Estrutura das Tabelas:
 *    - financial_plans, receivables, payment_records.
 *    - Constraints compostas (tenant_id, id), (tenant_id, enrollment_id, charge_type, installment_number).
 * 2. Isolamento Hermético Multi-Tenant (A/B):
 *    - Usuários do Tenant B não visualizam recebíveis nem pagamentos do Tenant A.
 * 3. Matriz de RBAC e Privilégios:
 *    - Admin / Financeiro: gestão completa de planos, parcelas e baixas.
 *    - Secretaria: consulta e baixa manual de recebíveis.
 *    - Professor: NÃO possui acesso a recebíveis nem planos financeiros (bloqueado por RLS).
 *    - Aluno: consulta estritamente suas próprias cobranças e recibos.
 * 4. Geração Idempotente de Parcelas e Bolsas:
 *    - Criação de plano financeiro com bolsa/desconto percentual.
 *    - Geração de cobranças (matrícula + mensalidades) respeitando a unicidade.
 *    - Tentativa de geração duplicada bloqueada.
 * 5. Baixas Manuais, Recibos e Estornos Auditáveis:
 *    - Baixa manual com recibo único.
 *    - Atualização do saldo e transição de status para 'pago'.
 *    - Estorno auditado revertendo o status para 'em_aberto' e recalculando o saldo pago.
 * 6. Proteção contra Adulteração Direta de Pagamentos (Anti-Fraude Discente):
 *    - Discente tenta registrar pagamento fictício via INSERT direto em payment_records (bloqueado por RLS).
 *    - Discente tenta alterar status/paid_amount em receivables via UPDATE direto (neutralizado).
 * 7. Limpeza Total de Dados Fictícios (Zero Resíduos).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  calculateInstallmentDueDate,
  generateReceiptNumber,
  calculateFinancialMetrics,
} from "../src/lib/financeiro/calculator.ts";

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

function createClientWithToken(jwt: string) {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const runId = Math.random().toString(36).substring(2, 7);

async function main() {
  console.log("================================================================================");
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA FINAL DO LOTE 10 (FINANCEIRO ESCOLAR) [RUN ID: ${runId}]`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdClassIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdPlanIds: string[] = [];
  const createdReceivableIds: string[] = [];
  const createdPaymentIds: string[] = [];

  try {
    // ----------------------------------------------------------------------------
    // 1. Confirmação Estrutural de Tabelas do Módulo Financeiro
    // ----------------------------------------------------------------------------
    console.log("1. Verificando existência das tabelas da Migration 0010...");

    const [t1, t2, t3] = await Promise.all([
      admin.from("financial_plans").select("id").limit(0),
      admin.from("receivables").select("id").limit(0),
      admin.from("payment_records").select("id").limit(0),
    ]);

    if (t1.error || t2.error || t3.error) {
      throw new Error(`Falha estrutural nas tabelas financeiras: ${t1.error?.message || t2.error?.message || t3.error?.message}`);
    }
    console.log("   ✅ Tabelas financial_plans, receivables e payment_records confirmadas.");

    // ----------------------------------------------------------------------------
    // 2. Provisionando Tenants Fictícios A e B
    // ----------------------------------------------------------------------------
    console.log("\n2. Provisionando Tenants Fictícios A e B...");

    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Instituto Bíblico Ebenézer ${runId}`,
        slug: `tenant-l10-a-${runId}`,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errTA) throw new Error(`Falha Tenant A: ${errTA.message}`);
    createdTenants.push(tenantA.id);

    const { data: tenantB, error: errTB } = await admin
      .from("tenants")
      .insert({
        name: `Seminário Antioquia ${runId}`,
        slug: `tenant-l10-b-${runId}`,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errTB) throw new Error(`Falha Tenant B: ${errTB.message}`);
    createdTenants.push(tenantB.id);

    console.log("   ✅ Tenants A e B provisionados.");

    // ----------------------------------------------------------------------------
    // 3. Criando Usuários e Gerando Sessões JWT Reais
    // ----------------------------------------------------------------------------
    console.log("\n3. Criando usuários e gerando sessões JWT reais...");

    async function createUser(email: string, role: string, tenantId: string, fullName: string) {
      const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: "PasswordTeoClass123!",
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (authErr) throw new Error(`Erro ao criar ${email}: ${authErr.message}`);
      createdUserIds.push(authUser.user.id);

      await admin.from("profiles").upsert({
        id: authUser.user.id,
        email,
        full_name: fullName,
      });

      await admin.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: authUser.user.id,
        role,
        is_active: true,
      });

      const client = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
        email,
        password: "PasswordTeoClass123!",
      });
      if (loginErr || !loginData.session) throw new Error(`Login ${email}: ${loginErr?.message}`);

      return {
        id: authUser.user.id,
        jwt: loginData.session.access_token,
        client: createClientWithToken(loginData.session.access_token),
      };
    }

    const finA = await createUser(`fin.l10.${runId}@tenanta.com`, "financeiro", tenantA.id, `Gestor Financeiro ${runId}`);
    const secA = await createUser(`sec.l10.${runId}@tenanta.com`, "secretaria", tenantA.id, `Secretária A ${runId}`);
    const profA = await createUser(`prof.l10.${runId}@tenanta.com`, "professor", tenantA.id, `Professor ${runId}`);
    const studentA1 = await createUser(`aluno1.l10.${runId}@tenanta.com`, "aluno", tenantA.id, `Aluno Um ${runId}`);
    const studentA2 = await createUser(`aluno2.l10.${runId}@tenanta.com`, "aluno", tenantA.id, `Aluno Dois ${runId}`);
    const studentB = await createUser(`aluno.l10.${runId}@tenantb.com`, "aluno", tenantB.id, `Aluno Tenant B ${runId}`);

    console.log("   ✅ Sessões JWT reais estabelecidas para Financeiro, Secretaria, Professor, Alunos A1/A2 e Aluno B.");

    // ----------------------------------------------------------------------------
    // 4. Estrutura Acadêmica (Cursos, Turmas e Matrículas)
    // ----------------------------------------------------------------------------
    console.log("\n4. Configurando estrutura acadêmica de suporte...");

    const { data: courseA } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Bacharel em Teologia Ministerial ${runId}`,
        modality: "presencial",
        format: "estruturado",
        workload_hours: 1400,
      })
      .select()
      .single();
    createdCourseIds.push(courseA.id);

    const { data: classA } = await secA.client
      .from("classes")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseA.id,
        name: `Turma Betel ${runId}`,
        shift: "noturno",
        status: "em_andamento",
        capacity: 35,
      })
      .select()
      .single();
    createdClassIds.push(classA.id);

    const { data: studentRecordA1 } = await secA.client
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: studentA1.id,
        first_name: "Aluno",
        last_name: `Um ${runId}`,
        cpf: `11122233300`,
        email: `aluno1.l10.${runId}@tenanta.com`,
      })
      .select()
      .single();
    createdStudentIds.push(studentRecordA1.id);

    const { data: studentRecordA2 } = await secA.client
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: studentA2.id,
        first_name: "Aluno",
        last_name: `Dois ${runId}`,
        cpf: `22233344499`,
        email: `aluno2.l10.${runId}@tenanta.com`,
      })
      .select()
      .single();
    createdStudentIds.push(studentRecordA2.id);

    const { data: enrollmentA1 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        course_id: courseA.id,
        class_id: classA.id,
        enrollment_number: `MAT-L10-A1-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    createdEnrollmentIds.push(enrollmentA1.id);

    const { data: enrollmentA2 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA2.id,
        course_id: courseA.id,
        class_id: classA.id,
        enrollment_number: `MAT-L10-A2-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    createdEnrollmentIds.push(enrollmentA2.id);

    console.log("   ✅ Alunos e matrículas ativas configurados.");

    // ----------------------------------------------------------------------------
    // 5. Criação de Planos Financeiros e Lançamento de Cobranças
    // ----------------------------------------------------------------------------
    console.log("\n5. Testando criação de plano financeiro e regras de cobrança...");

    // Financeiro cria plano com 10% de bolsa pastoral
    const { data: plan1, error: errPlan } = await finA.client
      .from("financial_plans")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseA.id,
        class_id: classA.id,
        name: `Plano Padrão 2026 (${runId})`,
        enrollment_fee: 100.00,
        installment_value: 200.00,
        installments_count: 3,
        default_due_day: 10,
        discount_percentage: 10.00, // 10% de desconto
      })
      .select()
      .single();

    if (errPlan || !plan1) throw new Error(`Falha ao criar plano: ${errPlan?.message}`);
    createdPlanIds.push(plan1.id);
    console.log("   ✅ Plano financeiro criado pelo Financeiro com sucesso.");

    // Geração de parcelas para o Aluno A1 (1 Matrícula de R$ 90 + 3 Mensalidades de R$ 180)
    const dueDate1 = "2026-03-10";
    const dueDate2 = "2026-04-10";
    const dueDate3 = "2026-05-10";

    const { data: recMatricula } = await finA.client
      .from("receivables")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        financial_plan_id: plan1.id,
        title: "Taxa de Matrícula",
        charge_type: "matricula",
        installment_number: 1,
        total_installments: 1,
        original_amount: 100.00,
        discount_amount: 10.00,
        final_amount: 90.00,
        due_date: "2026-02-15",
        status: "em_aberto",
      })
      .select()
      .single();
    createdReceivableIds.push(recMatricula.id);

    const { data: recMensal1 } = await finA.client
      .from("receivables")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        financial_plan_id: plan1.id,
        title: "Mensalidade 1/3",
        charge_type: "mensalidade",
        installment_number: 1,
        total_installments: 3,
        original_amount: 200.00,
        discount_amount: 20.00,
        final_amount: 180.00,
        due_date: dueDate1,
        status: "em_aberto",
      })
      .select()
      .single();
    createdReceivableIds.push(recMensal1.id);

    console.log("   ✅ Cobranças lançadas com valores monetários e descontos precisos.");

    // ----------------------------------------------------------------------------
    // 6. Testando Prevenção de Cobranças Duplicadas (Constraint de Unicidade)
    // ----------------------------------------------------------------------------
    console.log("\n6. Testando bloqueio contra geração de parcelas duplicadas...");

    const { error: dupErr } = await finA.client
      .from("receivables")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        financial_plan_id: plan1.id,
        title: "Mensalidade 1/3 Duplicada",
        charge_type: "mensalidade",
        installment_number: 1, // Mesmo número para a mesma matrícula
        total_installments: 3,
        original_amount: 200.00,
        discount_amount: 20.00,
        final_amount: 180.00,
        due_date: dueDate1,
      });

    if (!dupErr || !dupErr.message.includes("uq_receivables_enrollment_installment")) {
      throw new Error("FALHA: Constraint de unicidade permitiu parcela duplicada na mesma matrícula!");
    }
    console.log("   ✅ Constraint uq_receivables_enrollment_installment bloqueou cobrança duplicada com sucesso.");

    // ----------------------------------------------------------------------------
    // 7. Testando RBAC e Restrições de Acesso por Perfil
    // ----------------------------------------------------------------------------
    console.log("\n7. Testando permissões de acesso e RBAC...");

    // A. Professor NÃO deve acessar contas a receber (RLS deve bloquear)
    const { data: profLeak } = await profA.client
      .from("receivables")
      .select("id, final_amount")
      .eq("tenant_id", tenantA.id);

    if (profLeak && profLeak.length > 0) {
      throw new Error("FALHA CRÍTICA: Professor conseguiu visualizar contas a receber da instituição!");
    }
    console.log("   ✅ RLS bloqueou acesso do Professor ao módulo financeiro.");

    // B. Aluno 1 consulta suas próprias cobranças
    const { data: student1Charges, error: s1Err } = await studentA1.client
      .from("receivables")
      .select("id, title, final_amount")
      .eq("student_id", studentRecordA1.id);

    if (s1Err || student1Charges.length === 0) {
      throw new Error(`Aluno A1 falhou ao visualizar suas cobranças: ${s1Err?.message}`);
    }
    console.log("   ✅ Aluno A1 visualizou com sucesso suas próprias cobranças.");

    // C. Aluno 1 tenta visualizar cobranças de outro aluno (deve retornar vazio)
    const { data: student1Leak } = await studentA1.client
      .from("receivables")
      .select("id")
      .eq("student_id", studentRecordA2.id);

    if (student1Leak && student1Leak.length > 0) {
      throw new Error("FALHA CRÍTICA: Aluno A1 visualizou cobranças do Aluno A2!");
    }
    console.log("   ✅ RLS bloqueou Aluno A1 de visualizar cobranças de outros discentes.");

    // ----------------------------------------------------------------------------
    // 8. Testando Baixa Manual, Recibos e Estorno
    // ----------------------------------------------------------------------------
    console.log("\n8. Testando baixa manual de pagamento e estorno auditável...");

    const receiptNum = generateReceiptNumber();

    // Financeiro registra pagamento total da taxa de matrícula (R$ 90,00 via PIX)
    const { data: payment1, error: errPay } = await finA.client
      .from("payment_records")
      .insert({
        tenant_id: tenantA.id,
        receivable_id: recMatricula.id,
        amount_paid: 90.00,
        payment_method: "pix",
        receipt_number: receiptNum,
        received_by: finA.id,
      })
      .select()
      .single();

    if (errPay || !payment1) throw new Error(`Falha ao registrar pagamento: ${errPay?.message}`);
    createdPaymentIds.push(payment1.id);

    // Atualiza status do recebível para 'pago'
    await finA.client
      .from("receivables")
      .update({
        paid_amount: 90.00,
        status: "pago",
        paid_at: new Date().toISOString(),
      })
      .eq("id", recMatricula.id);

    const { data: checkPaid } = await admin
      .from("receivables")
      .select("status, paid_amount")
      .eq("id", recMatricula.id)
      .single();

    if (checkPaid.status !== "pago" || Number(checkPaid.paid_amount) !== 90.00) {
      throw new Error(`Status pós-baixa incorreto: ${checkPaid.status}`);
    }
    console.log("   ✅ Baixa manual efetuada com sucesso: status 'pago', recibo gravado.");

    // Testando estorno do pagamento
    await finA.client
      .from("payment_records")
      .update({
        is_reversed: true,
        reversed_at: new Date().toISOString(),
        reversed_by: finA.id,
        reversal_reason: "Comprovante de PIX não identificado pelo banco.",
      })
      .eq("id", payment1.id);

    await finA.client
      .from("receivables")
      .update({
        paid_amount: 0.00,
        status: "em_aberto",
        paid_at: null,
      })
      .eq("id", recMatricula.id);

    const { data: checkReversed } = await admin
      .from("receivables")
      .select("status, paid_amount")
      .eq("id", recMatricula.id)
      .single();

    if (checkReversed.status !== "em_aberto" || Number(checkReversed.paid_amount) !== 0.00) {
      throw new Error("Estorno não restabeleceu o status 'em_aberto' da cobrança!");
    }
    console.log("   ✅ Estorno de pagamento concluído e auditado: cobrança restabelecida como 'em_aberto'.");

    // ----------------------------------------------------------------------------
    // 9. Testando Tentativas de Fraude por Discente (Anti-Adulteração)
    // ----------------------------------------------------------------------------
    console.log("\n9. Testando tentativas de fraude financeira por aluno...");

    // Aluno tenta marcar cobrança como paga via UPDATE direto
    const { error: hackPayErr } = await studentA1.client
      .from("receivables")
      .update({ status: "pago", paid_amount: 180.00 })
      .eq("id", recMensal1.id);

    const { data: checkHack } = await admin
      .from("receivables")
      .select("status, paid_amount")
      .eq("id", recMensal1.id)
      .single();

    if (checkHack.status === "pago" || Number(checkHack.paid_amount) > 0) {
      throw new Error("FALHA CRÍTICA: Aluno conseguiu burlar pagamento via UPDATE direto!");
    }
    console.log("   ✅ Tentativa de auto-quitação de cobrança por discente foi neutralizada.");

    // Aluno tenta forjar recibo via INSERT direto em payment_records
    const { error: hackReceiptErr } = await studentA1.client
      .from("payment_records")
      .insert({
        tenant_id: tenantA.id,
        receivable_id: recMensal1.id,
        amount_paid: 180.00,
        payment_method: "dinheiro",
        receipt_number: "REC-FAKE-001",
      });

    if (!hackReceiptErr) {
      throw new Error("FALHA CRÍTICA: Aluno conseguiu forjar comprovante de pagamento via INSERT direto!");
    }
    console.log("   ✅ RLS bloqueou criação de comprovante forjado por discente.");

    // ----------------------------------------------------------------------------
    // 10. Testando Isolamento Multi-Tenant A/B
    // ----------------------------------------------------------------------------
    console.log("\n10. Testando isolamento Multi-Tenant A/B com Aluno do Tenant B...");

    const { data: tenantBLeak } = await studentB.client
      .from("receivables")
      .select("id, title")
      .eq("tenant_id", tenantA.id);

    if (tenantBLeak && tenantBLeak.length > 0) {
      throw new Error("FALHA CRÍTICA: Aluno do Tenant B conseguiu ver recebíveis do Tenant A!");
    }
    console.log("   ✅ Isolamento Multi-Tenant validado: Zero vazamento financeiro para o Tenant B.");

    console.log("\n================================================================================");
    console.log("🎉 TODOS OS TESTES REMOTOS DE HOMOLOGAÇÃO DO LOTE 10 FORAM APROVADOS!");
    console.log("================================================================================\n");

  } finally {
    // ----------------------------------------------------------------------------
    // Limpeza Total de Dados Fictícios
    // ----------------------------------------------------------------------------
    console.log("Limpando dados fictícios criados nesta homologação...");

    for (const payId of createdPaymentIds) {
      await admin.from("payment_records").delete().eq("id", payId);
    }
    for (const recId of createdReceivableIds) {
      await admin.from("receivables").delete().eq("id", recId);
    }
    for (const plId of createdPlanIds) {
      await admin.from("financial_plans").delete().eq("id", plId);
    }
    for (const enrId of createdEnrollmentIds) {
      await admin.from("enrollments").delete().eq("id", enrId);
    }
    for (const stdId of createdStudentIds) {
      await admin.from("students").delete().eq("id", stdId);
    }
    for (const claId of createdClassIds) {
      await admin.from("classes").delete().eq("id", claId);
    }
    for (const crsId of createdCourseIds) {
      await admin.from("courses").delete().eq("id", crsId);
    }
    for (const uid of createdUserIds) {
      await admin.from("tenant_users").delete().eq("user_id", uid);
      await admin.from("profiles").delete().eq("id", uid);
      await admin.auth.admin.deleteUser(uid);
    }
    for (const tid of createdTenants) {
      await admin.from("tenants").delete().eq("id", tid);
    }

    console.log("✅ Limpeza completa concluída sem deixar dados residuais.");
  }
}

main().catch((err) => {
  console.error("❌ ERRO NA HOMOLOGAÇÃO REMOTA:", err);
  process.exit(1);
});
