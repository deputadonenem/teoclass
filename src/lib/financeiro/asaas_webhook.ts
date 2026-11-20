import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerIncomingGatewayEvent, updateGatewayEventStatus } from "./gateway_events";
import { decryptGatewaySecret } from "./crypto";
import { generateReceiptNumber } from "./calculator";

export interface AsaasWebhookPayload {
  id?: string; // ID único do evento enviado pelo Asaas (ex: evt_...)
  event: string;
  payment?: {
    id: string;
    customer?: string;
    dateCreated?: string;
    dueDate?: string;
    value?: number;
    netValue?: number;
    billingType?: string;
    status?: string;
    description?: string;
    externalReference?: string; // receivable_id local
    paymentDate?: string | null;
    clientPaymentDate?: string | null;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    transactionReceiptUrl?: string;
  };
  [key: string]: unknown;
}

export interface WebhookProcessResult {
  statusCode: number;
  message: string;
  isDuplicate?: boolean;
}

/**
 * Validação de token em tempo constante (contra Timing Attacks)
 */
function safeCompareTokens(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Processador Seguro de Webhooks do Asaas
 * 
 * Invariantes de Segurança:
 * 1. Resolução Inequívoca da Escola:
 *    - O webhook pode ser recebido em rota parametrizada `/api/webhooks/asaas/[tenantId]` ou global `/api/webhooks/asaas`.
 *    - Quando tenantId é fornecido, valida se o token pré-compartilhado recebido coincide exatamente com o token do cofre.
 *    - Se não fornecido via URL, busca o receivable via `payment.externalReference` ou `payment.id` no banco
 *      para resolver o `tenant_id` legítimo, NUNCA confiando cegamente em IDs arbitrários no payload.
 * 2. Idempotência:
 *    - Registra atômico em `gateway_events (tenant_id, provider, event_id)`. Se já processado, retorna HTTP 200 OK sem duplicar.
 * 3. Prevenção de Baixa Duplicada:
 *    - Verifica se o receivable já está com status 'pago' ou se já possui `payment_records` associado ao evento.
 * 4. Estados Oficiais do Asaas:
 *    - `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`: Baixa automática da parcela e criação de `payment_records`.
 *    - `PAYMENT_REFUNDED`: Estorno do recebível (`status = 'estornado'`) e marcação `is_reversed = true` no pagamento.
 *    - `PAYMENT_DELETED` ou `PAYMENT_OVERDUE`: Atualização de status correspondente.
 */
export async function processAsaasWebhook(
  payload: AsaasWebhookPayload,
  receivedHeaderToken: string | null,
  routeTenantId?: string | null
): Promise<WebhookProcessResult> {
  if (!payload || !payload.event) {
    return { statusCode: 400, message: "Payload de webhook inválido: campo 'event' ausente." };
  }

  const payment = payload.payment;
  if (!payment || !payment.id) {
    // Eventos informativos sem pagamento associado (ex: cadastros avulsos)
    return { statusCode: 200, message: "Evento sem objeto de cobrança ignorado com sucesso." };
  }

  const admin = createAdminClient();

  // 1. Resolução Inequívoca do Tenant
  let resolvedTenantId: string | null = routeTenantId || null;

  if (payment.externalReference) {
    const { data: rec } = await (admin.from("receivables") as any)
      .select("tenant_id")
      .eq("id", payment.externalReference)
      .maybeSingle();
    if (rec?.tenant_id) {
      if (resolvedTenantId && resolvedTenantId !== rec.tenant_id) {
        return { statusCode: 403, message: "Divergência entre tenant da rota e o registro da cobrança." };
      }
      resolvedTenantId = rec.tenant_id;
    }
  }

  if (payment.id) {
    const { data: rec } = await (admin.from("receivables") as any)
      .select("tenant_id")
      .eq("gateway_charge_id", payment.id)
      .maybeSingle();
    if (rec?.tenant_id) {
      if (resolvedTenantId && resolvedTenantId !== rec.tenant_id) {
        return { statusCode: 403, message: "Divergência entre tenant da rota e o vínculo da cobrança." };
      }
      resolvedTenantId = rec.tenant_id;
    }
  }

  if (!resolvedTenantId) {
    return { statusCode: 404, message: "Não foi possível associar a cobrança a nenhuma instituição cadastrada." };
  }

  // 2. Validação Autenticada do Token Pré-Compartilhado do Tenant
  const { data: gatewayConfig } = await (admin.from("tenant_gateway_configs") as any)
    .select("webhook_access_token_encrypted, is_active, environment")
    .eq("tenant_id", resolvedTenantId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (!gatewayConfig) {
    return { statusCode: 401, message: "Instituição não possui configuração Asaas cadastrada." };
  }

  if (gatewayConfig.webhook_access_token_encrypted) {
    const expectedToken = decryptGatewaySecret(gatewayConfig.webhook_access_token_encrypted);
    if (!receivedHeaderToken || !safeCompareTokens(expectedToken, receivedHeaderToken.trim())) {
      return { statusCode: 401, message: "Token de webhook Asaas inválido ou ausente." };
    }
  }

  // 3. Controle Estrito de Idempotência
  // Gera eventId único: Asaas envia id no payment ou podemos compor (event + payment.id)
  const eventId = (payload as any).id || `${payload.event}_${payment.id}_${payment.status || ""}`;

  const eventReg = await registerIncomingGatewayEvent({
    tenantId: resolvedTenantId,
    provider: "asaas",
    eventId,
    eventType: payload.event,
    payload: payload as Record<string, unknown>,
  });

  if (eventReg.isDuplicate) {
    return { statusCode: 200, message: "Evento já processado anteriormente (idempotência garantida).", isDuplicate: true };
  }

  if (eventReg.error) {
    return { statusCode: 500, message: `Falha ao registrar idempotência do evento: ${eventReg.error}` };
  }

  // 4. Localização do Receivable correspondente
  let targetReceivable: any = null;

  if (payment.externalReference) {
    const { data: rec } = await (admin.from("receivables") as any)
      .select("*")
      .eq("id", payment.externalReference)
      .eq("tenant_id", resolvedTenantId)
      .maybeSingle();
    targetReceivable = rec;
  }

  if (!targetReceivable) {
    const { data: rec } = await (admin.from("receivables") as any)
      .select("*")
      .eq("gateway_charge_id", payment.id)
      .eq("tenant_id", resolvedTenantId)
      .maybeSingle();
    targetReceivable = rec;
  }

  if (!targetReceivable) {
    if (eventReg.eventRecordId) {
      await updateGatewayEventStatus(eventReg.eventRecordId, "ignored", "Parcela correspondente não encontrada.");
    }
    return { statusCode: 200, message: "Cobrança não localizada no sistema local; evento registrado como ignorado." };
  }

  // 5. Conciliação Automática dos Estados do Asaas
  try {
    const eventType = payload.event;

    // Cenário A: Pagamento Confirmado / Recebido
    if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
      // Prevenção de baixa duplicada se já estiver pago
      if (targetReceivable.status === "pago") {
        if (eventReg.eventRecordId) {
          await updateGatewayEventStatus(eventReg.eventRecordId, "processed");
        }
        return { statusCode: 200, message: "Parcela já constava como paga. Registro conciliado sem duplicação." };
      }

      // Validação de correspondência de valor
      const expectedAmount = Number(targetReceivable.final_amount);
      const reportedAmount = Number(payment.value ?? expectedAmount);

      // Tratamento de pagamento parcial: se o valor pago for menor que o esperado,
      // não marca como quitado integralmente para evitar perda financeira
      if (reportedAmount < expectedAmount) {
        if (eventReg.eventRecordId) {
          await updateGatewayEventStatus(
            eventReg.eventRecordId,
            "failed",
            `Pagamento divergente a menor: recebido R$ ${reportedAmount}, esperado R$ ${expectedAmount}`
          );
        }
        return {
          statusCode: 422,
          message: `Pagamento parcial recusado na conciliação automática: recebido ${reportedAmount}, esperado ${expectedAmount}. Requer análise manual.`,
        };
      }

      const amountPaid = reportedAmount;
      const paidDate = payment.paymentDate || payment.clientPaymentDate || new Date().toISOString();
      const receiptNumber = generateReceiptNumber();

      // Baixa atômica do receivable
      await (admin.from("receivables") as any)
        .update({
          status: "pago",
          paid_amount: amountPaid,
          paid_at: paidDate,
          gateway_charge_id: payment.id,
          gateway_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetReceivable.id);

      // Registra baixa automática em payment_records
      await (admin.from("payment_records") as any).insert({
        tenant_id: resolvedTenantId,
        receivable_id: targetReceivable.id,
        amount_paid: amountPaid,
        payment_method: payment.billingType === "PIX" ? "pix" : "boleto_manual",
        paid_at: paidDate,
        receipt_number: receiptNumber,
        notes: `Baixa automática via Asaas Webhook (${eventType}) - Charge ID: ${payment.id}`,
      });
    }

    // Cenário B: Estorno / Reembolso (Total ou Parcial)
    else if (eventType === "PAYMENT_REFUNDED" || eventType === "PAYMENT_PARTIALLY_REFUNDED") {
      // Se a parcela nunca foi paga ou já foi totalmente estornada, apenas registra
      if (targetReceivable.status === "estornado") {
        if (eventReg.eventRecordId) {
          await updateGatewayEventStatus(eventReg.eventRecordId, "processed");
        }
        return { statusCode: 200, message: "Parcela já constava como totalmente estornada." };
      }

      // Extrai valor do estorno a partir do payload oficial do Asaas (array refunds ou payment.value)
      let refundValue = 0;
      if (Array.isArray((payment as any).refunds) && (payment as any).refunds.length > 0) {
        refundValue = (payment as any).refunds.reduce((acc: number, r: any) => acc + Number(r.value || 0), 0);
      } else {
        refundValue = Number(payment.value || targetReceivable.paid_amount || targetReceivable.final_amount);
      }

      const prevRefunded = Number(targetReceivable.refunded_amount || 0);
      const totalRefunded = prevRefunded + refundValue;
      const isPartial = eventType === "PAYMENT_PARTIALLY_REFUNDED" && totalRefunded < Number(targetReceivable.paid_amount);

      if (isPartial) {
        // Estorno Parcial: Mantém status 'pago', apenas incrementa refunded_amount e anota auditoria
        await (admin.from("receivables") as any)
          .update({
            refunded_amount: totalRefunded,
            notes: `${targetReceivable.notes ? targetReceivable.notes + " | " : ""}Estorno parcial Asaas: R$ ${refundValue.toFixed(2)} (${payment.id})`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetReceivable.id);
      } else {
        // Estorno Total: Altera status para 'estornado' e reverte registros de pagamento
        await (admin.from("receivables") as any)
          .update({
            status: "estornado",
            refunded_amount: totalRefunded,
            notes: `${targetReceivable.notes ? targetReceivable.notes + " | " : ""}Estorno total Asaas: R$ ${totalRefunded.toFixed(2)} (${payment.id})`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetReceivable.id);

        // Marca payment_records existentes como estornados
        await (admin.from("payment_records") as any)
          .update({
            is_reversed: true,
            reversed_at: new Date().toISOString(),
            reversal_reason: `Reembolsado no Asaas (${eventType} - ${payment.id})`,
          })
          .eq("receivable_id", targetReceivable.id);
      }
    }

    // Cenário C: Cobrança Cancelada / Removida no Asaas
    else if (eventType === "PAYMENT_DELETED") {
      // Evento fora de ordem: se a parcela já estiver paga localmente,
      // NUNCA rebaixa para cancelado (preserva integridade financeira do pagamento efetuado)
      if (targetReceivable.status === "pago") {
        if (eventReg.eventRecordId) {
          await updateGatewayEventStatus(
            eventReg.eventRecordId,
            "ignored",
            "Cobrança cancelada no Asaas após pagamento já consumado localmente. Estado preservado."
          );
        }
        return { statusCode: 200, message: "Evento PAYMENT_DELETED ignorado: parcela já quitada." };
      }

      await (admin.from("receivables") as any)
        .update({
          status: "cancelado",
          notes: `Cancelado no Asaas (${payment.id})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetReceivable.id);
    }

    // Cenário D: Cobrança Vencida
    else if (eventType === "PAYMENT_OVERDUE") {
      // Evento fora de ordem: se já estiver pago, ignora
      if (targetReceivable.status === "pago" || targetReceivable.status === "cancelado") {
        if (eventReg.eventRecordId) {
          await updateGatewayEventStatus(eventReg.eventRecordId, "ignored");
        }
        return { statusCode: 200, message: "Evento PAYMENT_OVERDUE ignorado devido ao status atual da parcela." };
      }

      await (admin.from("receivables") as any)
        .update({
          status: "vencido",
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetReceivable.id);
    }

    if (eventReg.eventRecordId) {
      await updateGatewayEventStatus(eventReg.eventRecordId, "processed");
    }

    return { statusCode: 200, message: "Evento conciliado com sucesso." };
  } catch (err: any) {
    if (eventReg.eventRecordId) {
      await updateGatewayEventStatus(eventReg.eventRecordId, "failed", err.message);
    }
    return { statusCode: 500, message: `Erro ao conciliar evento: ${err.message}` };
  }
}
