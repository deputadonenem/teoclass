// ==============================================================================
// TeoClass — Tipos de Desempenho Acadêmico e Boletins (Lote 8)
// ==============================================================================

import type { Course, SchoolClass, Subject } from "./academico";
import type { Assessment, AssessmentAttempt } from "./provas";

/**
 * Situação acadêmica calculada para uma disciplina ou curso
 */
export type AcademicPerformanceSituation =
  | "aprovado"
  | "reprovado"
  | "recuperacao"
  | "em_andamento"
  | "nao_iniciado";

/**
 * Configuração institucional para cálculo de desempenho e aprovação
 */
export interface AcademicGradingPolicy {
  minimumPassingGrade: number;       // Ex: 7.0 (nota mínima para aprovação)
  recoveryThresholdGrade: number;   // Ex: 5.0 (abaixo disso é reprovado direto, acima até 6.9 é recuperação)
  maxGrade: number;                 // Ex: 10.0
  gradeCalculationMethod: "best_score" | "latest_attempt" | "average_scores"; // Padrão teológico: melhor nota da avaliação
}

export const DEFAULT_GRADING_POLICY: AcademicGradingPolicy = {
  minimumPassingGrade: 7.0,
  recoveryThresholdGrade: 5.0,
  maxGrade: 10.0,
  gradeCalculationMethod: "best_score",
};

/**
 * Item de avaliação no boletim da disciplina
 */
export interface AssessmentGradeItem {
  assessmentId: string;
  title: string;
  passingGrade: number;
  totalAttemptsAllowed: number;
  attemptsMadeCount: number;
  bestScore: number | null;
  latestScore: number | null;
  finalScore: number | null;
  passed: boolean | null;
  attempts: Array<{
    attemptNumber: number;
    startedAt: string;
    submittedAt: string | null;
    status: string;
    score: number | null;
    passed: boolean | null;
  }>;
}

/**
 * Registro de desempenho do aluno por disciplina
 */
export interface SubjectGradeReport {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  workloadHours: number;
  orderIndex: number;
  teacherName: string | null;
  assessments: AssessmentGradeItem[];
  averageScore: number | null;
  situation: AcademicPerformanceSituation;
  completedAssessmentsCount: number;
  totalAssessmentsCount: number;
}

/**
 * Boletim Acadêmico individual de um Aluno em uma Matrícula/Turma
 */
export interface StudentReportCard {
  enrollmentId: string;
  enrollmentNumber: string;
  enrollmentStatus: string;
  student: {
    id: string;
    fullName: string;
    cpf: string | null;
    email: string | null;
  };
  course: {
    id: string;
    name: string;
    code: string | null;
    workloadHours: number;
  };
  schoolClass: {
    id: string;
    name: string;
    periodLabel: string | null;
    shift: string;
  } | null;
  gradingPolicy: AcademicGradingPolicy;
  subjects: SubjectGradeReport[];
  overallAverage: number | null;
  overallSituation: AcademicPerformanceSituation;
  totalSubjects: number;
  approvedSubjectsCount: number;
}

/**
 * Linha de desempenho do aluno para visão de Turma / Professor / Secretaria
 */
export interface StudentClassPerformanceRow {
  studentId: string;
  studentName: string;
  studentCpf: string | null;
  enrollmentId: string;
  enrollmentNumber: string;
  enrollmentStatus: string;
  overallAverage: number | null;
  situation: AcademicPerformanceSituation;
  subjectsSummary: Array<{
    subjectId: string;
    subjectName: string;
    averageScore: number | null;
    situation: AcademicPerformanceSituation;
  }>;
  assessmentsCompleted: number;
  assessmentsPending: number;
}

/**
 * Visão consolidada de desempenho de uma Turma
 */
export interface ClassPerformanceReport {
  schoolClass: {
    id: string;
    name: string;
    courseId: string;
    courseName: string;
    periodLabel: string | null;
  };
  gradingPolicy: AcademicGradingPolicy;
  totalStudents: number;
  activeStudents: number;
  classAverage: number | null;
  approvalRatePercentage: number;
  students: StudentClassPerformanceRow[];
}
