import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { getReceivablesAction, getFinancialPlansAction } from "@/app/actions/financeiro";
import { getCoursesAction, getClassesAction, getEnrollmentsAction } from "@/app/actions/academico";
import { FinanceiroClient } from "@/components/financeiro/FinanceiroClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Financeiro Acadêmico | TeoClass",
  description: "Gestão escolar de mensalidades, matrículas, pagamentos e inadimplência.",
};

export default async function FinanceiroPage() {
  const session = await requireTenantSession();
  assertPermission(session.role, "financeiro:view");

  const [receivablesRes, plansRes, coursesRes, classesRes, enrollmentsRes] = await Promise.all([
    getReceivablesAction(),
    session.role !== "aluno" ? getFinancialPlansAction() : Promise.resolve({ data: [] }),
    session.role !== "aluno" ? getCoursesAction() : Promise.resolve({ data: [] }),
    session.role !== "aluno" ? getClassesAction() : Promise.resolve({ data: [] }),
    session.role !== "aluno" ? getEnrollmentsAction() : Promise.resolve({ data: [] }),
  ]);

  const receivables = receivablesRes.data || [];
  const metrics = receivablesRes.metrics;
  const plans = plansRes.data || [];
  const courses = (coursesRes.data || []).map((c: any) => ({ id: c.id, name: c.name }));
  const classes = (classesRes.data || []).map((c: any) => ({ id: c.id, name: c.name }));
  const enrollments = (enrollmentsRes.data || []).map((en: any) => ({
    id: en.id,
    enrollmentNumber: en.enrollment_number,
    studentName: en.student?.full_name || "Aluno",
    courseName: en.course?.name || "Curso",
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <FinanceiroClient
        initialReceivables={receivables}
        initialPlans={plans}
        initialMetrics={metrics}
        courses={courses}
        classes={classes}
        enrollments={enrollments}
        userRole={session.role}
      />
    </div>
  );
}
