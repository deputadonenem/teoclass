import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAssessmentScore,
  evaluateSituation,
  calculateSubjectAverage,
  calculateOverallPerformance,
} from "../src/lib/academico/calculator.ts";
import { DEFAULT_GRADING_POLICY } from "../src/types/desempenho.ts";
import type { AssessmentGradeItem, SubjectGradeReport } from "../src/types/desempenho.ts";

test("TeoClass — Motor de Desempenho Acadêmico e Boletins (Lote 8)", async (t) => {
  await t.test("1. Cálculo de nota de avaliação: melhor nota entre múltiplas tentativas", () => {
    const attempts = [
      { score: 6.0, status: "submetida", submittedAt: "2026-11-19T10:00:00Z", attemptNumber: 1 },
      { score: 9.5, status: "submetida", submittedAt: "2026-11-19T11:00:00Z", attemptNumber: 2 },
      { score: 8.0, status: "submetida", submittedAt: "2026-11-19T12:00:00Z", attemptNumber: 3 },
    ];

    const result = calculateAssessmentScore(attempts, DEFAULT_GRADING_POLICY);
    assert.equal(result.bestScore, 9.5);
    assert.equal(result.latestScore, 8.0);
    assert.equal(result.finalScore, 9.5, "Padrão teológico deve adotar a melhor nota do aluno");
  });

  await t.test("2. Cálculo de nota de avaliação: ignora tentativas em andamento ou nulas", () => {
    const attempts = [
      { score: null, status: "em_andamento", submittedAt: null, attemptNumber: 1 },
      { score: 7.5, status: "submetida", submittedAt: "2026-11-19T10:00:00Z", attemptNumber: 2 },
    ];

    const result = calculateAssessmentScore(attempts, DEFAULT_GRADING_POLICY);
    assert.equal(result.finalScore, 7.5);
    assert.equal(result.bestScore, 7.5);
  });

  await t.test("3. Avaliação da situação acadêmica com base na régua configurável", () => {
    // Mínimo para aprovação = 7.0, Recuperação = 5.0
    assert.equal(evaluateSituation(8.5, DEFAULT_GRADING_POLICY, false), "aprovado");
    assert.equal(evaluateSituation(7.0, DEFAULT_GRADING_POLICY, false), "aprovado");
    assert.equal(evaluateSituation(6.5, DEFAULT_GRADING_POLICY, false), "recuperacao");
    assert.equal(evaluateSituation(5.0, DEFAULT_GRADING_POLICY, false), "recuperacao");
    assert.equal(evaluateSituation(4.9, DEFAULT_GRADING_POLICY, false), "reprovado");
    assert.equal(evaluateSituation(6.5, DEFAULT_GRADING_POLICY, true), "em_andamento", "Se tem provas pendentes, situação é em andamento");
    assert.equal(evaluateSituation(null, DEFAULT_GRADING_POLICY, true), "nao_iniciado");
  });

  await t.test("4. Média da disciplina a partir de múltiplas avaliações", () => {
    const assessments: AssessmentGradeItem[] = [
      {
        assessmentId: "ass-1",
        title: "Prova Parcial 1",
        passingGrade: 7.0,
        totalAttemptsAllowed: 2,
        attemptsMadeCount: 1,
        bestScore: 8.0,
        latestScore: 8.0,
        finalScore: 8.0,
        passed: true,
        attempts: [],
      },
      {
        assessmentId: "ass-2",
        title: "Prova Parcial 2",
        passingGrade: 7.0,
        totalAttemptsAllowed: 2,
        attemptsMadeCount: 1,
        bestScore: 6.0,
        latestScore: 6.0,
        finalScore: 6.0,
        passed: false,
        attempts: [],
      },
    ];

    const result = calculateSubjectAverage(assessments, DEFAULT_GRADING_POLICY);
    assert.equal(result.averageScore, 7.0, "(8.0 + 6.0) / 2 = 7.0");
    assert.equal(result.situation, "aprovado");
    assert.equal(result.completedCount, 2);
    assert.equal(result.totalCount, 2);
  });

  await t.test("5. Média Geral do Curso e Conclusão Acadêmica", () => {
    const subjects: SubjectGradeReport[] = [
      {
        subjectId: "sub-1",
        subjectName: "Teologia Sistemática I",
        subjectCode: "TS101",
        workloadHours: 60,
        orderIndex: 1,
        teacherName: "Pr. João",
        assessments: [],
        averageScore: 9.0,
        situation: "aprovado",
        completedAssessmentsCount: 2,
        totalAssessmentsCount: 2,
      },
      {
        subjectId: "sub-2",
        subjectName: "Hermenêutica Bíblica",
        subjectCode: "HB102",
        workloadHours: 40,
        orderIndex: 2,
        teacherName: "Dr. Paulo",
        assessments: [],
        averageScore: 8.0,
        situation: "aprovado",
        completedAssessmentsCount: 2,
        totalAssessmentsCount: 2,
      },
    ];

    const overall = calculateOverallPerformance(subjects, DEFAULT_GRADING_POLICY);
    assert.equal(overall.overallAverage, 8.5);
    assert.equal(overall.overallSituation, "aprovado");
    assert.equal(overall.approvedCount, 2);
  });
});
