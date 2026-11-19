import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { getSubjectsAction, getClassesAction } from "@/app/actions/academico";
import { getAssessmentQuestionsAction, getAssessmentsAction } from "@/app/actions/provas";
import { ProvasClient } from "@/components/provas/ProvasClient";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Avaliações & Banco de Questões | TeoClass",
  description: "Provas teológicas, critérios de aprovação, tentativas e banco de questões por disciplina.",
};

export default async function ProvasPage() {
  const session = await requireTenantSession();

  const supabase = await createClient();

  // Busca disciplinas e turmas
  const [subjectsRes, classesRes, assessmentsRes] = await Promise.all([
    getSubjectsAction(),
    getClassesAction(),
    getAssessmentsAction(),
  ]);

  const subjects = subjectsRes.data || [];
  const classes = classesRes.data || [];
  const assessments = assessmentsRes.data || [];
  const defaultSubjectId = subjects.length > 0 ? subjects[0].id : "";

  // Busca questões da primeira matéria se for staff ou professor
  let initialQuestions: any[] = [];
  let isTeacherAssigned = false;

  if (session.role === "admin" || session.role === "secretaria") {
    isTeacherAssigned = true;
    if (defaultSubjectId) {
      const qRes = await getAssessmentQuestionsAction(defaultSubjectId);
      initialQuestions = qRes.data || [];
    }
  } else if (session.role === "professor") {
    if (defaultSubjectId) {
      const { data: hasAssignment } = await (supabase.rpc as any)(
        "has_teacher_subject_assignment",
        {
          p_tenant_id: session.tenant.id,
          p_subject_id: defaultSubjectId,
        }
      );
      isTeacherAssigned = Boolean(hasAssignment);

      if (isTeacherAssigned) {
        const qRes = await getAssessmentQuestionsAction(defaultSubjectId);
        initialQuestions = qRes.data || [];
      }
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <ProvasClient
        subjects={subjects}
        classes={classes}
        initialQuestions={initialQuestions}
        initialAssessments={assessments}
        userRole={session.role}
        isTeacherAssigned={isTeacherAssigned}
      />
    </div>
  );
}
