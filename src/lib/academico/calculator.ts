// ==============================================================================
// TeoClass — Motor de Cálculo de Médias e Desempenho Acadêmico (Lote 8)
// ==============================================================================

import type {
  AcademicGradingPolicy,
  AcademicPerformanceSituation,
  AssessmentGradeItem,
  SubjectGradeReport,
  StudentReportCard,
  DEFAULT_GRADING_POLICY,
} from "@/types/desempenho";

/**
 * Determina a nota final da avaliação a partir de suas tentativas com base na política institucional.
 * Por padrão e diretriz teológica, utiliza a MELHOR nota obtida pelo discente.
 */
export function calculateAssessmentScore(
  attempts: Array<{
    score: number | null;
    status: string;
    submittedAt: string | null;
    attemptNumber: number;
  }>,
  policy: AcademicGradingPolicy
): {
  finalScore: number | null;
  bestScore: number | null;
  latestScore: number | null;
} {
  // Filtra apenas tentativas válidas e avaliadas
  const evaluatedAttempts = attempts.filter(
    (a) => a.score !== null && a.status === "submetida"
  );

  if (evaluatedAttempts.length === 0) {
    return {
      finalScore: null,
      bestScore: null,
      latestScore: null,
    };
  }

  // Melhor nota
  const scores = evaluatedAttempts.map((a) => Number(a.score));
  const bestScore = Math.max(...scores);

  // Mais recente (maior attemptNumber ou mais recente submittedAt)
  const sorted = [...evaluatedAttempts].sort(
    (a, b) => b.attemptNumber - a.attemptNumber
  );
  const latestScore = Number(sorted[0].score);

  let finalScore = bestScore;

  if (policy.gradeCalculationMethod === "latest_attempt") {
    finalScore = latestScore;
  } else if (policy.gradeCalculationMethod === "average_scores") {
    const sum = scores.reduce((acc, s) => acc + s, 0);
    finalScore = Number((sum / scores.length).toFixed(2));
  }

  return {
    finalScore: Number(finalScore.toFixed(2)),
    bestScore: Number(bestScore.toFixed(2)),
    latestScore: Number(latestScore.toFixed(2)),
  };
}

/**
 * Determina a situação acadêmica baseada na nota média e na régua de aprovação institucional.
 */
export function evaluateSituation(
  averageScore: number | null,
  policy: AcademicGradingPolicy,
  hasPendingAssessments: boolean
): AcademicPerformanceSituation {
  if (averageScore === null) {
    return "nao_iniciado";
  }

  if (averageScore >= policy.minimumPassingGrade) {
    return "aprovado";
  }

  if (hasPendingAssessments) {
    return "em_andamento";
  }

  if (averageScore >= policy.recoveryThresholdGrade) {
    return "recuperacao";
  }

  return "reprovado";
}

/**
 * Calcula média aritmética das notas finais das avaliações de uma matéria
 */
export function calculateSubjectAverage(
  assessments: AssessmentGradeItem[],
  policy: AcademicGradingPolicy
): {
  averageScore: number | null;
  situation: AcademicPerformanceSituation;
  completedCount: number;
  totalCount: number;
} {
  const totalCount = assessments.length;
  if (totalCount === 0) {
    return {
      averageScore: null,
      situation: "em_andamento",
      completedCount: 0,
      totalCount: 0,
    };
  }

  const completed = assessments.filter((a) => a.finalScore !== null);
  const completedCount = completed.length;
  const hasPendingAssessments = completedCount < totalCount;

  if (completedCount === 0) {
    return {
      averageScore: null,
      situation: "nao_iniciado",
      completedCount: 0,
      totalCount,
    };
  }

  const sum = completed.reduce((acc, a) => acc + (a.finalScore ?? 0), 0);
  const average = Number((sum / completedCount).toFixed(2));
  const situation = evaluateSituation(average, policy, hasPendingAssessments);

  return {
    averageScore: average,
    situation,
    completedCount,
    totalCount,
  };
}

/**
 * Calcula a média geral do aluno ponderando as disciplinas
 */
export function calculateOverallPerformance(
  subjects: SubjectGradeReport[],
  policy: AcademicGradingPolicy
): {
  overallAverage: number | null;
  overallSituation: AcademicPerformanceSituation;
  approvedCount: number;
} {
  if (subjects.length === 0) {
    return {
      overallAverage: null,
      overallSituation: "em_andamento",
      approvedCount: 0,
    };
  }

  const gradedSubjects = subjects.filter((s) => s.averageScore !== null);
  if (gradedSubjects.length === 0) {
    return {
      overallAverage: null,
      overallSituation: "nao_iniciado",
      approvedCount: 0,
    };
  }

  const sum = gradedSubjects.reduce((acc, s) => acc + (s.averageScore ?? 0), 0);
  const overallAverage = Number((sum / gradedSubjects.length).toFixed(2));

  const approvedCount = subjects.filter((s) => s.situation === "aprovado").length;
  const hasFailures = subjects.some((s) => s.situation === "reprovado");
  const hasRecovery = subjects.some((s) => s.situation === "recuperacao");
  const hasPending = subjects.some(
    (s) => s.situation === "em_andamento" || s.situation === "nao_iniciado"
  );

  let overallSituation: AcademicPerformanceSituation = "em_andamento";
  if (approvedCount === subjects.length) {
    overallSituation = "aprovado";
  } else if (hasFailures && !hasPending) {
    overallSituation = "reprovado";
  } else if (hasRecovery && !hasPending) {
    overallSituation = "recuperacao";
  } else {
    overallSituation = "em_andamento";
  }

  return {
    overallAverage,
    overallSituation,
    approvedCount,
  };
}
