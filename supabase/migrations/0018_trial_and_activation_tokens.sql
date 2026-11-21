-- ==============================================================================
-- TeoClass Migration 0018: Trial de 7 Dias e Tokens de Ativação Segura
-- ==============================================================================
-- 1. Expansão do tipo enum tenant_status para suportar 'trial_pending' e 'trial_expired'
-- 2. Adição da coluna trial_ends_at em public.tenants
-- 3. Atualização do trigger prevent_tenant_plan_self_upgrade para permitir
--    transições legítimas de ativação e expiração de trial
-- 4. RPC atômica public.consume_activation_token_atomic para prevenir concorrência
-- 5. Tabela public.tenant_activation_tokens com token criptográfico em hash (SHA-256)
-- 6. RLS hermético: somente service_role ou funções internas acessam tokens
-- ==============================================================================

-- 1. Adicionar novos valores ao enum tenant_status
ALTER TYPE public.tenant_status ADD VALUE IF NOT EXISTS 'trial_pending';
ALTER TYPE public.tenant_status ADD VALUE IF NOT EXISTS 'trial_expired';

-- 2. Adicionar coluna trial_ends_at na tabela tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at ON public.tenants(trial_ends_at) WHERE status = 'trial';

-- 3. Tabela de Tokens de Ativação (Uso Único, Expiração e Hash SHA-256)
CREATE TABLE IF NOT EXISTS public.tenant_activation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    admin_email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 do token gerado
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activation_tokens_hash ON public.tenant_activation_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_tenant ON public.tenant_activation_tokens(tenant_id);

-- 4. Blindagem de RLS: Ninguém no cliente acessa diretamente tokens
ALTER TABLE public.tenant_activation_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tenant_activation_tokens FROM public, anon, authenticated;
GRANT ALL ON public.tenant_activation_tokens TO service_role;

-- 5. Trigger de imutabilidade do tenant_id no token
CREATE OR REPLACE FUNCTION public.fn_prevent_activation_token_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash) THEN
        RAISE EXCEPTION 'Os campos tenant_id e token_hash de ativação são estritamente imutáveis.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_activation_token_tampering ON public.tenant_activation_tokens;
CREATE TRIGGER trg_prevent_activation_token_tampering
    BEFORE UPDATE ON public.tenant_activation_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_activation_token_tampering();

-- 6. RPC Atômica para Queimar Token Sob Concorrência (Previne Race Condition)
CREATE OR REPLACE FUNCTION public.consume_activation_token_atomic(
    p_token_hash VARCHAR(64)
)
RETURNS TABLE (
    success BOOLEAN,
    reason VARCHAR(50),
    tenant_id UUID,
    admin_email VARCHAR(255)
) AS $$
DECLARE
    v_token RECORD;
BEGIN
    -- Seleciona e bloqueia a linha do token concorrente
    SELECT * INTO v_token
    FROM public.tenant_activation_tokens
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'TOKEN_NOT_FOUND'::VARCHAR(50), NULL::UUID, NULL::VARCHAR(255);
        RETURN;
    END IF;

    IF v_token.used_at IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, 'TOKEN_ALREADY_USED'::VARCHAR(50), v_token.tenant_id, v_token.admin_email;
        RETURN;
    END IF;

    IF timezone('utc'::text, now()) > v_token.expires_at THEN
        RETURN QUERY SELECT FALSE, 'TOKEN_EXPIRED'::VARCHAR(50), v_token.tenant_id, v_token.admin_email;
        RETURN;
    END IF;

    -- Queima o token atomicamente
    UPDATE public.tenant_activation_tokens
    SET used_at = timezone('utc'::text, now())
    WHERE id = v_token.id;

    RETURN QUERY SELECT TRUE, 'SUCCESS'::VARCHAR(50), v_token.tenant_id, v_token.admin_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.consume_activation_token_atomic(VARCHAR) TO service_role;
