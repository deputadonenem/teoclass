// ==============================================================================
// TeoClass — Tipos do Módulo de Avaliações & Banco de Questões (EAD)
// ==============================================================================

import type { Subject, SchoolClass } from "./academico";

export type QuestionType = "multipla_escolha" | "verdadeiro_falso";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multipla_escolha: "Múltipla Escolha",
  verdadeiro_falso: "Verdadeiro ou Falso",
};

/**
 * Alternativa da Questão
 */
export interface QuestionOption {
  id: string;
  tenant_id: string;
  question_id: string;
  option_text: string;
  is_correct?: boolean; // Ocultado do aluno durante a realização da prova
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionOptionInput {
  id?: string;
  option_text: string;
  is_correct: boolean;
  order_index?: number;
}

/**
 * Questão do Banco de Avaliações
 */
export interface AssessmentQuestion {
  id: string;
  tenant_id: string;
  subject_id: string;
  question_type: QuestionType;
  prompt: string;
  explanation: string | null;
  points: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Agregações
  options?: QuestionOption[];
  subject?: Subject;
}

export interface AssessmentQuestionInput {
  subject_id: string;
  question_type: QuestionType;
  prompt: string;
  explanation?: string | null;
  points: number;
  is_active?: boolean;
  options: QuestionOptionInput[];
}

/**
 * Avaliação / Prova Configurada
 */
export interface Assessment {
  id: string;
  tenant_id: string;
  subject_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  questions_count: number;
  duration_minutes: number;
  max_attempts: number;
  passing_grade: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  release_answer_key: boolean;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Agregações
  subject?: Subject;
  school_class?: SchoolClass | null;
  user_attempts_count?: number;
  user_best_score?: number | null;
  user_can_attempt?: boolean;
}

export interface AssessmentInput {
  subject_id: string;
  class_id?: string | null;
  title: string;
  description?: string | null;
  questions_count: number;
  duration_minutes: number;
  max_attempts: number;
  passing_grade: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  release_answer_key?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
}

export type AttemptStatus = "em_andamento" | "submetida" | "expirada";

/**
 * Snapshot de Questão Congelada para Tentativa (sem gabarito)
 */
export interface SnapshotQuestionOption {
  id: string;
  option_text: string;
  order_index: number;
  is_correct?: boolean; // Só preenchido após submissão e com release_answer_key habilitado
}

export interface SnapshotQuestion {
  id: string;
  prompt: string;
  question_type: QuestionType;
  points: number;
  explanation?: string | null;
  options: SnapshotQuestionOption[];
}

/**
 * Tentativa de Avaliação do Aluno
 */
export interface AssessmentAttempt {
  id: string;
  tenant_id: string;
  assessment_id: string;
  student_id: string;
  enrollment_id: string;
  attempt_number: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: AttemptStatus;
  total_score: number | null;
  passed: boolean | null;
  snapshot_questions: SnapshotQuestion[];
  created_at: string;
  updated_at: string;
  // Agregações
  assessment?: Assessment;
  answers?: AttemptAnswer[];
}

/**
 * Resposta de Questão na Tentativa
 */
export interface AttemptAnswer {
  id: string;
  tenant_id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_correct?: boolean | null;
  score_earned?: number | null;
  answered_at: string;
}

export interface SubmitAttemptInput {
  attempt_id: string;
  answers: Array<{
    question_id: string;
    selected_option_id: string;
  }>;
}
