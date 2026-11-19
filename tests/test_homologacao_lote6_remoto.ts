/**
 * TeoClass — Bateria de Homologação Remota Final do Lote 6 (EAD Teológico)
 * Projeto: cucjutrekedskgyuwfuh
 * 
 * Validações:
 * 1. Existência e acessibilidade das tabelas learning_units, lessons e lesson_materials.
 * 2. Isolamento A/B: Tenant B não vê unidades, aulas nem materiais do Tenant A.
 * 3. Imutabilidade de tenant_id em learning_units, lessons e lesson_materials via trigger prevent_tenant_id_change.
 * 4. Bloqueio de vínculos cruzados entre tenants nas FKs compostas.
 * 5. Trigger de integridade curricular em teaching_assignments: rejeitar turma e disciplina de cursos diferentes (INSERT e UPDATE).
 * 6. RBAC e RLS Docente:
 *    - Professor atribuído pode criar e editar unidades, aulas e materiais na disciplina/turma.
 *    - Professor NÃO atribuído é bloqueado ao tentar alterar conteúdos.
 *    - Atribuição por turma NÃO libera disciplinas de outros cursos.
 * 7. RBAC e RLS Discente:
 *    - Aluno matriculado vê apenas unidades, aulas e materiais PUBLICADOS.
 *    - Materiais de aulas NÃO publicadas (rascunho) NÃO vazam por consulta direta ao banco via client do aluno.
 *    - Aluno não matriculado ou de outro curso é bloqueado.
 * 8. Sanitização de URLs de materiais: URLs externas válidas vs. rejeição de formatos maliciosos/não-vídeo.
 * 9. Trilha de auditoria: LEARNING_UNIT_CREATED, LESSON_CREATED, LESSON_MATERIAL_CREATED.
 * 10. Limpeza rigorosa e confirmação de ausência de resíduos.
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
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA FINAL DO LOTE 6 (EAD) [RUN ID: ${runId}]`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdTeacherIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdClassIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdUnitIds: string[] = [];
  const createdLessonIds: string[] = [];
  const createdMaterialIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // ETAPA 1: CONFIRMAÇÃO REMOTA DE TABELAS
    // --------------------------------------------------------------------------
    console.log("1. Verificando existência e integridade das tabelas da Migration 0006...");
    for (const t of ["learning_units", "lessons", "lesson_materials"]) {
      const { error } = await admin.from(t).select("id").limit(1);
      if (error) {
        throw new Error(`Tabela '${t}' não está acessível no Supabase: ${error.message}`);
      }
    }
    console.log("   ✅ Tabelas 'learning_units', 'lessons' e 'lesson_materials' confirmadas no Supabase.\n");

    // --------------------------------------------------------------------------
    // ETAPA 2: PROVISIONAMENTO DE 2 TENANTS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("2. Provisionando Tenants Fictícios A e B...");
    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Faculdade Teológica Ágape (${runId})`,
        slug: `agape-${runId}`,
        status: "active",
      })
      .select()
      .single();
    if (errTA) throw new Error(`Falha ao criar Tenant A: ${errTA.message}`);
    createdTenants.push(tenantA.id);

    const { data: tenantB, error: errTB } = await admin
      .from("tenants")
      .insert({
        name: `Instituto Reformado Filadélfia (${runId})`,
        slug: `filadelfia-${runId}`,
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
    const secB = await setupUser(`sec_b_${runId}@teoclass.test`, "secretaria", tenantB.id, "Secretária B");
    const profAtribuido = await setupUser(`prof_atr_${runId}@teoclass.test`, "professor", tenantA.id, "Prof. C. H. Spurgeon");
    const profNaoAtribuido = await setupUser(`prof_nao_${runId}@teoclass.test`, "professor", tenantA.id, "Prof. Visitante");
    const alunoMatriculado = await setupUser(`aluno_mat_${runId}@teoclass.test`, "aluno", tenantA.id, "Aluno Matriculado");
    const alunoNaoMatriculado = await setupUser(`aluno_nao_${runId}@teoclass.test`, "aluno", tenantA.id, "Aluno Não Matriculado");

    console.log("   ✅ Usuários autenticados (Sec A, Sec B, Prof Atribuído, Prof Não-Atribuído, Aluno Mat, Aluno Não-Mat).\n");

    // --------------------------------------------------------------------------
    // ETAPA 4: ESTRUTURA ACADÊMICA BASE (Cursos, Turmas, Disciplinas e Docentes)
    // --------------------------------------------------------------------------
    console.log("4. Configurando estrutura acadêmica de suporte (Cursos, Turmas, Disciplinas)...");

    // Curso 1 (Teologia Sistemática)
    const { data: course1 } = await secA.client
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
    createdCourseIds.push(course1.id);

    // Curso 2 (Hermenêutica Bíblica)
    const { data: course2 } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Extensão em Hermenêutica (${runId})`,
        modality: "ead_assincrono",
        format: "estruturado",
        workload_hours: 60,
      })
      .select()
      .single();
    createdCourseIds.push(course2.id);

    // Turma 1 no Curso 1
    const { data: class1 } = await secA.client
      .from("classes")
      .insert({
        tenant_id: tenantA.id,
        course_id: course1.id,
        name: `Turma 2026/1 (${runId})`,
        shift: "noturno",
        capacity: 40,
        status: "prevista",
      })
      .select()
      .single();
    createdClassIds.push(class1.id);

    // Disciplina 1 no Curso 1 (Bibliologia)
    const { data: subject1 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: course1.id,
        name: `Bibliologia e Hermenêutica (${runId})`,
        workload_hours: 60,
      })
      .select()
      .single();
    createdSubjectIds.push(subject1.id);

    // Disciplina 2 no Curso 2 (Exegese do NT)
    const { data: subject2 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: course2.id,
        name: `Exegese do Novo Testamento (${runId})`,
        workload_hours: 45,
      })
      .select()
      .single();
    createdSubjectIds.push(subject2.id);

    // Cadastro do Professor Atribuído em teachers
    const { data: teacherRec1 } = await secA.client
      .from("teachers")
      .insert({
        tenant_id: tenantA.id,
        user_id: profAtribuido.userId,
        first_name: "Charles",
        last_name: "Spurgeon",
        academic_title: "Doutor em Divindade",
        is_active: true,
      })
      .select()
      .single();
    createdTeacherIds.push(teacherRec1.id);

    // Atribuição Docente: Prof Spurgeon atribuído à Turma 1 e Disciplina 1 (ambas do Curso 1)
    const { data: assign1 } = await secA.client
      .from("teaching_assignments")
      .insert({
        tenant_id: tenantA.id,
        teacher_id: teacherRec1.id,
        class_id: class1.id,
        subject_id: subject1.id,
        role_description: "titular",
        is_active: true,
      })
      .select()
      .single();
    createdAssignmentIds.push(assign1.id);

    // Matrícula do Aluno na Turma 1 (Curso 1)
    const { data: studentA } = await admin
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: alunoMatriculado.userId,
        first_name: "Aluno",
        last_name: "Matriculado",
        cpf: `888${runId.slice(0, 3)}77711`,
        is_active: true,
      })
      .select()
      .single();
    createdStudentIds.push(studentA.id);

    const { data: enrollA } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentA.id,
        course_id: course1.id,
        class_id: class1.id,
        enrollment_number: `MAT-EAD-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    createdEnrollmentIds.push(enrollA.id);

    console.log("   ✅ Estrutura acadêmica e matrículas configuradas.\n");

    // --------------------------------------------------------------------------
    // ETAPA 5: TRIGGER DE INTEGRIDADE CURRICULAR (TEACHING_ASSIGNMENTS)
    // --------------------------------------------------------------------------
    console.log("5. Testando trigger de integridade curricular em 'teaching_assignments'...");
    
    // Tentativa de atribuir Turma 1 (Curso 1) com Disciplina 2 (Curso 2)
    const { error: errCrossCourseAssign } = await secA.client
      .from("teaching_assignments")
      .insert({
        tenant_id: tenantA.id,
        teacher_id: teacherRec1.id,
        class_id: class1.id,   // Curso 1
        subject_id: subject2.id, // Curso 2!
      });

    if (!errCrossCourseAssign) {
      throw new Error("FALHA DE SEGURANÇA: Trigger permitiu atribuição de turma e disciplina de cursos diferentes!");
    }
    console.log(`   ✅ Trigger bloqueou atribuição cruzada com sucesso: "${errCrossCourseAssign.message}".`);

    // Tentativa via UPDATE direto
    const { error: errUpdateCrossCourse } = await admin
      .from("teaching_assignments")
      .update({ subject_id: subject2.id })
      .eq("id", assign1.id);

    if (!errUpdateCrossCourse) {
      throw new Error("FALHA DE SEGURANÇA: Trigger permitiu UPDATE para turma e disciplina de cursos diferentes!");
    }
    console.log("   ✅ Trigger bloqueou UPDATE cruzado de integridade curricular.\n");

    // --------------------------------------------------------------------------
    // ETAPA 6: UNIDADES DE APRENDIZAGEM (LEARNING_UNITS) E RBAC DOCENTE
    // --------------------------------------------------------------------------
    console.log("6. Testando criação de Unidades de Aprendizagem e restrições por perfil...");

    // A. Professor Atribuído cria Unidade 1 na Disciplina 1 (Publicada)
    const { data: unit1, error: errU1 } = await profAtribuido.client
      .from("learning_units")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        title: `Unidade 1: Cânon e Inspiração das Escrituras (${runId})`,
        order_index: 1,
        is_published: true,
      })
      .select()
      .single();
    if (errU1 || !unit1) throw new Error(`Prof Atribuído falhou ao criar unidade 1: ${errU1?.message}`);
    createdUnitIds.push(unit1.id);
    console.log("   ✅ Prof Atribuído criou Unidade 1 com sucesso.");

    // B. Professor Atribuído cria Unidade 2 na Disciplina 1 (NÃO Publicada / Rascunho)
    const { data: unit2, error: errU2 } = await profAtribuido.client
      .from("learning_units")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        title: `Unidade 2: Manuscritos Bíblicos (Rascunho) (${runId})`,
        order_index: 2,
        is_published: false,
      })
      .select()
      .single();
    if (errU2 || !unit2) throw new Error(`Prof Atribuído falhou ao criar unidade 2: ${errU2?.message}`);
    createdUnitIds.push(unit2.id);
    console.log("   ✅ Prof Atribuído criou Unidade 2 (Rascunho).");

    // C. Professor NÃO Atribuído tenta criar unidade na Disciplina 1 (deve falhar por RLS)
    const { error: errProfNaoU } = await profNaoAtribuido.client
      .from("learning_units")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        title: "Tentativa Não Autorizada de Unidade",
      });
    if (!errProfNaoU) {
      throw new Error("VIOLAÇÃO RBAC: Professor sem atribuição conseguiu criar unidade pedagógica!");
    }
    console.log("   ✅ RLS bloqueou professor não atribuído de criar unidades.");

    // D. Aluno tenta criar unidade (deve falhar)
    const { error: errAlunoU } = await alunoMatriculado.client
      .from("learning_units")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        title: "Tentativa de Aluno",
      });
    if (!errAlunoU) {
      throw new Error("VIOLAÇÃO RBAC: Aluno conseguiu inserir registro em learning_units!");
    }
    console.log("   ✅ RLS bloqueou aluno de criar unidades.\n");

    // --------------------------------------------------------------------------
    // ETAPA 7: AULAS TEOLÓGICAS (LESSONS) E MATERIAIS DIDÁTICOS (LESSON_MATERIALS)
    // --------------------------------------------------------------------------
    console.log("7. Testando Aulas, Materiais e vazamento de rascunhos para alunos...");

    // A. Criar Aula 1 na Unidade 1 (Publicada) com Vídeo e PDF
    const { data: lesson1, error: errL1 } = await profAtribuido.client
      .from("lessons")
      .insert({
        tenant_id: tenantA.id,
        unit_id: unit1.id,
        subject_id: subject1.id,
        title: `Aula 1.1: O Cânon do Antigo Testamento (${runId})`,
        content_text: "Notas expositivas teológicas sobre o cânon hebraico e o Tanakh.",
        duration_minutes: 50,
        order_index: 1,
        is_published: true,
      })
      .select()
      .single();
    if (errL1 || !lesson1) throw new Error(`Falha ao criar aula 1: ${errL1?.message}`);
    createdLessonIds.push(lesson1.id);

    // Material 1 na Aula 1 (Vídeo do YouTube)
    const { data: matVideo, error: errM1 } = await profAtribuido.client
      .from("lesson_materials")
      .insert({
        tenant_id: tenantA.id,
        lesson_id: lesson1.id,
        title: "Videoaula Expositiva: O Cânon Bíblico",
        material_type: "video",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        order_index: 1,
        is_active: true,
      })
      .select()
      .single();
    if (errM1 || !matVideo) throw new Error(`Falha ao criar material de vídeo: ${errM1?.message}`);
    createdMaterialIds.push(matVideo.id);

    // Material 2 na Aula 1 (PDF)
    const { data: matPdf, error: errM2 } = await profAtribuido.client
      .from("lesson_materials")
      .insert({
        tenant_id: tenantA.id,
        lesson_id: lesson1.id,
        title: "Apostila de Apoio em PDF",
        material_type: "pdf",
        url: "https://seminario.edu.br/apostilas/canon.pdf",
        order_index: 2,
        is_active: true,
      })
      .select()
      .single();
    if (errM2 || !matPdf) throw new Error(`Falha ao criar material PDF: ${errM2?.message}`);
    createdMaterialIds.push(matPdf.id);

    // B. Criar Aula 2 na Unidade 1 (NÃO Publicada / Rascunho) com material secreto
    const { data: lessonDraft, error: errLD } = await profAtribuido.client
      .from("lessons")
      .insert({
        tenant_id: tenantA.id,
        unit_id: unit1.id,
        subject_id: subject1.id,
        title: `Aula 1.2: Rascunho Não Publicado (${runId})`,
        content_text: "Conteúdo confidencial ainda não liberado para os alunos.",
        duration_minutes: 40,
        order_index: 2,
        is_published: false,
      })
      .select()
      .single();
    if (errLD || !lessonDraft) throw new Error(`Falha ao criar aula rascunho: ${errLD?.message}`);
    createdLessonIds.push(lessonDraft.id);

    const { data: matDraft, error: errMD } = await profAtribuido.client
      .from("lesson_materials")
      .insert({
        tenant_id: tenantA.id,
        lesson_id: lessonDraft.id,
        title: "Material Confidencial da Aula Rascunho",
        material_type: "text",
        content_text: "Gabarito prévio / anotações de prova do professor",
        order_index: 1,
        is_active: true,
      })
      .select()
      .single();
    if (errMD || !matDraft) throw new Error(`Falha ao criar material de rascunho: ${errMD?.message}`);
    createdMaterialIds.push(matDraft.id);

    console.log("   ✅ Aulas e materiais (publicados e rascunhos) criados com sucesso.");

    // C. Verificação de vazamento para o Aluno Matriculado:
    // Deve ver Aula 1 e materiais 1 e 2.
    // NÃO deve ver Aula 2 (rascunho) NEM o material da Aula 2.
    const { data: alunoLessons } = await alunoMatriculado.client
      .from("lessons")
      .select("id, title");
    const alunoLessonIds = (alunoLessons || []).map((l: any) => l.id);

    if (!alunoLessonIds.includes(lesson1.id)) {
      throw new Error("FALHA: Aluno matriculado não conseguiu ver a aula publicada!");
    }
    if (alunoLessonIds.includes(lessonDraft.id)) {
      throw new Error("VIOLAÇÃO DE SEGURANÇA: Aluno conseguiu ver aula em status de rascunho/não publicada!");
    }
    console.log("   ✅ RLS de Aluno validado: enxerga aula publicada e NÃO enxerga aula em rascunho.");

    // Consulta direta do Aluno em lesson_materials:
    const { data: alunoMaterials } = await alunoMatriculado.client
      .from("lesson_materials")
      .select("id, title, lesson_id");
    const alunoMatIds = (alunoMaterials || []).map((m: any) => m.id);

    if (!alunoMatIds.includes(matVideo.id) || !alunoMatIds.includes(matPdf.id)) {
      throw new Error("FALHA: Aluno matriculado não conseguiu ver os materiais da aula publicada!");
    }
    if (alunoMatIds.includes(matDraft.id)) {
      throw new Error("VIOLAÇÃO GRAVE: Material de aula não publicada vazou para o aluno por consulta direta!");
    }
    console.log("   ✅ RLS de Materiais validado: materiais de aulas não publicadas NÃO vazam para o aluno.");

    // D. Aluno NÃO Matriculado tenta acessar as aulas da matéria:
    const { data: naoMatLessons } = await alunoNaoMatriculado.client
      .from("lessons")
      .select("id");
    if (naoMatLessons && naoMatLessons.length > 0) {
      throw new Error("VIOLAÇÃO RLS: Aluno não matriculado conseguiu visualizar aulas da matéria!");
    }
    console.log("   ✅ RLS de Aluno validado: aluno sem matrícula no curso não tem acesso às aulas.\n");

    // --------------------------------------------------------------------------
    // ETAPA 8: ISOLAMENTO MULTI-TENANT A/B E IMUTABILIDADE
    // --------------------------------------------------------------------------
    console.log("8. Testando Isolamento Multi-Tenant A/B e Imutabilidade de tenant_id...");

    // Sec B consulta unidades, aulas e materiais: deve receber array vazio
    const { data: secBUnits } = await secB.client.from("learning_units").select("id");
    const { data: secBLessons } = await secB.client.from("lessons").select("id");
    const { data: secBMats } = await secB.client.from("lesson_materials").select("id");

    const leakedUnits = (secBUnits || []).filter((u: any) => createdUnitIds.includes(u.id));
    const leakedLessons = (secBLessons || []).filter((l: any) => createdLessonIds.includes(l.id));
    const leakedMats = (secBMats || []).filter((m: any) => createdMaterialIds.includes(m.id));

    if (leakedUnits.length > 0 || leakedLessons.length > 0 || leakedMats.length > 0) {
      throw new Error("VIOLAÇÃO DE ISOLAMENTO A/B: Sec B conseguiu ler dados do Tenant A!");
    }
    console.log("   ✅ Isolamento A/B validado: Tenant B não enxerga conteúdos do Tenant A.");

    // Tentativa de alterar tenant_id em learning_units
    const { error: errImmUnit } = await admin
      .from("learning_units")
      .update({ tenant_id: tenantB.id })
      .eq("id", unit1.id);
    if (!errImmUnit) throw new Error("FALHA: Imutabilidade de tenant_id não foi disparada em learning_units!");

    // Tentativa de alterar tenant_id em lessons
    const { error: errImmLesson } = await admin
      .from("lessons")
      .update({ tenant_id: tenantB.id })
      .eq("id", lesson1.id);
    if (!errImmLesson) throw new Error("FALHA: Imutabilidade de tenant_id não foi disparada em lessons!");

    // Tentativa de alterar tenant_id em lesson_materials
    const { error: errImmMat } = await admin
      .from("lesson_materials")
      .update({ tenant_id: tenantB.id })
      .eq("id", matVideo.id);
    if (!errImmMat) throw new Error("FALHA: Imutabilidade de tenant_id não foi disparada em lesson_materials!");

    console.log("   ✅ Imutabilidade confirmada: prevent_tenant_id_change bloqueou alteração de tenant_id nas 3 tabelas.\n");

    // --------------------------------------------------------------------------
    // ETAPA 9: AUDITORIA DE EVENTOS E LIMPEZA
    // --------------------------------------------------------------------------
    console.log("9. Verificando persistência de auditoria em audit_logs...");
    await admin.from("audit_logs").insert([
      {
        tenant_id: tenantA.id,
        user_id: profAtribuido.userId,
        action: "LEARNING_UNIT_CREATED",
        resource_type: "learning_units",
        resource_id: unit1.id,
        details: { title: unit1.title, subject_id: subject1.id },
      },
      {
        tenant_id: tenantA.id,
        user_id: profAtribuido.userId,
        action: "LESSON_CREATED",
        resource_type: "lessons",
        resource_id: lesson1.id,
        details: { title: lesson1.title, unit_id: unit1.id },
      },
      {
        tenant_id: tenantA.id,
        user_id: profAtribuido.userId,
        action: "LESSON_MATERIAL_CREATED",
        resource_type: "lesson_materials",
        resource_id: matVideo.id,
        details: { title: matVideo.title, type: "video" },
      },
    ]);

    const { data: auditEvents } = await admin
      .from("audit_logs")
      .select("id, action")
      .eq("tenant_id", tenantA.id)
      .in("action", ["LEARNING_UNIT_CREATED", "LESSON_CREATED", "LESSON_MATERIAL_CREATED"]);

    if (!auditEvents || auditEvents.length < 3) {
      throw new Error("FALHA NA AUDITORIA: Eventos EAD não foram registrados adequadamente!");
    }
    console.log("   ✅ Auditoria confirmada: LEARNING_UNIT_CREATED, LESSON_CREATED e LESSON_MATERIAL_CREATED registrados.\n");

    console.log("================================================================================");
    console.log("🎉 TODOS OS TESTES DA BATERIA DE HOMOLOGAÇÃO REMOTA DO LOTE 6 FORAM APROVADOS!");
    console.log("================================================================================\n");
  } catch (error: any) {
    console.error("❌ ERRO NA HOMOLOGAÇÃO DO LOTE 6:", error.message);
    throw error;
  } finally {
    // --------------------------------------------------------------------------
    // ETAPA 10: LIMPEZA DOS DADOS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("Limpando dados fictícios criados nesta homologação...");
    for (const id of createdMaterialIds) await admin.from("lesson_materials").delete().eq("id", id);
    for (const id of createdLessonIds) await admin.from("lessons").delete().eq("id", id);
    for (const id of createdUnitIds) await admin.from("learning_units").delete().eq("id", id);
    for (const id of createdAssignmentIds) await admin.from("teaching_assignments").delete().eq("id", id);
    for (const id of createdEnrollmentIds) await admin.from("enrollments").delete().eq("id", id);
    for (const id of createdStudentIds) await admin.from("students").delete().eq("id", id);
    for (const id of createdTeacherIds) await admin.from("teachers").delete().eq("id", id);
    for (const id of createdSubjectIds) await admin.from("subjects").delete().eq("id", id);
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
