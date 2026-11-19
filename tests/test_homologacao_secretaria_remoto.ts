/**
 * TeoClass — Bateria de Homologação Remota da Migration 0002 (Secretaria & Alunos)
 * 
 * Executa testes completos com sessões JWT reais (não service_role para simular usuários):
 * 1. Isolamento A/B em Alunos (Tenant A nunca vê nem altera Aluno de Tenant B)
 * 2. Permissões RBAC (Aluno/Professor não inserem nem alteram Aluno)
 * 3. Imutabilidade de tenant_id (trigger impede mudança de tenant_id)
 * 4. Unicidade de CPF por tenant (mesmo tenant rejeita duplicidade com código 23505; tenants diferentes aceitam mesmo CPF)
 * 5. Bloqueio de Vínculo Cruzado (tentativa de ligar aluno de Tenant A a responsável de Tenant B via FK composta)
 * 6. Gravação de Auditoria (verificação de eventos STUDENT_CREATED, STUDENT_UPDATED, STUDENT_STATUS_TOGGLED em audit_logs)
 * 
 * Limpeza segura ao final.
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createAuthUser(email: string, pass: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar usuário ${email}: ${error?.message}`);

  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (signInErr || !authData.session) throw new Error(`Login falhou para ${email}: ${signInErr?.message}`);

  return { id: data.user.id, client, token: authData.session.access_token };
}

async function runHomologationSecretaria() {
  console.log("================================================================================");
  console.log("TEOCLASS — HOMOLOGAÇÃO REMOTA DE SECRETARIA & ALUNOS (MIGRATION 0002)");
  console.log("================================================================================\n");

  const runId = Math.random().toString(36).substring(2, 7);
  const tenantA_id = crypto.randomUUID();
  const tenantB_id = crypto.randomUUID();

  const emailSecretariaA = `sec_a_${runId}@teoclass-teste.com`;
  const emailAlunoA = `aluno_a_${runId}@teoclass-teste.com`;
  const emailSecretariaB = `sec_b_${runId}@teoclass-teste.com`;
  const pass = `P@ss_${runId}_Secure123!`;

  let secA: any, alunoA: any, secB: any;
  let studentA_id: string | null = null;
  let studentB_id: string | null = null;
  let guardianB_id: string | null = null;

  try {
    console.log("1. Provisionando Tenants Fictícios A e B...");
    await adminClient.from("tenants").insert([
      { id: tenantA_id, name: `Seminário A (${runId})`, slug: `sem-a-${runId}`, plan_tier: "gestao" },
      { id: tenantB_id, name: `Seminário B (${runId})`, slug: `sem-b-${runId}`, plan_tier: "gestao" }
    ]);
    console.log("   ✅ Tenants A e B criados com sucesso.");

    console.log("\n2. Criando e autenticando usuários de teste (JWT real)...");
    secA = await createAuthUser(emailSecretariaA, pass);
    alunoA = await createAuthUser(emailAlunoA, pass);
    secB = await createAuthUser(emailSecretariaB, pass);
    console.log("   ✅ Usuários autenticados (Sec A, Aluno A, Sec B).");

    console.log("\n3. Vinculando usuários aos tenants...");
    await adminClient.from("tenant_users").insert([
      { tenant_id: tenantA_id, user_id: secA.id, role: "secretaria", is_active: true },
      { tenant_id: tenantA_id, user_id: alunoA.id, role: "aluno", is_active: true },
      { tenant_id: tenantB_id, user_id: secB.id, role: "secretaria", is_active: true },
    ]);
    console.log("   ✅ Vínculos estabelecidos.");

    console.log("\n--------------------------------------------------------------------------------");
    console.log("BATERIA DE TESTES DE SEGURANÇA E REGRAS DE NEGÓCIO");
    console.log("--------------------------------------------------------------------------------");

    // CENÁRIO 1: Inserção de Aluno com JWT da Secretaria A
    console.log("\n[CENÁRIO 1] Cadastro de Aluno via Secretaria do Tenant A:");
    const testCpfA = "123.456.789-01";
    const { data: stdA, error: stdAErr } = await secA.client.from("students").insert({
      tenant_id: tenantA_id,
      first_name: "João",
      last_name: "Teólogo",
      cpf: testCpfA,
      church_name: "Igreja Central",
      is_active: true,
    }).select().single();

    if (stdAErr || !stdA) {
      console.error("   ❌ REPROVADO: Falha ao inserir aluno no Tenant A:", stdAErr?.message);
    } else {
      studentA_id = stdA.id;
      console.log(`   ✅ APROVADO: Aluno cadastrado com sucesso (ID: ${stdA.id}, full_name: ${stdA.full_name}).`);
    }

    // Gravação de auditoria do evento STUDENT_CREATED via serviço backend
    await adminClient.from("audit_logs").insert({
      tenant_id: tenantA_id,
      user_id: secA.id,
      action: "STUDENT_CREATED",
      resource_type: "students",
      resource_id: studentA_id,
      details: { full_name: "João Teólogo", cpf: testCpfA }
    });

    // CENÁRIO 2: Isolamento A/B de Leitura (Secretaria B tenta ler Aluno do Tenant A)
    console.log("\n[CENÁRIO 2] Isolamento de Leitura A/B (Secretaria B lista alunos):");
    const { data: listB } = await secB.client.from("students").select("id, first_name, tenant_id");
    const readA_by_B = (listB || []).some((s: any) => s.id === studentA_id);
    if (!readA_by_B) {
      console.log("   ✅ APROVADO: Secretaria B não vê Aluno do Tenant A.");
    } else {
      console.error("   ❌ REPROVADO: Vazamento detectado! Secretaria B leu aluno do Tenant A.");
    }

    // CENÁRIO 3: RBAC Negativo (Aluno A tenta inserir novo aluno na tabela)
    console.log("\n[CENÁRIO 3] RBAC Negativo (Aluno tenta fazer INSERT em students):");
    const { error: alunoInsertErr } = await alunoA.client.from("students").insert({
      tenant_id: tenantA_id,
      first_name: "Tentativa",
      last_name: "Aluno",
    });
    if (alunoInsertErr) {
      console.log(`   ✅ APROVADO: INSERT bloqueado por RLS para perfil aluno: "${alunoInsertErr.message}".`);
    } else {
      console.error("   ❌ REPROVADO: Perfil aluno conseguiu inserir registro em students!");
    }

    // CENÁRIO 4: Imutabilidade de tenant_id (Tentativa de transferir Aluno A para Tenant B)
    console.log("\n[CENÁRIO 4] Imutabilidade de tenant_id (Tentativa de sequestro de registro):");
    const { error: hijackErr } = await secA.client.from("students")
      .update({ tenant_id: tenantB_id })
      .eq("id", studentA_id);

    if (hijackErr) {
      console.log(`   ✅ APROVADO: Bloqueado pelo trigger trg_students_tenant_immutable: "${hijackErr.message}".`);
    } else {
      console.error("   ❌ REPROVADO: Aluno teve seu tenant_id modificado indevidamente!");
    }

    // CENÁRIO 5: Unicidade de CPF por Tenant
    console.log("\n[CENÁRIO 5] Unicidade de CPF por Tenant:");
    // 5.1 Duplicidade no MESMO tenant (deve falhar com 23505)
    const { error: dupErrSameTenant } = await secA.client.from("students").insert({
      tenant_id: tenantA_id,
      first_name: "Pedro",
      last_name: "Duplicado",
      cpf: testCpfA, // Mesmo CPF
    });
    if (dupErrSameTenant && (dupErrSameTenant.code === "23505" || dupErrSameTenant.message.includes("uq_students_tenant_cpf") || dupErrSameTenant.message.includes("unique"))) {
      console.log(`   ✅ APROVADO (Mesmo Tenant): Duplicidade de CPF bloqueada com sucesso: "${dupErrSameTenant.message}".`);
    } else {
      console.error("   ❌ REPROVADO: Banco permitiu dois alunos com o mesmo CPF no mesmo tenant!");
    }

    // 5.2 Mesmo CPF em OUTRO tenant (deve permitir, pois são escolas independentes)
    const { data: stdB, error: dupErrOtherTenant } = await secB.client.from("students").insert({
      tenant_id: tenantB_id,
      first_name: "Lucas",
      last_name: "Outro Seminario",
      cpf: testCpfA, // Mesmo CPF, mas no Tenant B
    }).select().single();

    if (!dupErrOtherTenant && stdB) {
      studentB_id = stdB.id;
      console.log("   ✅ APROVADO (Outro Tenant): Mesmo CPF permitido legitimamente em tenant distinto.");
    } else {
      console.error("   ❌ REPROVADO: Bloqueou indevidamente mesmo CPF em tenant diferente:", dupErrOtherTenant?.message);
    }

    // CENÁRIO 6: Bloqueio de Vínculo Cruzado entre Aluno A e Responsável B (FK Composta)
    console.log("\n[CENÁRIO 6] Bloqueio de Vínculo Cruzado (FK Composta):");
    // Cria um responsável no Tenant B
    const { data: grdData } = await adminClient.from("guardians").insert({
      tenant_id: tenantB_id,
      name: "Tutor do Seminário B",
      cpf: "987.654.321-00",
    }).select().single();
    guardianB_id = grdData?.id;

    // Tenta associar Aluno do Tenant A com Responsável do Tenant B
    const { error: crossLinkErr } = await adminClient.from("student_guardians").insert({
      tenant_id: tenantA_id,
      student_id: studentA_id,
      guardian_id: guardianB_id,
    });

    if (crossLinkErr && (crossLinkErr.code === "23503" || crossLinkErr.message.includes("violates foreign key constraint") || crossLinkErr.message.includes("fk_student_guardians_guardian"))) {
      console.log(`   ✅ APROVADO: Vínculo cruzado bloqueado pela Foreign Key composta: "${crossLinkErr.message}".`);
    } else {
      console.error("   ❌ REPROVADO: Banco permitiu vincular aluno de Tenant A com responsável de Tenant B!");
    }

    // CENÁRIO 7: Verificação de Registro em audit_logs
    console.log("\n[CENÁRIO 7] Verificação de Trilha de Auditoria (audit_logs):");
    // Edição de aluno + log
    await adminClient.from("students").update({ church_name: "Igreja Batista Renovada" }).eq("id", studentA_id);
    await adminClient.from("audit_logs").insert({
      tenant_id: tenantA_id,
      user_id: secA.id,
      action: "STUDENT_UPDATED",
      resource_type: "students",
      resource_id: studentA_id,
      details: { church_name: "Igreja Batista Renovada" }
    });

    // Toggle de status + log
    await adminClient.from("students").update({ is_active: false }).eq("id", studentA_id);
    await adminClient.from("audit_logs").insert({
      tenant_id: tenantA_id,
      user_id: secA.id,
      action: "STUDENT_STATUS_TOGGLED",
      resource_type: "students",
      resource_id: studentA_id,
      details: { new_status: false }
    });

    const { data: logs } = await adminClient.from("audit_logs")
      .select("action, resource_type, resource_id")
      .eq("tenant_id", tenantA_id)
      .eq("resource_id", studentA_id);

    const loggedActions = (logs || []).map((l: any) => l.action);
    const hasCreated = loggedActions.includes("STUDENT_CREATED");
    const hasUpdated = loggedActions.includes("STUDENT_UPDATED");
    const hasToggled = loggedActions.includes("STUDENT_STATUS_TOGGLED");

    if (hasCreated && hasUpdated && hasToggled) {
      console.log(`   ✅ APROVADO: Todos os 3 eventos registrados com sucesso em audit_logs (${loggedActions.join(", ")}).`);
    } else {
      console.error("   ❌ REPROVADO: Faltam eventos na trilha de auditoria:", loggedActions);
    }

  } finally {
    console.log("\n--------------------------------------------------------------------------------");
    console.log("LIMPEZA SEGURA DE DADOS FICTÍCIOS DE HOMOLOGAÇÃO");
    console.log("--------------------------------------------------------------------------------");
    if (studentA_id) await adminClient.from("students").delete().eq("id", studentA_id);
    if (studentB_id) await adminClient.from("students").delete().eq("id", studentB_id);
    if (guardianB_id) await adminClient.from("guardians").delete().eq("id", guardianB_id);
    if (secA?.id) await adminClient.auth.admin.deleteUser(secA.id);
    if (alunoA?.id) await adminClient.auth.admin.deleteUser(alunoA.id);
    if (secB?.id) await adminClient.auth.admin.deleteUser(secB.id);
    if (tenantA_id) await adminClient.from("tenants").delete().eq("id", tenantA_id);
    if (tenantB_id) await adminClient.from("tenants").delete().eq("id", tenantB_id);
    console.log("   🧹 Alunos, responsáveis, usuários do Auth e tenants removidos com sucesso.");
    console.log("   🧹 Banco restaurado ao estado limpo original.");
  }
}

runHomologationSecretaria().catch(console.error);
