"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { assertPlanEntitlement } from "@/lib/rbac/entitlements";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  LearningUnit,
  LearningUnitInput,
  Lesson,
  LessonInput,
  LessonMaterial,
  LessonMaterialInput,
} from "@/types/ead";
import { validateMaterialUrl } from "@/types/ead";

// ==============================================================================
// 1. UNIDADES DE APRENDIZAGEM (learning_units)
// ==============================================================================

/**
 * Consulta unidades de aprendizagem de uma disciplina
 */
export async function getLearningUnitsAction(
  subjectId: string
): Promise<{ data: LearningUnit[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "ead");
    assertPermission(session.role, "ead:access_lessons");

    const supabase = await createClient();

    let query = (supabase.from("learning_units") as any)
      .select("*, lessons:lessons(*, materials:lesson_materials(*))")
      .eq("tenant_id", session.tenant.id)
      .eq("subject_id", subjectId)
      .order("order_index", { ascending: true });

    // Se aluno, filtrar apenas publicadas
    if (session.role === "aluno") {
      query = query.eq("is_published", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    const formatted: LearningUnit[] = (data || []).map((u: any) => {
      let filteredLessons = u.lessons || [];
      if (session.role === "aluno") {
        filteredLessons = filteredLessons.filter((l: any) => l.is_published);
      }
      filteredLessons.sort((a: any, b: any) => a.order_index - b.order_index);

      return {
        ...u,
        lessons: filteredLessons,
        lessons_count: filteredLessons.length,
      };
    });

    return { data: formatted, error: null };
  } catch (err: any) {
    console.error("getLearningUnitsAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar unidades." };
  }
}

/**
 * Cria ou atualiza uma unidade de aprendizagem
 */
export async function saveLearningUnitAction(
  input: LearningUnitInput,
  unitId?: string
): Promise<{ success: boolean; data?: LearningUnit; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "ead");
    assertPermission(session.role, "ead:manage_content");

    if (!input.title || input.title.trim().length < 2) {
      return { success: false, error: "O título da unidade é obrigatório (mínimo 2 caracteres)." };
    }
    if (!input.subject_id) {
      return { success: false, error: "A disciplina vinculada é obrigatória." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(unitId);

    // Se o usuário for professor, validar se ele tem atribuição ativa na disciplina
    if (session.role === "professor") {
      const { data: hasAssignment } = await (supabase.rpc as any)(
        "has_teacher_subject_assignment",
        {
          p_tenant_id: session.tenant.id,
          p_subject_id: input.subject_id,
        }
      );
      if (!hasAssignment) {
        return {
          success: false,
          error: "Acesso negado: Você não possui atribuição docente ativa para gerenciar esta disciplina.",
        };
      }
    }

    const payload: any = {
      subject_id: input.subject_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      order_index: input.order_index ?? 1,
      is_published: input.is_published ?? false,
      updated_at: new Date().toISOString(),
    };

    let resultUnit: LearningUnit;

    if (isEdit && unitId) {
      const { data, error } = await (supabase.from("learning_units") as any)
        .update(payload)
        .eq("id", unitId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) throw error;
      resultUnit = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "LEARNING_UNIT_UPDATED",
        resourceType: "learning_units",
        resourceId: unitId,
        details: { title: payload.title, subject_id: payload.subject_id },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("learning_units") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultUnit = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "LEARNING_UNIT_CREATED",
        resourceType: "learning_units",
        resourceId: resultUnit.id,
        details: { title: payload.title, subject_id: payload.subject_id },
      });
    }

    revalidatePath("/app/ead");
    return { success: true, data: resultUnit };
  } catch (err: any) {
    console.error("saveLearningUnitAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar unidade de aprendizagem." };
  }
}

// ==============================================================================
// 2. AULAS TEOLÓGICAS (lessons)
// ==============================================================================

/**
 * Consulta detalhes de uma aula com seus materiais
 */
export async function getLessonAction(
  lessonId: string
): Promise<{ data: Lesson | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "ead");
    assertPermission(session.role, "ead:access_lessons");

    const supabase = await createClient();
    const { data, error } = await (supabase.from("lessons") as any)
      .select("*, materials:lesson_materials(*), unit:learning_units(*)")
      .eq("id", lessonId)
      .eq("tenant_id", session.tenant.id)
      .single();

    if (error) throw error;

    if (session.role === "aluno" && !data.is_published) {
      return { data: null, error: "Esta aula ainda não está disponível ou publicada." };
    }

    if (data.materials) {
      data.materials.sort((a: any, b: any) => a.order_index - b.order_index);
      if (session.role === "aluno") {
        data.materials = data.materials.filter((m: any) => m.is_active);
      }
    }

    return { data, error: null };
  } catch (err: any) {
    console.error("getLessonAction error:", err);
    return { data: null, error: err?.message || "Erro ao consultar aula." };
  }
}

/**
 * Cria ou edita uma aula vinculada a uma unidade e disciplina
 */
export async function saveLessonAction(
  input: LessonInput,
  lessonId?: string
): Promise<{ success: boolean; data?: Lesson; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "ead");
    assertPermission(session.role, "ead:manage_content");

    if (!input.title || input.title.trim().length < 2) {
      return { success: false, error: "O título da aula é obrigatório." };
    }
    if (!input.unit_id) {
      return { success: false, error: "A unidade pedagógica vinculada é obrigatória." };
    }
    if (!input.subject_id) {
      return { success: false, error: "A disciplina vinculada é obrigatória." };
    }

    const supabase = await createClient();
    const isEdit = Boolean(lessonId);

    // Validação docente
    if (session.role === "professor") {
      const { data: hasAssignment } = await (supabase.rpc as any)(
        "has_teacher_subject_assignment",
        {
          p_tenant_id: session.tenant.id,
          p_subject_id: input.subject_id,
        }
      );
      if (!hasAssignment) {
        return {
          success: false,
          error: "Acesso negado: Você não possui atribuição docente ativa nesta disciplina.",
        };
      }
    }

    const payload: any = {
      unit_id: input.unit_id,
      subject_id: input.subject_id,
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      content_text: input.content_text?.trim() || null,
      duration_minutes: input.duration_minutes ?? 0,
      order_index: input.order_index ?? 1,
      is_published: input.is_published ?? false,
      updated_at: new Date().toISOString(),
    };

    let resultLesson: Lesson;

    if (isEdit && lessonId) {
      const { data, error } = await (supabase.from("lessons") as any)
        .update(payload)
        .eq("id", lessonId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) throw error;
      resultLesson = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "LESSON_UPDATED",
        resourceType: "lessons",
        resourceId: lessonId,
        details: { title: payload.title, unit_id: payload.unit_id },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("lessons") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultLesson = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "LESSON_CREATED",
        resourceType: "lessons",
        resourceId: resultLesson.id,
        details: { title: payload.title, unit_id: payload.unit_id },
      });
    }

    revalidatePath("/app/ead");
    return { success: true, data: resultLesson };
  } catch (err: any) {
    console.error("saveLessonAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar aula." };
  }
}

// ==============================================================================
// 3. MATERIAIS DIDÁTICOS (lesson_materials)
// ==============================================================================

/**
 * Cria ou edita um material da aula (vídeo, PDF, link ou texto)
 */
export async function saveLessonMaterialAction(
  input: LessonMaterialInput,
  materialId?: string
): Promise<{ success: boolean; data?: LessonMaterial; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPlanEntitlement(session.tenant.plan_tier, "ead");
    assertPermission(session.role, "ead:manage_content");

    if (!input.title || input.title.trim().length < 2) {
      return { success: false, error: "O título do material é obrigatório." };
    }
    if (!input.lesson_id) {
      return { success: false, error: "A aula vinculada é obrigatória." };
    }

    // Validação de URL segura
    const urlValidation = validateMaterialUrl(input.material_type, input.url);
    if (!urlValidation.isValid) {
      return { success: false, error: urlValidation.error };
    }

    const supabase = await createClient();
    const isEdit = Boolean(materialId);

    // Validação docente
    if (session.role === "professor") {
      const { data: lesson } = await (supabase.from("lessons") as any)
        .select("subject_id")
        .eq("id", input.lesson_id)
        .eq("tenant_id", session.tenant.id)
        .single();

      if (!lesson) {
        return { success: false, error: "Aula não encontrada no tenant." };
      }

      const { data: hasAssignment } = await (supabase.rpc as any)(
        "has_teacher_subject_assignment",
        {
          p_tenant_id: session.tenant.id,
          p_subject_id: lesson.subject_id,
        }
      );

      if (!hasAssignment) {
        return {
          success: false,
          error: "Acesso negado: Você não possui atribuição docente nesta matéria para alterar materiais.",
        };
      }
    }

    const payload: any = {
      lesson_id: input.lesson_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      material_type: input.material_type,
      url: input.url?.trim() || null,
      content_text: input.content_text?.trim() || null,
      order_index: input.order_index ?? 1,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let resultMaterial: LessonMaterial;

    if (isEdit && materialId) {
      const { data, error } = await (supabase.from("lesson_materials") as any)
        .update(payload)
        .eq("id", materialId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) throw error;
      resultMaterial = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "LESSON_MATERIAL_UPDATED",
        resourceType: "lesson_materials",
        resourceId: materialId,
        details: { title: payload.title, type: payload.material_type },
      });
    } else {
      payload.tenant_id = session.tenant.id;
      const { data, error } = await (supabase.from("lesson_materials") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      resultMaterial = data;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "LESSON_MATERIAL_CREATED",
        resourceType: "lesson_materials",
        resourceId: resultMaterial.id,
        details: { title: payload.title, type: payload.material_type },
      });
    }

    revalidatePath("/app/ead");
    return { success: true, data: resultMaterial };
  } catch (err: any) {
    console.error("saveLessonMaterialAction error:", err);
    return { success: false, error: err?.message || "Erro ao salvar material didático." };
  }
}
