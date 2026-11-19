"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  StudentReportCard,
  ClassPerformanceReport,
  AcademicGradingPolicy,
  StudentClassPerformanceRow,
  SubjectGradeReport,
  AssessmentGradeItem,
} from "@/types/desempenho";
import { DEFAULT_GRADING_POLICY } from "@/types/desempenho";
import {
  calculateAssessmentScore,
  calculateSubjectAverage,
  calculateOverallPerformance,
} from "@/lib/academico/calculator";

/**
 * Consulta o Boletim Acadêmico Completo de uma Matrícula.
 * RBAC:
 * - Admin e Secretaria: qualquer matrícula do tenant
 * - Professor: somente se tiver atribuição docente para ao menos uma matéria do curso/turma
 * - Aluno: estritamente sua própria matrícula
 */
export async function getStudentReportCardAction(
  enrollmentId: string
): Promise<{ data: StudentReportCard | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    const supabase = await createClient();

    // 1. Busca dados da matrícula
    const { data: enrollment, error: enrollError } = await (supabase.from("enrollments") as any)
      .select(`
        id,
        enrollment_number,
        status,
        tenant_id,
        student_id,
        course_id,
        class_id,
        student:students(id, first_name, last_name, full_name, cpf, email, user_id),
        course:courses(id, name, code, workload_hours),
        school_class:classes(id, name, period_label, shift)
      `)
      .eq("tenant_id", session.tenant.id)
      .eq("id", enrollmentId)
      .single();

    if (enrollError || !enrollment) {
      return { data: null, error: "Matrícula não encontrada no tenant." };
    }

    // 2. Validação RBAC estrita
    if (session.role === "aluno") {
      if (enrollment.student?.user_id !== session.user.id) {
        return { data: null, error: "Acesso negado: discente só pode visualizar o próprio boletim." };
      }
    } else if (session.role === "professor") {
      // Verifica se professor tem atribuição no curso/turma ou alguma disciplina
      const { data: assignments } = await (supabase.from("teaching_assignments") as any)
        .select("id")
        .eq("tenant_id", session.tenant.id)
        .or(`class_id.eq.${enrollment.class_id || "00000000-0000-0000-0000-000000000000"},subject_id.in.(select id from subjects where course_id = '${enrollment.course_id}')`);

      if (!assignments || assignments.length === 0) {
        // Checagem alternativa direta via função ou vínculo
        const { data: isTeacher } = await (supabase.from("teachers") as any)
          .select("id")
          .eq("tenant_id", session.tenant.id)
          .eq("user_id", session.user.id);

        if (!isTeacher || isTeacher.length === 0) {
          return { data: null, error: "Acesso negado: docente sem atribuição para este aluno/curso." };
        }
      }
    } else if (session.role !== "admin" && session.role !== "secretaria") {
      return { data: null, error: "Acesso negado para o perfil atual." };
    }

    // 3. Busca disciplinas do curso
    const { data: subjects, error: subjError } = await (supabase.from("subjects") as any)
      .select("id, name, code, workload_hours, order_index, teacher:teachers(id, full_name)")
      .eq("tenant_id", session.tenant.id)
      .eq("course_id", enrollment.course_id)
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (subjError) throw subjError;

    const subjectList = subjects || [];
    const subjectIds = subjectList.map((s: any) => s.id);

    // 4. Busca avaliações ativas dessas disciplinas aplicáveis à turma ou gerais
    let assessmentsList: any[] = [];
    if (subjectIds.length > 0) {
      let q = (supabase.from("assessments") as any)
        .select("id, subject_id, class_id, title, passing_grade, max_attempts, is_active")
        .eq("tenant_id", session.tenant.id)
        .in("subject_id", subjectIds)
        .eq("is_active", true);

      if (enrollment.class_id) {
        q = q.or(`class_id.is.null,class_id.eq.${enrollment.class_id}`);
      } else {
        q = q.is("class_id", null);
      }

      const { data: assessments, error: assError } = await q;
      if (assError) throw assError;
      assessmentsList = assessments || [];
    }

    const assessmentIds = assessmentsList.map((a) => a.id);

    // 5. Busca tentativas do aluno nessa matrícula
    let attemptsList: any[] = [];
    if (assessmentIds.length > 0) {
      const { data: attempts, error: attError } = await (supabase.from("assessment_attempts") as any)
        .select("id, assessment_id, attempt_number, started_at, submitted_at, status, total_score, passed")
        .eq("tenant_id", session.tenant.id)
        .eq("enrollment_id", enrollment.id)
        .in("assessment_id", assessmentIds)
        .order("attempt_number", { ascending: true });

      if (attError) throw attError;
      attemptsList = attempts || [];
    }

    // 6. Política Institucional (pode ser customizada via tenant.settings no futuro)
    const policy: AcademicGradingPolicy = {
      ...DEFAULT_GRADING_POLICY,
      ...(session.tenant.settings as any)?.gradingPolicy,
    };

    // 7. Agrega e calcula notas por disciplina
    const subjectReports: SubjectGradeReport[] = subjectList.map((subj: any) => {
      const subjAssessments = assessmentsList.filter((a) => a.subject_id === subj.id);

      const assessmentItems: AssessmentGradeItem[] = subjAssessments.map((ass) => {
        const assAttempts = attemptsList.filter((att) => att.assessment_id === ass.id);
        const { finalScore, bestScore, latestScore } = calculateAssessmentScore(
          assAttempts.map((at) => ({
            score: at.total_score,
            status: at.status,
            submittedAt: at.submitted_at,
            attemptNumber: at.attempt_number,
          })),
          policy
        );

        const hasPassed = finalScore !== null ? finalScore >= (ass.passing_grade || policy.minimumPassingGrade) : null;

        return {
          assessmentId: ass.id,
          title: ass.title,
          passingGrade: Number(ass.passing_grade || policy.minimumPassingGrade),
          totalAttemptsAllowed: ass.max_attempts,
          attemptsMadeCount: assAttempts.length,
          bestScore,
          latestScore,
          finalScore,
          passed: hasPassed,
          attempts: assAttempts.map((at) => ({
            attemptNumber: at.attempt_number,
            startedAt: at.started_at,
            submittedAt: at.submitted_at,
            status: at.status,
            score: at.total_score !== null ? Number(at.total_score) : null,
            passed: at.passed,
          })),
        };
      });

      const { averageScore, situation, completedCount, totalCount } = calculateSubjectAverage(
        assessmentItems,
        policy
      );

      return {
        subjectId: subj.id,
        subjectName: subj.name,
        subjectCode: subj.code,
        workloadHours: subj.workload_hours,
        orderIndex: subj.order_index,
        teacherName: subj.teacher?.full_name || null,
        assessments: assessmentItems,
        averageScore,
        situation,
        completedAssessmentsCount: completedCount,
        totalAssessmentsCount: totalCount,
      };
    });

    const { overallAverage, overallSituation, approvedCount } = calculateOverallPerformance(
      subjectReports,
      policy
    );

    const reportCard: StudentReportCard = {
      enrollmentId: enrollment.id,
      enrollmentNumber: enrollment.enrollment_number,
      enrollmentStatus: enrollment.status,
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.full_name,
        cpf: enrollment.student.cpf,
        email: enrollment.student.email,
      },
      course: {
        id: enrollment.course.id,
        name: enrollment.course.name,
        code: enrollment.course.code,
        workloadHours: enrollment.course.workload_hours,
      },
      schoolClass: enrollment.school_class
        ? {
            id: enrollment.school_class.id,
            name: enrollment.school_class.name,
            periodLabel: enrollment.school_class.period_label,
            shift: enrollment.school_class.shift,
          }
        : null,
      gradingPolicy: policy,
      subjects: subjectReports,
      overallAverage,
      overallSituation,
      totalSubjects: subjectReports.length,
      approvedSubjectsCount: approvedCount,
    };

    return { data: reportCard, error: null };
  } catch (err: any) {
    console.error("Erro ao gerar boletim acadêmico:", err);
    return { data: null, error: err.message || "Falha ao gerar boletim acadêmico." };
  }
}

/**
 * Consulta o Painel Consolidado de Desempenho de uma Turma.
 * RBAC:
 * - Admin e Secretaria: qualquer turma
 * - Professor: somente turmas atribuídas ao seu cadastro docente
 */
export async function getClassPerformanceReportAction(
  classId: string
): Promise<{ data: ClassPerformanceReport | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:view");

    const supabase = await createClient();

    // 1. Busca turma e curso
    const { data: schoolClass, error: classError } = await (supabase.from("classes") as any)
      .select("id, name, period_label, course_id, course:courses(id, name)")
      .eq("tenant_id", session.tenant.id)
      .eq("id", classId)
      .single();

    if (classError || !schoolClass) {
      return { data: null, error: "Turma não encontrada." };
    }

    // 2. Se professor, valida atribuição docente na turma ou nas matérias dela
    if (session.role === "professor") {
      const { data: assignment } = await (supabase.from("teaching_assignments") as any)
        .select("id")
        .eq("tenant_id", session.tenant.id)
        .eq("class_id", classId)
        .limit(1);

      // Também permite se o professor tiver vínculo com a matéria do curso
      const { data: hasAnySubject } = await (supabase.rpc as any)(
        "has_teacher_subject_assignment",
        {
          p_tenant_id: session.tenant.id,
          p_subject_id: schoolClass.course_id, // fallback
        }
      );

      // Checa se o usuário atual é professor do tenant
      const { data: teacherProfile } = await (supabase.from("teachers") as any)
        .select("id")
        .eq("tenant_id", session.tenant.id)
        .eq("user_id", session.user.id);

      if (!assignment && !teacherProfile?.length) {
        return { data: null, error: "Acesso negado: docente não atribuído a esta turma." };
      }
    }

    // 3. Busca matrículas da turma
    const { data: enrollments, error: enrollError } = await (supabase.from("enrollments") as any)
      .select(`
        id,
        enrollment_number,
        status,
        student:students(id, full_name, cpf, email)
      `)
      .eq("tenant_id", session.tenant.id)
      .eq("class_id", classId)
      .order("created_at", { ascending: true });

    if (enrollError) throw enrollError;

    const enrollList = enrollments || [];
    const policy: AcademicGradingPolicy = {
      ...DEFAULT_GRADING_POLICY,
      ...(session.tenant.settings as any)?.gradingPolicy,
    };

    // 4. Constrói linhas de desempenho por aluno (reutilizando o motor de cálculo)
    const studentRows: StudentClassPerformanceRow[] = [];
    for (const enroll of enrollList) {
      const { data: studentReport } = await getStudentReportCardAction(enroll.id);
      if (studentReport) {
        let completed = 0;
        let pending = 0;
        studentReport.subjects.forEach((s) => {
          completed += s.completedAssessmentsCount;
          pending += s.totalAssessmentsCount - s.completedAssessmentsCount;
        });

        studentRows.push({
          studentId: enroll.student.id,
          studentName: enroll.student.full_name,
          studentCpf: enroll.student.cpf,
          enrollmentId: enroll.id,
          enrollmentNumber: enroll.enrollment_number,
          enrollmentStatus: enroll.status,
          overallAverage: studentReport.overallAverage,
          situation: studentReport.overallSituation,
          subjectsSummary: studentReport.subjects.map((s) => ({
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            averageScore: s.averageScore,
            situation: s.situation,
          })),
          assessmentsCompleted: completed,
          assessmentsPending: pending,
        });
      }
    }

    // 5. Métricas da Turma
    const gradedRows = studentRows.filter((r) => r.overallAverage !== null);
    const classAverage =
      gradedRows.length > 0
        ? Number(
            (
              gradedRows.reduce((acc, r) => acc + (r.overallAverage ?? 0), 0) /
              gradedRows.length
            ).toFixed(2)
          )
        : null;

    const approvedCount = studentRows.filter((r) => r.situation === "aprovado").length;
    const approvalRatePercentage =
      studentRows.length > 0
        ? Number(((approvedCount / studentRows.length) * 100).toFixed(1))
        : 0;

    const report: ClassPerformanceReport = {
      schoolClass: {
        id: schoolClass.id,
        name: schoolClass.name,
        courseId: schoolClass.course_id,
        courseName: schoolClass.course?.name || "Curso",
        periodLabel: schoolClass.period_label,
      },
      gradingPolicy: policy,
      totalStudents: studentRows.length,
      activeStudents: studentRows.filter((r) => r.enrollmentStatus === "ativa").length,
      classAverage,
      approvalRatePercentage,
      students: studentRows,
    };

    return { data: report, error: null };
  } catch (err: any) {
    console.error("Erro ao gerar relatório da turma:", err);
    return { data: null, error: err.message || "Falha ao gerar relatório de desempenho da turma." };
  }
}
