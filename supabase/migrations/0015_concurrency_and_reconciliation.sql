-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0015: CONCORRÊNCIA E CONCILIAÇÃO SEGURA DO GATEWAY
-- ==============================================================================
-- 1. Colunas de controle de concorrência e emissão em receivables:
--    - gateway_issuing_at: Timestamp para lock atômico otimista contra concorrência serverless
--    - refunded_amount: Total acumulado estornado (suporte a estorno parcial)
-- 2. Função RPC atômica para conciliação de Webhooks Asaas:
--    - reconcile_gateway_payment: Atualiza gateway_events, receivables e payment_records
--      em uma única transação no PostgreSQL, eliminando estados intermediários inconsistentes.
-- ==============================================================================

-- 1. Novas colunas em public.receivables
ALTER TABLE public.receivables
    ADD COLUMN IF NOT EXISTS gateway_issuing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (refunded_amount >= 0);

CREATE INDEX IF NOT EXISTS idx_receivables_issuing ON public.receivables (gateway_issuing_at)
    WHERE gateway_issuing_at IS NOT NULL;

-- 2. Função RPC para conciliação atômica e consistente de webhooks
CREATE OR REPLACE FUNCTION public.reconcile_gateway_payment(
    p_tenant_id UUID,
    p_event_record_id UUID,
    p_receivable_id UUID,
    p_event_type VARCHAR(100),
    p_payment_id VARCHAR(150),
    p_reported_amount NUMERIC(10,2),
    p_paid_date TIMESTAMPTZ,
    p_billing_type VARCHAR(50),
    p_receipt_number VARCHAR(100),
    p_notes TEXT DEFAULT NULL,
    p_refund_amount NUMERIC(10,2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_new_refunded NUMERIC(10,2);
    v_result JSONB;
BEGIN
    -- Bloqueia a linha da parcela para exclusão mútua na transação
    SELECT * INTO v_rec
    FROM public.receivables
    WHERE id = p_receivable_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        UPDATE public.gateway_events
        SET status = 'ignored', error_message = 'Receivable não encontrado ou não pertence a esta instituição', processed_at = timezone('utc'::text, now())
        WHERE id = p_event_record_id AND tenant_id = p_tenant_id;
        RETURN jsonb_build_object('success', false, 'status', 'ignored', 'message', 'Receivable não encontrado');
    END IF;

    -- CENÁRIO 1: Liquidação / Confirmação de Pagamento
    IF p_event_type IN ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') THEN
        -- Se já estiver pago, concilia o evento sem gerar duplicidade de pagamento
        IF v_rec.status = 'pago' THEN
            UPDATE public.gateway_events
            SET status = 'processed', error_message = NULL, processed_at = timezone('utc'::text, now())
            WHERE id = p_event_record_id AND tenant_id = p_tenant_id;
            RETURN jsonb_build_object('success', true, 'status', 'processed', 'already_paid', true);
        END IF;

        -- Validação de divergência a menor (pagamento parcial recusado na quitação integral)
        IF p_reported_amount < v_rec.final_amount THEN
            UPDATE public.gateway_events
            SET status = 'failed',
                error_message = format('Pagamento divergente a menor: recebido %s, esperado %s', p_reported_amount, v_rec.final_amount),
                processed_at = timezone('utc'::text, now())
            WHERE id = p_event_record_id AND tenant_id = p_tenant_id;
            RETURN jsonb_build_object('success', false, 'status', 'failed', 'message', 'Pagamento divergente a menor');
        END IF;

        -- Baixa do receivable
        UPDATE public.receivables
        SET status = 'pago',
            paid_amount = p_reported_amount,
            paid_at = p_paid_date,
            gateway_charge_id = p_payment_id,
            gateway_synced_at = timezone('utc'::text, now()),
            gateway_issuing_at = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_rec.id AND tenant_id = p_tenant_id;

        -- Inserção de registro de pagamento
        INSERT INTO public.payment_records (
            tenant_id,
            receivable_id,
            amount_paid,
            payment_method,
            paid_at,
            receipt_number,
            notes
        ) VALUES (
            p_tenant_id,
            v_rec.id,
            p_reported_amount,
            CASE WHEN p_billing_type = 'PIX' THEN 'pix' ELSE 'boleto_manual' END,
            p_paid_date,
            p_receipt_number,
            COALESCE(p_notes, format('Baixa automática Asaas (%s) - ID: %s', p_event_type, p_payment_id))
        );

        UPDATE public.gateway_events
        SET status = 'processed', error_message = NULL, processed_at = timezone('utc'::text, now())
        WHERE id = p_event_record_id AND tenant_id = p_tenant_id;

        RETURN jsonb_build_object('success', true, 'status', 'processed');

    -- CENÁRIO 2: Estorno Total ou Parcial
    ELSIF p_event_type IN ('PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED') THEN
        v_new_refunded := COALESCE(v_rec.refunded_amount, 0.00) + COALESCE(p_refund_amount, p_reported_amount, v_rec.paid_amount);

        IF p_event_type = 'PAYMENT_PARTIALLY_REFUNDED' AND v_new_refunded < v_rec.paid_amount THEN
            -- Estorno parcial: mantém status 'pago', apenas registra o montante devolvido e notas auditáveis
            UPDATE public.receivables
            SET refunded_amount = v_new_refunded,
                notes = COALESCE(notes || ' | ', '') || format('Estorno parcial Asaas: R$ %s (%s)', COALESCE(p_refund_amount, p_reported_amount), p_payment_id),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_rec.id AND tenant_id = p_tenant_id;
        ELSE
            -- Estorno total: transiciona para 'estornado'
            UPDATE public.receivables
            SET status = 'estornado',
                refunded_amount = v_new_refunded,
                notes = COALESCE(notes || ' | ', '') || format('Estorno total Asaas: R$ %s (%s)', v_new_refunded, p_payment_id),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_rec.id AND tenant_id = p_tenant_id;

            UPDATE public.payment_records
            SET is_reversed = TRUE,
                reversed_at = timezone('utc'::text, now()),
                reversal_reason = format('Estorno total Asaas (%s)', p_payment_id)
            WHERE receivable_id = v_rec.id AND tenant_id = p_tenant_id AND is_reversed = FALSE;
        END IF;

        UPDATE public.gateway_events
        SET status = 'processed', error_message = NULL, processed_at = timezone('utc'::text, now())
        WHERE id = p_event_record_id AND tenant_id = p_tenant_id;

        RETURN jsonb_build_object('success', true, 'status', 'processed', 'refunded_amount', v_new_refunded);

    -- CENÁRIO 3: Cobrança Cancelada / Removida no Asaas
    ELSIF p_event_type = 'PAYMENT_DELETED' THEN
        IF v_rec.status = 'pago' THEN
            -- Evento fora de ordem: preserva recebimento consumado
            UPDATE public.gateway_events
            SET status = 'ignored', error_message = 'Cancelamento ignorado: parcela já quitada', processed_at = timezone('utc'::text, now())
            WHERE id = p_event_record_id AND tenant_id = p_tenant_id;
            RETURN jsonb_build_object('success', true, 'status', 'ignored', 'message', 'Parcela já quitada');
        END IF;

        UPDATE public.receivables
        SET status = 'cancelado',
            notes = COALESCE(notes || ' | ', '') || format('Cancelada no Asaas (%s)', p_payment_id),
            gateway_issuing_at = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_rec.id AND tenant_id = p_tenant_id;

        UPDATE public.gateway_events
        SET status = 'processed', error_message = NULL, processed_at = timezone('utc'::text, now())
        WHERE id = p_event_record_id AND tenant_id = p_tenant_id;

        RETURN jsonb_build_object('success', true, 'status', 'processed');

    -- CENÁRIO 4: Cobrança Vencida
    ELSIF p_event_type = 'PAYMENT_OVERDUE' THEN
        IF v_rec.status IN ('pago', 'cancelado', 'estornado') THEN
            UPDATE public.gateway_events
            SET status = 'ignored', processed_at = timezone('utc'::text, now())
            WHERE id = p_event_record_id AND tenant_id = p_tenant_id;
            RETURN jsonb_build_object('success', true, 'status', 'ignored');
        END IF;

        UPDATE public.receivables
        SET status = 'vencido',
            updated_at = timezone('utc'::text, now())
        WHERE id = v_rec.id AND tenant_id = p_tenant_id;

        UPDATE public.gateway_events
        SET status = 'processed', error_message = NULL, processed_at = timezone('utc'::text, now())
        WHERE id = p_event_record_id AND tenant_id = p_tenant_id;

        RETURN jsonb_build_object('success', true, 'status', 'processed');

    ELSE
        -- Evento desconhecido ou não relevante para conciliação direta
        UPDATE public.gateway_events
        SET status = 'ignored', processed_at = timezone('utc'::text, now())
        WHERE id = p_event_record_id AND tenant_id = p_tenant_id;
        RETURN jsonb_build_object('success', true, 'status', 'ignored');
    END IF;
END;
$$;

-- Permissões RPC: Apenas service_role pode executar
REVOKE ALL ON FUNCTION public.reconcile_gateway_payment(UUID, UUID, UUID, VARCHAR, VARCHAR, NUMERIC, TIMESTAMPTZ, VARCHAR, VARCHAR, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_gateway_payment(UUID, UUID, UUID, VARCHAR, VARCHAR, NUMERIC, TIMESTAMPTZ, VARCHAR, VARCHAR, TEXT, NUMERIC) TO service_role;
