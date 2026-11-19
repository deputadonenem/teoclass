-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0007_1: BLINDAGEM DE NOTA E TENTATIVAS (ANTI-ADULTERAÇÃO)
-- ==============================================================================
-- Problema identificado na homologação do Lote 7:
-- A política assessment_attempts_update_policy permitia ao aluno realizar UPDATE em sua tentativa
-- enquanto status = 'em_andamento'. O PostgreSQL RLS opera em nível de linha (row-level),
-- permitindo que um UPDATE direto modificasse colunas críticas como total_score, passed e expires_at.
--
-- Solução:
-- 1. Trigger nativo BEFORE UPDATE em assessment_attempts que bloqueia terminantemente
--    qualquer alteração em total_score, passed, expires_at, started_at, snapshot_questions
--    e attempt_number quando a operação for executada por perfis não administrativos ou discentes.
-- 2. Restringe a alteração dessas colunas sensíveis exclusivamente ao contexto de serviço interno
--    (Server Action de correção) ou administradores.
-- 3. Atualização rigorosa da política RLS assessment_attempts_update_policy.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_assessment_attempt_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Se o usuário conectado for aluno (ou usuário autenticado comum):
    IF auth.uid() IS NOT NULL THEN
        IF NOT (
            public.is_platform_operator()
            OR (
                NEW.tenant_id IN (SELECT get_auth_tenant_ids())
                AND public.get_auth_role_in_tenant(NEW.tenant_id) IN ('admin', 'secretaria')
            )
        ) THEN
            -- Impede adulteração de nota
            IF NEW.total_score IS DISTINCT FROM OLD.total_score THEN
                RAISE EXCEPTION 'Operação proibida: a nota da avaliação só pode ser calculada pelo servidor.';
            END IF;

            -- Impede adulteração do resultado de aprovação
            IF NEW.passed IS DISTINCT FROM OLD.passed THEN
                RAISE EXCEPTION 'Operação proibida: o status de aprovação só pode ser emitido pelo servidor.';
            END IF;

            -- Impede prorrogação fraudulenta do prazo de término
            IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
                RAISE EXCEPTION 'Operação proibida: o tempo de prova não pode ser alterado.';
            END IF;

            -- Impede adulteração do número da tentativa
            IF NEW.attempt_number IS DISTINCT FROM OLD.attempt_number THEN
                RAISE EXCEPTION 'Operação proibida: o número da tentativa é imutável.';
            END IF;

            -- Impede alteração das questões sorteadas
            IF NEW.snapshot_questions IS DISTINCT FROM OLD.snapshot_questions THEN
                RAISE EXCEPTION 'Operação proibida: as questões sorteadas da tentativa são imutáveis.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_assessment_attempt_fields ON public.assessment_attempts;
CREATE TRIGGER trg_protect_assessment_attempt_fields
    BEFORE UPDATE ON public.assessment_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_assessment_attempt_fields();
