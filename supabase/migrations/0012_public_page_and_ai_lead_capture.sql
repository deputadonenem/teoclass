-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0012: CAPTAÇÃO DE ALUNOS E PÁGINA PÚBLICA COM IA
-- ==============================================================================
-- Invariantes de Segurança, LGPD, Rate Limiting Atômico e Arquitetura Multi-Tenant:
-- 1. Tabela de leads (leads / interessados) com isolamento estrito de tenant_id.
-- 2. Tabela de configurações da página pública e assistente IA (public_page_settings).
-- 3. Tabela de controle atômico de Rate Limiting persistente (rate_limit_buckets)
--    utilizada para controle sob concorrência e instâncias serverless (Vercel).
-- 4. Função atômica check_and_increment_rate_limit() com SECURITY DEFINER e search_path fixo.
-- 5. Armazenamento seguro de hash de origem (SHA-256) em vez de IP bruto para respeito à LGPD.
-- 6. Tabela de histórico de conversas/mensagens do chat público (public_chat_sessions e public_chat_messages).
-- 7. Imutabilidade de tenant_id via trigger nativo prevent_tenant_id_change().
-- 8. RLS Default-Deny estrito em todas as tabelas.
-- ==============================================================================

-- 1. TABELA DE RATE LIMITING PERSISTENTE E ATÔMICO (rate_limit_buckets)
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bucket_key VARCHAR(128) NOT NULL, -- Ex: 'lead:slug:hash', 'chat_daily:tenant_id', 'chat_sess:token'
    tokens_count INT NOT NULL DEFAULT 1,
    max_tokens INT NOT NULL,
    window_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_rate_limit_bucket UNIQUE (tenant_id, bucket_key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_tenant ON public.rate_limit_buckets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expiry ON public.rate_limit_buckets(window_expires_at);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_rate_limit_buckets_tenant_immutable ON public.rate_limit_buckets;
CREATE TRIGGER trg_rate_limit_buckets_tenant_immutable
    BEFORE UPDATE ON public.rate_limit_buckets
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- 2. FUNÇÃO ATÔMICA DE RATE LIMITING (SECURITY DEFINER)
-- Retorna TRUE se a chamada foi permitida (e consome 1 token), ou FALSE se excedeu o limite.
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
    p_tenant_id UUID,
    p_bucket_key VARCHAR(128),
    p_max_tokens INT,
    p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_record RECORD;
BEGIN
    -- Busca e bloqueia o registro com FOR UPDATE para atomicidade total sob concorrência
    SELECT id, tokens_count, window_expires_at
    INTO v_record
    FROM public.rate_limit_buckets
    WHERE tenant_id = p_tenant_id AND bucket_key = p_bucket_key
    FOR UPDATE;

    -- Se não existe ou a janela expirou, cria ou reinicia a janela
    IF v_record.id IS NULL THEN
        INSERT INTO public.rate_limit_buckets (
            tenant_id, bucket_key, tokens_count, max_tokens, window_expires_at
        ) VALUES (
            p_tenant_id, p_bucket_key, 1, p_max_tokens, v_now + (p_window_seconds || ' seconds')::interval
        )
        ON CONFLICT (tenant_id, bucket_key) DO UPDATE
        SET tokens_count = 1,
            max_tokens = EXCLUDED.max_tokens,
            window_expires_at = EXCLUDED.window_expires_at;
            
        RETURN TRUE;
    ELSIF v_record.window_expires_at <= v_now THEN
        -- Janela expirou: reinicia a contagem
        UPDATE public.rate_limit_buckets
        SET tokens_count = 1,
            max_tokens = p_max_tokens,
            window_expires_at = v_now + (p_window_seconds || ' seconds')::interval
        WHERE id = v_record.id;

        RETURN TRUE;
    ELSE
        -- Janela ainda ativa: verifica cota disponível
        IF v_record.tokens_count >= p_max_tokens THEN
            RETURN FALSE; -- Limite atingido!
        ELSE
            UPDATE public.rate_limit_buckets
            SET tokens_count = tokens_count + 1
            WHERE id = v_record.id;

            RETURN TRUE;
        END IF;
    END IF;
END;
$$;


-- 3. TABELA DE CONFIGURAÇÕES DA PÁGINA PÚBLICA E ASSISTENTE IA (public_page_settings)
CREATE TABLE IF NOT EXISTS public.public_page_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identidade Pública
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    show_financial_values BOOLEAN NOT NULL DEFAULT FALSE,
    headline VARCHAR(255) NOT NULL DEFAULT 'Formação Teológica para Edificação e Ministério',
    subheadline TEXT DEFAULT 'Cursos acessíveis e sólidos com fundamentação bíblica.',
    about_text TEXT DEFAULT 'Nossa instituição dedica-se ao ensino fiel das Escrituras Sagradas, capacitando líderes e vocacionados para a igreja e a sociedade.',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    contact_whatsapp VARCHAR(30),
    address_display VARCHAR(255),

    -- Configuração do Agente IA de Atendimento
    ai_agent_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ai_agent_name VARCHAR(100) NOT NULL DEFAULT 'Assistente TeoClass',
    ai_agent_welcome_message TEXT DEFAULT 'Paz! Sou o assistente virtual da instituição. Como posso ajudar com informações sobre nossos cursos e inscrições?',
    ai_agent_instructions TEXT DEFAULT 'Você é o assistente virtual oficial da instituição teológica. Responda educadamente a dúvidas sobre cursos, duração, modalidade e inscrições usando exclusivamente os dados institucionais autorizados fornecidos no contexto. Jamais invente preços, prazos ou promessas que não constem no catálogo. Se não souber de algo, oriente o interessado a preencher o formulário de contato.',
    ai_daily_limit_messages INT NOT NULL DEFAULT 500 CHECK (ai_daily_limit_messages > 0),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_public_page_settings_tenant UNIQUE (tenant_id),
    CONSTRAINT uq_public_page_settings_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_public_page_settings_tenant ON public.public_page_settings(tenant_id);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_public_page_settings_tenant_immutable ON public.public_page_settings;
CREATE TRIGGER trg_public_page_settings_tenant_immutable
    BEFORE UPDATE ON public.public_page_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- 4. TABELA DE LEADS / INTERESSADOS (leads)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    course_id UUID,

    -- Dados do interessado
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    church_name VARCHAR(200),
    notes TEXT,

    -- Origem e Consentimento LGPD
    source VARCHAR(50) NOT NULL DEFAULT 'pagina_publica'
        CHECK (source IN ('pagina_publica', 'chat_ia', 'indicacao', 'secretaria', 'evento')),
    status VARCHAR(30) NOT NULL DEFAULT 'novo'
        CHECK (status IN ('novo', 'em_contato', 'matriculado', 'descartado')),
    
    lgpd_consent BOOLEAN NOT NULL DEFAULT TRUE,
    lgpd_consent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    origin_hash VARCHAR(64), -- Hash SHA-256 anonimizado da origem/sessão (sem expor IP bruto)

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_leads_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_leads_course FOREIGN KEY (tenant_id, course_id) REFERENCES public.courses(tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(tenant_id, created_at DESC);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_leads_tenant_immutable ON public.leads;
CREATE TRIGGER trg_leads_tenant_immutable
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- 5. TABELA DE SESSÕES DE CHAT PÚBLICO COM IA (public_chat_sessions)
CREATE TABLE IF NOT EXISTS public.public_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_token VARCHAR(64) NOT NULL UNIQUE,
    origin_hash VARCHAR(64), -- Hash SHA-256 da origem
    messages_count INT NOT NULL DEFAULT 0 CHECK (messages_count >= 0),
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_public_chat_sessions_tenant UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_public_chat_sessions_tenant ON public.public_chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_public_chat_sessions_token ON public.public_chat_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_public_chat_sessions_origin ON public.public_chat_sessions(tenant_id, origin_hash, created_at);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_public_chat_sessions_tenant_immutable ON public.public_chat_sessions;
CREATE TRIGGER trg_public_chat_sessions_tenant_immutable
    BEFORE UPDATE ON public.public_chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- 6. TABELA DE MENSAGENS DO CHAT PÚBLICO (public_chat_messages)
CREATE TABLE IF NOT EXISTS public.public_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.public_chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_public_chat_messages_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_public_chat_messages_session ON public.public_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_public_chat_messages_tenant ON public.public_chat_messages(tenant_id, created_at);


-- ==============================================================================
-- 7. ROW-LEVEL SECURITY (RLS) DEFAULT-DENY
-- ==============================================================================
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_chat_messages ENABLE ROW LEVEL SECURITY;

-- 7.1 rate_limit_buckets (Acesso restrito a service_role e função SECURITY DEFINER)
CREATE POLICY rate_limit_admin_select ON public.rate_limit_buckets
    FOR SELECT TO authenticated
    USING (
        public.is_platform_operator()
        OR (
            tenant_id IN (SELECT get_auth_tenant_ids())
            AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
        )
    );

-- 7.2 public_page_settings
DROP POLICY IF EXISTS public_page_settings_select_policy ON public.public_page_settings;
CREATE POLICY public_page_settings_select_policy ON public.public_page_settings
    FOR SELECT
    USING (
        is_published = TRUE
        OR (
            tenant_id IN (SELECT get_auth_tenant_ids())
            AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
        )
    );

DROP POLICY IF EXISTS public_page_settings_write_policy ON public.public_page_settings;
CREATE POLICY public_page_settings_write_policy ON public.public_page_settings
    FOR ALL TO authenticated
    USING (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
    WITH CHECK (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    );

-- 7.3 leads
DROP POLICY IF EXISTS leads_select_policy ON public.leads;
CREATE POLICY leads_select_policy ON public.leads
    FOR SELECT TO authenticated
    USING (
        public.is_platform_operator()
        OR (
            tenant_id IN (SELECT get_auth_tenant_ids())
            AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
        )
    );

DROP POLICY IF EXISTS leads_insert_policy ON public.leads;
CREATE POLICY leads_insert_policy ON public.leads
    FOR INSERT
    WITH CHECK (
        length(trim(full_name)) >= 2
        AND length(trim(email)) >= 5
        AND position('@' in email) > 1
        AND lgpd_consent = TRUE
    );

DROP POLICY IF EXISTS leads_update_policy ON public.leads;
CREATE POLICY leads_update_policy ON public.leads
    FOR UPDATE TO authenticated
    USING (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
    WITH CHECK (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    );

DROP POLICY IF EXISTS leads_delete_policy ON public.leads;
CREATE POLICY leads_delete_policy ON public.leads
    FOR DELETE TO authenticated
    USING (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    );

-- 7.4 public_chat_sessions e public_chat_messages
DROP POLICY IF EXISTS public_chat_sessions_admin_select ON public.public_chat_sessions;
CREATE POLICY public_chat_sessions_admin_select ON public.public_chat_sessions
    FOR SELECT TO authenticated
    USING (
        public.is_platform_operator()
        OR (
            tenant_id IN (SELECT get_auth_tenant_ids())
            AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
        )
    );

DROP POLICY IF EXISTS public_chat_messages_admin_select ON public.public_chat_messages;
CREATE POLICY public_chat_messages_admin_select ON public.public_chat_messages
    FOR SELECT TO authenticated
    USING (
        public.is_platform_operator()
        OR (
            tenant_id IN (SELECT get_auth_tenant_ids())
            AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
        )
    );
