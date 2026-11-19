// ==============================================================================
// TeoClass — Tipos de Certificados e Documentos Acadêmicos (Lote 9)
// ==============================================================================

export type AcademicDocumentType =
  | "certificado_conclusao"
  | "declaracao_matricula"
  | "historico_escolar";

export type DocumentStatus = "emitido" | "revogado" | "substituido";

export const DOCUMENT_TYPE_LABELS: Record<AcademicDocumentType, string> = {
  certificado_conclusao: "Certificado de Conclusão",
  declaracao_matricula: "Declaração de Matrícula",
  historico_escolar: "Histórico Escolar",
};

/**
 * Snapshot dos dados congelados no documento
 */
export interface DocumentMetadataSnapshot {
  institution: {
    name: string;
    tradeName?: string | null;
    cnpj?: string | null;
    city?: string | null;
    state?: string | null;
  };
  student: {
    fullName: string;
    cpf?: string | null;
    cpfMasked: string;
    email?: string | null;
  };
  course: {
    name: string;
    code?: string | null;
    workloadHours: number;
    modality: string;
  };
  enrollment: {
    enrollmentNumber: string;
    status: string;
    enrolledAt: string;
    completedAt?: string | null;
  };
  academicSummary: {
    overallAverage: number | null;
    situation: string;
    totalSubjects: number;
    approvedSubjectsCount: number;
    subjects: Array<{
      name: string;
      code: string | null;
      workloadHours: number;
      averageScore: number | null;
      situation: string;
    }>;
  };
}

/**
 * Entidade de Documento Acadêmico
 */
export interface AcademicDocument {
  id: string;
  tenant_id: string;
  student_id: string;
  enrollment_id: string;
  course_id: string;
  document_type: AcademicDocumentType;
  title: string;
  document_number: string;
  verification_token: string;
  status: DocumentStatus;
  issued_at: string;
  issued_by: string | null;
  metadata_snapshot: DocumentMetadataSnapshot;
  revocation_reason: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
  updated_at: string;
  // Relações carregadas
  student?: {
    id: string;
    full_name: string;
    cpf: string | null;
    email: string | null;
  };
  course?: {
    id: string;
    name: string;
    code: string | null;
    workload_hours: number;
  };
}

/**
 * DTO para Emissão de Documento
 */
export interface IssueDocumentInput {
  enrollment_id: string;
  document_type: AcademicDocumentType;
  custom_title?: string;
}

/**
 * DTO para Revogação de Documento
 */
export interface RevokeDocumentInput {
  document_id: string;
  reason: string;
}

/**
 * Resultado da Validação Pública (LGPD-Compliant)
 */
export interface PublicDocumentVerificationResult {
  valid: boolean;
  message?: string;
  status?: DocumentStatus;
  document_type?: AcademicDocumentType;
  title?: string;
  document_number?: string;
  issued_at?: string;
  is_revoked?: boolean;
  revocation_reason?: string | null;
  revoked_at?: string | null;
  institution?: {
    name: string;
  };
  student?: {
    name: string;
    cpf_masked: string;
  };
  course?: {
    name: string;
    workload_hours: number;
  };
  summary?: any;
}
