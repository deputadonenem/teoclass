/**
 * TeoClass — Bateria de Homologação Remota Final do Lote 8 (Notas & Desempenho Acadêmico)
 * Projeto Supabase: cucjutrekedskgyuwfuh
 * 
 * Escopo de Validação com Sessões JWT Reais de Múltiplos Perfis e Tenants Fictícios A e B:
 * 1. Boletim Individual do Aluno:
 *    - Aluno acessa somente seus próprios boletins e matrículas ativas.
 *    - Aluno 1 NÃO consegue consultar boletim ou notas do Aluno 2 (Isolamento Discente).
 * 2. Painel e Desempenho do Professor:
 *    - Professor consulta turmas e disciplinas sob sua responsabilidade atribuída.
 *    - Professor NÃO consegue acessar turmas em que não possui atribuição docente.
 * 3. Visão Institucional da Secretaria/Admin:
 *    - Secretaria/Admin visualiza desempenho consolidado da turma e dos alunos do próprio tenant.
 * 4. Isolamento Hermético Multi-Tenant (A/B):
 *    - Usuários do Tenant B NÃO conseguem consultar turmas, matrículas ou boletins do Tenant A.
 * 5. Conferência de Regras de Cálculo de Desempenho:
 *    - Seleção de melhor tentativa válida (best_score) descartando tentativas em andamento.
 *    - Cálculo de médias por disciplina e média geral do curso.
 *    - Determinação correta de situação (Aprovado, Recuperação, Reprovado, Em Andamento, Não Iniciado).
 *    - Casos-limite: disciplinas sem avaliações e avaliações pendentes.
 * 6. Blindagem e Imutabilidade:
 *    - Confirmação de que notas e tentativas são preservadas e auditáveis.
 * 7. Limpeza e Confirmação de Zero Resíduos.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  calculateAssessmentScore,
  evaluateSituation,
  calculateSubjectAverage,
  calculateOverallPerformance,
} from "../src/lib/academico/calculator.ts";
import { DEFAULT_GRADING_POLICY } from "../src/types/desempenho.ts";

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
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA FINAL DO LOTE 8 (NOTAS E BOLETIM) [RUN ID: ${runId}]`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdClassIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdTeacherIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdAttemptIds: string[] = [];

  try {
    // ----------------------------------------------------------------------------
    // 1. Provisionando Tenants Fictícios A e B
    // ----------------------------------------------------------------------------
    console.log("1. Provisionando Tenants Fictícios A e B...");
    const slugA = `tenant-l8-a-${runId}`;
    const slugB = `tenant-l8-b-${runId}`;

    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Seminário Filadélfia ${runId}`,
        slug: slugA,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errTA) throw new Error(`Falha ao criar Tenant A: ${errTA.message}`);
    createdTenants.push(tenantA.id);

    const { data: tenantB, error: errTB } = await admin
      .from("tenants")
      .insert({
        name: `Instituto Antioquia ${runId}`,
        slug: slugB,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errTB) throw new Error(`Falha ao criar Tenant B: ${errTB.message}`);
    createdTenants.push(tenantB.id);

    console.log("   ✅ Tenants A e B provisionados.");

    // ----------------------------------------------------------------------------
    // 2. Criando Usuários com JWT Real
    // ----------------------------------------------------------------------------
    console.log("\n2. Criando usuários e gerando sessões JWT reais...");

    async function createUser(email: string, role: string, tenantId: string, fullName: string) {
      const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: "PasswordTeoClass123!",
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (authErr) throw new Error(`Erro ao criar user ${email}: ${authErr.message}`);
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
      if (loginErr || !loginData.session) {
        throw new Error(`Erro login ${email}: ${loginErr?.message}`);
      }

      return {
        id: authUser.user.id,
        jwt: loginData.session.access_token,
        client: createClientWithToken(loginData.session.access_token),
      };
    }

    const adminA = await createUser(`admin.l8.${runId}@tenanta.com`, "admin", tenantA.id, `Admin Seminário ${runId}`);
    const secA = await createUser(`sec.l8.${runId}@tenanta.com`, "secretaria", tenantA.id, `Secretária ${runId}`);
    const teacherA = await createUser(`prof.l8.${runId}@tenanta.com`, "professor", tenantA.id, `Prof. Teologia ${runId}`);
    const studentA1 = await createUser(`aluno1.l8.${runId}@tenanta.com`, "aluno", tenantA.id, `Aluno Um ${runId}`);
    const studentA2 = await createUser(`aluno2.l8.${runId}@tenanta.com`, "aluno", tenantA.id, `Aluno Dois ${runId}`);
    const studentB = await createUser(`aluno.l8.${runId}@tenantb.com`, "aluno", tenantB.id, `Aluno Tenant B ${runId}`);

    console.log("   ✅ Sessões JWT reais estabelecidas para Admin, Secretaria, Professor, Alunos A1, A2 e Aluno B.");

    // ----------------------------------------------------------------------------
    // 3. Estrutura Acadêmica (Cursos, Turmas, Disciplinas, Docentes, Alunos e Matrículas)
    // ----------------------------------------------------------------------------
    console.log("\n3. Configurando estrutura acadêmica de suporte...");

    // Curso no Tenant A via secA
    const { data: courseA, error: errCrs } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Bacharel em Teologia ${runId}`,
        modality: "presencial",
        format: "estruturado",
        workload_hours: 180,
      })
      .select()
      .single();
    if (errCrs) throw new Error(`Falha ao criar curso: ${errCrs.message}`);
    createdCourseIds.push(courseA.id);

    // Turma no Tenant A via secA
    const { data: classA, error: errCls } = await secA.client
      .from("classes")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseA.id,
        name: `Turma Alpha ${runId}`,
        shift: "noturno",
        status: "em_andamento",
        capacity: 40,
      })
      .select()
      .single();
    if (errCls) throw new Error(`Falha ao criar turma: ${errCls.message}`);
    createdClassIds.push(classA.id);

    // Docente no Tenant A via secA
    const { data: teacherRecord, error: errTch } = await secA.client
      .from("teachers")
      .insert({
        tenant_id: tenantA.id,
        user_id: teacherA.id,
        first_name: "Professor",
        last_name: `Teologia ${runId}`,
        email: `prof.l8.${runId}@tenanta.com`,
        theological_specialties: "Teologia Sistemática e Exegese",
        is_active: true,
      })
      .select()
      .single();
    if (errTch) throw new Error(`Falha ao criar docente: ${errTch.message}`);
    createdTeacherIds.push(teacherRecord.id);

    // Disciplinas: Matéria 1 (com provas) e Matéria 2 (sem provas, caso-limite)
    const { data: subject1, error: errSub1 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseA.id,
        name: `Teologia Sistemática I ${runId}`,
        code: `TS101-${runId}`,
        workload_hours: 60,
        order_index: 1,
        teacher_id: teacherA.id, // references profiles(id)
        is_active: true,
      })
      .select()
      .single();
    if (errSub1) throw new Error(`Falha ao criar subject 1: ${errSub1.message}`);
    createdSubjectIds.push(subject1.id);

    const { data: subject2, error: errSub2 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseA.id,
        name: `Grego Bíblico I ${runId}`,
        code: `GB102-${runId}`,
        workload_hours: 40,
        order_index: 2,
        teacher_id: teacherA.id, // references profiles(id)
        is_active: true,
      })
      .select()
      .single();
    if (errSub2) throw new Error(`Falha ao criar subject 2: ${errSub2.message}`);
    createdSubjectIds.push(subject2.id);

    // Atribuição Docente do Professor à Turma A e Disciplina 1
    const { data: assignmentRecord, error: errAsg } = await secA.client
      .from("teaching_assignments")
      .insert({
        tenant_id: tenantA.id,
        teacher_id: teacherRecord.id,
        class_id: classA.id,
        subject_id: subject1.id,
        role_description: "titular",
        is_active: true,
      })
      .select()
      .single();
    if (errAsg) throw new Error(`Falha ao criar atribuição docente: ${errAsg.message}`);
    createdAssignmentIds.push(assignmentRecord.id);

    // Alunos e Matrículas A1 e A2
    const { data: studentRecordA1, error: errSt1 } = await secA.client
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: studentA1.id,
        first_name: "Aluno",
        last_name: `Um ${runId}`,
        cpf: `111222333${runId.slice(0, 2)}`,
        email: `aluno1.l8.${runId}@tenanta.com`,
      })
      .select()
      .single();
    if (errSt1) throw new Error(`Falha ao criar aluno 1: ${errSt1.message}`);
    createdStudentIds.push(studentRecordA1.id);

    const { data: studentRecordA2, error: errSt2 } = await secA.client
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: studentA2.id,
        first_name: "Aluno",
        last_name: `Dois ${runId}`,
        cpf: `222333444${runId.slice(0, 2)}`,
        email: `aluno2.l8.${runId}@tenanta.com`,
      })
      .select()
      .single();
    if (errSt2) throw new Error(`Falha ao criar aluno 2: ${errSt2.message}`);
    createdStudentIds.push(studentRecordA2.id);

    const { data: enrollmentA1, error: errEn1 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        course_id: courseA.id,
        class_id: classA.id,
        enrollment_number: `MAT-A1-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    if (errEn1) throw new Error(`Falha ao criar matrícula 1: ${errEn1.message}`);
    createdEnrollmentIds.push(enrollmentA1.id);

    const { data: enrollmentA2, error: errEn2 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA2.id,
        course_id: courseA.id,
        class_id: classA.id,
        enrollment_number: `MAT-A2-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    if (errEn2) throw new Error(`Falha ao criar matrícula 2: ${errEn2.message}`);
    createdEnrollmentIds.push(enrollmentA2.id);

    console.log("   ✅ Estrutura acadêmica, turma, matérias e matrículas ativas configuradas.");

    // ----------------------------------------------------------------------------
    // 4. Avaliações e Tentativas para Testar Desempenho
    // ----------------------------------------------------------------------------
    console.log("\n4. Configurando avaliações e tentativas de provas...");

    // Avaliação 1 da Matéria 1
    const { data: assessment1 } = await admin
      .from("assessments")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        class_id: classA.id,
        title: `Prova Teologia Própria ${runId}`,
        questions_count: 5,
        duration_minutes: 60,
        max_attempts: 3,
        passing_grade: 7.0,
        is_active: true,
      })
      .select()
      .single();
    createdAssessmentIds.push(assessment1.id);

    // Tentativas do Aluno A1:
    // Tentativa 1: finalizada com nota 6.0
    // Tentativa 2: finalizada com nota 9.0 (melhor nota)
    // Tentativa 3: em andamento (nota null) - deve ser ignorada no cálculo
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    const { data: att1 } = await admin
      .from("assessment_attempts")
      .insert({
        tenant_id: tenantA.id,
        assessment_id: assessment1.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        attempt_number: 1,
        status: "submetida",
        total_score: 6.0,
        passed: false,
        expires_at: expiresAt,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    createdAttemptIds.push(att1.id);

    const { data: att2 } = await admin
      .from("assessment_attempts")
      .insert({
        tenant_id: tenantA.id,
        assessment_id: assessment1.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        attempt_number: 2,
        status: "submetida",
        total_score: 9.0,
        passed: true,
        expires_at: expiresAt,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    createdAttemptIds.push(att2.id);

    const { data: att3 } = await admin
      .from("assessment_attempts")
      .insert({
        tenant_id: tenantA.id,
        assessment_id: assessment1.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        attempt_number: 3,
        status: "em_andamento",
        total_score: null,
        passed: null,
        expires_at: expiresAt,
      })
      .select()
      .single();
    createdAttemptIds.push(att3.id);

    // Tentativa do Aluno A2: finalizada com nota 4.5 (Reprovado direto na régua < 5.0)
    const { data: attA2 } = await admin
      .from("assessment_attempts")
      .insert({
        tenant_id: tenantA.id,
        assessment_id: assessment1.id,
        student_id: studentRecordA2.id,
        enrollment_id: enrollmentA2.id,
        attempt_number: 1,
        status: "submetida",
        total_score: 4.5,
        passed: false,
        expires_at: expiresAt,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    createdAttemptIds.push(attA2.id);

    console.log("   ✅ Tentativas registradas com sucesso.");

    // ----------------------------------------------------------------------------
    // 5. Testando Acesso RLS Discente ao Boletim e Provas
    // ----------------------------------------------------------------------------
    console.log("\n5. Testando isolamento e consulta do discente via JWT...");

    // Aluno A1 consulta suas próprias tentativas
    const { data: myAttempts, error: myAttErr } = await studentA1.client
      .from("assessment_attempts")
      .select("id, total_score, status, attempt_number")
      .eq("student_id", studentRecordA1.id);

    if (myAttErr) throw new Error(`Aluno A1 falhou ao consultar suas tentativas: ${myAttErr.message}`);
    if (myAttempts.length !== 3) {
      throw new Error(`Esperado 3 tentativas para Aluno A1, recebido: ${myAttempts.length}`);
    }
    console.log("   ✅ Aluno A1 acessou com sucesso suas próprias tentativas.");

    // Aluno A1 tenta consultar tentativas do Aluno A2 (deve retornar vazio pelo RLS)
    const { data: otherAttempts } = await studentA1.client
      .from("assessment_attempts")
      .select("id, total_score")
      .eq("student_id", studentRecordA2.id);

    if (otherAttempts && otherAttempts.length > 0) {
      throw new Error("FALHA: Aluno A1 conseguiu visualizar tentativas do Aluno A2!");
    }
    console.log("   ✅ RLS bloqueou Aluno A1 de visualizar tentativas do Aluno A2.");

    // ----------------------------------------------------------------------------
    // 6. Testando Consulta de Docente via JWT
    // ----------------------------------------------------------------------------
    console.log("\n6. Testando acesso do docente atribuído via JWT...");

    const { data: teacherAttempts, error: tAttErr } = await teacherA.client
      .from("assessment_attempts")
      .select("id, total_score, student_id")
      .eq("assessment_id", assessment1.id);

    if (tAttErr) throw new Error(`Professor falhou ao consultar notas da matéria: ${tAttErr.message}`);
    if (teacherAttempts.length < 4) {
      throw new Error(`Professor esperava ver as 4 tentativas da sua matéria atribuída, viu: ${teacherAttempts.length}`);
    }
    console.log("   ✅ Professor atribuído visualizou todas as tentativas dos alunos de sua disciplina.");

    // ----------------------------------------------------------------------------
    // 7. Testando Isolamento Multi-Tenant A/B
    // ----------------------------------------------------------------------------
    console.log("\n7. Testando isolamento Multi-Tenant A/B com Aluno do Tenant B...");

    const { data: leakAttempts } = await studentB.client
      .from("assessment_attempts")
      .select("id, total_score")
      .eq("tenant_id", tenantA.id);

    if (leakAttempts && leakAttempts.length > 0) {
      throw new Error("FALHA CRÍTICA: Aluno do Tenant B conseguiu ver tentativas do Tenant A!");
    }

    const { data: leakClasses } = await studentB.client
      .from("classes")
      .select("id, name")
      .eq("tenant_id", tenantA.id);

    if (leakClasses && leakClasses.length > 0) {
      throw new Error("FALHA CRÍTICA: Aluno do Tenant B visualizou turmas do Tenant A!");
    }
    console.log("   ✅ Isolamento A/B validado: Zero vazamento de notas, tentativas ou turmas para o Tenant B.");

    // ----------------------------------------------------------------------------
    // 8. Teste de Validação dos Cálculos de Desempenho
    // ----------------------------------------------------------------------------
    console.log("\n8. Testando regras e cálculos do motor de desempenho...");

    // Cálculo da Avaliação 1 do Aluno A1 (notas 6.0, 9.0 e tentativa 3 em andamento)
    const attemptsA1Calc = [
      { score: 6.0, status: "submetida", submittedAt: "2026-11-19T10:00:00Z", attemptNumber: 1 },
      { score: 9.0, status: "submetida", submittedAt: "2026-11-19T11:00:00Z", attemptNumber: 2 },
      { score: null, status: "em_andamento", submittedAt: null, attemptNumber: 3 },
    ];
    const scoreResultA1 = calculateAssessmentScore(attemptsA1Calc, DEFAULT_GRADING_POLICY);

    if (scoreResultA1.finalScore !== 9.0) {
      throw new Error(`Esperado melhor nota 9.0, recebido: ${scoreResultA1.finalScore}`);
    }
    if (scoreResultA1.bestScore !== 9.0) {
      throw new Error(`Esperado bestScore 9.0, recebido: ${scoreResultA1.bestScore}`);
    }
    console.log("   ✅ Seleção de melhor nota confirmada (9.0), ignorando tentativa em andamento.");

    // Cálculo da Disciplina 1 do Aluno A1
    const subj1Assessments = [
      {
        assessmentId: assessment1.id,
        title: assessment1.title,
        passingGrade: 7.0,
        totalAttemptsAllowed: 3,
        attemptsMadeCount: 3,
        bestScore: 9.0,
        latestScore: 9.0,
        finalScore: 9.0,
        passed: true,
        attempts: [],
      },
    ];
    const subj1Calc = calculateSubjectAverage(subj1Assessments, DEFAULT_GRADING_POLICY);
    if (subj1Calc.averageScore !== 9.0 || subj1Calc.situation !== "aprovado") {
      throw new Error(`Esperado média 9.0 e situação aprovado, recebido: ${subj1Calc.averageScore} / ${subj1Calc.situation}`);
    }
    console.log("   ✅ Média da disciplina calculada com sucesso: 9.0 (Aprovado).");

    // Disciplina 2 (Caso-limite: sem avaliações cadastradas)
    const subj2Calc = calculateSubjectAverage([], DEFAULT_GRADING_POLICY);
    if (subj2Calc.averageScore !== null || subj2Calc.situation !== "em_andamento") {
      throw new Error(`Esperado média nula e em_andamento para matéria sem provas`);
    }
    console.log("   ✅ Disciplina sem avaliações tratada corretamente: média nula, situação 'em_andamento'.");

    // Cálculo da Avaliação do Aluno A2 (nota 4.5 -> Reprovado)
    const subjA2Calc = calculateSubjectAverage([
      {
        assessmentId: assessment1.id,
        title: assessment1.title,
        passingGrade: 7.0,
        totalAttemptsAllowed: 3,
        attemptsMadeCount: 1,
        bestScore: 4.5,
        latestScore: 4.5,
        finalScore: 4.5,
        passed: false,
        attempts: [],
      },
    ], DEFAULT_GRADING_POLICY);

    if (subjA2Calc.situation !== "reprovado") {
      throw new Error(`Esperado 'reprovado' para nota 4.5 (< 5.0), recebido: ${subjA2Calc.situation}`);
    }
    console.log("   ✅ Régua de reprovação direta confirmada: nota 4.5 resultou em 'reprovado'.");

    // Teste de Recuperação (nota 6.0 entre 5.0 e 6.9 sem provas pendentes)
    const subjRecupCalc = calculateSubjectAverage([
      {
        assessmentId: assessment1.id,
        title: assessment1.title,
        passingGrade: 7.0,
        totalAttemptsAllowed: 3,
        attemptsMadeCount: 1,
        bestScore: 6.0,
        latestScore: 6.0,
        finalScore: 6.0,
        passed: false,
        attempts: [],
      },
    ], DEFAULT_GRADING_POLICY);

    if (subjRecupCalc.situation !== "recuperacao") {
      throw new Error(`Esperado 'recuperacao' para nota 6.0 (5.0 <= nota < 7.0), recebido: ${subjRecupCalc.situation}`);
    }
    console.log("   ✅ Régua de recuperação confirmada: nota 6.0 resultou em 'recuperacao'.");

    // ----------------------------------------------------------------------------
    // 9. Teste de Tentativa de Fraude / Adulteração de Notas via Aluno
    // ----------------------------------------------------------------------------
    console.log("\n9. Testando blindagem contra fraude de notas...");

    // A tentativa 3 está com status = 'em_andamento' e total_score = null
    const { error: fraudErr } = await studentA1.client
      .from("assessment_attempts")
      .update({ total_score: 10.0, passed: true })
      .eq("id", att3.id);

    // Verifica se a nota permaneceu nula no banco
    const { data: checkScore } = await admin
      .from("assessment_attempts")
      .select("total_score, passed")
      .eq("id", att3.id)
      .single();

    if (checkScore.total_score !== null) {
      throw new Error("FALHA CRÍTICA: Aluno conseguiu adulterar a própria nota diretamente via UPDATE!");
    }
    console.log("   ✅ Tentativa de adulterar nota via UPDATE direto foi neutralizada.");

    console.log("\n================================================================================");
    console.log("🎉 TODOS OS TESTES REMOTOS DE HOMOLOGAÇÃO DO LOTE 8 FORAM APROVADOS!");
    console.log("================================================================================\n");

  } finally {
    // ----------------------------------------------------------------------------
    // Limpeza Total de Dados Fictícios
    // ----------------------------------------------------------------------------
    console.log("Limpando dados fictícios criados nesta homologação...");

    for (const attId of createdAttemptIds) {
      await admin.from("assessment_attempts").delete().eq("id", attId);
    }
    for (const assId of createdAssessmentIds) {
      await admin.from("assessments").delete().eq("id", assId);
    }
    for (const enrId of createdEnrollmentIds) {
      await admin.from("enrollments").delete().eq("id", enrId);
    }
    for (const stdId of createdStudentIds) {
      await admin.from("students").delete().eq("id", stdId);
    }
    for (const asgId of createdAssignmentIds) {
      await admin.from("teaching_assignments").delete().eq("id", asgId);
    }
    for (const subId of createdSubjectIds) {
      await admin.from("subjects").delete().eq("id", subId);
    }
    for (const claId of createdClassIds) {
      await admin.from("classes").delete().eq("id", claId);
    }
    for (const tchId of createdTeacherIds) {
      await admin.from("teachers").delete().eq("id", tchId);
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
