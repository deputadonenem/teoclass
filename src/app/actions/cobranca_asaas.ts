"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { logAuditEvent } from "@/lib/audit/logger";
import { AsaasClient } from "@/lib/financeiro/asaas_client";
import { getDecryptedGatewayApiKey } from "@/lib/financeiro/gateway_vault";

export interface IssueSchoolChargeInput {
  receivableId: string;
  billingType: "PIX" | "BOLETO";
}

export interface IssueSchoolChargeResult {
  success: boolean;
  receivableId?: string;
  gatewayChargeId?: string;
  billingType?: "PIX" | "BOLETO";
  invoiceUrl?: string | null;
  pixQrCode?: string | null;
  pixImageUrl?: string | null;
  error?: string;
}

/**
 * Emite cobrança escolar Asaas (Pix ou Boleto) para um receivable existente.
 * 
 * Regras e Invariantes:
 * 1. RBAC: Restrito a Admin ou Financeiro escolar.
 * 2. Sessão e Tenant: Apenas a conta Asaas ativa do próprio tenant da sessão é utilizada.
 * 3. Validação do Receivable:
 *    - Deve pertencer ao tenant da sessão (`tenant_id = session.tenant.id`).
 *    - Deve estar com status 'em_aberto' ou 'vencido'.
 *    - Não pode estar 'pago', 'cancelado' ou 'estornado'.
 *    - Prevenção de duplicidade: Se já possuir `gateway_charge_id`, retorna os dados existentes sem reemitir.
 * 4. Persistência: Registra `gateway_provider = 'asaas'`, `gateway_charge_id`, `gateway_invoice_url`,
 *    `gateway_pix_qrcode`, `gateway_pix_image_url`, `gateway_payment_method`, `gateway_synced_at`.
 */
export async function issueSchoolChargeAction(
  input: IssueSchoolChargeInput
): Promise<IssueSchoolChargeResult> {
  try {
    const session = await requireTenantSession();

    // Valida permissão do papel
    if (session.role !== "admin" && session.role !== "financeiro") {
      return { success: false, error: "Acesso negado: apenas Administrador ou Financeiro podem emitir cobranças." };
    }

    if (!input.receivableId) {
      return { success: false, error: "Identificador da parcela (receivableId) não informado." };
    }

    const admin = createAdminClient();

    // 1. Busca o receivable do tenant com dados do aluno
    const { data: receivable, error: recErr } = await (admin.from("receivables") as any)
      .select(`
        id,
        tenant_id,
        title,
        charge_type,
        installment_number,
        total_installments,
        final_amount,
        due_date,
        status,
        gateway_provider,
        gateway_charge_id,
        gateway_invoice_url,
        gateway_pix_qrcode,
        gateway_pix_image_url,
        gateway_payment_method,
        student:students(id, first_name, last_name, full_name, cpf, email, phone)
      `)
      .eq("id", input.receivableId)
      .eq("tenant_id", session.tenant.id)
      .single();

    if (recErr || !receivable) {
      return { success: false, error: "Parcela não encontrada ou não pertence a esta instituição." };
    }

    // 2. Valida status da parcela
    if (receivable.status === "pago") {
      return { success: false, error: "Esta parcela já foi baixada/paga. Não é permitida nova emissão." };
    }
    if (receivable.status === "cancelado" || receivable.status === "estornado") {
      return { success: false, error: `Não é possível emitir cobrança para parcela com status '${receivable.status}'.` };
    }

    // 3. Prevenção de cobrança duplicada: Se já tiver charge_id para o mesmo método, retorna existente
    if (
      receivable.gateway_charge_id &&
      receivable.gateway_provider === "asaas" &&
      receivable.gateway_payment_method === input.billingType
    ) {
      return {
        success: true,
        receivableId: receivable.id,
        gatewayChargeId: receivable.gateway_charge_id,
        billingType: input.billingType,
        invoiceUrl: receivable.gateway_invoice_url,
        pixQrCode: receivable.gateway_pix_qrcode,
        pixImageUrl: receivable.gateway_pix_image_url,
      };
    }

    // 3.1 Lock Atômico Distribuído / Exclusão Mútua Serverless:
    // Evita que duas chamadas simultâneas (mesmo em instâncias distintas) comecem
    // a emitir cobrança para o mesmo receivable ao mesmo tempo.
    // O lock possui expiração automática de 60 segundos para recuperação em caso de falha transitória/crash.
    const lockExpiryMs = 60 * 1000;
    const nowIso = new Date().toISOString();
    const staleLockThreshold = new Date(Date.now() - lockExpiryMs).toISOString();

    // Tenta adquirir o lock atômico
    const { data: lockedRec, error: lockErr } = await (admin.from("receivables") as any)
      .update({ gateway_issuing_at: nowIso })
      .eq("id", receivable.id)
      .eq("tenant_id", session.tenant.id)
      .or(`gateway_issuing_at.is.null,gateway_issuing_at.lt.${staleLockThreshold}`)
      .select("id")
      .maybeSingle();

    if (lockErr || !lockedRec) {
      return {
        success: false,
        error: "Esta parcela já está em processo de emissão por outro operador ou requisição concorrente. Aguarde alguns instantes.",
      };
    }

    // 4. Recupera credenciais Asaas ativas do tenant
    const credentials = await getDecryptedGatewayApiKey(session.tenant.id, "asaas");
    if (!credentials) {
      return {
        success: false,
        error: "A instituição não possui integração Asaas configurada e ativa. Configure em Configurações > Pagamentos da Escola.",
      };
    }

    const asaasClient = new AsaasClient({
      apiKey: credentials.apiKey,
      environment: credentials.environment,
    });

    // 4.1 Idempotência Efetiva no Asaas: Antes de criar, consulta se já existe cobrança
    // ativa no Asaas com este mesmo externalReference (receivable.id).
    // Isso protege contra concorrência entre abas/operadores e retries de rede.
    let existingAsaasPayment = null;
    try {
      existingAsaasPayment = await asaasClient.findPaymentByExternalReference(receivable.id);
    } catch (checkErr: any) {
      console.warn("Aviso ao verificar cobrança existente no Asaas:", checkErr.message);
    }

    let paymentRes = existingAsaasPayment;

    if (!paymentRes) {
      // 5. Garante cliente no Asaas
      const student = receivable.student;
      const customerRes = await asaasClient.createOrFindCustomer({
        name: student?.full_name || `${student?.first_name} ${student?.last_name}`.trim(),
        cpfCnpj: student?.cpf || null,
        email: student?.email || null,
        phone: student?.phone || null,
        externalReference: student?.id,
      });

      if (!customerRes || !customerRes.id) {
        return { success: false, error: "Falha ao registrar ou localizar o cadastro do aluno no Asaas." };
      }

      // 6. Emite cobrança no Asaas com amarração inequívoca
      const description = `${receivable.title} - Parcela ${receivable.installment_number}/${receivable.total_installments}`;
      paymentRes = await asaasClient.createPayment({
        customer: customerRes.id,
        billingType: input.billingType,
        value: Number(receivable.final_amount),
        dueDate: receivable.due_date,
        description,
        externalReference: receivable.id,
      });
    }

    if (!paymentRes || !paymentRes.id) {
      return { success: false, error: "Falha na criação ou recuperação da cobrança junto ao Asaas." };
    }

    let pixQrCode: string | null = null;
    let pixImageUrl: string | null = null;

    // Se for Pix, busca QR Code imediatamente
    if (input.billingType === "PIX") {
      try {
        const qrRes = await asaasClient.getPixQrCode(paymentRes.id);
        if (qrRes) {
          pixQrCode = qrRes.payload || null;
          pixImageUrl = qrRes.encodedImage ? `data:image/png;base64,${qrRes.encodedImage}` : null;
        }
      } catch (err: any) {
        console.warn("Aviso ao buscar QR code Pix do Asaas:", err.message);
      }
    }

    const invoiceUrl = paymentRes.bankSlipUrl || paymentRes.invoiceUrl || null;

    // 7. Atualiza o receivable com os dados do gateway e libera o lock de emissão
    const { error: updateErr } = await (admin.from("receivables") as any)
      .update({
        gateway_provider: "asaas",
        gateway_charge_id: paymentRes.id,
        gateway_invoice_url: invoiceUrl,
        gateway_pix_qrcode: pixQrCode,
        gateway_pix_image_url: pixImageUrl,
        gateway_payment_method: input.billingType,
        gateway_synced_at: new Date().toISOString(),
        gateway_issuing_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receivable.id)
      .eq("tenant_id", session.tenant.id);

    if (updateErr) {
      return { success: false, error: `Cobrança gerada no Asaas (${paymentRes.id}), mas falhou ao vincular localmente: ${updateErr.message}` };
    }

    await logAuditEvent({
      tenantId: session.tenant.id,
      userId: session.user.id,
      action: "CHARGE_ISSUED",
      resourceType: "receivables",
      resourceId: receivable.id,
      details: {
        gateway_provider: "asaas",
        charge_id: paymentRes.id,
        billing_type: input.billingType,
        value: receivable.final_amount,
      },
    });

    revalidatePath("/app/financeiro");
    revalidatePath("/app/portal");

    return {
      success: true,
      receivableId: receivable.id,
      gatewayChargeId: paymentRes.id,
      billingType: input.billingType,
      invoiceUrl,
      pixQrCode,
      pixImageUrl,
    };
  } catch (err: any) {
    // Liberação preventiva do lock de emissão em caso de exceção/falha inesperada
    try {
      if (input.receivableId) {
        const admin = createAdminClient();
        await (admin.from("receivables") as any)
          .update({ gateway_issuing_at: null })
          .eq("id", input.receivableId);
      }
    } catch {
      // Ignora erro secundário de limpeza de lock
    }

    return { success: false, error: err.message || "Erro inesperado ao emitir cobrança Asaas." };
  }
}
