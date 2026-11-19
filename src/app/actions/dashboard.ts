"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import type {
  InstitutionDashboardMetrics,
  TeacherDashboardMetrics,
  StudentPortalData,
  StudentPortalEnrollmentSummary,
} from "@/types/dashboard";
import { getStudentReportCardAction } from "./desempenho";
import { getAcademicDocumentsAction } from "./documentos";
import { getReceivablesAction } from "./financeiro";
import { maskCpf } from "@/lib/documentos/generator";

/**
 * Consulta as Métricas Reais do Dashboard Geral Institucional
 * RBAC: Restrito a Admin, Secretaria ou Financeiro do tenant
 */
export async function getInstitutionDashboardMetricsAction(): Promise<{
  data: InstitutionDashboardMetrics | null;
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "inicio" as any);

    if (session.role === "aluno" || session.role === "professor") {
      return { data: null, error: "Acesso negado: visão agregada institucional." };
    }

    const supabase = await createClient();

    // Consultas agregadas paralelas
    const [
      studentsRes,
      enrollmentsRes,
      coursesRes,
      classesRes,
      lessonsRes,
      assessmentsRes,
      receivablesRes,
      recentRes,
    ] = await Promise.all([
      (supabase.from("students") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id),
      (supabase.from("enrollments") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("status", "ativa"),
      (supabase.from("courses") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("is_active", true),
      (supabase.from("classes") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("is_active", true),
      (supabase.from("lessons") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("is_published", true),
      (supabase.from("assessments") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", session.tenant.id)
        .eq("is_active", true),
      getReceivablesAction(),
      (supabase.from("enrollments") as any)
        .select(`
          id,
          enrollment_number,
          enrolled_at,
          status,
          student:students(full_name),
          course:courses(name)
        `)
        .eq("tenant_id", session.tenant.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const financialMetrics = receivablesRes.metrics || {
      totalReceived: 0,
      totalPending: 0,
      totalOverdue: 0,
      defaultRatePercentage: 0,
    };

    const recentEnrollments = (recentRes.data || []).map((e: any) => ({
      id: e.id,
      enrollmentNumber: e.enrollment_number,
      studentName: e.student?.full_name || "Aluno",
      courseName: e.course?.name || "Curso",
      enrolledAt: e.enrolled_at,
      status: e.status,
    }));

    const metrics: InstitutionDashboardMetrics = {
      totalActiveStudents: studentsRes.count || 0,
      totalEnrollments: enrollmentsRes.count || 0,
      totalCourses: coursesRes.count || 0,
      totalClasses: classesRes.count || 0,
      activeLessonsCount: lessonsRes.count || 0,
      activeAssessmentsCount: assessmentsRes.count || 0,
      financial: {
        totalReceived: financialMetrics.totalReceived,
        totalPending: financialMetrics.totalPending,
        totalOverdue: financialMetrics.totalOverdue,
        defaultRatePercentage: financialMetrics.defaultRatePercentage,
      },
      recentEnrollments,
    };

    return { data: metrics, error: null };
  } catch (err: any) {
    console.error("Erro ao buscar métricas do dashboard:", err);
    return { data: null, error: err.message || "Falha ao buscar dados do dashboard." };
  }
}

/**
 * Consulta as Métricas do Dashboard para o Corpo Docente
 */
export async function getTeacherDashboardMetricsAction(): Promise<{
  data: TeacherDashboardMetrics | null;
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();
    if (session.role !== "professor") {
      return { data: null, error: "Acesso restrito ao perfil de professor." };
    }

    const supabase = await createClient();

    // Busca cadastro docente do usuário
    const { data: teacher } = await (supabase.from("teachers") as any)
      .select("id")
      .eq("tenant_id", session.tenant.id)
      .eq("user_id", session.user.id)
      .single();

    if (!teacher) {
      return {
        data: {
          assignedClassesCount: 0,
          assignedSubjectsCount: 0,
          totalTaughtStudentsCount: 0,
          pendingAssessmentsToGradeCount: 0,
          assignedClasses: [],
        },
        error: null,
      };
    }

    // Busca atribuições ativas do professor
    const { data: assignments } = await (supabase.from("teaching_assignments") as any)
      .select(`
        id,
        class_id,
        subject_id,
        class:classes(id, name, course:courses(name))
      `)
      .eq("tenant_id", session.tenant.id)
      .eq("teacher_id", teacher.id)
      .eq("is_active", true);

    const assignList = assignments || [];
    const classMap = new Map<string, { classId: string; className: string; courseName: string; studentsCount: number }>();
    const subjectIds = new Set<string>();

    assignList.forEach((a: any) => {
      if (a.subject_id) subjectIds.add(a.subject_id);
      if (a.class_id && a.class && !classMap.has(a.class_id)) {
        classMap.set(a.class_id, {
          classId: a.class_id,
          className: a.class.name,
          courseName: a.class.course?.name || "Curso",
          studentsCount: 0,
        });
      }
    });

    // Contagem de alunos nessas turmas
    const classIds = Array.from(classMap.keys());
    let totalStudents = 0;
    if (classIds.length > 0) {
      const { data: enrollments } = await (supabase.from("enrollments") as any)
        .select("class_id")
        .eq("tenant_id", session.tenant.id)
        .in("class_id", classIds)
        .eq("status", "ativa");

      (enrollments || []).forEach((e: any) => {
        totalStudents++;
        const item = classMap.get(e.class_id);
        if (item) item.studentsCount++;
      });
    }

    const metrics: TeacherDashboardMetrics = {
      assignedClassesCount: classMap.size,
      assignedSubjectsCount: subjectIds.size,
      totalTaughtStudentsCount: totalStudents,
      pendingAssessmentsToGradeCount: 0,
      assignedClasses: Array.from(classMap.values()),
    };

    return { data: metrics, error: null };
  } catch (err: any) {
    console.error("Erro ao buscar dashboard do professor:", err);
    return { data: null, error: err.message || "Falha ao buscar dados docentes." };
  }
}

/**
 * Consulta os Dados Consolidados do Portal do Aluno
 * RBAC: Restrito ao próprio aluno conectado
 */
export async function getStudentPortalDataAction(): Promise<{
  data: StudentPortalData | null;
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();
    if (session.role !== "aluno") {
      return { data: null, error: "Acesso restrito a discentes." };
    }

    const supabase = await createClient();

    // 1. Busca cadastro do aluno
    const { data: studentRecord, error: studErr } = await (supabase.from("students") as any)
      .select("id, full_name, cpf, email")
      .eq("tenant_id", session.tenant.id)
      .eq("user_id", session.user.id)
      .single();

    if (studErr || !studentRecord) {
      return { data: null, error: "Cadastro de discente não localizado para o usuário atual." };
    }

    // 2. Busca matrículas do aluno
    const { data: enrollments, error: enrollErr } = await (supabase.from("enrollments") as any)
      .select(`
        id,
        enrollment_number,
        status,
        enrolled_at,
        course:courses(id, name, code, workload_hours, modality),
        school_class:classes(id, name, period_label, shift)
      `)
      .eq("tenant_id", session.tenant.id)
      .eq("student_id", studentRecord.id)
      .order("created_at", { ascending: false });

    if (enrollErr) throw enrollErr;

    const enrollList = enrollments || [];

    // 3. Busca boletos/cobranças e documentos em paralelo
    const [receivablesRes, docsRes] = await Promise.all([
      getReceivablesAction(),
      getAcademicDocumentsAction(),
    ]);

    const allReceivables = receivablesRes.data || [];
    const allDocuments = docsRes.data || [];

    // 4. Carrega boletim da matrícula mais relevante (ativa ou mais recente)
    const primaryEnrollment = enrollList.find((e: any) => e.status === "ativa") || enrollList[0];
    let activeEnrollmentReport = null;
    if (primaryEnrollment) {
      const repRes = await getStudentReportCardAction(primaryEnrollment.id);
      activeEnrollmentReport = repRes.data;
    }

    // 5. Monta resumos por matrícula
    const today = new Date().toISOString().split("T")[0];
    const enrollmentSummaries: StudentPortalEnrollmentSummary[] = [];

    for (const en of enrollList) {
      const enReceivables = allReceivables.filter((r) => r.enrollment_id === en.id);
      const pendingCharges = enReceivables.filter((r) => r.status === "em_aberto");
      const overdueCharges = pendingCharges.filter((r) => r.due_date < today);

      enrollmentSummaries.push({
        enrollmentId: en.id,
        enrollmentNumber: en.enrollment_number,
        status: en.status,
        enrolledAt: en.enrolled_at,
        course: {
          id: en.course.id,
          name: en.course.name,
          code: en.course.code,
          workloadHours: en.course.workload_hours,
          modality: en.course.modality || "presencial",
        },
        schoolClass: en.school_class
          ? {
              id: en.school_class.id,
              name: en.school_class.name,
              periodLabel: en.school_class.period_label,
              shift: en.school_class.shift,
            }
          : null,
        academicSummary: {
          overallAverage: activeEnrollmentReport?.overallAverage ?? null,
          situation: activeEnrollmentReport?.overallSituation ?? "em_andamento",
          completedAssessmentsCount: activeEnrollmentReport?.subjects.reduce(
            (acc, s) => acc + s.completedAssessmentsCount,
            0
          ) ?? 0,
          totalAssessmentsCount: activeEnrollmentReport?.subjects.reduce(
            (acc, s) => acc + s.totalAssessmentsCount,
            0
          ) ?? 0,
        },
        pendingChargesCount: pendingCharges.length,
        overdueChargesCount: overdueCharges.length,
      });
    }

    const portalData: StudentPortalData = {
      student: {
        id: studentRecord.id,
        fullName: studentRecord.full_name,
        cpfMasked: maskCpf(studentRecord.cpf),
        email: studentRecord.email,
      },
      enrollments: enrollmentSummaries,
      activeEnrollmentReport,
      financialReceivables: allReceivables,
      documents: allDocuments,
    };

    return { data: portalData, error: null };
  } catch (err: any) {
    console.error("Erro ao carregar dados do portal do aluno:", err);
    return { data: null, error: err.message || "Falha ao carregar portal do aluno." };
  }
}
