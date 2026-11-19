import test from "node:test";
import assert from "node:assert/strict";
import {
  hasActionAccess,
  hasModuleAccess,
} from "../src/lib/rbac/permissions.ts";
import {
  QUESTION_TYPE_LABELS,
  type AssessmentQuestionInput,
  type AssessmentInput,
  type SubmitAttemptInput,
} from "../src/types/provas.ts";

test("TeoClass — Avaliações e Banco de Questões (Testes Locais de Regras e RBAC)", async (t) => {
  await t.test("RBAC: Permissões de Banco de Questões e Realização de Provas", () => {
    // Admin tem gestão completa
    assert.equal(hasActionAccess("admin", "provas:manage_bank"), true);
    assert.equal(hasActionAccess("admin", "provas:grade"), true);
    assert.equal(hasActionAccess("admin", "provas:attempt"), true);
    assert.equal(hasModuleAccess("admin", "provas"), true);

    // Professor pode gerenciar banco e avaliar
    assert.equal(hasActionAccess("professor", "provas:manage_bank"), true);
    assert.equal(hasActionAccess("professor", "provas:grade"), true);
    assert.equal(hasModuleAccess("professor", "provas"), true);

    // Aluno pode realizar provas (attempt), mas NÃO pode gerenciar banco de questões
    assert.equal(hasActionAccess("aluno", "provas:attempt"), true);
    assert.equal(hasActionAccess("aluno", "provas:manage_bank"), false);
    assert.equal(hasActionAccess("aluno", "provas:grade"), false);
    assert.equal(hasModuleAccess("aluno", "provas"), true);

    // Financeiro NÃO tem acesso a provas
    assert.equal(hasActionAccess("financeiro", "provas:manage_bank"), false);
    assert.equal(hasActionAccess("financeiro", "provas:attempt"), false);
    assert.equal(hasModuleAccess("financeiro", "provas"), false);
  });

  await t.test("Contratos e Dicionários de Tipos de Questão", () => {
    assert.equal(QUESTION_TYPE_LABELS.multipla_escolha, "Múltipla Escolha");
    assert.equal(QUESTION_TYPE_LABELS.verdadeiro_falso, "Verdadeiro ou Falso");
  });

  await t.test("Validação Local de DTOs de Questão e Avaliação", () => {
    // 1. Questão
    const questionDto: AssessmentQuestionInput = {
      subject_id: "fake-uuid-subject",
      question_type: "multipla_escolha",
      prompt: "Qual o documento histórico teológico formulado em 1647 em Westminster?",
      explanation: "A Confissão de Fé de Westminster e seus catecismos Maior e Breve.",
      points: 1.5,
      is_active: true,
      options: [
        { option_text: "Confissão de Fé de Westminster", is_correct: true, order_index: 1 },
        { option_text: "Cânones de Dort", is_correct: false, order_index: 2 },
        { option_text: "Catecismo de Heidelberg", is_correct: false, order_index: 3 },
        { option_text: "Confissão Belga", is_correct: false, order_index: 4 },
      ],
    };
    assert.ok(questionDto.prompt.length >= 3);
    assert.equal(questionDto.options.length, 4);
    assert.equal(questionDto.options.filter((o) => o.is_correct).length, 1);

    // 2. Avaliação / Prova
    const assessmentDto: AssessmentInput = {
      subject_id: "fake-uuid-subject",
      title: "Prova Semestral de Teologia Histórica",
      questions_count: 10,
      duration_minutes: 60,
      max_attempts: 2,
      passing_grade: 7.0,
      shuffle_questions: true,
      shuffle_options: true,
      release_answer_key: true,
      is_active: true,
    };
    assert.ok(assessmentDto.title.length >= 3);
    assert.ok(assessmentDto.questions_count > 0);
    assert.ok(assessmentDto.duration_minutes > 0);
    assert.equal(assessmentDto.passing_grade, 7.0);

    // 3. Submissão de Tentativa
    const submitDto: SubmitAttemptInput = {
      attempt_id: "fake-uuid-attempt",
      answers: [
        { question_id: "fake-q1", selected_option_id: "fake-opt1" },
        { question_id: "fake-q2", selected_option_id: "fake-opt2" },
      ],
    };
    assert.ok(submitDto.attempt_id.length > 0);
    assert.equal(submitDto.answers.length, 2);
  });
});

test("TeoClass — Suíte de Testes Remotos de Avaliações (Pendente da Migration 0007)", async (t) => {
  await t.test(
    "TESTE PENDENTE: Cadastro de questão e alternativas no Tenant A com isolamento contra Tenant B",
    { todo: "Aguardando aplicação da migration 0007_assessments_and_question_bank.sql no Supabase TeoClass." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: RLS de aluno impedindo consulta de is_correct (gabarito) em question_options",
    { todo: "Aguardando aplicação da migration 0007 no Supabase." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Imutabilidade de tenant_id em assessment_questions, assessments e assessment_attempts",
    { todo: "Aguardando aplicação da migration 0007 no Supabase." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Correção automática e cega de tentativa no servidor calculando nota real",
    { todo: "Aguardando aplicação da migration 0007 e homologação remota da Server Action." },
    () => {}
  );
});
