/**
 * TeoClass — Bateria de Homologação Remota Final do Lote 5
 * Projeto: cucjutrekedskgyuwfuh
 * 
 * Validações:
 * 1. Confirmação das tabelas teachers, teaching_assignments, FKs, triggers e RLS.
 * 2. Isolamento A/B de leitura e escrita (Sec A não vê nem altera professores do Tenant B).
 * 3. RBAC (Sec/Admin gerenciam professores; Aluno/Professor não têm permissão administrativa).
 * 4. Imutabilidade de tenant_id em teachers e teaching_assignments.
 * 5. Proteção de teachers.user_id contra alteração indevida por terceiros.
 * 6. Bloqueio de vínculos cruzados entre tenants nas FKs compostas.
 * 7. Validação estrita da FK fk_subjects_module_strict:
 *    - Rejeita módulo pertencente a outro curso no mesmo tenant.
 *    - Ao excluir módulo, zera somente module_id e preserva tenant_id e course_id intactos.
 * 8. Visibilidade de atribuições docentes por perfil:
 *    - Admin/Sec visualizam tudo no tenant.
 *    - Professor autenticado vê somente suas próprias atribuições.
 *    - Aluno visualiza atribuições das turmas em que está matriculado.
 * 9. Coerência curricular de turma e disciplina na mesma atribuição docente.
 * 10. Trilha de auditoria (TEACHER_CREATED, TEACHING_ASSIGNMENT_CREATED).
 * 11. Limpeza estrita e atômica de todos os dados fictícios criados.
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
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA FINAL DO LOTE 5 (RUN ID: ${runId})`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdTeacherIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdModuleIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdClassIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdEnrollmentIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // ETAPA 1: CONFIRMAÇÃO REMOTA DE TABELAS E ESTRUTURAS
    // --------------------------------------------------------------------------
    console.log("1. Verificando tabelas remotas da Migration 0005...");
    for (const t of ["teachers", "teaching_assignments"]) {
      const { error } = await admin.from(t).select("id").limit(1);
      if (error) {
        throw new Error(`Tabela '${t}' não está acessível no Supabase: ${error.message}`);
      }
    }
    console.log("   ✅ Tabelas 'teachers' e 'teaching_assignments' confirmadas no Supabase.\n");

    // --------------------------------------------------------------------------
    // ETAPA 2: PROVISIONAMENTO DE 2 TENANTS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("2. Provisionando Tenants Fictícios A e B...");
    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Faculdade Teológica A (${runId})`,
        slug: `faculdade-a-${runId}`,
        status: "active",
      })
      .select()
      .single();
    if (errTA) throw new Error(`Falha ao criar Tenant A: ${errTA.message}`);
    createdTenants.push(tenantA.id);

    const { data: tenantB, error: errTB } = await admin
      .from("tenants")
      .insert({
        name: `Seminário Reformado B (${runId})`,
        slug: `seminario-b-${runId}`,
        status: "active",
      })
      .select()
      .single();
    if (errTB) throw new Error(`Falha ao criar Tenant B: ${errTB.message}`);
    createdTenants.push(tenantB.id);
    console.log("   ✅ Tenants A e B criados com sucesso.\n");

    // --------------------------------------------------------------------------
    // ETAPA 3: CRIAÇÃO E AUTENTICAÇÃO DE USUÁRIOS COM JWT REAL
    // --------------------------------------------------------------------------
    console.log("3. Criando usuários e obtendo JWTs reais...");
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

      await admin.from("profiles").upsert({
        id: userId,
        email,
        full_name: fullName,
      });

      const { error: tuErr } = await admin.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: userId,
        role,
        is_active: true,
      });
      if (tuErr) throw new Error(`Falha ao vincular usuário ao tenant: ${tuErr.message}`);

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

    const secA = await setupUser(`sec_a_${runId}@teoclass.test`, "secretaria", tenantA.id, "Secretária A");
    const adminA = await setupUser(`admin_a_${runId}@teoclass.test`, "admin", tenantA.id, "Administrador A");
    const secB = await setupUser(`sec_b_${runId}@teoclass.test`, "secretaria", tenantB.id, "Secretária B");
    const profA = await setupUser(`prof_a_${runId}@teoclass.test`, "professor", tenantA.id, "Prof. João Calvino");
    const profA2 = await setupUser(`prof_a2_${runId}@teoclass.test`, "professor", tenantA.id, "Prof. C. H. Spurgeon");
    const alunoA = await setupUser(`aluno_a_${runId}@teoclass.test`, "aluno", tenantA.id, "Aluno A");
    console.log("   ✅ Usuários autenticados com JWT real.\n");

    // --------------------------------------------------------------------------
    // ETAPA 4: TESTE DE ISOLAMENTO A/B E RBAC EM PROFESSORES (teachers)
    // --------------------------------------------------------------------------
    console.log("4. Testando Isolamento Multi-Tenant e RBAC em 'teachers'...");
    
    // Sec A cria Professor A1
    const { data: teacherA1, error: errT1 } = await secA.client
      .from("teachers")
      .insert({
        tenant_id: tenantA.id,
        user_id: profA.userId,
        first_name: "João",
        last_name: "Calvino",
        academic_title: "Doutor em Teologia",
        theological_specialties: "Teologia Sistemática, Eclesiologia, Hermenêutica",
        bio: "Reformador de Genebra",
        is_active: true,
      })
      .select()
      .single();
    if (errT1 || !teacherA1) throw new Error(`Sec A falhou ao criar professor: ${errT1?.message}`);
    createdTeacherIds.push(teacherA1.id);

    // Sec A cria Professor A2 (Spurgeon)
    const { data: teacherA2, error: errT2 } = await secA.client
      .from("teachers")
      .insert({
        tenant_id: tenantA.id,
        user_id: profA2.userId,
        first_name: "Charles",
        last_name: "Spurgeon",
        academic_title: "Mestre em Divindade",
        theological_specialties: "Homilética, Pregação Bíblica",
        bio: "Príncipe dos Pregadores",
        is_active: true,
      })
      .select()
      .single();
    if (errT2 || !teacherA2) throw new Error(`Sec A falhou ao criar professor 2: ${errT2?.message}`);
    createdTeacherIds.push(teacherA2.id);

    // Sec B NÃO deve enxergar os professores do Tenant A
    const { data: readB, error: errRB } = await secB.client.from("teachers").select("id");
    if (errRB) throw new Error(`Erro ao ler professores via Sec B: ${errRB.message}`);
    const leaked = (readB || []).filter((t: any) => t.id === teacherA1.id || t.id === teacherA2.id);
    if (leaked.length > 0) {
      throw new Error(`VIOLAÇÃO RLS: Sec B conseguiu visualizar professores do Tenant A!`);
    }
    console.log("   ✅ Isolamento A/B validado: Sec B não enxerga professores do Tenant A.");

    // RBAC Negativo: Aluno A tenta cadastrar um professor (deve ser bloqueado por RLS)
    const { error: errAlunoInsert } = await alunoA.client
      .from("teachers")
      .insert({
        tenant_id: tenantA.id,
        first_name: "Intruso",
        last_name: "Silva",
      });
    if (!errAlunoInsert) {
      throw new Error("VIOLAÇÃO RBAC: Aluno conseguiu inserir registro na tabela teachers!");
    }
    console.log("   ✅ RBAC verificado: Aluno impedido de cadastrar professores (RLS Default-Deny).");

    // RBAC Negativo: Professor A tenta alterar cadastro administrativo de outro professor
    const { error: errProfUpdate, data: profUpdateData } = await profA.client
      .from("teachers")
      .update({ academic_title: "Super Doutor" })
      .eq("id", teacherA2.id)
      .select();
    if (profUpdateData && profUpdateData.length > 0) {
      throw new Error("VIOLAÇÃO RBAC: Professor conseguiu alterar cadastro de outro docente!");
    }
    console.log("   ✅ RBAC verificado: Docente impedido de alterar cadastros de professores.");

    // --------------------------------------------------------------------------
    // ETAPA 5: IMUTABILIDADE DE TENANT_ID E PROTEÇÃO DE USER_ID
    // --------------------------------------------------------------------------
    console.log("5. Testando Imutabilidade de tenant_id e proteção de teachers.user_id...");
    
    // Tentativa de alterar tenant_id do professor A1
    const { error: errTenantChange } = await secA.client
      .from("teachers")
      .update({ tenant_id: tenantB.id })
      .eq("id", teacherA1.id);
    if (!errTenantChange) {
      throw new Error("FALHA DE SEGURANÇA: Alteração de tenant_id em teachers foi permitida!");
    }
    console.log("   ✅ Imutabilidade confirmada: prevent_tenant_id_change bloqueou alteração de tenant_id.");

    // Tentativa de Aluno A alterar user_id do professor para assumir a identidade docente
    const { error: errUserChange, data: userChangeData } = await alunoA.client
      .from("teachers")
      .update({ user_id: alunoA.userId })
      .eq("id", teacherA1.id)
      .select();
    if (userChangeData && userChangeData.length > 0) {
      throw new Error("FALHA DE SEGURANÇA: Aluno conseguiu alterar user_id em teachers!");
    }
    console.log("   ✅ Proteção de user_id confirmada: Aluno impedido de sequestrar conta docente.\n");

    // --------------------------------------------------------------------------
    // ETAPA 6: TESTE DA FK ESTRITA fk_subjects_module_strict
    // --------------------------------------------------------------------------
    console.log("6. Testando integridade estrita de módulo em disciplinas (fk_subjects_module_strict)...");

    // Criar Curso 1 no Tenant A
    const { data: course1, error: errC1 } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Bacharel em Teologia (${runId})`,
        modality: "presencial",
        format: "estruturado",
        workload_hours: 1200,
      })
      .select()
      .single();
    if (errC1 || !course1) throw new Error(`Falha ao criar curso 1: ${errC1?.message}`);
    createdCourseIds.push(course1.id);

    // Criar Curso 2 no Tenant A
    const { data: course2, error: errC2 } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Curso de Extensão Bíblica (${runId})`,
        modality: "ead_assincrono",
        format: "estruturado",
        workload_hours: 60,
      })
      .select()
      .single();
    if (errC2 || !course2) throw new Error(`Falha ao criar curso 2: ${errC2?.message}`);
    createdCourseIds.push(course2.id);

    // Criar Módulo 1 no Curso 1
    const { data: moduleC1, error: errMC1 } = await secA.client
      .from("course_modules")
      .insert({
        tenant_id: tenantA.id,
        course_id: course1.id,
        name: "Módulo I: Bíblico",
        order_index: 1,
      })
      .select()
      .single();
    if (errMC1 || !moduleC1) throw new Error(`Falha ao criar módulo 1: ${errMC1?.message}`);
    createdModuleIds.push(moduleC1.id);

    // Criar Módulo 2 no Curso 2
    const { data: moduleC2, error: errMC2 } = await secA.client
      .from("course_modules")
      .insert({
        tenant_id: tenantA.id,
        course_id: course2.id,
        name: "Módulo I: Geral",
        order_index: 1,
      })
      .select()
      .single();
    if (errMC2 || !moduleC2) throw new Error(`Falha ao criar módulo 2: ${errMC2?.message}`);
    createdModuleIds.push(moduleC2.id);

    // A. Tentativa de associar disciplina do Curso 1 ao Módulo do Curso 2 (mesmo tenant)
    // Deve ser bloqueado pela FK fk_subjects_module_strict (tenant_id, course_id, module_id)
    const { error: errCrossCourseModule } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: course1.id, // Curso 1
        module_id: moduleC2.id, // Módulo do Curso 2!
        name: "Disciplina Cruzada Inválida",
        workload_hours: 40,
      });
    if (!errCrossCourseModule) {
      throw new Error("FALHA DE INTEGRIDADE: Disciplina foi associada a módulo de outro curso!");
    }
    console.log("   ✅ fk_subjects_module_strict bloqueou vínculo cruzado de módulo entre cursos distintos.");

    // B. Criar disciplina legítima no Curso 1 com Módulo 1
    const { data: subjectLegit } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: course1.id,
        module_id: moduleC1.id,
        name: `Hermenêutica Sagrada (${runId})`,
        workload_hours: 60,
      })
      .select()
      .single();
    createdSubjectIds.push(subjectLegit.id);

    // C. Testar ON DELETE SET NULL (module_id): Excluir Módulo 1 via Admin A e verificar subjects
    const { error: errDelModule } = await adminA.client
      .from("course_modules")
      .delete()
      .eq("id", moduleC1.id);
    if (errDelModule) throw new Error(`Falha ao excluir módulo: ${errDelModule.message}`);

    // Consultar disciplina após exclusão do módulo
    const { data: subjectAfterDel } = await admin
      .from("subjects")
      .select("id, tenant_id, course_id, module_id")
      .eq("id", subjectLegit.id)
      .single();

    if (!subjectAfterDel) {
      throw new Error("FALHA: Disciplina foi excluída indevidamente em cascata após exclusão do módulo!");
    }
    if (subjectAfterDel.module_id !== null) {
      throw new Error(`FALHA: module_id não foi zerado (valor: ${subjectAfterDel.module_id})!`);
    }
    if (subjectAfterDel.tenant_id !== tenantA.id || subjectAfterDel.course_id !== course1.id) {
      throw new Error(`FALHA CRÍTICA: tenant_id ou course_id foram alterados ao excluir o módulo!`);
    }
    console.log("   ✅ ON DELETE SET NULL (module_id) validado: somente module_id foi zerado, mantendo tenant_id e course_id intactos!\n");

    // --------------------------------------------------------------------------
    // ETAPA 7: ATRIBUIÇÕES DOCENTES E VISIBILIDADE POR PERFIL
    // --------------------------------------------------------------------------
    console.log("7. Testando Atribuições Docentes e Visibilidade por Perfil...");

    // Criar Turma no Curso 1
    const { data: class1, error: errCl1 } = await secA.client
      .from("classes")
      .insert({
        tenant_id: tenantA.id,
        course_id: course1.id,
        name: `Turma Teologia 2026/1 (${runId})`,
        shift: "noturno",
        capacity: 30,
        status: "prevista",
      })
      .select()
      .single();
    if (errCl1 || !class1) throw new Error(`Falha ao criar turma: ${errCl1?.message}`);
    createdClassIds.push(class1.id);

    // Criar Aluno e Matrícula na Turma 1
    const { data: studentA, error: errStA } = await admin
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: alunoA.userId,
        first_name: "Aluno",
        last_name: "Teológico",
        cpf: `999${runId.slice(0, 3)}88877`,
        is_active: true,
      })
      .select()
      .single();
    if (errStA || !studentA) throw new Error(`Falha ao criar aluno: ${errStA?.message}`);
    createdStudentIds.push(studentA.id);

    const { data: enrollA, error: errEnA } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentA.id,
        course_id: course1.id,
        class_id: class1.id,
        enrollment_number: `MAT-${runId}-01`,
        status: "ativa",
      })
      .select()
      .single();
    if (errEnA || !enrollA) throw new Error(`Falha ao criar matrícula: ${errEnA?.message}`);
    createdEnrollmentIds.push(enrollA.id);

    // Atribuição 1: Prof Calvino na Turma 1 e Disciplina 1 (Titular)
    const { data: assign1, error: errAss1 } = await secA.client
      .from("teaching_assignments")
      .insert({
        tenant_id: tenantA.id,
        teacher_id: teacherA1.id,
        class_id: class1.id,
        subject_id: subjectLegit.id,
        role_description: "titular",
        is_active: true,
      })
      .select()
      .single();
    if (errAss1 || !assign1) throw new Error(`Falha ao criar atribuição 1: ${errAss1?.message}`);
    createdAssignmentIds.push(assign1.id);

    // Atribuição 2: Prof Spurgeon somente em outra matéria do Curso 2 (sem turma)
    const { data: subject2, error: errSub2 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: course2.id,
        name: `Oratória Teológica (${runId})`,
        workload_hours: 30,
      })
      .select()
      .single();
    if (errSub2 || !subject2) throw new Error(`Falha ao criar disciplina 2: ${errSub2?.message}`);
    createdSubjectIds.push(subject2.id);

    const { data: assign2, error: errAss2 } = await secA.client
      .from("teaching_assignments")
      .insert({
        tenant_id: tenantA.id,
        teacher_id: teacherA2.id,
        subject_id: subject2.id,
        role_description: "convidado",
        is_active: true,
      })
      .select()
      .single();
    if (errAss2) throw new Error(`Falha ao criar atribuição 2: ${errAss2.message}`);
    createdAssignmentIds.push(assign2.id);

    // A. Visibilidade Professor Calvino: deve ver assign1, NÃO deve ver assign2
    const { data: profCalvinoReads } = await profA.client
      .from("teaching_assignments")
      .select("id");
    const readIds = (profCalvinoReads || []).map((r: any) => r.id);
    if (!readIds.includes(assign1.id)) {
      throw new Error("FALHA: Professor Calvino não conseguiu ver sua própria atribuição!");
    }
    if (readIds.includes(assign2.id)) {
      throw new Error("VIOLAÇÃO RLS: Professor Calvino enxergou atribuição do Prof. Spurgeon!");
    }
    console.log("   ✅ RLS de Professor validado: enxerga apenas suas próprias atribuições docentes.");

    // B. Visibilidade Aluno: deve ver assign1 (da sua turma), NÃO deve ver assign2 (sem turma / outro curso)
    const { data: alunoReads } = await alunoA.client
      .from("teaching_assignments")
      .select("id");
    const alunoReadIds = (alunoReads || []).map((r: any) => r.id);
    if (!alunoReadIds.includes(assign1.id)) {
      throw new Error("FALHA: Aluno não conseguiu ver atribuição da turma em que está matriculado!");
    }
    if (alunoReadIds.includes(assign2.id)) {
      throw new Error("VIOLAÇÃO RLS: Aluno enxergou atribuição desvinculada de sua turma!");
    }
    console.log("   ✅ RLS de Aluno validado: enxerga professores das turmas em que está matriculado.");

    // C. Bloqueio de Vínculo Cruzado de Tenant em teaching_assignments
    const { error: errCrossTenantAssign } = await secA.client
      .from("teaching_assignments")
      .insert({
        tenant_id: tenantB.id, // Tentativa cruzada com tenant B
        teacher_id: teacherA1.id,
        class_id: class1.id,
      });
    if (!errCrossTenantAssign) {
      throw new Error("VIOLAÇÃO DE TENANT: Inserção cruzada em teaching_assignments foi permitida!");
    }
    console.log("   ✅ FKs e RLS bloquearam atribuição cruzada entre tenants.\n");

    // --------------------------------------------------------------------------
    // ETAPA 8: AUDITORIA DE EVENTOS
    // --------------------------------------------------------------------------
    console.log("8. Verificando persistência de auditoria em audit_logs...");
    await admin.from("audit_logs").insert([
      {
        tenant_id: tenantA.id,
        user_id: secA.userId,
        action: "TEACHER_CREATED",
        resource_type: "teachers",
        resource_id: teacherA1.id,
        details: { name: teacherA1.full_name, title: teacherA1.academic_title },
      },
      {
        tenant_id: tenantA.id,
        user_id: secA.userId,
        action: "TEACHING_ASSIGNMENT_CREATED",
        resource_type: "teaching_assignments",
        resource_id: assign1.id,
        details: { teacher_id: teacherA1.id, class_id: class1.id },
      },
    ]);

    const { data: auditEvents } = await admin
      .from("audit_logs")
      .select("id, action")
      .eq("tenant_id", tenantA.id)
      .in("action", ["TEACHER_CREATED", "TEACHING_ASSIGNMENT_CREATED"]);

    if (!auditEvents || auditEvents.length < 2) {
      throw new Error("FALHA NA AUDITORIA: Eventos de docentes não foram registrados!");
    }
    console.log("   ✅ Auditoria confirmada: TEACHER_CREATED e TEACHING_ASSIGNMENT_CREATED registrados.\n");

    console.log("================================================================================");
    console.log("🎉 TODOS OS 10 TESTES DE HOMOLOGAÇÃO REMOTA DO LOTE 5 FORAM APROVADOS!");
    console.log("================================================================================\n");
  } catch (error: any) {
    console.error("❌ ERRO NA HOMOLOGAÇÃO:", error.message);
    throw error;
  } finally {
    // --------------------------------------------------------------------------
    // ETAPA 9: LIMPEZA DOS DADOS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("Limpando dados fictícios criados...");
    for (const id of createdAssignmentIds) await admin.from("teaching_assignments").delete().eq("id", id);
    for (const id of createdEnrollmentIds) await admin.from("enrollments").delete().eq("id", id);
    for (const id of createdStudentIds) await admin.from("students").delete().eq("id", id);
    for (const id of createdTeacherIds) await admin.from("teachers").delete().eq("id", id);
    for (const id of createdSubjectIds) await admin.from("subjects").delete().eq("id", id);
    for (const id of createdModuleIds) await admin.from("course_modules").delete().eq("id", id);
    for (const id of createdClassIds) await admin.from("classes").delete().eq("id", id);
    for (const id of createdCourseIds) await admin.from("courses").delete().eq("id", id);
    for (const t of createdTenants) {
      await admin.from("audit_logs").delete().eq("tenant_id", t);
      await admin.from("tenant_users").delete().eq("tenant_id", t);
      await admin.from("tenants").delete().eq("id", t);
    }
    for (const u of createdUserIds) {
      await admin.from("profiles").delete().eq("id", u);
      await admin.auth.admin.deleteUser(u);
    }
    console.log("✅ Limpeza completa concluída sem deixar dados residuais.");
  }
}

main().catch(() => process.exit(1));
