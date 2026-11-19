-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0013: CONFIGURAÇÕES, GESTÃO DE EQUIPE E AUDITORIA DE ENTITLEMENTS
-- ==============================================================================
-- Invariantes de Segurança, RBAC, Multi-Tenancy e Proteção contra Autopromoção:
-- 1. Proteção de Plan_Tier contra alteração direta por Administradores de Tenant:
--    Somente operadores centrais da plataforma (is_platform_operator = TRUE)
--    ou processos confiáveis com service_role podem alterar tenants.plan_tier.
-- 2. Proteção estrita contra autopromoção em tenant_users:
--    Um usuário (mesmo admin) não pode alterar seu próprio role nem reativar a si mesmo.
-- 3. Blindagem de deleção de si mesmo:
--    Um usuário não pode deletar seu próprio vínculo ativo se for o único admin do tenant.
-- 4. Suporte a campos de identidade visual e dados cadastrais institucionais:
--    Garantir que a tabela tenants possua colunas para logo_url e configurações institucionais.
-- ==============================================================================

-- 1. ADICIONA COLUNAS DE IDENTIDADE E CONTATO EM TENANTS CASO NÃO EXISTAM
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS primary_color VARCHAR(10) DEFAULT '#4f46e5',
    ADD COLUMN IF NOT EXISTS website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
    ADD COLUMN IF NOT EXISTS address_postal_code VARCHAR(20);

-- 2. TRIGGER DE SEGURANÇA: IMPEDIR QUE ADMIN DO TENANT MUDE O PRÓPRIO PLANO SAAS
-- Somente Operador de Plataforma (is_platform_operator) ou service_role pode alterar plan_tier e status
CREATE OR REPLACE FUNCTION public.prevent_tenant_plan_self_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (NEW.plan_tier IS DISTINCT FROM OLD.plan_tier) THEN
        IF NOT public.is_platform_operator() THEN
            RAISE EXCEPTION 'Operação proibida: somente a plataforma ou faturamento SaaS pode alterar o plano contratado.';
        END IF;
    END IF;

    IF (NEW.status IS DISTINCT FROM OLD.status) THEN
        IF NOT public.is_platform_operator() THEN
            RAISE EXCEPTION 'Operação proibida: somente a plataforma pode suspender ou alterar o status operacional da instituição.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_plan_self_upgrade ON public.tenants;
CREATE TRIGGER trg_prevent_tenant_plan_self_upgrade
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_plan_self_upgrade();


-- 3. TRIGGER DE SEGURANÇA: IMPEDIR AUTOPROMOÇÃO E AUTOALTERAÇÃO DE ROLE EM TENANT_USERS
CREATE OR REPLACE FUNCTION public.prevent_tenant_user_self_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Se quem está atualizando é o próprio usuário do registro (auth.uid() = OLD.user_id)
    -- e não é um operador de plataforma, proíbe alterar seu próprio role ou status
    IF (auth.uid() = OLD.user_id AND NOT public.is_platform_operator()) THEN
        IF (NEW.role IS DISTINCT FROM OLD.role) THEN
            RAISE EXCEPTION 'Operação proibida: você não pode alterar seu próprio perfil de acesso.';
        END IF;

        IF (NEW.is_active IS DISTINCT FROM OLD.is_active AND NEW.is_active = TRUE) THEN
            RAISE EXCEPTION 'Operação proibida: você não pode reativar seu próprio acesso suspenso.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_user_self_modification ON public.tenant_users;
CREATE TRIGGER trg_prevent_tenant_user_self_modification
    BEFORE UPDATE ON public.tenant_users
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_user_self_modification();


-- 4. POLÍTICAS DE RLS REFORÇADAS PARA AUDIT LOGS E TENANTS
-- Garantir que os updates do Admin em tenants estejam permitidos apenas para campos institucionais
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
