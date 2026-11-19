-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0011_1: AJUSTE DE RLS EM STUDENTS PARA DISCENTES
-- ==============================================================================
-- Objetivo de Segurança e Privacidade (LGPD):
-- 1. Garantir que discentes (role 'aluno') só possam consultar via SELECT o seu
--    próprio registro em public.students (onde user_id = auth.uid()), impedindo
--    qualquer listagem, scraping ou enumeração de outros estudantes do mesmo tenant.
-- 2. Staff e corpo docente (admin, secretaria, financeiro, professor) continuam com
--    acesso legítimo de leitura aos alunos matriculados no respectivo tenant.
-- 3. Blindar contra usuários autenticados sem papel ou com role de aluno sem user_id.
-- 4. Preservar o isolamento multi-tenant hermético via get_auth_tenant_ids() e
--    get_auth_role_in_tenant().
-- ==============================================================================

DROP POLICY IF EXISTS "students_select_policy" ON public.students;

CREATE POLICY "students_select_policy"
ON public.students FOR SELECT
USING (
    -- Operadores centrais de suporte da plataforma
    public.is_platform_operator()
    OR (
        -- Isolamento de tenant: o registro precisa pertencer a um tenant ativo do usuário
        tenant_id IN (SELECT get_auth_tenant_ids())
        AND (
            -- Perfis institucionais e docentes autorizados no tenant
            public.get_auth_role_in_tenant(tenant_id) IN ('admin', 'secretaria', 'financeiro', 'professor')
            OR (
                -- Aluno: restrito estritamente ao seu próprio registro vinculado à conta de autenticação
                public.get_auth_role_in_tenant(tenant_id) = 'aluno'
                AND user_id IS NOT NULL
                AND user_id = auth.uid()
            )
        )
    )
);
