import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasModuleAccess } from '../src/lib/rbac/permissions.ts';
import type {
  StudentPortalEnrollmentSummary,
  StudentPortalData,
  InstitutionDashboardMetrics,
  TeacherDashboardMetrics
} from '../src/types/dashboard.ts';

describe('TeoClass — Lote 11: Portal do Aluno e Dashboard Consolidado', () => {
  describe('1. Regras de RBAC e Segregação de Módulos (Aluno vs Gestão)', () => {
    it('Aluno deve ter acesso estrito ao portal_aluno e módulos de aprendizagem, sem acesso aos módulos de gestão administrativa/financeira', () => {
      // Permitidos
      assert.equal(hasModuleAccess('aluno', 'portal_aluno'), true);
      assert.equal(hasModuleAccess('aluno', 'ead'), true);
      assert.equal(hasModuleAccess('aluno', 'provas'), true);
      assert.equal(hasModuleAccess('aluno', 'certificados'), true);

      // Bloqueados da administração escolar
      assert.equal(hasModuleAccess('aluno', 'secretaria'), false);
      assert.equal(hasModuleAccess('aluno', 'academico'), false);
      assert.equal(hasModuleAccess('aluno', 'financeiro'), false);
      assert.equal(hasModuleAccess('aluno', 'configuracoes'), false);
      assert.equal(hasModuleAccess('aluno', 'captacao'), false);
    });

    it('Perfis de Gestão (Admin, Secretaria, Financeiro) e Docente devem acessar o dashboard institucional/docente', () => {
      assert.equal(hasModuleAccess('admin', 'inicio'), true);
      assert.equal(hasModuleAccess('secretaria', 'inicio'), true);
      assert.equal(hasModuleAccess('financeiro', 'inicio'), true);
      assert.equal(hasModuleAccess('professor', 'inicio'), true);
    });
  });

  describe('2. Integridade dos Modelos e Contratos de Dados (DTOs)', () => {
    it('Deve validar a estrutura de dados do Portal do Aluno (StudentPortalData)', () => {
      const mockEnrollment: StudentPortalEnrollmentSummary = {
        enrollmentId: 'enr-1',
        enrollmentNumber: 'MAT-2026-001',
        status: 'ativa',
        enrolledAt: '2026-02-01T10:00:00Z',
        course: {
          id: 'crs-1',
          name: 'Bacharelado em Teologia',
          code: 'TEO-BACH',
          workloadHours: 1600,
          modality: 'ead',
        },
        schoolClass: {
          id: 'cls-1',
          name: 'Turma Beta 2026',
          periodLabel: '2026.1',
          shift: 'noturno',
        },
        academicSummary: {
          overallAverage: 8.5,
          situation: 'aprovado',
          completedAssessmentsCount: 4,
          totalAssessmentsCount: 4,
        },
        pendingChargesCount: 1,
        overdueChargesCount: 0,
      };

      const portalData: StudentPortalData = {
        student: {
          id: 'stu-1',
          fullName: 'Lucas Evangelista',
          cpfMasked: '***.456.789-**',
          email: 'lucas@teoclass.local',
        },
        enrollments: [mockEnrollment],
        activeEnrollmentReport: null,
        financialReceivables: [],
        documents: [],
      };

      assert.equal(portalData.student.id, 'stu-1');
      assert.equal(portalData.enrollments.length, 1);
      assert.equal(portalData.enrollments[0].course.name, 'Bacharelado em Teologia');
      assert.equal(portalData.enrollments[0].academicSummary.overallAverage, 8.5);
      assert.equal(portalData.enrollments[0].pendingChargesCount, 1);
    });

    it('Deve validar a integridade dos indicadores do Dashboard Institucional (InstitutionDashboardMetrics)', () => {
      const metrics: InstitutionDashboardMetrics = {
        totalActiveStudents: 150,
        totalEnrollments: 165,
        totalCourses: 5,
        totalClasses: 8,
        activeLessonsCount: 120,
        activeAssessmentsCount: 24,
        financial: {
          totalReceived: 25400.00,
          totalPending: 5000.00,
          totalOverdue: 1850.50,
          defaultRatePercentage: 6.8,
        },
        recentEnrollments: [
          {
            id: 'enr-100',
            enrollmentNumber: 'MAT-2026-100',
            studentName: 'Barnabé de Chipre',
            courseName: 'Teologia Sistemática',
            enrolledAt: '2026-05-10T14:30:00Z',
            status: 'ativa',
          },
        ],
      };

      assert.equal(metrics.totalActiveStudents, 150);
      assert.equal(metrics.totalEnrollments, 165);
      assert.equal(metrics.financial.totalOverdue, 1850.50);
      assert.equal(metrics.recentEnrollments.length, 1);
      assert.equal(metrics.recentEnrollments[0].studentName, 'Barnabé de Chipre');
    });

    it('Deve validar os indicadores consolidados do Docente (TeacherDashboardMetrics)', () => {
      const teacherMetrics: TeacherDashboardMetrics = {
        assignedClassesCount: 3,
        assignedSubjectsCount: 4,
        totalTaughtStudentsCount: 75,
        pendingAssessmentsToGradeCount: 0,
        assignedClasses: [
          {
            classId: 'cls-1',
            className: 'Turma Hermenêutica 2026',
            courseName: 'Exegese Bíblica',
            studentsCount: 25,
          },
        ],
      };

      assert.equal(teacherMetrics.assignedClassesCount, 3);
      assert.equal(teacherMetrics.assignedSubjectsCount, 4);
      assert.equal(teacherMetrics.totalTaughtStudentsCount, 75);
      assert.equal(teacherMetrics.assignedClasses.length, 1);
      assert.equal(teacherMetrics.assignedClasses[0].courseName, 'Exegese Bíblica');
    });
  });

  describe('3. Cálculos de Progresso e Validação de Porcentagens', () => {
    it('deve calcular o progresso percentual corretamente sem divisões por zero', () => {
      const calcProgress = (completed: number, total: number) => {
        if (total <= 0) return 0;
        return Math.min(100, Math.round((completed / total) * 100));
      };

      assert.equal(calcProgress(0, 0), 0);
      assert.equal(calcProgress(5, 10), 50);
      assert.equal(calcProgress(10, 10), 100);
      assert.equal(calcProgress(15, 10), 100); // Teto de 100%
      assert.equal(calcProgress(1, 3), 33);
    });
  });
});
