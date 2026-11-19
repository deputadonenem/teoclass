import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { getAcademicDocumentsAction } from "@/app/actions/documentos";
import { getEnrollmentsAction } from "@/app/actions/academico";
import { CertificadosClient } from "@/components/documentos/CertificadosClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Certificados & Documentos Acadêmicos | TeoClass",
  description: "Emissão, consulta e autenticação pública de certificados, históricos e declarações.",
};

export default async function CertificadosPage() {
  const session = await requireTenantSession();
  assertPermission(session.role, "certificados:view");

  const [docsRes, enrollmentsRes] = await Promise.all([
    getAcademicDocumentsAction(),
    session.role === "admin" || session.role === "secretaria"
      ? getEnrollmentsAction()
      : Promise.resolve({ data: [] }),
  ]);

  const documents = docsRes.data || [];
  const rawEnrollments = enrollmentsRes.data || [];

  const formattedEnrollments = rawEnrollments.map((en: any) => ({
    id: en.id,
    enrollmentNumber: en.enrollment_number,
    studentName: en.student?.full_name || "Aluno",
    courseName: en.course?.name || "Curso",
    status: en.status,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <CertificadosClient
        initialDocuments={documents}
        enrollments={formattedEnrollments}
        userRole={session.role}
      />
    </div>
  );
}
