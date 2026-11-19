"use server";

import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { revalidatePath } from "next/cache";
import { Student, StudentInput } from "@/types/secretaria";
import { cleanCpf, isValidCpf } from "@/lib/utils/cpf";
import { logAuditEvent } from "@/lib/audit/logger";

/**
 * Busca alunos da instituição atual com suporte a filtro de pesquisa e status.
 */
export async function getStudentsAction(filters?: {
  search?: string;
  status?: "all" | "active" | "inactive";
}): Promise<Student[]> {
  const session = await requireTenantSession();
  assertPermission(session.role, "secretaria:view");

  const supabase = await createClient();

  // Query segura: filtra estritamente pelo tenant_id resolvido no servidor
  let query = (supabase.from("students") as any)
    .select(`
      *,
      guardians:student_guardians(
        id,
        kinship,
        is_financial,
        is_emergency_contact,
        guardian:guardians(*)
      )
    `)
    .eq("tenant_id", session.tenant.id)
    .order("created_at", { ascending: false });

  if (filters?.status === "active") {
    query = query.eq("is_active", true);
  } else if (filters?.status === "inactive") {
    query = query.eq("is_active", false);
  }

  if (filters?.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},cpf.ilike.${term},email.ilike.${term},church_name.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao listar alunos:", error);
    return [];
  }

  return (data as Student[]) || [];
}

/**
 * Criação ou Edição de Aluno na instituição teológica
 */
export async function saveStudentAction(
  studentInput: StudentInput,
  studentId?: string
): Promise<{ success: boolean; data?: Student; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "secretaria:manage_students");

    const supabase = await createClient();

    // Validações básicas de formato
    if (!studentInput.first_name?.trim() || !studentInput.last_name?.trim()) {
      return { success: false, error: "Nome e sobrenome são obrigatórios." };
    }

    let formattedCpf: string | null = null;
    if (studentInput.cpf && studentInput.cpf.trim()) {
      const rawCpf = cleanCpf(studentInput.cpf);
      if (!isValidCpf(rawCpf)) {
        return { success: false, error: "O CPF informado é inválido." };
      }
      formattedCpf = rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    const payload = {
      tenant_id: session.tenant.id, // Forçado pelo contexto do servidor (imutável)
      first_name: studentInput.first_name.trim(),
      last_name: studentInput.last_name.trim(),
      cpf: formattedCpf,
      rg: studentInput.rg?.trim() || null,
      rg_issuer: studentInput.rg_issuer?.trim() || null,
      birth_date: studentInput.birth_date || null,
      gender: studentInput.gender || null,
      photo_url: studentInput.photo_url || null,
      email: studentInput.email?.trim() || null,
      phone: studentInput.phone?.trim() || null,
      whatsapp: studentInput.whatsapp?.trim() || null,
      postal_code: studentInput.postal_code?.trim() || null,
      street: studentInput.street?.trim() || null,
      number: studentInput.number?.trim() || null,
      complement: studentInput.complement?.trim() || null,
      neighborhood: studentInput.neighborhood?.trim() || null,
      city: studentInput.city?.trim() || null,
      state: studentInput.state?.trim() || null,
      church_name: studentInput.church_name?.trim() || null,
      pastor_name: studentInput.pastor_name?.trim() || null,
      ministry_role: studentInput.ministry_role?.trim() || null,
      general_notes: studentInput.general_notes?.trim() || null,
      is_active: studentInput.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    if (studentId) {
      // Edição
      const { data, error } = await (supabase.from("students") as any)
        .update(payload)
        .eq("id", studentId)
        .eq("tenant_id", session.tenant.id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return { success: false, error: "Já existe outro aluno cadastrado com este mesmo CPF nesta instituição." };
        }
        return { success: false, error: `Falha ao atualizar aluno: ${error.message}` };
      }

      // Registro de Auditoria no Servidor
      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "STUDENT_UPDATED",
        resourceType: "students",
        resourceId: studentId,
        details: { full_name: data.full_name, changes: payload },
      });

      revalidatePath("/app/secretaria");
      return { success: true, data: data as Student };
    } else {
      // Inserção
      const { data, error } = await (supabase.from("students") as any)
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return { success: false, error: "Já existe um aluno cadastrado com este mesmo CPF nesta instituição." };
        }
        return { success: false, error: `Falha ao cadastrar aluno: ${error.message}` };
      }

      // Registro de Auditoria no Servidor
      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "STUDENT_CREATED",
        resourceType: "students",
        resourceId: data.id,
        details: { full_name: data.full_name, cpf: data.cpf, church_name: data.church_name },
      });

      revalidatePath("/app/secretaria");
      return { success: true, data: data as Student };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado ao salvar aluno.";
    return { success: false, error: msg };
  }
}

/**
 * Ativa ou Desativa um aluno
 */
export async function toggleStudentStatusAction(
  studentId: string,
  newStatus: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "secretaria:manage_students");

    const supabase = await createClient();

    const { data, error } = await (supabase.from("students") as any)
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq("id", studentId)
      .eq("tenant_id", session.tenant.id)
      .select("id, full_name")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Registro de Auditoria no Servidor
    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "STUDENT_STATUS_TOGGLED",
      resourceType: "students",
      resourceId: studentId,
      details: { full_name: data?.full_name, new_status: newStatus },
    });

    revalidatePath("/app/secretaria");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado ao alterar status do aluno.";
    return { success: false, error: msg };
  }
}
