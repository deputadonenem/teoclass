/**
 * Tipos e Interfaces do Módulo Acadêmico, Currículo & Professores — TeoClass
 * Alinhado com a Especificação Técnica de Seminários e Institutos Bíblicos
 */

export type CourseModality = "presencial" | "hibrido" | "ead_assincrono";
export type CourseFormat = "simples" | "estruturado";
export type ClassShift = "matutino" | "vespertino" | "noturno" | "integral" | "sabado" | "tempo_flexivel";
export type ClassStatus = "prevista" | "em_andamento" | "concluida" | "cancelada";

export type EnrollmentStatus =
  | "pre_matricula"
  | "em_analise"
  | "ativa"
  | "trancada"
  | "cancelada"
  | "concluida"
  | "transferida";

export type TeachingRole = "titular" | "adjunto" | "tutor" | "convidado";

/**
 * Professor / Docente Teológico
 */
export interface Teacher {
  id: string;
  tenant_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  academic_title: string | null;
  theological_specialties: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Agregações opcionais em tela
  assignments_count?: number;
  assignments?: TeachingAssignment[];
}

/**
 * Atribuição Docente (Vínculo de Professor a Turma e/ou Disciplina)
 */
export interface TeachingAssignment {
  id: string;
  tenant_id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: string | null;
  role_description: TeachingRole;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Relações carregadas
  teacher?: Teacher;
  class?: SchoolClass | null;
  subject?: Subject | null;
}

/**
 * Curso Teológico
 */
export interface Course {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  description: string | null;
  modality: CourseModality;
  format: CourseFormat;
  duration_months: number | null;
  workload_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Agregações opcionais em tela
  classes_count?: number;
  enrollments_count?: number;
  modules_count?: number;
  subjects_count?: number;
}

/**
 * Módulo / Período Teológico do Curso (Opcional, para cursos estruturados ou blocos temáticos)
 */
export interface CourseModule {
  id: string;
  tenant_id: string;
  course_id: string;
  name: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Agregações
  subjects?: Subject[];
  subjects_count?: number;
}

/**
 * Disciplina Teológica (Matéria)
 */
export interface Subject {
  id: string;
  tenant_id: string;
  course_id: string;
  module_id: string | null;
  name: string;
  code: string | null;
  syllabus: string | null; // Ementa teológica / bibliografia
  workload_hours: number;
  order_index: number;
  teacher_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Agregações opcionais
  course?: Course;
  module?: CourseModule | null;
  teacher?: Teacher | {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

/**
 * Turma Teológica
 */
export interface SchoolClass {
  id: string;
  tenant_id: string;
  course_id: string;
  name: string;
  code: string | null;
  period_label: string | null; // Ex: 2026/1, Turma Alpha, Sábado Noite
  shift: ClassShift;
  status: ClassStatus;
  capacity: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Agregações opcionais
  course?: Course;
  enrolled_count?: number;
}

/**
 * Matrícula Teológica
 */
export interface Enrollment {
  id: string;
  tenant_id: string;
  student_id: string;
  course_id: string;
  class_id: string | null;
  enrollment_number: string;
  status: EnrollmentStatus;
  status_reason: string | null;
  enrolled_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relações carregadas
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    cpf: string | null;
    email: string | null;
    phone: string | null;
  };
  course?: Course;
  class?: SchoolClass | null;
}

/**
 * DTOs para Criação e Atualização de Cursos
 */
export interface CourseInput {
  name: string;
  code?: string | null;
  description?: string | null;
  modality: CourseModality;
  format: CourseFormat;
  duration_months?: number | null;
  workload_hours: number;
  is_active?: boolean;
}

/**
 * DTOs para Módulos / Períodos
 */
export interface CourseModuleInput {
  course_id: string;
  name: string;
  description?: string | null;
  order_index?: number;
  is_active?: boolean;
}

/**
 * DTOs para Disciplinas Teológicas
 */
export interface SubjectInput {
  course_id: string;
  module_id?: string | null;
  name: string;
  code?: string | null;
  syllabus?: string | null;
  workload_hours: number;
  order_index?: number;
  teacher_id?: string | null;
  is_active?: boolean;
}

/**
 * DTOs para Professores
 */
export interface TeacherInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  academic_title?: string | null;
  theological_specialties?: string | null;
  bio?: string | null;
  user_id?: string | null;
  is_active?: boolean;
}

/**
 * DTOs para Atribuições Docentes
 */
export interface TeachingAssignmentInput {
  teacher_id: string;
  class_id?: string | null;
  subject_id?: string | null;
  role_description?: TeachingRole;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

/**
 * DTOs para Criação e Atualização de Turmas
 */
export interface ClassInput {
  course_id: string;
  name: string;
  code?: string | null;
  period_label?: string | null;
  shift: ClassShift;
  status?: ClassStatus;
  capacity: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
}

/**
 * DTOs para Matrículas
 */
export interface EnrollmentInput {
  student_id: string;
  course_id: string;
  class_id?: string | null;
  enrollment_number?: string;
  status?: EnrollmentStatus;
  status_reason?: string | null;
  enrolled_at?: string;
  notes?: string | null;
}

export const MODALITY_LABELS: Record<CourseModality, string> = {
  presencial: "Presencial",
  hibrido: "Híbrido",
  ead_assincrono: "EAD Assíncrono",
};

export const FORMAT_LABELS: Record<CourseFormat, string> = {
  simples: "Simples (Direto por Aulas)",
  estruturado: "Estruturado (Módulos & Disciplinas)",
};

export const SHIFT_LABELS: Record<ClassShift, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  noturno: "Noturno",
  integral: "Integral",
  sabado: "Sábados / Intensivo",
  tempo_flexivel: "Tempo Flexível (EAD)",
};

export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = {
  prevista: "Prevista",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pre_matricula: "Pré-matrícula",
  em_analise: "Em Análise",
  ativa: "Ativa",
  trancada: "Trancada",
  cancelada: "Cancelada",
  concluida: "Concluída",
  transferida: "Transferida",
};

export const TEACHING_ROLE_LABELS: Record<TeachingRole, string> = {
  titular: "Professor Titular",
  adjunto: "Professor Adjunto / Co-docente",
  tutor: "Tutor Acadêmico",
  convidado: "Professor Convidado / Preletor",
};
