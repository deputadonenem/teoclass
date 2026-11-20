-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0016: FUNDAÇÃO M2M ALCÂNTARA HUB & NONCES ANTI-REPLAY
-- ==============================================================================
-- Invariantes de Segurança e Auditoria:
-- 1. Tabela public.hub_m2m_nonces para rastreamento de nonces anti-replay do Hub.
-- 2. Chave única composta (key_id, nonce) para impedir repetição de requisições.
-- 3. Expiração temporal (expires_at) para permitir limpeza periódica (TTL de 10 minutos).
-- 4. RLS Default-Deny e REVOKE total para papéis públicos (anon, authenticated via PostgREST).
-- 5. Apenas a aplicação no backend (via service_role) pode ler e gravar nonces.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.hub_m2m_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(100) NOT NULL,
    nonce VARCHAR(120) NOT NULL,
    request_timestamp BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_hub_m2m_nonces_key_nonce UNIQUE (key_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_hub_m2m_nonces_key_nonce ON public.hub_m2m_nonces (key_id, nonce);
CREATE INDEX IF NOT EXISTS idx_hub_m2m_nonces_expires_at ON public.hub_m2m_nonces (expires_at);

-- RLS Default-Deny e Revogação para PostgREST
ALTER TABLE public.hub_m2m_nonces ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hub_m2m_nonces FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.hub_m2m_nonces TO service_role;
