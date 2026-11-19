import { requireTenantSession } from "@/lib/tenant/resolver";
import { assertPermission } from "@/lib/rbac/permissions";
import {
  getCoursesAction,
  getCourseModulesAction,
  getSubjectsAction,
  getTeachersAction,
  getTeachingAssignmentsAction,
  getClassesAction,
  getEnrollmentsAction,
} from "@/app/actions/academico";
import { getStudentsAction } from "@/app/actions/secretaria";
import { AcademicoClient } from "@/components/academico/AcademicoClient";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acadêmico & Corpo Docente | TeoClass",
  description: "Gestão de cursos teológicos, módulos, disciplinas, corpo docente, turmas e matrículas de alunos.",
};

export default async function AcademicoPage() {
  const session = await requireTenantSession();
  assertPermission(session.role, "academico:view");

  const supabase = await createClient();

  // Busca dados em paralelo no servidor
  const [
    coursesRes,
    modulesRes,
    subjectsRes,
    teachersRes,
    assignmentsRes,
    classesRes,
    enrollmentsRes,
    students,
    authUsersRes,
  ] = await Promise.all([
    getCoursesAction(),
    getCourseModulesAction(),
    getSubjectsAction(),
    getTeachersAction(),
    getTeachingAssignmentsAction(),
    getClassesAction(),
    getEnrollmentsAction(),
    getStudentsAction({}),
    (supabase.from("tenant_users") as any)
      .select("user_id, role, profile:profiles(id, full_name, email)")
      .eq("tenant_id", session.tenant.id)
      .in("role", ["professor", "admin"]),
  ]);

  const authUsers = (authUsersRes.data || [])
    .filter((tu: any) => tu.profile)
    .map((tu: any) => ({
      id: tu.profile.id,
      full_name: tu.profile.full_name,
      email: tu.profile.email,
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <AcademicoClient
        initialCourses={coursesRes.data || []}
        initialModules={modulesRes.data || []}
        initialSubjects={subjectsRes.data || []}
        initialTeachers={teachersRes.data || []}
        initialAssignments={assignmentsRes.data || []}
        initialClasses={classesRes.data || []}
        initialEnrollments={enrollmentsRes.data || []}
        students={students || []}
        authUsers={authUsers}
        userRole={session.role}
      />
    </div>
  );
}
