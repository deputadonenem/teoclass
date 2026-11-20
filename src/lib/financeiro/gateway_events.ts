import { createAdminClient } from "@/lib/supabase/admin";
import type { GatewayProvider, GatewayEventStatus } from "@/types/financeiro";

/**
 * Registro de Eventos de Gateway com Idempotência Estrita
 * 
 * Regra:
 * Se um webhook do gateway reenviar o mesmo event_id para o mesmo tenant_id e provider,
 * a tentativa de inserção detecta o conflito e impede duplicações sob concorrência.
 */

export interface RecordGatewayEventParams {
  tenantId: string;
  provider: GatewayProvider;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface GatewayEventRegistrationResult {
  isDuplicate: boolean;
  eventRecordId?: string;
  error?: string;
}

/**
 * Registra o evento de entrada do gateway de forma atômica.
 * Retorna isDuplicate: true se o evento já havia sido registrado e concluído.
 * Se o evento anterior estava em status 'failed', permite reprocessamento retornando o id existente.
 */
export async function registerIncomingGatewayEvent(
  params: RecordGatewayEventParams
): Promise<GatewayEventRegistrationResult> {
  const admin = createAdminClient();

  // Tenta inserir o evento. Se já existir (tenant_id, provider, event_id), retorna erro 23505 (unique_violation)
  const { data, error } = await (admin.from("gateway_events") as any)
    .insert({
      tenant_id: params.tenantId,
      provider: params.provider,
      event_id: params.eventId,
      event_type: params.eventType,
      payload: params.payload,
      status: "received",
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // Código de violação de unicidade no PostgreSQL
    if (error.code === "23505" || error.message?.includes("uq_gateway_events_idempotency")) {
      // Consulta o status do evento pré-existente
      const { data: existing } = await (admin.from("gateway_events") as any)
        .select("id, status")
        .eq("tenant_id", params.tenantId)
        .eq("provider", params.provider)
        .eq("event_id", params.eventId)
        .maybeSingle();

      // Se o evento anterior falhou (ex: falha transitória de rede ou timeout),
      // permite reprocessamento sem duplicar a chave única
      if (existing && existing.status === "failed") {
        await (admin.from("gateway_events") as any)
          .update({
            status: "received",
            error_message: null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        return {
          isDuplicate: false,
          eventRecordId: existing.id,
        };
      }

      return {
        isDuplicate: true,
        eventRecordId: existing?.id,
      };
    }

    return {
      isDuplicate: false,
      error: error.message,
    };
  }

  return {
    isDuplicate: false,
    eventRecordId: data.id,
  };
}

/**
 * Atualiza o status do processamento do evento (ex: 'processed', 'ignored', 'failed').
 */
export async function updateGatewayEventStatus(
  eventId: string,
  status: GatewayEventStatus,
  errorMessage?: string
): Promise<void> {
  const admin = createAdminClient();

  await (admin.from("gateway_events") as any)
    .update({
      status,
      error_message: errorMessage || null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}
