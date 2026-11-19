// ==============================================================================
// TeoClass — Tipos do Portal do Aluno & Dashboard Consolidado (Lote 11)
// ==============================================================================

import type { StudentReportCard } from "./desempenho";
import type { AcademicDocument } from "./documentos";
import type { Receivable } from "./financeiro";

/**
 * Resumo de Matrícula para o Portal do Aluno
 */
export interface StudentPortalEnrollmentSummary {
  enrollmentId: string;
  enrollmentNumber: string;
  status: string;
  enrolledAt: string;
  course: {
    id: string;
    name: string;
    code: string | null;
    workloadHours: number;
    modality: string;
  };
  schoolClass: {
    id: string;
    name: string;
    periodLabel: string | null;
    shift: string;
  } | null;
  academicSummary: {
    overallAverage: number | null;
    situation: string;
    completedAssessmentsCount: number;
    totalAssessmentsCount: number;
  };
  pendingChargesCount: number;
  overdueChargesCount: number;
}

/**
 * Dados Completos Consolidados do Portal do Aluno
 */
export interface StudentPortalData {
  student: {
    id: string;
    fullName: string;
    cpfMasked: string;
    email: string | null;
  };
  enrollments: StudentPortalEnrollmentSummary[];
  activeEnrollmentReport: StudentReportCard | null;
  financialReceivables: Receivable[];
  documents: AcademicDocument[];
}

/**
 * Métricas Reais do Dashboard Geral Institucional (Admin/Secretaria/Financeiro)
 */
export interface InstitutionDashboardMetrics {
  totalActiveStudents: number;
  totalEnrollments: number;
  totalCourses: number;
  totalClasses: number;
  activeLessonsCount: number;
  activeAssessmentsCount: number;
  financial: {
    totalReceived: number;
    totalPending: number;
    totalOverdue: number;
    defaultRatePercentage: number;
  };
  recentEnrollments: Array<{
    id: string;
    enrollmentNumber: string;
    studentName: string;
    courseName: string;
    enrolledAt: string;
    status: string;
  }>;
}

/**
 * Métricas do Dashboard para o Corpo Docente (Professor)
 */
export interface TeacherDashboardMetrics {
  assignedClassesCount: number;
  assignedSubjectsCount: number;
  totalTaughtStudentsCount: number;
  pendingAssessmentsToGradeCount: number;
  assignedClasses: Array<{
    classId: string;
    className: string;
    courseName: string;
    studentsCount: number;
  }>;
}
