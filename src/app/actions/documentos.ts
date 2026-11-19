"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  AcademicDocument,
  IssueDocumentInput,
  RevokeDocumentInput,
  PublicDocumentVerificationResult,
  DocumentMetadataSnapshot,
} from "@/types/documentos";
import { getStudentReportCardAction } from "./desempenho";
import {
  generateDocumentNumber,
  generateVerificationToken,
  maskCpf,
} from "@/lib/documentos/generator";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Consulta documentos acadêmicos da instituição ou do aluno autenticado.
 * RBAC:
 * - Admin/Secretaria: vê todos do tenant.
 * - Aluno: vê estritamente seus próprios documentos emitidos.
 */
export async function getAcademicDocumentsAction(
  enrollmentId?: string
): Promise<{ data: AcademicDocument[] | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    const supabase = await createClient();

    let query = (supabase.from("academic_documents") as any)
      .select(`
        *,
        student:students(id, full_name, cpf, email),
        course:courses(id, name, code, workload_hours)
      `)
      .eq("tenant_id", session.tenant.id)
      .order("issued_at", { ascending: false });

    if (enrollmentId) {
      query = query.eq("enrollment_id", enrollmentId);
    }

    // Se aluno, filtra estritamente por seu student_id
    if (session.role === "aluno") {
      const { data: studentRecord } = await (supabase.from("students") as any)
        .select("id")
        .eq("tenant_id", session.tenant.id)
        .eq("user_id", session.user.id)
        .single();

      if (!studentRecord) {
        return { data: [], error: null };
      }
      query = query.eq("student_id", studentRecord.id).eq("status", "emitido");
    }

    const { data, error } = await query;
    if (error) throw error;

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error("Erro ao listar documentos acadêmicos:", err);
    return { data: null, error: err.message || "Falha ao buscar documentos." };
  }
}

/**
 * Emite um novo documento acadêmico institucional (Certificado, Declaração ou Histórico).
 * RBAC: Restrito a Administrador ou Secretaria.
 * Invariante de Segurança: Certificado de conclusão exige matrícula com situação 'aprovado' ou 'concluida'.
 */
export async function issueAcademicDocumentAction(
  input: IssueDocumentInput
): Promise<{ data: AcademicDocument | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "certificados:issue");

    const supabase = await createClient();

    // 1. Busca dados da matrícula e boletim acadêmico
    const { data: reportCard, error: reportErr } = await getStudentReportCardAction(input.enrollment_id);
    if (reportErr || !reportCard) {
      return { data: null, error: reportErr || "Boletim acadêmico da matrícula não encontrado." };
    }

    // 2. Validação de Elegibilidade Rigorosa para Certificado de Conclusão:
    // A conclusão exige critérios acadêmicos reais comprovados (todas as matérias aprovadas).
    // Matrícula marcada como 'concluida' isoladamente SEM aprovação acadêmica NÃO deve permitir emissão.
    if (input.document_type === "certificado_conclusao") {
      const isAcademicallyApproved =
        reportCard.overallSituation === "aprovado" &&
        reportCard.totalSubjects > 0 &&
        reportCard.approvedSubjectsCount === reportCard.totalSubjects;

      if (!isAcademicallyApproved) {
        return {
          data: null,
          error: `Elegibilidade não atendida: o aluno possui rendimento acadêmico '${reportCard.overallSituation}' (${reportCard.approvedSubjectsCount}/${reportCard.totalSubjects} disciplinas aprovadas). Para emissão de Certificado de Conclusão, é indispensável a aprovação acadêmica integral em todas as disciplinas do curso.`,
        };
      }
    }

    // 3. Monta o Snapshot Congelado (Anti-adulteração retrospectiva)
    const snapshot: DocumentMetadataSnapshot = {
      institution: {
        name: session.tenant.name,
        tradeName: session.tenant.trade_name,
        cnpj: session.tenant.cnpj,
      },
      student: {
        fullName: reportCard.student.fullName,
        cpf: reportCard.student.cpf,
        cpfMasked: maskCpf(reportCard.student.cpf),
        email: reportCard.student.email,
      },
      course: {
        name: reportCard.course.name,
        code: reportCard.course.code,
        workloadHours: reportCard.course.workloadHours,
        modality: "presencial",
      },
      enrollment: {
        enrollmentNumber: reportCard.enrollmentNumber,
        status: reportCard.enrollmentStatus,
        enrolledAt: new Date().toISOString(),
      },
      academicSummary: {
        overallAverage: reportCard.overallAverage,
        situation: reportCard.overallSituation,
        totalSubjects: reportCard.totalSubjects,
        approvedSubjectsCount: reportCard.approvedSubjectsCount,
        subjects: reportCard.subjects.map((s) => ({
          name: s.subjectName,
          code: s.subjectCode,
          workloadHours: s.workloadHours,
          averageScore: s.averageScore,
          situation: s.situation,
        })),
      },
    };

    // 4. Gera código e token de autenticidade
    const documentNumber = generateDocumentNumber(input.document_type);
    const verificationToken = generateVerificationToken();

    let title = input.custom_title;
    if (!title) {
      if (input.document_type === "certificado_conclusao") {
        title = `Certificado de Conclusão — ${reportCard.course.name}`;
      } else if (input.document_type === "declaracao_matricula") {
        title = `Declaração de Matrícula — ${reportCard.course.name}`;
      } else {
        title = `Histórico Escolar — ${reportCard.course.name}`;
      }
    }

    // 5. Grava documento
    const { data: newDoc, error: insertErr } = await (supabase.from("academic_documents") as any)
      .insert({
        tenant_id: session.tenant.id,
        student_id: reportCard.student.id,
        enrollment_id: reportCard.enrollmentId,
        course_id: reportCard.course.id,
        document_type: input.document_type,
        title,
        document_number: documentNumber,
        verification_token: verificationToken,
        status: "emitido",
        issued_by: session.user.id,
        metadata_snapshot: snapshot,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 6. Auditoria
    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "ACADEMIC_DOCUMENT_ISSUED",
      resourceType: "academic_document",
      resourceId: newDoc.id,
      details: {
        document_number: documentNumber,
        document_type: input.document_type,
        student_id: reportCard.student.id,
        enrollment_id: reportCard.enrollmentId,
      },
    });

    revalidatePath("/app/certificados");
    return { data: newDoc, error: null };
  } catch (err: any) {
    console.error("Erro ao emitir documento acadêmico:", err);
    return { data: null, error: err.message || "Falha ao emitir documento acadêmico." };
  }
}

/**
 * Revoga um documento emitido (ex: cancelamento por irregularidade ou reemissão).
 * RBAC: Restrito a Administrador ou Secretaria.
 */
export async function revokeAcademicDocumentAction(
  input: RevokeDocumentInput
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "certificados:revoke");

    if (!input.reason || input.reason.trim().length < 5) {
      return { success: false, error: "O motivo da revogação deve ter no mínimo 5 caracteres." };
    }

    const supabase = await createClient();

    const { data: doc, error: docErr } = await (supabase.from("academic_documents") as any)
      .select("id, status, document_number")
      .eq("tenant_id", session.tenant.id)
      .eq("id", input.document_id)
      .single();

    if (docErr || !doc) {
      return { success: false, error: "Documento não encontrado no tenant." };
    }

    if (doc.status === "revogado") {
      return { success: false, error: "Este documento já se encontra revogado." };
    }

    const { error: updateErr } = await (supabase.from("academic_documents") as any)
      .update({
        status: "revogado",
        revocation_reason: input.reason.trim(),
        revoked_at: new Date().toISOString(),
        revoked_by: session.user.id,
      })
      .eq("tenant_id", session.tenant.id)
      .eq("id", input.document_id);

    if (updateErr) throw updateErr;

    // Auditoria
    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "ACADEMIC_DOCUMENT_REVOKED",
      resourceType: "academic_document",
      resourceId: doc.id,
      details: {
        document_number: doc.document_number,
        reason: input.reason.trim(),
      },
    });

    revalidatePath("/app/certificados");
    return { success: true, error: null };
  } catch (err: any) {
    console.error("Erro ao revogar documento:", err);
    return { success: false, error: err.message || "Falha ao revogar documento." };
  }
}

/**
 * Consulta pública de autenticidade documental por Token (LGPD-Compliant).
 * Executada com service_role para permitir verificação anônima por terceiros.
 */
export async function verifyPublicDocumentAction(
  token: string
): Promise<PublicDocumentVerificationResult> {
  try {
    const adminClient = getAdminSupabase();

    const { data, error } = await (adminClient.rpc as any)("verify_public_document", {
      p_token: token.trim(),
    });

    if (error) {
      console.error("Erro RPC verify_public_document:", error);
      return { valid: false, message: "Erro de consulta de autenticidade." };
    }

    return data as PublicDocumentVerificationResult;
  } catch (err: any) {
    console.error("Erro ao verificar documento público:", err);
    return { valid: false, message: "Falha na comunicação com o servidor de validação." };
  }
}
