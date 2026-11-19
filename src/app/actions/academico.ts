"use server";

import { revalidatePath } from "next/cache";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  Course,
  CourseModule,
  Subject,
  Teacher,
  TeachingAssignment,
  SchoolClass,
  Enrollment,
  CourseInput,
  CourseModuleInput,
  SubjectInput,
  TeacherInput,
  TeachingAssignmentInput,
  ClassInput,
  EnrollmentInput,
  EnrollmentStatus,
} from "@/types/academico";

// ==============================================================================
// 1. CURSOS TEOLÓGICOS
// ==============================================================================

/**
 * Lista todos os cursos da instituição com contadores de turmas e disciplinas
 */
export async function getCoursesAction(): Promise<{ data: Course[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:view");

    const supabase = await createClient();
    const { data, error } = await (supabase.from("courses") as any)
      .select("*, classes:classes(count), modules:course_modules(count), subjects:subjects(count)")
      .eq("tenant_id", session.tenant.id)
      .order("name", { ascending: true });

    if (error) throw error;

    const formattedCourses: Course[] = (data || []).map((c: any) => ({
      ...c,
      classes_count: c.classes?.[0]?.count ?? 0,
      modules_count: c.modules?.[0]?.count ?? 0,
      subjects_count: c.subjects?.[0]?.count ?? 0,
    }));

    return { data: formattedCourses, error: null };
  } catch (err: any) {
    console.error("getCoursesAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar cursos." };
  }
}

/**
 * Cria ou atualiza um curso teológico
 */
export async function saveCourseAction(
  input: CourseInput,
  courseId?: string
): Promise<{ success: boolean; data?: Course; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:manage_courses");

    if (!input.name || input.name.trim().length < 3) {
      return { success: false, error: "O nome do curso deve conter ao menos 3 caracteres." };
    }

    if (input.workload_hours <= 0) {
      return { success: false, error: "A carga horária deve ser maior que zero." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(courseId);

    const payload: any = {
      name: input.name.trim(),
      code: input.code?.trim() || null,
      description: input.description?.trim() || null,
      modality: input.modality,
      format: input.format,
      duration_months: input.duration_months || null,
      workload_hours: input.workload_hours,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultCourse: Course;

    if (isEdit && courseId) {
      const { data, error } = await (supabase.from("courses") as any)
        .update(payload)
        .eq("id", courseId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) throw error;
      resultCourse = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "COURSE_UPDATED",
        resourceType: "courses",
        resourceId: courseId,
        details: { name: payload.name, modality: payload.modality },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("courses") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultCourse = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "COURSE_CREATED",
        resourceType: "courses",
        resourceId: resultCourse.id,
        details: { name: payload.name, modality: payload.modality },
      });
    }

    revalidatePath("/app/academico");
    return { success: true, data: resultCourse };
  } catch (err: any) {
    console.error("saveCourseAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar curso." };
  }
}

// ==============================================================================
// 2. MÓDULOS CURRICULARES (course_modules)
// ==============================================================================

/**
 * Consulta módulos curriculares de um curso
 */
export async function getCourseModulesAction(
  courseId?: string
): Promise<{ data: CourseModule[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:view");

    const supabase = await createClient();
    let query = (supabase.from("course_modules") as any)
      .select("*, subjects:subjects(count)")
      .eq("tenant_id", session.tenant.id)
      .order("order_index", { ascending: true });

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const formatted: CourseModule[] = (data || []).map((m: any) => ({
      ...m,
      subjects_count: m.subjects?.[0]?.count ?? 0,
    }));

    return { data: formatted, error: null };
  } catch (err: any) {
    console.error("getCourseModulesAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar módulos do curso." };
  }
}

/**
 * Cria ou edita um módulo curricular
 */
export async function saveCourseModuleAction(
  input: CourseModuleInput,
  moduleId?: string
): Promise<{ success: boolean; data?: CourseModule; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:manage_curriculum");

    if (!input.name || input.name.trim().length < 2) {
      return { success: false, error: "O nome do módulo é obrigatório." };
    }
    if (!input.course_id) {
      return { success: false, error: "O curso teológico deve ser informado." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(moduleId);

    const payload: any = {
      course_id: input.course_id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      order_index: input.order_index ?? 1,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultModule: CourseModule;

    if (isEdit && moduleId) {
      const { data, error } = await (supabase.from("course_modules") as any)
        .update(payload)
        .eq("id", moduleId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) throw error;
      resultModule = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "COURSE_MODULE_UPDATED",
        resourceType: "course_modules",
        resourceId: moduleId,
        details: { name: payload.name, course_id: payload.course_id },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("course_modules") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultModule = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "COURSE_MODULE_CREATED",
        resourceType: "course_modules",
        resourceId: resultModule.id,
        details: { name: payload.name, course_id: payload.course_id },
      });
    }

    revalidatePath("/app/academico");
    return { success: true, data: resultModule };
  } catch (err: any) {
    console.error("saveCourseModuleAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar módulo curricular." };
  }
}

// ==============================================================================
// 3. DISCIPLINAS TEOLÓGICAS (subjects)
// ==============================================================================

/**
 * Consulta disciplinas curriculares com dados do módulo e professor
 */
export async function getSubjectsAction(filters?: {
  courseId?: string;
  moduleId?: string;
}): Promise<{ data: Subject[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:view");

    const supabase = await createClient();
    let query = (supabase.from("subjects") as any)
      .select("*, course:courses(id, name, modality), module:course_modules(id, name), teacher:profiles!subjects_teacher_id_fkey(id, full_name, email)")
      .eq("tenant_id", session.tenant.id)
      .order("order_index", { ascending: true });

    if (filters?.courseId) query = query.eq("course_id", filters.courseId);
    if (filters?.moduleId) query = query.eq("module_id", filters.moduleId);

    const { data, error } = await query;
    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    console.error("getSubjectsAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar disciplinas." };
  }
}

/**
 * Cria ou atualiza uma disciplina teológica
 */
export async function saveSubjectAction(
  input: SubjectInput,
  subjectId?: string
): Promise<{ success: boolean; data?: Subject; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:manage_curriculum");

    if (!input.name || input.name.trim().length < 2) {
      return { success: false, error: "O nome da disciplina é obrigatório." };
    }
    if (!input.course_id) {
      return { success: false, error: "É obrigatório associar a disciplina a um curso." };
    }
    if (input.workload_hours <= 0) {
      return { success: false, error: "A carga horária deve ser maior que zero." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(subjectId);

    const payload: any = {
      course_id: input.course_id,
      module_id: input.module_id || null,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      syllabus: input.syllabus?.trim() || null,
      workload_hours: input.workload_hours,
      order_index: input.order_index ?? 1,
      teacher_id: input.teacher_id || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultSubject: Subject;

    if (isEdit && subjectId) {
      const { data, error } = await (supabase.from("subjects") as any)
        .update(payload)
        .eq("id", subjectId)
        .eq("tenant_id", session.tenant.id)
        .select("*, course:courses(id, name, modality), module:course_modules(id, name), teacher:profiles!subjects_teacher_id_fkey(id, full_name, email)")
        .single();

      if (error) throw error;
      resultSubject = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "SUBJECT_UPDATED",
        resourceType: "subjects",
        resourceId: subjectId,
        details: { name: payload.name, course_id: payload.course_id },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("subjects") as any)
        .insert(payload)
        .select("*, course:courses(id, name, modality), module:course_modules(id, name), teacher:profiles!subjects_teacher_id_fkey(id, full_name, email)")
        .single();

      if (error) throw error;
      resultSubject = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "SUBJECT_CREATED",
        resourceType: "subjects",
        resourceId: resultSubject.id,
        details: { name: payload.name, course_id: payload.course_id },
      });
    }

    revalidatePath("/app/academico");
    return { success: true, data: resultSubject };
  } catch (err: any) {
    console.error("saveSubjectAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar disciplina." };
  }
}

// ==============================================================================
// 4. TURMAS TEOLÓGICAS
// ==============================================================================

/**
 * Lista turmas do tenant, opcionalmente filtrando por curso
 */
export async function getClassesAction(
  courseId?: string
): Promise<{ data: SchoolClass[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:view");

    const supabase = await createClient();
    let query = (supabase.from("classes") as any)
      .select("*, course:courses(id, name, modality), enrollments:enrollments(count)")
      .eq("tenant_id", session.tenant.id)
      .order("name", { ascending: true });

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const formattedClasses: SchoolClass[] = (data || []).map((c: any) => ({
      ...c,
      enrolled_count: c.enrollments?.[0]?.count ?? 0,
    }));

    return { data: formattedClasses, error: null };
  } catch (err: any) {
    console.error("getClassesAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar turmas." };
  }
}

/**
 * Cria ou atualiza uma turma vinculada a curso
 */
export async function saveClassAction(
  input: ClassInput,
  classId?: string
): Promise<{ success: boolean; data?: SchoolClass; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:manage_classes");

    if (!input.name || input.name.trim().length < 2) {
      return { success: false, error: "O nome da turma é obrigatório." };
    }
    if (!input.course_id) {
      return { success: false, error: "É obrigatório associar um curso à turma." };
    }
    if (input.capacity < 0) {
      return { success: false, error: "A capacidade não pode ser negativa." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(classId);

    const payload: any = {
      course_id: input.course_id,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      period_label: input.period_label?.trim() || null,
      shift: input.shift,
      status: input.status || "prevista",
      capacity: input.capacity,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultClass: SchoolClass;

    if (isEdit && classId) {
      const { data, error } = await (supabase.from("classes") as any)
        .update(payload)
        .eq("id", classId)
        .eq("tenant_id", session.tenant.id)
        .select("*, course:courses(id, name, modality)")
        .single();

      if (error) throw error;
      resultClass = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "CLASS_UPDATED",
        resourceType: "classes",
        resourceId: classId,
        details: { name: payload.name, course_id: payload.course_id },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("classes") as any)
        .insert(payload)
        .select("*, course:courses(id, name, modality)")
        .single();

      if (error) throw error;
      resultClass = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "CLASS_CREATED",
        resourceType: "classes",
        resourceId: resultClass.id,
        details: { name: payload.name, course_id: payload.course_id },
      });
    }

    revalidatePath("/app/academico");
    return { success: true, data: resultClass };
  } catch (err: any) {
    console.error("saveClassAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar turma." };
  }
}

// ==============================================================================
// 5. MATRÍCULAS
// ==============================================================================

/**
 * Consulta matrículas da instituição
 */
export async function getEnrollmentsAction(filters?: {
  courseId?: string;
  classId?: string;
  status?: string;
}): Promise<{ data: Enrollment[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "secretaria:view");

    const supabase = await createClient();
    let query = (supabase.from("enrollments") as any)
      .select("*, student:students(id, first_name, last_name, full_name, cpf, email, phone), course:courses(id, name, modality), class:classes(id, name, shift, capacity)")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false });

    if (filters?.courseId) query = query.eq("course_id", filters.courseId);
    if (filters?.classId) query = query.eq("class_id", filters.classId);
    if (filters?.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    console.error("getEnrollmentsAction error:", err);
    return { data: null, error: err?.message || "Erro ao listar matrículas." };
  }
}

/**
 * Cria uma nova matrícula, respeitando capacidade da turma e unicidade de matrícula ativa
 */
export async function createEnrollmentAction(
  input: EnrollmentInput
): Promise<{ success: boolean; data?: Enrollment; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "secretaria:manage_enrollments");

    if (!input.student_id) return { success: false, error: "Aluno não selecionado." };
    if (!input.course_id) return { success: false, error: "Curso não selecionado." };

    const supabase = await createClient();

    // 1. Validação de capacidade se turma foi informada
    if (input.class_id) {
      const { data: schoolClass, error: classErr } = await (supabase.from("classes") as any)
        .select("id, capacity, enrollments:enrollments(count)")
        .eq("id", input.class_id)
        .eq("tenant_id", session.tenant.id)
        .single();

      if (classErr || !schoolClass) {
        return { success: false, error: "Turma selecionada inválida ou não encontrada." };
      }

      const currentCount = schoolClass.enrollments?.[0]?.count ?? 0;
      if (schoolClass.capacity > 0 && currentCount >= schoolClass.capacity) {
        return {
          success: false,
          error: `A capacidade máxima da turma (${schoolClass.capacity} alunos) já foi atingida.`,
        };
      }
    }

    // 2. Geração do número de matrícula se não informado
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const enrollmentNumber = input.enrollment_number?.trim() || `MAT-${year}-${randomSuffix}`;

    const payload: any = {
      tenant_id: session.tenant.id,
      student_id: input.student_id,
      course_id: input.course_id,
      class_id: input.class_id || null,
      enrollment_number: enrollmentNumber,
      status: input.status || "ativa",
      status_reason: input.status_reason?.trim() || null,
      enrolled_at: input.enrolled_at || new Date().toISOString(),
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from("enrollments") as any)
      .insert(payload)
      .select("*, student:students(id, first_name, last_name, full_name, cpf, email, phone), course:courses(id, name, modality), class:classes(id, name, shift)")
      .single();

    if (error) {
      if (error.code === "23505") {
        if (error.message.includes("uq_enrollments_tenant_number")) {
          return { success: false, error: "Número de matrícula já existe neste tenant." };
        }
        return {
          success: false,
          error: "O aluno já possui uma matrícula ativa ou em andamento neste curso.",
        };
      }
      throw error;
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "ENROLLMENT_CREATED",
      resourceType: "enrollments",
      resourceId: data.id,
      details: {
        student_id: input.student_id,
        course_id: input.course_id,
        class_id: input.class_id,
        enrollment_number: enrollmentNumber,
      },
    });

    revalidatePath("/app/academico");
    return { success: true, data };
  } catch (err: any) {
    console.error("createEnrollmentAction error:", err);
    return { success: false, error: err?.message || "Erro ao realizar matrícula." };
  }
}

/**
 * Atualiza o status de uma matrícula (trancamento, cancelamento, conclusão, etc.)
 */
export async function updateEnrollmentStatusAction(
  enrollmentId: string,
  newStatus: EnrollmentStatus,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "secretaria:manage_enrollments");

    const supabase = await createClient();
    const updatePayload: any = {
      status: newStatus,
      status_reason: reason?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "concluida") {
      updatePayload.completed_at = new Date().toISOString();
    } else if (newStatus === "cancelada") {
      updatePayload.canceled_at = new Date().toISOString();
    }

    const { error } = await (supabase.from("enrollments") as any)
      .update(updatePayload)
      .eq("id", enrollmentId)
      .eq("tenant_id", session.tenant.id);

    if (error) throw error;

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "ENROLLMENT_STATUS_CHANGED",
      resourceType: "enrollments",
      resourceId: enrollmentId,
      details: { new_status: newStatus, reason },
    });

    revalidatePath("/app/academico");
    return { success: true };
  } catch (err: any) {
    console.error("updateEnrollmentStatusAction error:", err);
    return { success: false, error: err?.message || "Erro ao atualizar status da matrícula." };
  }
}

// ==============================================================================
// 6. GESTÃO DE PROFESSORES (teachers) E ATRIBUIÇÕES DOCENTES
// ==============================================================================

/**
 * Consulta professores cadastrados da instituição
 */
export async function getTeachersAction(): Promise<{ data: Teacher[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:view");

    const supabase = await createClient();
    const { data, error } = await (supabase.from("teachers") as any)
      .select("*, assignments:teaching_assignments(count)")
      .eq("tenant_id", session.tenant.id)
      .order("first_name", { ascending: true });

    if (error) throw error;

    const formatted: Teacher[] = (data || []).map((t: any) => ({
      ...t,
      assignments_count: t.assignments?.[0]?.count ?? 0,
    }));

    return { data: formatted, error: null };
  } catch (err: any) {
    console.error("getTeachersAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar corpo docente." };
  }
}

/**
 * Cria ou atualiza um professor
 */
export async function saveTeacherAction(
  input: TeacherInput,
  teacherId?: string
): Promise<{ success: boolean; data?: Teacher; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:manage_teachers");

    if (!input.first_name || input.first_name.trim().length < 2) {
      return { success: false, error: "O primeiro nome é obrigatório." };
    }
    if (!input.last_name || input.last_name.trim().length < 2) {
      return { success: false, error: "O sobrenome é obrigatório." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(teacherId);

    const payload: any = {
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      academic_title: input.academic_title?.trim() || null,
      theological_specialties: input.theological_specialties?.trim() || null,
      bio: input.bio?.trim() || null,
      user_id: input.user_id || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultTeacher: Teacher;

    if (isEdit && teacherId) {
      const { data, error } = await (supabase.from("teachers") as any)
        .update(payload)
        .eq("id", teacherId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) throw error;
      resultTeacher = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "TEACHER_UPDATED",
        resourceType: "teachers",
        resourceId: teacherId,
        details: { name: resultTeacher.full_name, title: payload.academic_title },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("teachers") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultTeacher = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "TEACHER_CREATED",
        resourceType: "teachers",
        resourceId: resultTeacher.id,
        details: { name: resultTeacher.full_name, title: payload.academic_title },
      });
    }

    revalidatePath("/app/academico");
    return { success: true, data: resultTeacher };
  } catch (err: any) {
    console.error("saveTeacherAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar professor." };
  }
}

/**
 * Consulta atribuições docentes do tenant
 */
export async function getTeachingAssignmentsAction(filters?: {
  teacherId?: string;
  classId?: string;
  subjectId?: string;
}): Promise<{ data: TeachingAssignment[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:view");

    const supabase = await createClient();
    let query = (supabase.from("teaching_assignments") as any)
      .select("*, teacher:teachers(*), class:classes(id, name, shift), subject:subjects(id, name, code, workload_hours)")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false });

    if (filters?.teacherId) query = query.eq("teacher_id", filters.teacherId);
    if (filters?.classId) query = query.eq("class_id", filters.classId);
    if (filters?.subjectId) query = query.eq("subject_id", filters.subjectId);

    const { data, error } = await query;
    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    console.error("getTeachingAssignmentsAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar atribuições docentes." };
  }
}

/**
 * Cria ou edita uma atribuição docente
 */
export async function saveTeachingAssignmentAction(
  input: TeachingAssignmentInput,
  assignmentId?: string
): Promise<{ success: boolean; data?: TeachingAssignment; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "academico:manage_teachers");

    if (!input.teacher_id) {
      return { success: false, error: "O professor deve ser selecionado." };
    }
    if (!input.class_id && !input.subject_id) {
      return { success: false, error: "Informe ao menos uma turma ou disciplina para a atribuição." };
    }

    const supabase = await createClient();

    // Validação de coerência curricular: se turma e disciplina forem informadas simultaneamente,
    // ambas devem pertencer rigorosamente ao mesmo curso.
    if (input.class_id && input.subject_id) {
      const [classRes, subjectRes] = await Promise.all([
        (supabase.from("classes") as any)
          .select("id, course_id")
          .eq("id", input.class_id)
          .eq("tenant_id", session.tenant.id)
          .single(),
        (supabase.from("subjects") as any)
          .select("id, course_id")
          .eq("id", input.subject_id)
          .eq("tenant_id", session.tenant.id)
          .single(),
      ]);

      if (classRes.error || !classRes.data) {
        return { success: false, error: "Turma selecionada não encontrada no tenant." };
      }
      if (subjectRes.error || !subjectRes.data) {
        return { success: false, error: "Disciplina selecionada não encontrada no tenant." };
      }

      if (classRes.data.course_id !== subjectRes.data.course_id) {
        return {
          success: false,
          error: "Incoerência curricular: A turma e a disciplina selecionadas pertencem a cursos diferentes.",
        };
      }
    }

    const isEdit = Boolean(assignmentId);

    const payload: any = {
      teacher_id: input.teacher_id,
      class_id: input.class_id || null,
      subject_id: input.subject_id || null,
      role_description: input.role_description || "titular",
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultAssignment: TeachingAssignment;

    if (isEdit && assignmentId) {
      const { data, error } = await (supabase.from("teaching_assignments") as any)
        .update(payload)
        .eq("id", assignmentId)
        .eq("tenant_id", session.tenant.id)
        .select("*, teacher:teachers(*), class:classes(id, name, shift), subject:subjects(id, name, code)")
        .single();

      if (error) throw error;
      resultAssignment = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "TEACHING_ASSIGNMENT_UPDATED",
        resourceType: "teaching_assignments",
        resourceId: assignmentId,
        details: { teacher_id: payload.teacher_id, class_id: payload.class_id, subject_id: payload.subject_id },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("teaching_assignments") as any)
        .insert(payload)
        .select("*, teacher:teachers(*), class:classes(id, name, shift), subject:subjects(id, name, code)")
        .single();

      if (error) throw error;
      resultAssignment = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "TEACHING_ASSIGNMENT_CREATED",
        resourceType: "teaching_assignments",
        resourceId: resultAssignment.id,
        details: { teacher_id: payload.teacher_id, class_id: payload.class_id, subject_id: payload.subject_id },
      });
    }

    revalidatePath("/app/academico");
    return { success: true, data: resultAssignment };
  } catch (err: any) {
    console.error("saveTeachingAssignmentAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar atribuição docente." };
  }
}
