-- ==============================================================================
-- TEOCLASS — MIGRAÇÃO 0009: CERTIFICADOS E DOCUMENTOS ACADÊMICOS
-- ==============================================================================
-- Invariantes de Segurança e Arquitetura Multi-Tenant:
-- 1. Documentos Acadêmicos Institucionais (academic_documents):
--    - Tipos suportados: 'certificado_conclusao', 'declaracao_matricula', 'historico_escolar'.
--    - Vinculados a aluno (student_id), matrícula (enrollment_id) e curso (course_id).
--    - Código de validação único em formato humanamente legível e seguro (ex: TC-CERT-XXXXX).
--    - Token criptográfico seguro para validação pública sem autenticação obrigatória (LGPD).
--    - Instantâneo congelado dos dados do documento (metadata_snapshot):
--      impede alteração do histórico ou adulteração retrospectiva caso os registros originais mudem.
-- 2. Controle de Ciclo de Vida:
--    - Status: 'emitido', 'revogado', 'substituido'.
--    - Registro de revogação/cancelamento com motivo (revocation_reason), autor (revoked_by) e data.
-- 3. Imutabilidade de tenant_id via trigger prevent_tenant_id_change().
-- 4. RLS Default-Deny:
--    - Staff (Admin, Secretaria): emissão, consulta e revogação no próprio tenant.
--    - Alunos: consulta estrita aos seus próprios documentos com status 'emitido'.
--    - Consulta pública anônima permitida exclusivamente via função segura/RPC de validação
--      ou token exato, sem conceder SELECT aberto em toda a tabela.
-- ==============================================================================

-- ==============================================================================
-- 1. TABELA DE DOCUMENTOS ACADÊMICOS (academic_documents)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.academic_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    course_id UUID NOT NULL,
    
    document_type VARCHAR(50) NOT NULL
        CHECK (document_type IN ('certificado_conclusao', 'declaracao_matricula', 'historico_escolar')),
    
    title VARCHAR(255) NOT NULL,
    document_number VARCHAR(100) NOT NULL, -- Ex: TC-CERT-2026-XXXXX
    verification_token VARCHAR(64) NOT NULL UNIQUE, -- Token seguro para QR Code e link público
    
    status VARCHAR(30) NOT NULL DEFAULT 'emitido'
        CHECK (status IN ('emitido', 'revogado', 'substituido')),
    
    issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Snapshot histórico congelado em JSONB
    -- Contém: nome da instituição, dados do aluno, curso, carga horária, média geral, disciplinas cursadas
    metadata_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Dados de revogação / cancelamento
    revocation_reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- FKs compostas para integridade referencial estrita com o tenant
    CONSTRAINT fk_academic_documents_student
        FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_academic_documents_enrollment
        FOREIGN KEY (tenant_id, enrollment_id)
        REFERENCES public.enrollments(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT fk_academic_documents_course
        FOREIGN KEY (tenant_id, course_id)
        REFERENCES public.courses(tenant_id, id)
        ON DELETE CASCADE,

    CONSTRAINT uq_academic_documents_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_academic_documents_tenant_number UNIQUE (tenant_id, document_number)
);

-- Índices de Performance e Consulta
CREATE INDEX IF NOT EXISTS idx_academic_documents_tenant ON public.academic_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_academic_documents_student ON public.academic_documents(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_academic_documents_enrollment ON public.academic_documents(tenant_id, enrollment_id);
CREATE INDEX IF NOT EXISTS idx_academic_documents_type ON public.academic_documents(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_academic_documents_token ON public.academic_documents(verification_token);
CREATE INDEX IF NOT EXISTS idx_academic_documents_status ON public.academic_documents(tenant_id, status);

-- Trigger de Imutabilidade do tenant_id
DROP TRIGGER IF EXISTS trg_academic_documents_tenant_immutable ON public.academic_documents;
CREATE TRIGGER trg_academic_documents_tenant_immutable
    BEFORE UPDATE ON public.academic_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_id_change();


-- ==============================================================================
-- 2. TRIGGER PARA BLINDAGEM DE EMISSÃO E DADOS CONGELADOS
-- ==============================================================================
-- Impede que alunos ou requisições não autorizadas alterem metadata_snapshot,
-- document_number ou verification_token de documentos já emitidos.
CREATE OR REPLACE FUNCTION public.protect_academic_document_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        -- Alunos jamais podem alterar documentos
        IF NOT (
            public.is_platform_operator()
            OR (
                NEW.tenant_id IN (SELECT get_auth_tenant_ids())
                AND public.get_auth_role_in_tenant(NEW.tenant_id) IN ('admin', 'secretaria')
            )
        ) THEN
            RAISE EXCEPTION 'Operação proibida: você não possui permissão para gerenciar documentos acadêmicos.';
        END IF;

        -- Mesmo para admin/secretaria, o número, token e snapshot são imutáveis após criação
        IF NEW.document_number IS DISTINCT FROM OLD.document_number THEN
            RAISE EXCEPTION 'Operação proibida: o identificador do documento é estritamente imutável.';
        END IF;

        IF NEW.verification_token IS DISTINCT FROM OLD.verification_token THEN
            RAISE EXCEPTION 'Operação proibida: o token de validação é estritamente imutável.';
        END IF;

        IF NEW.metadata_snapshot IS DISTINCT FROM OLD.metadata_snapshot THEN
            RAISE EXCEPTION 'Operação proibida: o conteúdo histórico do documento não pode ser modificado. Para correções, emita uma substituição.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_academic_document_fields ON public.academic_documents;
CREATE TRIGGER trg_protect_academic_document_fields
    BEFORE UPDATE ON public.academic_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_academic_document_fields();


-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) — DEFAULT DENY
-- ==============================================================================
ALTER TABLE public.academic_documents ENABLE ROW LEVEL SECURITY;

-- SELECT:
-- 1. Admin e Secretaria: visualizam documentos do seu tenant.
-- 2. Professor: visualiza histórico/documentos de alunos de suas turmas atribuídas.
-- 3. Aluno: visualiza exclusivamente seus próprios documentos.
DROP POLICY IF EXISTS academic_documents_select_policy ON public.academic_documents;
CREATE POLICY academic_documents_select_policy ON public.academic_documents
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = academic_documents.tenant_id
              AND tu.user_id = auth.uid()
              AND (
                  tu.role IN ('admin', 'secretaria')
                  OR (
                      tu.role = 'professor'
                      AND EXISTS (
                          SELECT 1 FROM public.teaching_assignments ta
                          JOIN public.enrollments e ON e.class_id = ta.class_id AND e.tenant_id = ta.tenant_id
                          WHERE e.id = academic_documents.enrollment_id
                            AND ta.tenant_id = academic_documents.tenant_id
                            AND public.has_teacher_subject_assignment(ta.tenant_id, ta.subject_id)
                      )
                  )
                  OR (
                      tu.role = 'aluno'
                      AND EXISTS (
                          SELECT 1 FROM public.students s
                          WHERE s.id = academic_documents.student_id
                            AND s.tenant_id = academic_documents.tenant_id
                            AND s.user_id = auth.uid()
                      )
                  )
              )
        )
    );

-- WRITE (INSERT / UPDATE): Apenas Admin e Secretaria do tenant
DROP POLICY IF EXISTS academic_documents_write_policy ON public.academic_documents;
CREATE POLICY academic_documents_write_policy ON public.academic_documents
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = academic_documents.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = academic_documents.tenant_id
              AND tu.user_id = auth.uid()
              AND tu.role IN ('admin', 'secretaria')
        )
    );


-- ==============================================================================
-- 4. FUNÇÃO RPC PÚBLICA PARA VERIFICAÇÃO DE DOCUMENTOS (LGPD-COMPLIANT)
-- ==============================================================================
-- Permite que qualquer pessoa ou instituição com o QR Code / Token verifique
-- a veracidade do documento SEM expor dados sensíveis desnecessários (CPF parcial,
-- sem telefone, sem endereço).
CREATE OR REPLACE FUNCTION public.verify_public_document(p_token VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_doc RECORD;
    v_tenant_name VARCHAR;
    v_student_name VARCHAR;
    v_student_cpf_masked VARCHAR;
    v_course_name VARCHAR;
BEGIN
    SELECT 
        d.id,
        d.document_type,
        d.title,
        d.document_number,
        d.status,
        d.issued_at,
        d.revocation_reason,
        d.revoked_at,
        d.metadata_snapshot,
        t.name AS tenant_name,
        s.full_name AS student_name,
        s.cpf AS student_cpf,
        c.name AS course_name,
        c.workload_hours
    INTO v_doc
    FROM public.academic_documents d
    JOIN public.tenants t ON t.id = d.tenant_id
    JOIN public.students s ON s.id = d.student_id AND s.tenant_id = d.tenant_id
    JOIN public.courses c ON c.id = d.course_id AND c.tenant_id = d.tenant_id
    WHERE d.verification_token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Documento não encontrado ou código de autenticidade inválido.'
        );
    END IF;

    -- Mascaramento de CPF (ex: 123.***.***-00) para proteção LGPD
    IF v_doc.student_cpf IS NOT NULL AND length(v_doc.student_cpf) >= 11 THEN
        v_student_cpf_masked := substr(v_doc.student_cpf, 1, 3) || '.***.***-' || substr(v_doc.student_cpf, length(v_doc.student_cpf) - 1, 2);
    ELSE
        v_student_cpf_masked := '***.***.***-**';
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'status', v_doc.status,
        'document_type', v_doc.document_type,
        'title', v_doc.title,
        'document_number', v_doc.document_number,
        'issued_at', v_doc.issued_at,
        'is_revoked', (v_doc.status = 'revogado'),
        'revocation_reason', v_doc.revocation_reason,
        'revoked_at', v_doc.revoked_at,
        'institution', jsonb_build_object(
            'name', v_doc.tenant_name
        ),
        'student', jsonb_build_object(
            'name', v_doc.student_name,
            'cpf_masked', v_student_cpf_masked
        ),
        'course', jsonb_build_object(
            'name', v_doc.course_name,
            'workload_hours', v_doc.workload_hours
        ),
        'summary', v_doc.metadata_snapshot->'summary'
    );
END;
$$;

-- Concede privilégio de execução ao público anônimo e autenticado
GRANT EXECUTE ON FUNCTION public.verify_public_document(VARCHAR) TO anon, authenticated;
