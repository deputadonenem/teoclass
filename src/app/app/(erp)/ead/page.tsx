import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import { getCoursesAction, getSubjectsAction } from "@/app/actions/academico";
import { getLearningUnitsAction } from "@/app/actions/ead";
import { EadClient } from "@/components/ead/EadClient";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EAD Teológico & Aulas | TeoClass",
  description: "Ambiente virtual de aprendizagem, videoaulas, textos expositivos e materiais didáticos.",
};

export default async function EadPage() {
  const session = await requireTenantSession();
  assertPermission(session.role, "ead:access_lessons");

  const supabase = await createClient();

  // Busca disciplinas e cursos do tenant
  const [coursesRes, subjectsRes] = await Promise.all([
    getCoursesAction(),
    getSubjectsAction(),
  ]);

  const courses = coursesRes.data || [];
  const subjects = subjectsRes.data || [];
  const defaultSubjectId = subjects.length > 0 ? subjects[0].id : "";

  // Busca unidades da primeira matéria por padrão
  let initialUnits: any[] = [];
  if (defaultSubjectId) {
    const unitsRes = await getLearningUnitsAction(defaultSubjectId);
    initialUnits = unitsRes.data || [];
  }

  // Verifica se o usuário for professor se ele possui atribuição docente nesta matéria
  let isTeacherAssigned = false;
  if (session.role === "professor" && defaultSubjectId) {
    const { data: hasAssignment } = await (supabase.rpc as any)(
      "has_teacher_subject_assignment",
      {
        p_tenant_id: session.tenant.id,
        p_subject_id: defaultSubjectId,
      }
    );
    isTeacherAssigned = Boolean(hasAssignment);
  } else if (session.role === "admin" || session.role === "secretaria") {
    isTeacherAssigned = true;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <EadClient
        courses={courses}
        subjects={subjects}
        initialUnits={initialUnits}
        userRole={session.role}
        isTeacherAssigned={isTeacherAssigned}
      />
    </div>
  );
}
