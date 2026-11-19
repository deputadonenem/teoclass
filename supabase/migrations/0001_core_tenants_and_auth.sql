-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0001: FUNDAÇÃO MULTI-TENANT, AUTH, MEMBERSHIPS E AUDITORIA
-- ==============================================================================
-- Regras de Segurança:
-- 1. Default-Deny: RLS ativado em 100% das tabelas.
-- 2. Isolamento Hermético: Nenhuma consulta de tenant A pode acessar dados de tenant B.
-- 3. Defesa em Profundidade: Funções SECURITY DEFINER com search_path = public fixo.
-- 4. Proteção contra Autopromoção: Ninguém altera seu próprio perfil para operador de plataforma ou seu próprio role em tenant_users.
-- ==============================================================================

-- 1. Extensões essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tipos enumerados
DO $$ BEGIN
    CREATE TYPE public.teoclass_role AS ENUM (
        'admin',
        'secretaria',
        'financeiro',
        'professor',
        'aluno'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.tenant_status AS ENUM (
        'active',
        'suspended',
        'trial',
        'inactive'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.plan_tier AS ENUM (
        'gestao',
        'gestao_ead',
        'institucional'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabela de Tenants (Instituições Teológicas / Seminários)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    slug VARCHAR(100) NOT NULL UNIQUE,
    cnpj VARCHAR(18) UNIQUE,
    email VARCHAR(255),
    phone VARCHAR(30),
    status public.tenant_status NOT NULL DEFAULT 'active',
    plan_tier public.plan_tier NOT NULL DEFAULT 'gestao',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- 4. Tabela de Perfis de Usuários (Profiles vinculados ao auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(30),
    is_platform_operator BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 5. Tabela de Associação Usuário-Tenant (Memberships) com os 5 papéis
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.teoclass_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    custom_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tenant_user_membership UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON public.tenant_users(role);

-- 6. Tabela de Auditoria Imutável
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ==============================================================================
-- 7. Funções Utilitárias com SECURITY DEFINER e search_path Fixo
-- ==============================================================================

-- Verificar se o usuário autenticado é operador central da plataforma
CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT p.is_platform_operator FROM public.profiles p WHERE p.id = auth.uid()),
        FALSE
    );
$$;

-- Obter todos os IDs de tenant válidos aos quais o usuário autenticado pertence
CREATE OR REPLACE FUNCTION public.get_auth_tenant_ids()
RETURNS TABLE (tenant_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT tu.tenant_id
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = TRUE;
$$;

-- Obter o papel do usuário autenticado em um tenant específico
CREATE OR REPLACE FUNCTION public.get_auth_role_in_tenant(p_tenant_id UUID)
RETURNS public.teoclass_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT tu.role
    FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = auth.uid()
      AND tu.is_active = TRUE
    LIMIT 1;
$$;

-- ==============================================================================
-- 8. Triggers de Segurança (Proteção contra Autopromoção e Criação de Perfil)
-- ==============================================================================

-- Criação automática do profile na inscrição via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, is_platform_operator)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Trigger para impedir autopromoção a is_platform_operator
CREATE OR REPLACE FUNCTION public.prevent_operator_self_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (NEW.is_platform_operator IS DISTINCT FROM OLD.is_platform_operator) THEN
        IF NOT public.is_platform_operator() THEN
            RAISE EXCEPTION 'Operação proibida: somente operadores da plataforma podem alterar este status.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_operator_self_promotion ON public.profiles;
CREATE TRIGGER trg_prevent_operator_self_promotion
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_operator_self_promotion();

-- ==============================================================================
-- 9. Row-Level Security (RLS) - Regras Estritas de Isolamento Multi-Tenant
-- ==============================================================================

-- A) Tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_membership" ON public.tenants;
CREATE POLICY "tenants_select_membership"
ON public.tenants
FOR SELECT
USING (
    public.is_platform_operator()
    OR id IN (SELECT get_auth_tenant_ids())
);

DROP POLICY IF EXISTS "tenants_update_admin" ON public.tenants;
CREATE POLICY "tenants_update_admin"
ON public.tenants
FOR UPDATE
USING (
    public.is_platform_operator()
    OR (
        id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(id) = 'admin'
    )
)
WITH CHECK (
    public.is_platform_operator()
    OR (
        id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(id) = 'admin'
    )
);

-- B) Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_same_tenant" ON public.profiles;
CREATE POLICY "profiles_select_own_or_same_tenant"
ON public.profiles
FOR SELECT
USING (
    id = auth.uid()
    OR public.is_platform_operator()
    OR EXISTS (
        SELECT 1 FROM public.tenant_users tu1
        JOIN public.tenant_users tu2 ON tu1.tenant_id = tu2.tenant_id
        WHERE tu1.user_id = auth.uid()
          AND tu2.user_id = profiles.id
          AND tu1.is_active = TRUE
          AND tu2.is_active = TRUE
    )
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (id = auth.uid() OR public.is_platform_operator())
WITH CHECK (id = auth.uid() OR public.is_platform_operator());

-- C) Tenant Users (Memberships)
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_users_select" ON public.tenant_users;
CREATE POLICY "tenant_users_select"
ON public.tenant_users
FOR SELECT
USING (
    user_id = auth.uid()
    OR public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria')
    )
);

DROP POLICY IF EXISTS "tenant_users_insert_admin" ON public.tenant_users;
CREATE POLICY "tenant_users_insert_admin"
ON public.tenant_users
FOR INSERT
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
);

DROP POLICY IF EXISTS "tenant_users_update_admin" ON public.tenant_users;
CREATE POLICY "tenant_users_update_admin"
ON public.tenant_users
FOR UPDATE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
)
WITH CHECK (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
);

DROP POLICY IF EXISTS "tenant_users_delete_admin" ON public.tenant_users;
CREATE POLICY "tenant_users_delete_admin"
ON public.tenant_users
FOR DELETE
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
);

-- D) Audit Logs (Somente Leitura para Admin do Tenant ou Operador Central; Inserções via Operação Confiável do Servidor)
-- Proíbe INSERT, UPDATE e DELETE diretos para qualquer cliente (anon e authenticated).
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select"
ON public.audit_logs
FOR SELECT
USING (
    public.is_platform_operator()
    OR (
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND public.get_auth_role_in_tenant(tenant_id) = 'admin'
    )
);

-- Bloqueio total de INSERT direto via PostgREST/anon/authenticated.
-- Somente o backend com service_role (que ignora RLS) pode gravar logs de auditoria.
DROP POLICY IF EXISTS "audit_logs_deny_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_deny_insert"
ON public.audit_logs
FOR INSERT
WITH CHECK (FALSE);

-- Bloqueia alteração e exclusão manual direta em audit_logs (imutabilidade garantida)
DROP POLICY IF EXISTS "audit_logs_deny_update" ON public.audit_logs;
CREATE POLICY "audit_logs_deny_update"
ON public.audit_logs
FOR UPDATE
USING (FALSE);

DROP POLICY IF EXISTS "audit_logs_deny_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_deny_delete"
ON public.audit_logs
FOR DELETE
USING (FALSE);
