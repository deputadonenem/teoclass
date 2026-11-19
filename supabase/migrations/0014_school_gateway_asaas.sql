-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0014: FUNDAÇÃO SEGURA DO GATEWAY ASAAS ESCOLAR
-- ==============================================================================
-- Invariantes de Segurança, Multi-Tenancy e Isolamento Financeiro:
-- 1. Separação Estrita de Domínios:
--    - Este módulo atende única e exclusivamente à cobrança escolar interna das
--      instituições (mensalidades, matrículas e taxas dos alunos).
--    - NÃO se mistura com assinaturas corporativas da plataforma (Alcântara Hub).
-- 2. Cofre Isolado de Credenciais (tenant_gateway_configs):
--    - As credenciais da conta Asaas de cada tenant são criptografadas (AES-256-GCM)
--      e armazenadas em tabela dedicada.
--    - REVOKE total para papéis públicos (anon e authenticated via PostgREST).
--    - Apenas a aplicação no backend (via service_role) pode ler e manipular segredos.
-- 3. Idempotência e Concorrência de Eventos (gateway_events):
--    - Chave única composta (tenant_id, provider, event_id) para impedir processamento
--      duplicado de webhooks sob concorrência ou retransmissão de rede.
-- 4. Extensão Hermética de Recebíveis (receivables):
--    - Adição de colunas opcionais para identificadores do gateway Asaas, PIX e Boleto.
--    - Unicidade estrita por (tenant_id, gateway_provider, gateway_charge_id) para
--      impedir vinculação cruzada ou duplicidade de cobranças.
-- 5. Preservação do Financeiro Manual:
--    - Escolas sem Asaas ou pagamentos recebidos em dinheiro/balcão continuam
--      funcionando integralmente sem nenhuma dependência de APIs externas.
-- ==============================================================================

-- ==============================================================================
-- 1. TABELA DE COFRE DE CREDENCIAIS POR TENANT (tenant_gateway_configs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_gateway_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL DEFAULT 'asaas',
    
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    environment VARCHAR(20) NOT NULL DEFAULT 'sandbox'
        CHECK (environment IN ('sandbox', 'production')),
    
    -- Armazenamento seguro de credenciais (Cifradas em repouso com AES-256-GCM)
    api_key_encrypted TEXT NOT NULL,
    api_key_last_four VARCHAR(4) NOT NULL,
    
    -- Token de validação de webhook configurado no Asaas para este tenant
    webhook_access_token_encrypted TEXT,
    
    -- Informações da conta da escola no Asaas (preenchidas após teste de conexão)
    account_number VARCHAR(50),
    wallet_id VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_tenant_gateway_provider UNIQUE (tenant_id, provider),
    CONSTRAINT uq_tenant_gateway_configs_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_gateway_configs_tenant ON public.tenant_gateway_configs(tenant_id);

-- Imutabilidade de tenant_id
DROP TRIGGER IF EXISTS trg_tenant_gateway_configs_tenant_immutable ON public.tenant_gateway_configs;
CREATE TRIGGER trg_tenant_gateway_configs_tenant_immutable
    BEFORE UPDATE ON public.tenant_gateway_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS Default-Deny e Revogação Total para PostgREST
ALTER TABLE public.tenant_gateway_configs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tenant_gateway_configs FROM anon, authenticated;
GRANT ALL ON public.tenant_gateway_configs TO service_role;


-- ==============================================================================
-- 2. TABELA DE EVENTOS DE GATEWAY E IDEMPOTÊNCIA (gateway_events)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.gateway_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL DEFAULT 'asaas',
    
    event_id VARCHAR(150) NOT NULL, -- ID do evento no gateway (ex: evt_...)
    event_type VARCHAR(100) NOT NULL, -- ex: PAYMENT_RECEIVED, PAYMENT_OVERDUE
    
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processed'
        CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    
    error_message TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Idempotência estrita: impede duplicidade de processamento por tenant e evento
    CONSTRAINT uq_gateway_events_idempotency UNIQUE (tenant_id, provider, event_id),
    CONSTRAINT uq_gateway_events_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_gateway_events_tenant ON public.gateway_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gateway_events_provider_event ON public.gateway_events(tenant_id, provider, event_id);
CREATE INDEX IF NOT EXISTS idx_gateway_events_type ON public.gateway_events(tenant_id, event_type);

-- Imutabilidade de tenant_id
DROP TRIGGER IF EXISTS trg_gateway_events_tenant_immutable ON public.gateway_events;
CREATE TRIGGER trg_gateway_events_tenant_immutable
    BEFORE UPDATE ON public.gateway_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();

-- RLS Default-Deny e Revogação para PostgREST
ALTER TABLE public.gateway_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gateway_events FROM anon, authenticated;
GRANT ALL ON public.gateway_events TO service_role;


-- ==============================================================================
-- 3. EXTENSÃO HERMÉTICA DE RECEBÍVEIS (receivables) COM CAMPOS DE GATEWAY
-- ==============================================================================
ALTER TABLE public.receivables
    ADD COLUMN IF NOT EXISTS gateway_provider VARCHAR(30)
        CHECK (gateway_provider IN ('asaas')),
    ADD COLUMN IF NOT EXISTS gateway_charge_id VARCHAR(150),
    ADD COLUMN IF NOT EXISTS gateway_invoice_url TEXT,
    ADD COLUMN IF NOT EXISTS gateway_pix_qrcode TEXT,
    ADD COLUMN IF NOT EXISTS gateway_pix_image_url TEXT,
    ADD COLUMN IF NOT EXISTS gateway_payment_method VARCHAR(50)
        CHECK (gateway_payment_method IN ('PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED')),
    ADD COLUMN IF NOT EXISTS gateway_synced_at TIMESTAMPTZ;

-- Índice e Constraint de Unicidade para evitar duplicidade de cobrança no mesmo tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_receivables_tenant_gateway_charge
    ON public.receivables (tenant_id, gateway_provider, gateway_charge_id)
    WHERE gateway_charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receivables_gateway_charge
    ON public.receivables (gateway_charge_id)
    WHERE gateway_charge_id IS NOT NULL;
