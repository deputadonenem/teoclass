"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import type {
  FinancialPlan,
  FinancialPlanInput,
  Receivable,
  PaymentRecord,
  GenerateInstallmentsInput,
  RecordPaymentInput,
  ReversePaymentInput,
  SchoolFinancialMetrics,
} from "@/types/financeiro";
import {
  calculateInstallmentDueDate,
  generateReceiptNumber,
  calculateFinancialMetrics,
} from "@/lib/financeiro/calculator";

// ==============================================================================
// 1. PLANOS FINANCEIROS
// ==============================================================================

export async function getFinancialPlansAction(): Promise<{
  data: FinancialPlan[] | null;
  error: string | null;
}> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "financeiro:view");

    const supabase = await createClient();
    const { data, error } = await (supabase.from("financial_plans") as any)
      .select("*, course:courses(id, name), school_class:classes(id, name)")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    console.error("Erro ao listar planos financeiros:", err);
    return { data: null, error: err.message || "Falha ao buscar planos financeiros." };
  }
}

export async function saveFinancialPlanAction(
  input: FinancialPlanInput & { id?: string }
): Promise<{ data: FinancialPlan | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "financeiro:manage_receivables");

    if (!input.name || input.installment_value < 0 || input.installments_count <= 0) {
      return { data: null, error: "Dados inválidos para o plano financeiro." };
    }

    const supabase = await createClient();

    if (input.id) {
      const { data, error } = await (supabase.from("financial_plans") as any)
        .update({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          enrollment_fee: input.enrollment_fee || 0,
          installment_value: input.installment_value,
          installments_count: input.installments_count,
          default_due_day: input.default_due_day || 10,
          discount_percentage: input.discount_percentage || 0,
          scholarship_notes: input.scholarship_notes?.trim() || null,
          is_active: input.is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", session.tenant.id)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "FINANCIAL_PLAN_UPDATED",
        resourceType: "financial_plan",
        resourceId: input.id,
        details: { name: input.name },
      });

      revalidatePath("/app/financeiro");
      return { data, error: null };
    } else {
      const { data, error } = await (supabase.from("financial_plans") as any)
        .insert({
          tenant_id: session.tenant.id,
          course_id: input.course_id,
          class_id: input.class_id || null,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          enrollment_fee: input.enrollment_fee || 0,
          installment_value: input.installment_value,
          installments_count: input.installments_count,
          default_due_day: input.default_due_day || 10,
          discount_percentage: input.discount_percentage || 0,
          scholarship_notes: input.scholarship_notes?.trim() || null,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      await logAuditEvent({
        tenantId: session.tenant.id,
        userId: session.user.id,
        action: "FINANCIAL_PLAN_CREATED",
        resourceType: "financial_plan",
        resourceId: data.id,
        details: { name: input.name, course_id: input.course_id },
      });

      revalidatePath("/app/financeiro");
      return { data, error: null };
    }
  } catch (err: any) {
    console.error("Erro ao salvar plano financeiro:", err);
    return { data: null, error: err.message || "Falha ao salvar plano financeiro." };
  }
}

// ==============================================================================
// 2. CONTAS A RECEBER E GERAÇÃO DE PARCELAS
// ==============================================================================

export async function getReceivablesAction(filters?: {
  enrollmentId?: string;
  studentId?: string;
  status?: string;
}): Promise<{ data: Receivable[] | null; metrics: SchoolFinancialMetrics | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    const supabase = await createClient();

    let query = (supabase.from("receivables") as any)
      .select(`
        *,
        student:students(id, full_name, cpf, email),
        enrollment:enrollments(id, enrollment_number, course:courses(name)),
        payments:payment_records(*)
      `)
      .eq("tenant_id", session.tenant.id)
      .order("due_date", { ascending: true });

    // Se aluno, filtra estritamente por suas contas
    if (session.role === "aluno") {
      const { data: studentRecord } = await (supabase.from("students") as any)
        .select("id")
        .eq("tenant_id", session.tenant.id)
        .eq("user_id", session.user.id)
        .single();

      if (!studentRecord) return { data: [], metrics: null, error: null };
      query = query.eq("student_id", studentRecord.id);
    } else {
      assertPermission(session.role, "financeiro:view");
      if (filters?.enrollmentId) query = query.eq("enrollment_id", filters.enrollmentId);
      if (filters?.studentId) query = query.eq("student_id", filters.studentId);
      if (filters?.status && filters.status !== "todos") query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const list: Receivable[] = (data || []).map((r: any) => ({
      ...r,
      enrollment: {
        id: r.enrollment?.id,
        enrollment_number: r.enrollment?.enrollment_number,
        course_name: r.enrollment?.course?.name,
      },
    }));

    const metrics = calculateFinancialMetrics(list);
    return { data: list, metrics, error: null };
  } catch (err: any) {
    console.error("Erro ao listar contas a receber:", err);
    return { data: null, metrics: null, error: err.message || "Falha ao buscar contas a receber." };
  }
}

/**
 * Gera parcelas de cobrança para uma matrícula com base em um plano financeiro.
 * Previne geração duplicada consultando se já existem recebíveis vinculados.
 */
export async function generateEnrollmentInstallmentsAction(
  input: GenerateInstallmentsInput
): Promise<{ count: number; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "financeiro:manage_receivables");

    const supabase = await createClient();

    // 1. Busca matrícula e plano
    const [enrollRes, planRes] = await Promise.all([
      (supabase.from("enrollments") as any)
        .select("id, tenant_id, student_id, course_id")
        .eq("tenant_id", session.tenant.id)
        .eq("id", input.enrollment_id)
        .single(),
      (supabase.from("financial_plans") as any)
        .select("*")
        .eq("tenant_id", session.tenant.id)
        .eq("id", input.financial_plan_id)
        .single(),
    ]);

    if (enrollRes.error || !enrollRes.data) return { count: 0, error: "Matrícula não encontrada." };
    if (planRes.error || !planRes.data) return { count: 0, error: "Plano financeiro não encontrado." };

    const enrollment = enrollRes.data;
    const plan = planRes.data;

    // 2. Previne duplicação
    const { count: existingCount } = await (supabase.from("receivables") as any)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", session.tenant.id)
      .eq("enrollment_id", enrollment.id);

    if (existingCount && existingCount > 0) {
      return {
        count: 0,
        error: "Esta matrícula já possui cobranças/parcelas geradas. Para novos lançamentos, cadastre cobranças avulsas.",
      };
    }

    const discountPerc = input.custom_discount_percentage ?? plan.discount_percentage ?? 0;
    const recordsToInsert: any[] = [];

    // Taxa de matrícula se houver
    if (Number(plan.enrollment_fee) > 0) {
      const orig = Number(plan.enrollment_fee);
      const disc = Number(((orig * discountPerc) / 100).toFixed(2));
      const fin = Number((orig - disc).toFixed(2));

      recordsToInsert.push({
        tenant_id: session.tenant.id,
        student_id: enrollment.student_id,
        enrollment_id: enrollment.id,
        financial_plan_id: plan.id,
        title: "Taxa de Matrícula",
        charge_type: "matricula",
        installment_number: 1,
        total_installments: 1,
        original_amount: orig,
        discount_amount: disc,
        final_amount: fin,
        due_date: input.first_due_date,
        status: "em_aberto",
      });
    }

    // Mensalidades
    const monthlyOrig = Number(plan.installment_value);
    const monthlyDisc = Number(((monthlyOrig * discountPerc) / 100).toFixed(2));
    const monthlyFin = Number((monthlyOrig - monthlyDisc).toFixed(2));

    for (let i = 1; i <= plan.installments_count; i++) {
      const dueDate = calculateInstallmentDueDate(input.first_due_date, i - 1);
      recordsToInsert.push({
        tenant_id: session.tenant.id,
        student_id: enrollment.student_id,
        enrollment_id: enrollment.id,
        financial_plan_id: plan.id,
        title: `Mensalidade ${i}/${plan.installments_count}`,
        charge_type: "mensalidade",
        installment_number: i,
        total_installments: plan.installments_count,
        original_amount: monthlyOrig,
        discount_amount: monthlyDisc,
        final_amount: monthlyFin,
        due_date: dueDate,
        status: "em_aberto",
      });
    }

    const { data: inserted, error: insertErr } = await (supabase.from("receivables") as any)
      .insert(recordsToInsert)
      .select();

    if (insertErr) throw insertErr;

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "INSTALLMENTS_GENERATED",
      resourceType: "receivable",
      details: {
        enrollment_id: enrollment.id,
        total_installments: recordsToInsert.length,
      },
    });

    revalidatePath("/app/financeiro");
    return { count: inserted.length, error: null };
  } catch (err: any) {
    console.error("Erro ao gerar parcelas:", err);
    return { count: 0, error: err.message || "Falha ao gerar parcelas financeiras." };
  }
}

// ==============================================================================
// 3. REGISTRO DE PAGAMENTO MANUAL E ESTORNO
// ==============================================================================

export async function recordPaymentAction(
  input: RecordPaymentInput
): Promise<{ data: PaymentRecord | null; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "financeiro:record_payments");

    if (input.amount_paid <= 0) {
      return { data: null, error: "O valor pago deve ser maior que zero." };
    }

    const supabase = await createClient();

    // 1. Busca recebível
    const { data: rec, error: recErr } = await (supabase.from("receivables") as any)
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("id", input.receivable_id)
      .single();

    if (recErr || !rec) return { data: null, error: "Conta a receber não encontrada." };
    if (rec.status === "pago") return { data: null, error: "Esta conta já se encontra totalmente paga." };
    if (rec.status === "cancelado") return { data: null, error: "Conta cancelada não pode receber pagamentos." };

    const receiptNumber = generateReceiptNumber();
    const paidAt = input.paid_at || new Date().toISOString();

    // 2. Grava registro de pagamento
    const { data: payment, error: payErr } = await (supabase.from("payment_records") as any)
      .insert({
        tenant_id: session.tenant.id,
        receivable_id: rec.id,
        amount_paid: input.amount_paid,
        payment_method: input.payment_method,
        paid_at: paidAt,
        received_by: session.user.id,
        receipt_number: receiptNumber,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (payErr) throw payErr;

    // 3. Atualiza recebível (total pago e status)
    const newPaidAmount = Number(rec.paid_amount) + Number(input.amount_paid);
    const newStatus = newPaidAmount >= Number(rec.final_amount) ? "pago" : "em_aberto";

    await (supabase.from("receivables") as any)
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        paid_at: newStatus === "pago" ? paidAt : rec.paid_at,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", session.tenant.id)
      .eq("id", rec.id);

    // 4. Auditoria
    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "PAYMENT_RECORDED",
      resourceType: "payment_record",
      resourceId: payment.id,
      details: {
        receivable_id: rec.id,
        amount_paid: input.amount_paid,
        receipt_number: receiptNumber,
        method: input.payment_method,
      },
    });

    revalidatePath("/app/financeiro");
    return { data: payment, error: null };
  } catch (err: any) {
    console.error("Erro ao registrar pagamento:", err);
    return { data: null, error: err.message || "Falha ao registrar pagamento." };
  }
}

export async function reversePaymentAction(
  input: ReversePaymentInput
): Promise<{ success: boolean; error: string | null }> {
  try {
    const session = await requireTenantSession();
    assertPermission(session.role, "financeiro:record_payments");

    if (!input.reason || input.reason.trim().length < 5) {
      return { success: false, error: "O motivo do estorno deve ter ao menos 5 caracteres." };
    }

    const supabase = await createClient();

    // 1. Busca pagamento
    const { data: payment, error: payErr } = await (supabase.from("payment_records") as any)
      .select("*, receivable:receivables(*)")
      .eq("tenant_id", session.tenant.id)
      .eq("id", input.payment_id)
      .single();

    if (payErr || !payment) return { success: false, error: "Pagamento não encontrado." };
    if (payment.is_reversed) return { success: false, error: "Este pagamento já foi estornado anteriormente." };

    const reversedAt = new Date().toISOString();

    // 2. Marca pagamento como estornado
    await (supabase.from("payment_records") as any)
      .update({
        is_reversed: true,
        reversed_at: reversedAt,
        reversed_by: session.user.id,
        reversal_reason: input.reason.trim(),
        updated_at: reversedAt,
      })
      .eq("tenant_id", session.tenant.id)
      .eq("id", payment.id);

    // 3. Atualiza conta a receber subtraindo o valor estornado
    const rec = payment.receivable;
    const newPaidAmount = Math.max(0, Number(rec.paid_amount) - Number(payment.amount_paid));
    const newStatus = "em_aberto";

    await (supabase.from("receivables") as any)
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        paid_at: newPaidAmount > 0 ? rec.paid_at : null,
        updated_at: reversedAt,
      })
      .eq("tenant_id", session.tenant.id)
      .eq("id", rec.id);

    // 4. Auditoria
    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "PAYMENT_REVERSED",
      resourceType: "payment_record",
      resourceId: payment.id,
      details: {
        receipt_number: payment.receipt_number,
        amount: payment.amount_paid,
        reason: input.reason.trim(),
      },
    });

    revalidatePath("/app/financeiro");
    return { success: true, error: null };
  } catch (err: any) {
    console.error("Erro ao estornar pagamento:", err);
    return { success: false, error: err.message || "Falha ao estornar pagamento." };
  }
}
