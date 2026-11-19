-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0002.1: VÍNCULO EXPLÍCITO ENTRE STUDENTS E AUTH.USERS
-- ==============================================================================
-- Objetivo de Segurança e Identidade Institucional:
-- 1. Estabelecer vínculo explícito, seguro e auditável entre o registro de aluno
--    (public.students) e a conta de autenticação (auth.users).
-- 2. Eliminar identificações frágeis baseadas em correspondência de strings (e-mail ou CPF).
-- 3. Proteger contra sequestro de conta: um aluno comum jamais pode alterar seu próprio
--    user_id ou associar-se a registros de outro aluno/tenant.
-- 4. Garantir suporte a múltiplos tenants: índice único parcial (tenant_id, user_id)
--    assegurando que um usuário de auth tenha no máximo um registro de aluno ativo por escola.
-- ==============================================================================

-- 1. Adicionar coluna user_id na tabela students referenciando auth.users
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Índice único parcial por tenant: um usuário auth só pode ser associado a 1 aluno no mesmo tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_tenant_user_id
    ON public.students (tenant_id, user_id)
    WHERE user_id IS NOT NULL;

-- 3. Índice para consultas de performance por user_id
CREATE INDEX IF NOT EXISTS idx_students_user_id
    ON public.students (user_id);

-- 4. Trigger de proteção contra alteração indevida de user_id:
-- Somente usuários autorizados com perfil 'admin' ou 'secretaria' no tenant
-- (ou serviço via backend com bypass RLS / service_role) podem alterar user_id.
CREATE OR REPLACE FUNCTION public.check_student_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Se o user_id foi modificado ou atribuído
    IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        -- Se for chamada vinda de cliente autenticado comum (não service_role/postgres)
        IF (auth.uid() IS NOT NULL) THEN
            IF NOT (
                public.is_platform_operator()
                OR (
                    NEW.tenant_id IN (SELECT get_auth_tenant_ids())
                    AND public.get_auth_role_in_tenant(NEW.tenant_id) IN ('admin', 'secretaria')
                )
            ) THEN
                RAISE EXCEPTION 'Operação proibida: apenas administradores ou secretaria podem vincular ou alterar a conta de usuário do aluno.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_protect_user_id ON public.students;
CREATE TRIGGER trg_students_protect_user_id
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.check_student_user_id_change();
