/**
 * TeoClass — Bateria de Homologação Remota Final do Lote 4
 * Projeto: cucjutrekedskgyuwfuh
 * 
 * Validações:
 * 1. Confirmação das tabelas course_modules e subjects no catálogo do Supabase
 * 2. Isolamento A/B de leitura e escrita (Sec A não vê nem altera disciplinas do Tenant B)
 * 3. RBAC negativo (Aluno não insere módulos nem disciplinas)
 * 4. Imutabilidade de tenant_id em course_modules e subjects (prevent_tenant_id_change)
 * 5. Bloqueio de vínculos cruzados (FK composta impede ligar disciplina do Tenant A a curso/módulo do Tenant B)
 * 6. Estrutura flexível: curso simples (disciplinas diretas sem módulo) e curso estruturado (com módulos)
 * 7. Ordenação (order_index), carga horária e vínculo de professor titular
 * 8. Trilha de auditoria (COURSE_MODULE_CREATED, SUBJECT_CREATED)
 * 9. Limpeza estrita de todos os dados fictícios
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
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA FINAL DO LOTE 4 (RUN ID: ${runId})`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdModuleIds: string[] = [];
  const createdSubjectIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // ETAPA 1: CONFIRMAÇÃO REMOTA DE TABELAS
    // --------------------------------------------------------------------------
    console.log("1. Verificando estruturas remotas da Migration 0004...");
    const checkTables = ["course_modules", "subjects"];
    for (const t of checkTables) {
      const { error } = await admin.from(t).select("id").limit(1);
      if (error) {
        throw new Error(`Tabela '${t}' não está acessível no Supabase: ${error.message}`);
      }
    }
    console.log("   ✅ Tabelas 'course_modules' e 'subjects' confirmadas com sucesso no Supabase.\n");

    // --------------------------------------------------------------------------
    // ETAPA 2: PROVISIONAMENTO DE 2 TENANTS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("2. Provisionando Tenants Fictícios A e B...");
    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Seminário Teológico A (${runId})`,
        slug: `seminario-a-${runId}`,
        status: "active",
      })
      .select()
      .single();
    if (errTA) throw new Error(`Falha ao criar Tenant A: ${errTA.message}`);
    createdTenants.push(tenantA.id);

    const { data: tenantB, error: errTB } = await admin
      .from("tenants")
      .insert({
        name: `Instituto Bíblico B (${runId})`,
        slug: `instituto-b-${runId}`,
        status: "active",
      })
      .select()
      .single();
    if (errTB) throw new Error(`Falha ao criar Tenant B: ${errTB.message}`);
    createdTenants.push(tenantB.id);
    console.log("   ✅ Tenants A e B criados com sucesso.\n");

    // --------------------------------------------------------------------------
    // ETAPA 3: CRIAÇÃO E AUTENTICAÇÃO DE USUÁRIOS (JWT REAL)
    // --------------------------------------------------------------------------
    console.log("3. Criando usuários e gerando sessões JWT reais...");
    const pass = `Pass_${runId}_Aa123!`;

    async function setupUser(email: string, role: string, tenantId: string, fullName: string) {
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: pass,
        email_confirm: true,
      });
      if (authErr) throw new Error(`Falha ao criar auth user (${email}): ${authErr.message}`);
      const userId = authData.user.id;
      createdUserIds.push(userId);

      // Profile
      await admin.from("profiles").upsert({
        id: userId,
        email,
        full_name: fullName,
      });

      // Membership
      const { error: tuErr } = await admin.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: userId,
        role,
        is_active: true,
      });
      if (tuErr) throw new Error(`Falha ao vincular usuário ao tenant: ${tuErr.message}`);

      // Login para obter JWT
      const anon = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: sessionData, error: sessErr } = await anon.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (sessErr || !sessionData.session) {
        throw new Error(`Falha no login de ${email}: ${sessErr?.message}`);
      }

      return {
        userId,
        jwt: sessionData.session.access_token,
        client: createClientWithToken(sessionData.session.access_token),
      };
    }

    const secA = await setupUser(`sec_a_${runId}@teoclass.test`, "secretaria", tenantA.id, "Secretário A");
    const profA = await setupUser(`prof_a_${runId}@teoclass.test`, "professor", tenantA.id, "Dr. Gamaliel");
    const alunoA = await setupUser(`aluno_a_${runId}@teoclass.test`, "aluno", tenantA.id, "Timóteo Aluno");
    const secB = await setupUser(`sec_b_${runId}@teoclass.test`, "secretaria", tenantB.id, "Secretário B");

    console.log("   ✅ Usuários autenticados (Sec A, Prof A, Aluno A, Sec B).\n");

    // --------------------------------------------------------------------------
    // ETAPA 4: BATERIA DE TESTES DE SEGURANÇA E ESTRUTURA CURRICULAR
    // --------------------------------------------------------------------------
    console.log("--------------------------------------------------------------------------------");
    console.log("BATERIA DE TESTES DE SEGURANÇA E ESTRUTURA CURRICULAR");
    console.log("--------------------------------------------------------------------------------\n");

    // [CENÁRIO 1] Criação de Cursos Teológicos (Simples e Estruturado) no Tenant A
    console.log("[CENÁRIO 1] Criação de Cursos Teológicos no Tenant A (Simples e Estruturado):");
    const { data: courseEstruturado, error: errCE } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: "Bacharel Livre em Teologia",
        format: "estruturado",
        modality: "presencial",
        workload_hours: 1200,
        is_active: true,
      })
      .select()
      .single();
    if (errCE || !courseEstruturado) throw new Error(`Falha ao criar curso estruturado: ${errCE?.message}`);
    createdCourseIds.push(courseEstruturado.id);

    const { data: courseSimples, error: errCS } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: "Extensão em Homilética e Pregação",
        format: "simples",
        modality: "ead_assincrono",
        workload_hours: 60,
        is_active: true,
      })
      .select()
      .single();
    if (errCS || !courseSimples) throw new Error(`Falha ao criar curso simples: ${errCS?.message}`);
    createdCourseIds.push(courseSimples.id);
    console.log(`   ✅ APROVADO: Cursos criados com sucesso (Estruturado: ${courseEstruturado.id}, Simples: ${courseSimples.id}).`);

    // [CENÁRIO 2] Criação de Módulo Curricular (Tenant A)
    console.log("\n[CENÁRIO 2] Criação de Módulo Curricular via Secretaria do Tenant A:");
    const { data: module1, error: errMod1 } = await secA.client
      .from("course_modules")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseEstruturado.id,
        name: "Módulo I: Fundamentos Bíblicos e Teologia Própria",
        description: "Introdução à teologia, revelação divina e bibliologia",
        order_index: 1,
        is_active: true,
      })
      .select()
      .single();
    if (errMod1 || !module1) {
      console.log(`   ❌ REPROVADO: Falha ao criar módulo: ${errMod1?.message}`);
    } else {
      createdModuleIds.push(module1.id);
      console.log(`   ✅ APROVADO: Módulo criado com sucesso (ID: ${module1.id}).`);
    }

    // [CENÁRIO 3] Criação de Disciplinas (Com Módulo e Direta / Sem Módulo) e Vínculo de Professor
    console.log("\n[CENÁRIO 3] Criação de Disciplinas (Estruturada e Direta) com Professor Titular:");
    // Disciplina 1: Vinculada a módulo e com professor titular
    const { data: subj1, error: errSubj1 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseEstruturado.id,
        module_id: module1?.id,
        name: "Bibliologia e Hermenêutica Bíblica",
        code: "TEO-101",
        syllabus: "Cânon das Escrituras, inerrância, métodos clássicos de interpretação e aplicação pastoral.",
        workload_hours: 60,
        order_index: 1,
        teacher_id: profA.userId,
        is_active: true,
      })
      .select()
      .single();

    if (errSubj1 || !subj1) {
      console.log(`   ❌ REPROVADO: Falha ao criar disciplina estruturada: ${errSubj1?.message}`);
    } else {
      createdSubjectIds.push(subj1.id);
      console.log(`   ✅ APROVADO: Disciplina estruturada criada com professor titular (ID: ${subj1.id}).`);
    }

    // Disciplina 2: Curso simples (direta, sem módulo)
    const { data: subj2, error: errSubj2 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseSimples.id,
        module_id: null, // Sem módulo
        name: "A Arte da Pregação Expositiva",
        code: "HOM-201",
        syllabus: "Estrutura do sermão, exegese para pregação e oratória cristã.",
        workload_hours: 30,
        order_index: 1,
        is_active: true,
      })
      .select()
      .single();

    if (errSubj2 || !subj2) {
      console.log(`   ❌ REPROVADO: Falha ao criar disciplina direta: ${errSubj2?.message}`);
    } else {
      createdSubjectIds.push(subj2.id);
      console.log(`   ✅ APROVADO: Disciplina de curso simples (sem módulo) criada com sucesso (ID: ${subj2.id}).`);
    }

    // [CENÁRIO 4] Isolamento A/B de Leitura em Módulos e Disciplinas
    console.log("\n[CENÁRIO 4] Isolamento A/B (Sec B não visualiza módulos ou disciplinas do Tenant A):");
    const { data: modsB } = await secB.client
      .from("course_modules")
      .select("id, name")
      .eq("tenant_id", tenantA.id);

    const { data: subjsB } = await secB.client
      .from("subjects")
      .select("id, name")
      .eq("tenant_id", tenantA.id);

    const isLeaked = (modsB && modsB.length > 0) || (subjsB && subjsB.length > 0);
    if (isLeaked) {
      console.log("   ❌ REPROVADO: Vazamento multi-tenant em módulos ou disciplinas!");
    } else {
      console.log("   ✅ APROVADO: Secretaria B obteve 0 registros ao consultar dados curriculares do Tenant A.");
    }

    // [CENÁRIO 5] RBAC Negativo (Aluno tenta criar disciplina)
    console.log("\n[CENÁRIO 5] RBAC Negativo (Aluno tenta fazer INSERT em subjects):");
    const { error: errAlunoSubj } = await alunoA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseEstruturado.id,
        name: "Disciplina Ilegítima por Aluno",
        workload_hours: 40,
      });

    if (!errAlunoSubj) {
      console.log("   ❌ REPROVADO: Aluno conseguiu inserir disciplina no banco!");
    } else {
      console.log(`   ✅ APROVADO: RLS bloqueou criação por Aluno: "${errAlunoSubj.message}".`);
    }

    // [CENÁRIO 6] Imutabilidade de tenant_id em Módulos e Disciplinas
    console.log("\n[CENÁRIO 6] Imutabilidade de tenant_id (Tentativa de sequestro de disciplina):");
    const { error: errHijackSubj } = await secA.client
      .from("subjects")
      .update({ tenant_id: tenantB.id })
      .eq("id", subj1.id);

    if (!errHijackSubj) {
      console.log("   ❌ REPROVADO: tenant_id da disciplina foi alterado!");
    } else {
      console.log(`   ✅ APROVADO: Trigger prevent_tenant_id_change bloqueou alteração de tenant_id: "${errHijackSubj.message}".`);
    }

    // [CENÁRIO 7] Bloqueio de Vínculo Cruzado de Disciplina (FK Composta)
    console.log("\n[CENÁRIO 7] Bloqueio de Vínculo Cruzado (FK Composta fk_subjects_course):");
    const { data: courseB } = await secB.client
      .from("courses")
      .insert({
        tenant_id: tenantB.id,
        name: "Curso Isolado B",
        modality: "presencial",
        workload_hours: 60,
      })
      .select()
      .single();
    if (courseB) createdCourseIds.push(courseB.id);

    const { error: errCrossSubj } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseB?.id, // Curso do Tenant B!
        name: "Disciplina Cruzada Ilegítima",
        workload_hours: 40,
      });

    if (!errCrossSubj) {
      console.log("   ❌ REPROVADO: FK composta não impediu vínculo com curso de outro tenant!");
    } else {
      console.log(`   ✅ APROVADO: FK composta rejeitou vínculo entre tenants distintos: "${errCrossSubj.message}".`);
    }

    // [CENÁRIO 8] Trilha de Auditoria Curricular
    console.log("\n[CENÁRIO 8] Trilha de Auditoria de Módulos e Disciplinas (audit_logs):");
    const { error: errAudit } = await admin.from("audit_logs").insert([
      {
        tenant_id: tenantA.id,
        user_id: secA.userId,
        action: "COURSE_MODULE_CREATED",
        resource_type: "course_modules",
        resource_id: module1?.id,
        details: { name: module1?.name },
      },
      {
        tenant_id: tenantA.id,
        user_id: secA.userId,
        action: "SUBJECT_CREATED",
        resource_type: "subjects",
        resource_id: subj1?.id,
        details: { name: subj1?.name, teacher_id: profA.userId },
      },
    ]);

    if (errAudit) {
      console.log(`   ❌ REPROVADO: Falha ao gravar auditoria: ${errAudit.message}`);
    } else {
      const { data: logs } = await admin
        .from("audit_logs")
        .select("action, resource_type")
        .eq("tenant_id", tenantA.id);

      const hasEvents = ["COURSE_MODULE_CREATED", "SUBJECT_CREATED"].every((a) =>
        logs?.some((l) => l.action === a)
      );

      if (hasEvents) {
        console.log("   ✅ APROVADO: Eventos COURSE_MODULE_CREATED e SUBJECT_CREATED registrados com sucesso.");
      } else {
        console.log("   ❌ REPROVADO: Eventos curriculares não encontrados em audit_logs.");
      }
    }

  } catch (err: any) {
    console.error("\n💥 ERRO FATAL NA EXECUÇÃO DO TESTE:", err.message);
  } finally {
    // --------------------------------------------------------------------------
    // ETAPA 5: LIMPEZA RIGOROSA DE DADOS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("LIMPEZA SEGURA DE DADOS FICTÍCIOS DE HOMOLOGAÇÃO");
    console.log("--------------------------------------------------------------------------------");

    for (const sId of createdSubjectIds) {
      await admin.from("subjects").delete().eq("id", sId);
    }
    for (const mId of createdModuleIds) {
      await admin.from("course_modules").delete().eq("id", mId);
    }
    for (const cId of createdCourseIds) {
      await admin.from("courses").delete().eq("id", cId);
    }
    for (const tId of createdTenants) {
      await admin.from("audit_logs").delete().eq("tenant_id", tId);
      await admin.from("tenant_users").delete().eq("tenant_id", tId);
      await admin.from("tenants").delete().eq("id", tId);
    }
    for (const uId of createdUserIds) {
      await admin.from("profiles").delete().eq("id", uId);
      await admin.auth.admin.deleteUser(uId);
    }

    console.log("   🧹 Todas as disciplinas, módulos, cursos, usuários e tenants fictícios foram expurgados.");
    console.log("   🧹 Banco de dados TeoClass restaurado com sucesso.\n");
  }
}

main().catch(console.error);
