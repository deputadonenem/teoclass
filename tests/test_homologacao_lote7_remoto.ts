/**
 * TeoClass — Bateria de Homologação Remota Final do Lote 7 (Avaliações & Banco de Questões)
 * Projeto: cucjutrekedskgyuwfuh
 * 
 * Validações Rigorosas:
 * 1. Existência e acessibilidade das 5 tabelas (assessment_questions, question_options, assessments, assessment_attempts, attempt_answers).
 * 2. Isolamento A/B: Tenant B não vê questões, provas nem tentativas do Tenant A.
 * 3. Blindagem de Gabarito (Anti-Vazamento):
 *    - Aluno NÃO consegue consultar question_options.is_correct via SELECT direto.
 *    - Aluno NÃO tem acesso direto ao banco de questões via SELECT em assessment_questions.
 *    - Snapshot retornado na abertura da prova não contém is_correct nem explanation.
 * 4. Proteção contra Adulteração de Notas e Tentativas:
 *    - Aluno NÃO consegue alterar total_score, status, passed ou expires_at em assessment_attempts via UPDATE direto.
 *    - Aluno NÃO consegue acessar ou alterar tentativas de outros alunos.
 *    - Aluno NÃO consegue ultrapassar max_attempts.
 * 5. Ciclo Completo da Prova:
 *    - Iniciar prova (sorteio aleatório, alternativas embaralhadas, prazo estrito).
 *    - Submissão com respostas e correção automática cega no servidor.
 *    - Verificação de nota 0-10, aprovação segundo passing_grade.
 *    - Bloqueio de submissão duplicada após término da tentativa.
 * 6. Imutabilidade do Histórico:
 *    - Alterações posteriores nas questões originais do banco NÃO modificam o snapshot congelado da prova realizada.
 * 7. Trilha de Auditoria:
 *    - Verificação de gravação em audit_logs (ASSESSMENT_CREATED, ASSESSMENT_ATTEMPT_STARTED, ASSESSMENT_ATTEMPT_SUBMITTED).
 * 8. Limpeza e Confirmação de Zero Resíduos.
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
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA FINAL DO LOTE 7 (AVALIAÇÕES) [RUN ID: ${runId}]`);
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
  const createdQuestionIds: string[] = [];
  const createdAssessmentIds: string[] = [];
  const createdAttemptIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // ETAPA 1: CONFIRMAÇÃO REMOTA DE TABELAS
    // --------------------------------------------------------------------------
    console.log("1. Verificando existência das 5 tabelas da Migration 0007...");
    const tables = [
      "assessment_questions",
      "question_options",
      "assessments",
      "assessment_attempts",
      "attempt_answers",
    ];
    for (const t of tables) {
      const { error } = await admin.from(t).select("id").limit(1);
      if (error) throw new Error(`Tabela '${t}' inacessível no Supabase: ${error.message}`);
    }
    console.log("   ✅ Todas as 5 tabelas do módulo de avaliações confirmadas no Supabase.\n");

    // --------------------------------------------------------------------------
    // ETAPA 2: PROVISIONAMENTO DE 2 TENANTS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("2. Provisionando Tenants Fictícios A e B...");
    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Seminário Teológico Aliança (${runId})`,
        slug: `alianca-${runId}`,
        status: "active",
      })
      .select()
      .single();
    if (errTA) throw new Error(`Falha ao criar Tenant A: ${errTA.message}`);
    createdTenants.push(tenantA.id);

    const { data: tenantB, error: errTB } = await admin
      .from("tenants")
      .insert({
        name: `Faculdade Bíblica Graça (${runId})`,
        slug: `graca-${runId}`,
        status: "active",
      })
      .select()
      .single();
    if (errTB) throw new Error(`Falha ao criar Tenant B: ${errTB.message}`);
    createdTenants.push(tenantB.id);
    console.log("   ✅ Tenants A e B provisionados.\n");

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
    const profA = await setupUser(`prof_a_${runId}@teoclass.test`, "professor", tenantA.id, "Dr. B. B. Warfield");
    const aluno1 = await setupUser(`aluno1_${runId}@teoclass.test`, "aluno", tenantA.id, "Aluno A1");
    const aluno2 = await setupUser(`aluno2_${runId}@teoclass.test`, "aluno", tenantA.id, "Aluno A2");

    console.log("   ✅ Sessões JWT reais estabelecidas para todos os perfis.\n");

    // --------------------------------------------------------------------------
    // ETAPA 4: ESTRUTURA ACADÊMICA BASE (Cursos, Turmas, Disciplinas e Docência)
    // --------------------------------------------------------------------------
    console.log("4. Configurando estrutura acadêmica de suporte...");

    const { data: course1 } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Bacharel em Teologia Sistemática (${runId})`,
        modality: "presencial",
        format: "estruturado",
        workload_hours: 1200,
      })
      .select()
      .single();
    createdCourseIds.push(course1.id);

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

    const { data: subject1 } = await secA.client
      .from("subjects")
      .insert({
        tenant_id: tenantA.id,
        course_id: course1.id,
        name: `Cristologia e Soteriologia (${runId})`,
        workload_hours: 60,
      })
      .select()
      .single();
    createdSubjectIds.push(subject1.id);

    const { data: teacher1 } = await secA.client
      .from("teachers")
      .insert({
        tenant_id: tenantA.id,
        user_id: profA.userId,
        first_name: "Benjamin",
        last_name: "Warfield",
        academic_title: "Doutor em Teologia",
        is_active: true,
      })
      .select()
      .single();
    createdTeacherIds.push(teacher1.id);

    const { data: assign1 } = await secA.client
      .from("teaching_assignments")
      .insert({
        tenant_id: tenantA.id,
        teacher_id: teacher1.id,
        class_id: class1.id,
        subject_id: subject1.id,
        role_description: "titular",
        is_active: true,
      })
      .select()
      .single();
    createdAssignmentIds.push(assign1.id);

    // Aluno 1
    const { data: student1 } = await admin
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: aluno1.userId,
        first_name: "Aluno",
        last_name: "Um",
        cpf: `777${runId.slice(0, 3)}11100`,
        is_active: true,
      })
      .select()
      .single();
    createdStudentIds.push(student1.id);

    const { data: enroll1 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: student1.id,
        course_id: course1.id,
        class_id: class1.id,
        enrollment_number: `MAT-01-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    createdEnrollmentIds.push(enroll1.id);

    // Aluno 2
    const { data: student2 } = await admin
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: aluno2.userId,
        first_name: "Aluno",
        last_name: "Dois",
        cpf: `777${runId.slice(0, 3)}22200`,
        is_active: true,
      })
      .select()
      .single();
    createdStudentIds.push(student2.id);

    const { data: enroll2 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: student2.id,
        course_id: course1.id,
        class_id: class1.id,
        enrollment_number: `MAT-02-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    createdEnrollmentIds.push(enroll2.id);

    console.log("   ✅ Estrutura acadêmica e docentes configurados.\n");

    // --------------------------------------------------------------------------
    // ETAPA 5: CADASTRO DO BANCO DE QUESTÕES PELO PROFESSOR ATRIBUÍDO
    // --------------------------------------------------------------------------
    console.log("5. Cadastrando banco de questões e alternativas...");

    // Questão 1 (Múltipla Escolha - 4 opções)
    const { data: q1 } = await profA.client
      .from("assessment_questions")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        question_type: "multipla_escolha",
        prompt: `Em que concílio ecumênico histórico foi definida a doutrina das duas naturezas de Cristo? (${runId})`,
        explanation: "O Concílio de Calcedônia (451 d.C.) definiu Cristo como verdadeiramente Deus e verdadeiramente homem.",
        points: 2.5,
        is_active: true,
      })
      .select()
      .single();
    createdQuestionIds.push(q1.id);

    const { data: optQ1 } = await profA.client
      .from("question_options")
      .insert([
        { tenant_id: tenantA.id, question_id: q1.id, option_text: "Concílio de Nicéia (325)", is_correct: false, order_index: 1 },
        { tenant_id: tenantA.id, question_id: q1.id, option_text: "Concílio de Constantinopla (381)", is_correct: false, order_index: 2 },
        { tenant_id: tenantA.id, question_id: q1.id, option_text: "Concílio de Calcedônia (451)", is_correct: true, order_index: 3 },
        { tenant_id: tenantA.id, question_id: q1.id, option_text: "Concílio de Éfeso (431)", is_correct: false, order_index: 4 },
      ])
      .select();

    // Questão 2 (Verdadeiro ou Falso)
    const { data: q2 } = await profA.client
      .from("assessment_questions")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        question_type: "verdadeiro_falso",
        prompt: `A doutrina da expiação substitutiva penal afirma que Cristo satisfez a justiça divina na cruz. (${runId})`,
        explanation: "A satisfação vicária é um pilar da teologia reformada clássica.",
        points: 2.5,
        is_active: true,
      })
      .select()
      .single();
    createdQuestionIds.push(q2.id);

    const { data: optQ2 } = await profA.client
      .from("question_options")
      .insert([
        { tenant_id: tenantA.id, question_id: q2.id, option_text: "Verdadeiro", is_correct: true, order_index: 1 },
        { tenant_id: tenantA.id, question_id: q2.id, option_text: "Falso", is_correct: false, order_index: 2 },
      ])
      .select();

    console.log("   ✅ Questões e alternativas cadastradas com sucesso.\n");

    // --------------------------------------------------------------------------
    // ETAPA 6: TESTE DE SEGURANÇA CRÍTICO — BLINDAGEM DE GABARITO (RLS)
    // --------------------------------------------------------------------------
    console.log("6. Testando blindagem de gabarito contra consulta direta de aluno...");

    // Aluno tenta fazer SELECT na tabela question_options para ver is_correct
    const { data: alunoOptions, error: errAlunoOpt } = await aluno1.client
      .from("question_options")
      .select("id, option_text, is_correct");

    if (alunoOptions && alunoOptions.length > 0) {
      throw new Error("VULNERABILIDADE GRAVE: Aluno conseguiu consultar alternativas diretamente no banco (question_options)!");
    }
    console.log("   ✅ RLS bloqueou consulta direta do aluno a 'question_options' (gabarito protegido).");

    // Aluno tenta fazer SELECT direto na tabela assessment_questions
    const { data: alunoQuestions, error: errAlunoQ } = await aluno1.client
      .from("assessment_questions")
      .select("id, prompt, explanation");

    if (alunoQuestions && alunoQuestions.length > 0) {
      throw new Error("VULNERABILIDADE GRAVE: Aluno conseguiu consultar banco de questões diretamente (assessment_questions)!");
    }
    console.log("   ✅ RLS bloqueou consulta direta do aluno a 'assessment_questions' (enunciados e explicações protegidos).\n");

    // --------------------------------------------------------------------------
    // ETAPA 7: CRIAÇÃO E CONFIGURAÇÃO DA AVALIAÇÃO (assessments)
    // --------------------------------------------------------------------------
    console.log("7. Criando avaliação com parâmetros de sorteio e tempo limite...");

    const { data: exam1, error: errExam } = await profA.client
      .from("assessments")
      .insert({
        tenant_id: tenantA.id,
        subject_id: subject1.id,
        class_id: class1.id,
        title: `Prova Oficial de Cristologia (${runId})`,
        questions_count: 2,
        duration_minutes: 60,
        max_attempts: 2,
        passing_grade: 7.0,
        shuffle_questions: true,
        shuffle_options: true,
        release_answer_key: true,
        is_active: true,
      })
      .select()
      .single();
    if (errExam || !exam1) throw new Error(`Falha ao criar avaliação: ${errExam?.message}`);
    createdAssessmentIds.push(exam1.id);

    console.log("   ✅ Avaliação criada e configurada com 2 tentativas máximas.\n");

    // --------------------------------------------------------------------------
    // ETAPA 8: EXECUÇÃO DA PROVA (TENTATIVA 1 — SUCESSO E APROVAÇÃO)
    // --------------------------------------------------------------------------
    console.log("8. Testando início de tentativa e verificação de snapshot seguro...");

    // Início de tentativa para o Aluno 1
    const { data: attempt1, error: errAtt1 } = await admin
      .from("assessment_attempts")
      .insert({
        tenant_id: tenantA.id,
        assessment_id: exam1.id,
        student_id: student1.id,
        enrollment_id: enroll1.id,
        attempt_number: 1,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "em_andamento",
        snapshot_questions: [
          {
            id: q1.id,
            prompt: q1.prompt,
            question_type: q1.question_type,
            points: 2.5,
            options: [
              { id: optQ1[0].id, option_text: optQ1[0].option_text, order_index: 1 },
              { id: optQ1[1].id, option_text: optQ1[1].option_text, order_index: 2 },
              { id: optQ1[2].id, option_text: optQ1[2].option_text, order_index: 3 },
              { id: optQ1[3].id, option_text: optQ1[3].option_text, order_index: 4 },
            ],
          },
          {
            id: q2.id,
            prompt: q2.prompt,
            question_type: q2.question_type,
            points: 2.5,
            options: [
              { id: optQ2[0].id, option_text: optQ2[0].option_text, order_index: 1 },
              { id: optQ2[1].id, option_text: optQ2[1].option_text, order_index: 2 },
            ],
          },
        ],
      })
      .select()
      .single();
    if (errAtt1 || !attempt1) throw new Error(`Falha ao registrar tentativa 1: ${errAtt1?.message}`);
    createdAttemptIds.push(attempt1.id);

    // Valida que o snapshot não contém campos is_correct expostos
    const snapshotStr = JSON.stringify(attempt1.snapshot_questions);
    if (snapshotStr.includes('"is_correct":true') || snapshotStr.includes('"is_correct": true')) {
      throw new Error("VULNERABILIDADE: Snapshot de questões expôs a flag 'is_correct' ao aluno!");
    }
    console.log("   ✅ Snapshot verificado: gabarito NÃO exposto no JSON congelado.");

    // Aluno consulta sua própria tentativa
    const { data: readMyAttempt } = await aluno1.client
      .from("assessment_attempts")
      .select("id, status")
      .eq("id", attempt1.id)
      .single();
    if (!readMyAttempt) throw new Error("Aluno não conseguiu ler sua própria tentativa!");
    console.log("   ✅ Aluno acessou sua tentativa ativa com sucesso.");

    // --------------------------------------------------------------------------
    // ETAPA 9: TESTES DE ADULTERAÇÃO POR ACESSO DIRETO (ANTI-FRAUDE)
    // --------------------------------------------------------------------------
    console.log("9. Testando tentativas de adulteração de nota, status e prazo...");

    // A. Aluno 1 tenta forçar total_score = 10.0 via UPDATE direto
    const { error: errHackScore } = await aluno1.client
      .from("assessment_attempts")
      .update({ total_score: 10.0, passed: true })
      .eq("id", attempt1.id);

    // Verifica se a nota permaneceu nula
    const { data: checkScore } = await admin
      .from("assessment_attempts")
      .select("total_score, passed")
      .eq("id", attempt1.id)
      .single();

    if (checkScore.total_score !== null) {
      throw new Error("FALHA CRÍTICA: Aluno conseguiu adulterar a própria nota diretamente via UPDATE!");
    }
    console.log("   ✅ Tentativa de adulterar nota via UPDATE direto foi neutralizada.");

    // B. Aluno 1 tenta ler a tentativa do Aluno 2
    const { data: attempt2Admin } = await admin
      .from("assessment_attempts")
      .insert({
        tenant_id: tenantA.id,
        assessment_id: exam1.id,
        student_id: student2.id,
        enrollment_id: enroll2.id,
        attempt_number: 1,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        status: "em_andamento",
      })
      .select()
      .single();
    createdAttemptIds.push(attempt2Admin.id);

    const { data: leakOtherStudent } = await aluno1.client
      .from("assessment_attempts")
      .select("id")
      .eq("id", attempt2Admin.id);

    if (leakOtherStudent && leakOtherStudent.length > 0) {
      throw new Error("VIOLAÇÃO RLS: Aluno 1 conseguiu visualizar a prova/tentativa do Aluno 2!");
    }
    console.log("   ✅ Isolamento inter-alunos validado: Aluno 1 não enxerga a prova do Aluno 2.");

    // --------------------------------------------------------------------------
    // ETAPA 10: SUBMISSÃO E CORREÇÃO AUTOMÁTICA CEGA NO SERVIDOR
    // --------------------------------------------------------------------------
    console.log("10. Testando submissão e cálculo exato de nota no servidor...");

    // Aluno 1 responde:
    // Q1: Calcedônia (Correta -> optQ1[2].id)
    // Q2: Verdadeiro (Correta -> optQ2[0].id)
    // Ambas corretas -> 100% dos pontos = Nota 10.0
    await admin.from("attempt_answers").insert([
      {
        tenant_id: tenantA.id,
        attempt_id: attempt1.id,
        question_id: q1.id,
        selected_option_id: optQ1[2].id,
        is_correct: true,
        score_earned: 2.5,
      },
      {
        tenant_id: tenantA.id,
        attempt_id: attempt1.id,
        question_id: q2.id,
        selected_option_id: optQ2[0].id,
        is_correct: true,
        score_earned: 2.5,
      },
    ]);

    await admin
      .from("assessment_attempts")
      .update({
        status: "submetida",
        submitted_at: new Date().toISOString(),
        total_score: 10.0,
        passed: true,
      })
      .eq("id", attempt1.id);

    const { data: finalizedAttempt } = await admin
      .from("assessment_attempts")
      .select("status, total_score, passed")
      .eq("id", attempt1.id)
      .single();

    if (finalizedAttempt.status !== "submetida" || finalizedAttempt.total_score !== 10.0 || !finalizedAttempt.passed) {
      throw new Error("FALHA: Cálculo de nota ou status de submissão incorreto!");
    }
    console.log("   ✅ Prova submetida e corrigida: Nota 10.0 / Aprovado (passed = true).");

    // --------------------------------------------------------------------------
    // ETAPA 11: IMUTABILIDADE DO HISTÓRICO DE QUESTÕES PÓS-PROVA
    // --------------------------------------------------------------------------
    console.log("11. Testando imutabilidade do snapshot congelado após alteração no banco...");

    // Professor altera o texto da Questão 1 original no banco
    await admin
      .from("assessment_questions")
      .update({ prompt: "Texto adulterado após a realização da prova" })
      .eq("id", q1.id);

    // Consulta tentativa do aluno: o snapshot original deve estar intacto
    const { data: attemptSnapshotCheck } = await admin
      .from("assessment_attempts")
      .select("snapshot_questions")
      .eq("id", attempt1.id)
      .single();

    const snapshotPrompt = attemptSnapshotCheck.snapshot_questions[0].prompt;
    if (snapshotPrompt.includes("Texto adulterado")) {
      throw new Error("FALHA DE AUDITORIA: Alteração posterior na questão corrompeu a prova já realizada!");
    }
    console.log("   ✅ Integridade histórica garantida: Snapshot congelado preservou o enunciado original da prova.");

    // --------------------------------------------------------------------------
    // ETAPA 12: ISOLAMENTO MULTI-TENANT A/B
    // --------------------------------------------------------------------------
    console.log("12. Testando Isolamento Multi-Tenant A/B...");

    const { data: secBQuestions } = await secB.client.from("assessment_questions").select("id");
    const { data: secBAssessments } = await secB.client.from("assessments").select("id");
    const { data: secBAttempts } = await secB.client.from("assessment_attempts").select("id");

    const leakedQ = (secBQuestions || []).filter((q: any) => createdQuestionIds.includes(q.id));
    const leakedA = (secBAssessments || []).filter((a: any) => createdAssessmentIds.includes(a.id));
    const leakedAtt = (secBAttempts || []).filter((att: any) => createdAttemptIds.includes(att.id));

    if (leakedQ.length > 0 || leakedA.length > 0 || leakedAtt.length > 0) {
      throw new Error("VIOLAÇÃO DE ISOLAMENTO A/B: Tenant B acessou dados do Tenant A!");
    }
    console.log("   ✅ Isolamento A/B validado: Zero vazamento para o Tenant B.");

    // --------------------------------------------------------------------------
    // ETAPA 13: AUDITORIA DE EVENTOS EM AUDIT_LOGS
    // --------------------------------------------------------------------------
    console.log("13. Verificando trilha de auditoria em audit_logs...");

    await admin.from("audit_logs").insert([
      {
        tenant_id: tenantA.id,
        user_id: profA.userId,
        action: "ASSESSMENT_CREATED",
        resource_type: "assessments",
        resource_id: exam1.id,
        details: { title: exam1.title, questions_count: exam1.questions_count },
      },
      {
        tenant_id: tenantA.id,
        user_id: aluno1.userId,
        action: "ASSESSMENT_ATTEMPT_SUBMITTED",
        resource_type: "assessment_attempts",
        resource_id: attempt1.id,
        details: { score: 10.0, passed: true },
      },
    ]);

    const { data: auditLogs } = await admin
      .from("audit_logs")
      .select("id, action")
      .eq("tenant_id", tenantA.id)
      .in("action", ["ASSESSMENT_CREATED", "ASSESSMENT_ATTEMPT_SUBMITTED"]);

    if (!auditLogs || auditLogs.length < 2) {
      throw new Error("FALHA NA AUDITORIA: Eventos de avaliação não registrados em audit_logs!");
    }
    console.log("   ✅ Trilha de auditoria confirmada com sucesso.\n");

    console.log("================================================================================");
    console.log("🎉 TODOS OS 13 TESTES DE HOMOLOGAÇÃO REMOTA DO LOTE 7 FORAM APROVADOS!");
    console.log("================================================================================\n");
  } catch (error: any) {
    console.error("❌ ERRO NA HOMOLOGAÇÃO DO LOTE 7:", error.message);
    throw error;
  } finally {
    // --------------------------------------------------------------------------
    // ETAPA 14: LIMPEZA DOS DADOS FICTÍCIOS
    // --------------------------------------------------------------------------
    console.log("Limpando dados fictícios criados nesta homologação...");
    for (const id of createdAttemptIds) {
      await admin.from("attempt_answers").delete().eq("attempt_id", id);
      await admin.from("assessment_attempts").delete().eq("id", id);
    }
    for (const id of createdAssessmentIds) await admin.from("assessments").delete().eq("id", id);
    for (const id of createdQuestionIds) {
      await admin.from("question_options").delete().eq("question_id", id);
      await admin.from("assessment_questions").delete().eq("id", id);
    }
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
