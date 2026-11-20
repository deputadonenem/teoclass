-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0017: IDEMPOTÊNCIA ADMINISTRATIVA M2M & RPC TRANSAÇÃO
-- ==============================================================================
-- Invariantes de Segurança e Auditoria:
-- 1. Tabela dedicada public.hub_admin_idempotency:
--    - Separação física e semântica entre anti-replay de transporte (hub_m2m_nonces, TTL 10m)
--      e idempotência administrativa de negócio (hub_admin_idempotency, TTL 24h).
--    - Registro atômico e persistente de (key_id, idempotency_key), operation, tenant_id,
--      payload_hash (SHA-256), status ('processing', 'completed', 'failed'), response_body (JSONB),
--      response_status_code, correlation_id, operator_email, operator_role.
--    - Prevenção de índices redundantes: chave primária UUID e constraint UNIQUE (key_id, idempotency_key)
--      já criam índices btree implícitos; mantemos índices para tenant_id e expires_at.
--    - RLS default-deny ativado e REVOKE total de PUBLIC, anon e authenticated. Apenas service_role.
--
-- 2. RPC Transacional: public.execute_hub_admin_mutation
--    - SECURITY DEFINER com search_path = public, pg_temp.
--    - Executa em uma ÚNICA transação atômica no banco:
--      a) Verificação e lock de idempotência em hub_admin_idempotency.
--         - Se a chave já existir com payload_hash divergente -> Erro TAMPERING_CONFLICT (HTTP 409).
--         - Se já estiver 'completed' -> Retorna imediatamente o response_body em cache (idempotent replay).
--         - Se estiver 'processing' há menos de 60s -> Erro CONCURRENT_IN_PROGRESS (HTTP 429).
--         - Se estiver 'processing' expirado (>60s) -> Assume timeout do worker anterior e renova o lock.
--      b) Lock exclusivo do tenant no banco (SELECT ... FOR UPDATE).
--      c) Atualização de tenants (plan_tier ou status) com validação estrita dos ENUMs e compatibilidade
--         com a trigger trg_prevent_tenant_plan_self_upgrade (configura variável de sessão confiável).
--      d) Inserção compulsória em public.audit_logs com detalhes estruturados.
--      e) Atualização do status da chave em hub_admin_idempotency para 'completed' com o resultado.
--      f) Se qualquer instrução falhar, o rollback é 100% integral no PostgreSQL.
--
-- 3. Menor Privilégio e Blindagem PostgREST:
--    - REVOKE total em hub_admin_idempotency e execute_hub_admin_mutation de PUBLIC, anon e authenticated.
--    - Somente backend autenticado via service_role possui GRANT.
-- ==============================================================================

-- 1. TABELA DE IDEMPOTÊNCIA ADMINISTRATIVA M2M
CREATE TABLE IF NOT EXISTS public.hub_admin_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    operation VARCHAR(50) NOT NULL,            -- 'activate', 'plan', 'status'
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payload_hash VARCHAR(64) NOT NULL,         -- SHA-256 do payload canonicalizado
    status VARCHAR(20) NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    response_status_code INTEGER,
    response_body JSONB,
    correlation_id VARCHAR(128),
    operator_email VARCHAR(255),
    operator_role VARCHAR(50),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_hub_admin_idempotency_key UNIQUE (key_id, idempotency_key)
);

-- Índices úteis para consultas de ciclo de vida e limpeza por TTL (evitando redundância com uq_hub_admin_idempotency_key)
CREATE INDEX IF NOT EXISTS idx_hub_admin_idemp_tenant ON public.hub_admin_idempotency (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_admin_idemp_expires ON public.hub_admin_idempotency (expires_at);

-- RLS Default-Deny e REVOKE para PostgREST
ALTER TABLE public.hub_admin_idempotency ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hub_admin_idempotency FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.hub_admin_idempotency TO service_role;


-- 2. TRIGGER REFINADA: COMPATIBILIDADE DE OPERADOR SAAS / SERVICE_ROLE EM TENANTS
-- Atualiza a função prevent_tenant_plan_self_upgrade para aceitar a variável de sessão transacional
-- 'app.is_hub_m2m_mutation = true' disparada pela RPC autenticada, ou is_platform_operator()
CREATE OR REPLACE FUNCTION public.prevent_tenant_plan_self_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_hub_m2m TEXT;
BEGIN
    BEGIN
        v_is_hub_m2m := current_setting('app.is_hub_m2m_mutation', true);
    EXCEPTION WHEN OTHERS THEN
        v_is_hub_m2m := 'false';
    END;

    IF (NEW.plan_tier IS DISTINCT FROM OLD.plan_tier) THEN
        IF NOT (public.is_platform_operator() OR v_is_hub_m2m = 'true') THEN
            RAISE EXCEPTION 'Operação proibida: somente a plataforma ou faturamento SaaS pode alterar o plano contratado.';
        END IF;
    END IF;

    IF (NEW.status IS DISTINCT FROM OLD.status) THEN
        IF NOT (public.is_platform_operator() OR v_is_hub_m2m = 'true') THEN
            RAISE EXCEPTION 'Operação proibida: somente a plataforma pode suspender ou alterar o status operacional da instituição.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- 3. RPC TRANSAÇÃO ATÔMICA INTEGRAL: IDEMPOTÊNCIA, MUTACÃO DE TENANT E AUDIT_LOG
CREATE OR REPLACE FUNCTION public.execute_hub_admin_mutation(
    p_key_id VARCHAR(100),
    p_idempotency_key VARCHAR(128),
    p_tenant_id UUID,
    p_operation VARCHAR(50),                  -- 'activate', 'plan', 'status'
    p_target_value VARCHAR(50),               -- novo plano ou novo status
    p_payload_hash VARCHAR(64),
    p_reason TEXT,
    p_operator_email VARCHAR(255),
    p_operator_role VARCHAR(50),
    p_correlation_id VARCHAR(128)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_idemp RECORD;
    v_tenant RECORD;
    v_previous_state JSONB;
    v_current_state JSONB;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_action VARCHAR(100);
    v_result JSONB;
    v_ttl TIMESTAMPTZ := v_now + INTERVAL '24 hours';
BEGIN
    -- 1. Gestão Atômica de Idempotência em hub_admin_idempotency
    SELECT * INTO v_idemp
    FROM public.hub_admin_idempotency
    WHERE key_id = p_key_id AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        -- a) Mesma chave com hash divergente -> Fraude / Conflito Crítico
        IF v_idemp.payload_hash <> p_payload_hash THEN
            RAISE EXCEPTION 'TAMPERING_CONFLICT: Mesma X-Hub-Idempotency-Key reenviada com parâmetros divergentes.';
        END IF;

        -- b) Já completada com sucesso -> Retornar resposta idêntica em cache (idempotent replay)
        IF v_idemp.status = 'completed' THEN
            RETURN v_idemp.response_body;
        END IF;

        -- c) Em processamento recente (< 60 segundos) -> Corrida / Concorrência ativa
        IF v_idemp.status = 'processing' AND (v_now - v_idemp.updated_at) < INTERVAL '60 seconds' THEN
            RAISE EXCEPTION 'CONCURRENT_IN_PROGRESS: Comando em processamento concorrente por outra instância.';
        END IF;

        -- d) Em processamento expirado (> 60 segundos) ou falha anterior -> Reassume lock para reprocessamento
        UPDATE public.hub_admin_idempotency
        SET status = 'processing',
            updated_at = v_now,
            expires_at = v_ttl
        WHERE id = v_idemp.id;
    ELSE
        -- Insere novo registro em processing
        INSERT INTO public.hub_admin_idempotency (
            key_id,
            idempotency_key,
            operation,
            tenant_id,
            payload_hash,
            status,
            correlation_id,
            operator_email,
            operator_role,
            expires_at,
            created_at,
            updated_at
        ) VALUES (
            p_key_id,
            p_idempotency_key,
            p_operation,
            p_tenant_id,
            p_payload_hash,
            'processing',
            p_correlation_id,
            p_operator_email,
            p_operator_role,
            v_ttl,
            v_now,
            v_now
        );
    END IF;

    -- 2. Lock Exclusivo do Tenant (SELECT ... FOR UPDATE)
    SELECT id, name, slug, status, plan_tier
    INTO v_tenant
    FROM public.tenants
    WHERE id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Libera idempotência para evitar trava em tenant inválido
        DELETE FROM public.hub_admin_idempotency
        WHERE key_id = p_key_id AND idempotency_key = p_idempotency_key;

        RAISE EXCEPTION 'TENANT_NOT_FOUND: Instituição com ID % não encontrada.', p_tenant_id;
    END IF;

    v_previous_state := jsonb_build_object(
        'status', v_tenant.status,
        'plan', v_tenant.plan_tier
    );

    -- 3. Habilita flag de sessão para autorizar alteração de plano/status na trigger de segurança
    PERFORM set_config('app.is_hub_m2m_mutation', 'true', true);

    -- 4. Executa mutação conforme a operação
    IF p_operation = 'activate' THEN
        v_action := 'HUB_M2M_TENANT_ACTIVATED';
        UPDATE public.tenants
        SET status = 'active'::public.tenant_status,
            updated_at = v_now
        WHERE id = p_tenant_id;

        v_current_state := jsonb_build_object(
            'status', 'active',
            'plan', v_tenant.plan_tier
        );

    ELSIF p_operation = 'plan' THEN
        v_action := 'HUB_M2M_PLAN_CHANGED';
        IF p_target_value NOT IN ('gestao', 'gestao_ead', 'institucional') THEN
            RAISE EXCEPTION 'INVALID_PLAN: Plano comercial % inválido. Valores aceitos: gestao, gestao_ead, institucional.', p_target_value;
        END IF;

        UPDATE public.tenants
        SET plan_tier = p_target_value::public.plan_tier,
            updated_at = v_now
        WHERE id = p_tenant_id;

        v_current_state := jsonb_build_object(
            'status', v_tenant.status,
            'plan', p_target_value
        );

    ELSIF p_operation = 'status' THEN
        v_action := 'HUB_M2M_STATUS_CHANGED';
        IF p_target_value NOT IN ('active', 'trial', 'suspended', 'inactive') THEN
            RAISE EXCEPTION 'INVALID_STATUS: Status operacional % inválido. Valores aceitos: active, trial, suspended, inactive.', p_target_value;
        END IF;

        UPDATE public.tenants
        SET status = p_target_value::public.tenant_status,
            updated_at = v_now
        WHERE id = p_tenant_id;

        v_current_state := jsonb_build_object(
            'status', p_target_value,
            'plan', v_tenant.plan_tier
        );

    ELSE
        RAISE EXCEPTION 'INVALID_OPERATION: Operação % desconhecida.', p_operation;
    END IF;

    -- 5. Gravação compulsória e atômica na trilha de auditoria (audit_logs)
    INSERT INTO public.audit_logs (
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        created_at
    ) VALUES (
        p_tenant_id,
        NULL,
        v_action,
        'tenant',
        p_tenant_id::text,
        jsonb_build_object(
            'operator_email', COALESCE(p_operator_email, 'unknown_operator'),
            'operator_role', COALESCE(p_operator_role, 'unknown_role'),
            'correlation_id', p_correlation_id,
            'idempotency_key', p_idempotency_key,
            'reason', p_reason,
            'previous_state', v_previous_state,
            'current_state', v_current_state
        ),
        v_now
    );

    -- 6. Construir payload de sucesso final
    v_result := jsonb_build_object(
        'success', TRUE,
        'idempotent', FALSE,
        'tenant_id', p_tenant_id,
        'tenant_slug', v_tenant.slug,
        'previous_state', v_previous_state,
        'current_state', v_current_state,
        'executed_at', v_now
    );

    -- 7. Gravação de Conclusão e Cache em hub_admin_idempotency (na mesma transação!)
    UPDATE public.hub_admin_idempotency
    SET status = 'completed',
        response_status_code = 200,
        response_body = jsonb_set(v_result, '{idempotent}', 'true'::jsonb),
        updated_at = v_now
    WHERE key_id = p_key_id AND idempotency_key = p_idempotency_key;

    RETURN v_result;
END;
$$;

-- Restringir permissão de execução da RPC exclusivamente ao service_role
REVOKE ALL ON FUNCTION public.execute_hub_admin_mutation(VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_hub_admin_mutation(VARCHAR, VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR) TO service_role;
