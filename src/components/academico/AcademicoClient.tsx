"use client";

import React, { useState, useTransition, useMemo } from "react";
import type {
  Course,
  CourseModule,
  Subject,
  Teacher,
  TeachingAssignment,
  SchoolClass,
  Enrollment,
  CourseInput,
  CourseModuleInput,
  SubjectInput,
  TeacherInput,
  TeachingAssignmentInput,
  ClassInput,
  EnrollmentInput,
  EnrollmentStatus,
} from "@/types/academico";
import {
  MODALITY_LABELS,
  SHIFT_LABELS,
  CLASS_STATUS_LABELS,
  ENROLLMENT_STATUS_LABELS,
  FORMAT_LABELS,
  TEACHING_ROLE_LABELS,
} from "@/types/academico";
import type { Student } from "@/types/secretaria";
import {
  saveCourseAction,
  saveCourseModuleAction,
  saveSubjectAction,
  saveTeacherAction,
  saveTeachingAssignmentAction,
  saveClassAction,
  createEnrollmentAction,
  updateEnrollmentStatusAction,
} from "@/app/actions/academico";
import { CourseModal } from "./CourseModal";
import { ModuleModal } from "./ModuleModal";
import { SubjectModal } from "./SubjectModal";
import { TeacherModal } from "./TeacherModal";
import { AssignmentModal } from "./AssignmentModal";
import { ClassModal } from "./ClassModal";
import { EnrollmentModal } from "./EnrollmentModal";
import {
  BookOpen,
  Users,
  GraduationCap,
  Plus,
  Search,
  AlertCircle,
  Layers,
  Bookmark,
  Check,
  Award,
  BookOpenCheck,
} from "lucide-react";

interface AcademicoClientProps {
  initialCourses: Course[];
  initialModules: CourseModule[];
  initialSubjects: Subject[];
  initialTeachers: Teacher[];
  initialAssignments: TeachingAssignment[];
  initialClasses: SchoolClass[];
  initialEnrollments: Enrollment[];
  students: Student[];
  authUsers: Array<{ id: string; full_name: string; email: string }>;
  userRole: string;
}

export function AcademicoClient({
  initialCourses,
  initialModules,
  initialSubjects,
  initialTeachers,
  initialAssignments,
  initialClasses,
  initialEnrollments,
  students,
  authUsers,
  userRole,
}: AcademicoClientProps) {
  const [activeTab, setActiveTab] = useState<
    "courses" | "curriculum" | "teachers" | "classes" | "enrollments"
  >("courses");

  // Dados em estado local
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [modules, setModules] = useState<CourseModule[]>(initialModules);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>(initialAssignments);
  const [classes, setClasses] = useState<SchoolClass[]>(initialClasses);
  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [filterModality, setFilterModality] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Modais
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<TeachingAssignment | null>(null);

  const [classModalOpen, setClassModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);

  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManage = userRole === "admin" || userRole === "secretaria";

  // Filtros de Cursos
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchModality = filterModality === "all" || c.modality === filterModality;
      return matchSearch && matchModality;
    });
  }, [courses, searchTerm, filterModality]);

  // Filtros de Disciplinas & Estrutura Curricular
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchCourse = selectedCourseId === "all" || s.course_id === selectedCourseId;
      const matchSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.syllabus && s.syllabus.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCourse && matchSearch;
    });
  }, [subjects, selectedCourseId, searchTerm]);

  // Filtros de Módulos
  const filteredModules = useMemo(() => {
    return modules.filter((m) => selectedCourseId === "all" || m.course_id === selectedCourseId);
  }, [modules, selectedCourseId]);

  // Filtros de Professores
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      return (
        t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.theological_specialties &&
          t.theological_specialties.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.academic_title && t.academic_title.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  }, [teachers, searchTerm]);

  // Filtros de Turmas
  const filteredClasses = useMemo(() => {
    return classes.filter((cl) => {
      const matchSearch =
        cl.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cl.code && cl.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cl.period_label && cl.period_label.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = filterStatus === "all" || cl.status === filterStatus;
      const matchCourse = selectedCourseId === "all" || cl.course_id === selectedCourseId;
      return matchSearch && matchStatus && matchCourse;
    });
  }, [classes, searchTerm, filterStatus, selectedCourseId]);

  // Filtros de Matrículas
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      const studentName = e.student?.full_name || "";
      const matchSearch =
        studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.enrollment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.course?.name && e.course.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = filterStatus === "all" || e.status === filterStatus;
      const matchCourse = selectedCourseId === "all" || e.course_id === selectedCourseId;
      return matchSearch && matchStatus && matchCourse;
    });
  }, [enrollments, searchTerm, filterStatus, selectedCourseId]);

  // 1. Salvar Curso
  const handleSaveCourse = async (data: CourseInput, courseId?: string) => {
    const res = await saveCourseAction(data, courseId);
    if (res.success && res.data) {
      if (courseId) {
        setCourses((prev) => prev.map((c) => (c.id === courseId ? res.data! : c)));
        setActionMessage({ type: "success", text: "Curso teológico atualizado com sucesso." });
      } else {
        setCourses((prev) => [res.data!, ...prev]);
        setActionMessage({ type: "success", text: "Curso teológico criado com sucesso." });
      }
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 2. Salvar Módulo Curricular
  const handleSaveModule = async (data: CourseModuleInput, moduleId?: string) => {
    const res = await saveCourseModuleAction(data, moduleId);
    if (res.success && res.data) {
      if (moduleId) {
        setModules((prev) => prev.map((m) => (m.id === moduleId ? res.data! : m)));
        setActionMessage({ type: "success", text: "Módulo curricular atualizado com sucesso." });
      } else {
        setModules((prev) => [...prev, res.data!]);
        setActionMessage({ type: "success", text: "Módulo curricular criado com sucesso." });
      }
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 3. Salvar Disciplina Teológica
  const handleSaveSubject = async (data: SubjectInput, subjectId?: string) => {
    const res = await saveSubjectAction(data, subjectId);
    if (res.success && res.data) {
      if (subjectId) {
        setSubjects((prev) => prev.map((s) => (s.id === subjectId ? res.data! : s)));
        setActionMessage({ type: "success", text: "Disciplina teológica atualizada com sucesso." });
      } else {
        setSubjects((prev) => [...prev, res.data!]);
        setActionMessage({ type: "success", text: "Disciplina teológica criada com sucesso." });
      }
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 4. Salvar Professor
  const handleSaveTeacher = async (data: TeacherInput, teacherId?: string) => {
    const res = await saveTeacherAction(data, teacherId);
    if (res.success && res.data) {
      if (teacherId) {
        setTeachers((prev) => prev.map((t) => (t.id === teacherId ? res.data! : t)));
        setActionMessage({ type: "success", text: "Docente atualizado com sucesso." });
      } else {
        setTeachers((prev) => [...prev, res.data!]);
        setActionMessage({ type: "success", text: "Docente cadastrado com sucesso." });
      }
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 5. Salvar Atribuição Docente
  const handleSaveAssignment = async (data: TeachingAssignmentInput, assignmentId?: string) => {
    const res = await saveTeachingAssignmentAction(data, assignmentId);
    if (res.success && res.data) {
      if (assignmentId) {
        setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? res.data! : a)));
        setActionMessage({ type: "success", text: "Atribuição docente atualizada com sucesso." });
      } else {
        setAssignments((prev) => [res.data!, ...prev]);
        setActionMessage({ type: "success", text: "Atribuição docente vinculada com sucesso." });
      }
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 6. Salvar Turma
  const handleSaveClass = async (data: ClassInput, classId?: string) => {
    const res = await saveClassAction(data, classId);
    if (res.success && res.data) {
      if (classId) {
        setClasses((prev) => prev.map((c) => (c.id === classId ? res.data! : c)));
        setActionMessage({ type: "success", text: "Turma atualizada com sucesso." });
      } else {
        setClasses((prev) => [res.data!, ...prev]);
        setActionMessage({ type: "success", text: "Turma criada com sucesso." });
      }
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 7. Matrícula
  const handleCreateEnrollment = async (data: EnrollmentInput) => {
    const res = await createEnrollmentAction(data);
    if (res.success && res.data) {
      setEnrollments((prev) => [res.data!, ...prev]);
      if (data.class_id) {
        setClasses((prev) =>
          prev.map((c) =>
            c.id === data.class_id ? { ...c, enrolled_count: (c.enrolled_count ?? 0) + 1 } : c
          )
        );
      }
      setActionMessage({ type: "success", text: "Matrícula realizada com sucesso." });
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // 8. Atualizar Status de Matrícula
  const handleStatusChange = (enrollmentId: string, newStatus: EnrollmentStatus) => {
    startTransition(async () => {
      const res = await updateEnrollmentStatusAction(enrollmentId, newStatus);
      if (res.success) {
        setEnrollments((prev) =>
          prev.map((e) => (e.id === enrollmentId ? { ...e, status: newStatus } : e))
        );
        setActionMessage({
          type: "success",
          text: `Situação da matrícula alterada para ${ENROLLMENT_STATUS_LABELS[newStatus]}.`,
        });
      } else {
        setActionMessage({ type: "error", text: res.error || "Falha ao alterar situação." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-indigo-600" />
            Acadêmico, Currículo & Docentes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão integrada de cursos teológicos, corpo docente, disciplinas, turmas e matrículas
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === "courses" && (
              <button
                onClick={() => {
                  setSelectedCourse(null);
                  setCourseModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Curso
              </button>
            )}
            {activeTab === "curriculum" && (
              <>
                <button
                  onClick={() => {
                    setSelectedModule(null);
                    setModuleModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Novo Módulo
                </button>
                <button
                  onClick={() => {
                    setSelectedSubject(null);
                    setSubjectModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nova Disciplina
                </button>
              </>
            )}
            {activeTab === "teachers" && (
              <>
                <button
                  onClick={() => {
                    setSelectedTeacher(null);
                    setTeacherModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Novo Professor
                </button>
                <button
                  onClick={() => {
                    setSelectedAssignment(null);
                    setAssignmentModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nova Atribuição
                </button>
              </>
            )}
            {activeTab === "classes" && (
              <button
                onClick={() => {
                  setSelectedClass(null);
                  setClassModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Turma
              </button>
            )}
            {activeTab === "enrollments" && (
              <button
                onClick={() => setEnrollmentModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Efetivar Matrícula
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mensagem de Feedback */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {actionMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs underline hover:opacity-80"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("courses");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "courses"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Cursos Teológicos ({courses.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("curriculum");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "curriculum"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Disciplinas & Grade ({subjects.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("teachers");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "teachers"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Award className="w-4 h-4" />
          Corpo Docente ({teachers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("classes");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "classes"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          Turmas & Períodos ({classes.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("enrollments");
            setSearchTerm("");
          }}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "enrollments"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Matrículas ({enrollments.length})
        </button>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === "courses"
                ? "Buscar cursos por nome ou sigla..."
                : activeTab === "curriculum"
                ? "Buscar disciplinas por nome, código ou ementa..."
                : activeTab === "teachers"
                ? "Buscar professores por nome, e-mail ou especialidade..."
                : activeTab === "classes"
                ? "Buscar turmas por nome ou período..."
                : "Buscar matrículas por aluno ou número..."
            }
            className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        {activeTab !== "courses" && activeTab !== "teachers" && (
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">Todos os Cursos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {activeTab === "courses" && (
          <select
            value={filterModality}
            onChange={(e) => setFilterModality(e.target.value)}
            className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">Todas as Modalidades</option>
            <option value="presencial">Presencial</option>
            <option value="hibrido">Híbrido</option>
            <option value="ead_assincrono">EAD Assíncrono</option>
          </select>
        )}
      </div>

      {/* ABA 1: CURSOS */}
      {activeTab === "courses" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredCourses.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">Nenhum curso teológico encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Curso</th>
                    <th className="px-6 py-3">Estrutura</th>
                    <th className="px-6 py-3">Carga Horária</th>
                    <th className="px-6 py-3">Disciplinas / Módulos</th>
                    <th className="px-6 py-3">Turmas</th>
                    <th className="px-6 py-3">Situação</th>
                    {canManage && <th className="px-6 py-3 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{course.name}</div>
                        {course.code && <div className="text-xs text-slate-400">Sigla: {course.code}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {FORMAT_LABELS[course.format]}
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5">{MODALITY_LABELS[course.modality]}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium">{course.workload_hours}h</span>
                        {course.duration_months && (
                          <span className="text-xs text-slate-400 ml-1">
                            ({course.duration_months} meses)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-800">{course.subjects_count ?? 0}</span>
                        <span className="text-xs text-slate-400 ml-1">disciplinas</span>
                        {course.format === "estruturado" && (
                          <div className="text-xs text-slate-400">{course.modules_count ?? 0} módulos</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium">{course.classes_count ?? 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            course.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {course.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedCourse(course);
                              setCourseModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                          >
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: ESTRUTURA CURRICULAR & DISCIPLINAS */}
      {activeTab === "curriculum" && (
        <div className="space-y-6">
          {filteredModules.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-amber-600" />
                Módulos / Blocos Curriculares ({filteredModules.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredModules.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                          Ordem #{m.order_index}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => {
                              setSelectedModule(m);
                              setModuleModalOpen(true);
                            }}
                            className="text-xs text-amber-700 font-medium hover:underline"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                      <h4 className="font-semibold text-slate-800 mt-2">{m.name}</h4>
                      {m.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{m.description}</p>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                      <span>{m.subjects_count ?? 0} disciplinas vinculadas</span>
                      <span className={m.is_active ? "text-emerald-600" : "text-slate-400"}>
                        {m.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredSubjects.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-700">Nenhuma disciplina teológica encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-6 py-3">Ordem</th>
                      <th className="px-6 py-3">Disciplina</th>
                      <th className="px-6 py-3">Curso & Módulo</th>
                      <th className="px-6 py-3">Carga Horária</th>
                      <th className="px-6 py-3">Professor Titular</th>
                      <th className="px-6 py-3">Situação</th>
                      {canManage && <th className="px-6 py-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubjects.map((subject) => (
                      <tr key={subject.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-slate-500 text-xs">
                          #{subject.order_index}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{subject.name}</div>
                          {subject.code && <div className="text-xs text-slate-400">Sigla: {subject.code}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-700">{subject.course?.name || "—"}</div>
                          <div className="text-xs text-slate-400">
                            {subject.module?.name ? `Módulo: ${subject.module.name}` : "Sem módulo (Direta)"}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium">{subject.workload_hours}h</td>
                        <td className="px-6 py-4">
                          {subject.teacher ? (
                            <div className="text-slate-800 font-medium">{subject.teacher.full_name}</div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">A definir</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              subject.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {subject.is_active ? "Ativa" : "Inativa"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedSubject(subject);
                                setSubjectModalOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: CORPO DOCENTE & ATRIBUIÇÕES */}
      {activeTab === "teachers" && (
        <div className="space-y-6">
          {/* Tabela de Professores */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-teal-600" />
                Professores Cadastrados ({filteredTeachers.length})
              </h3>
            </div>
            {filteredTeachers.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-700">Nenhum professor cadastrado</p>
                <p className="text-xs text-slate-400 mt-1">
                  Cadastre docentes e atribua turmas ou disciplinas pelo botão superior.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-6 py-3">Docente</th>
                      <th className="px-6 py-3">Titulação</th>
                      <th className="px-6 py-3">Especialidades Teológicas</th>
                      <th className="px-6 py-3">Contato</th>
                      <th className="px-6 py-3">Atribuições</th>
                      <th className="px-6 py-3">Situação</th>
                      {canManage && <th className="px-6 py-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{teacher.full_name}</div>
                          {teacher.user_id && (
                            <span className="text-2xs text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-mono">
                              Usuário Vinculado
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {teacher.academic_title || "Docente"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {teacher.theological_specialties || "Geral"}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div>{teacher.email || "—"}</div>
                          <div className="text-slate-400">{teacher.phone || ""}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800">
                            {teacher.assignments_count ?? 0}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">atribuições</span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              teacher.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {teacher.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedTeacher(teacher);
                                setTeacherModalOpen(true);
                              }}
                              className="text-teal-600 hover:text-teal-800 text-xs font-semibold px-2 py-1 rounded-md hover:bg-teal-50 transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabela de Atribuições Docentes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5 text-violet-600" />
                Atribuições Vigentes ({assignments.length})
              </h3>
            </div>
            {assignments.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <BookOpenCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Nenhuma atribuição docente registrada</p>
                <p className="text-xs text-slate-400 mt-1">
                  Vincule professores a turmas ou disciplinas no botão &quot;Nova Atribuição&quot;.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-6 py-3">Professor</th>
                      <th className="px-6 py-3">Papel / Função</th>
                      <th className="px-6 py-3">Turma</th>
                      <th className="px-6 py-3">Disciplina</th>
                      <th className="px-6 py-3">Vigência</th>
                      <th className="px-6 py-3">Situação</th>
                      {canManage && <th className="px-6 py-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.map((asg) => (
                      <tr key={asg.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {asg.teacher?.full_name || "Docente"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-50 text-violet-700">
                            {TEACHING_ROLE_LABELS[asg.role_description]}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {asg.class ? (
                            <div className="text-slate-800 font-medium">
                              {asg.class.name} ({asg.class.shift})
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sem turma específica</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {asg.subject ? (
                            <div className="text-slate-800 font-medium">
                              {asg.subject.name} {asg.subject.code ? `(${asg.subject.code})` : ""}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Regência da turma</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {asg.start_date ? new Date(asg.start_date).toLocaleDateString("pt-BR") : "Início livre"}{" "}
                          - {asg.end_date ? new Date(asg.end_date).toLocaleDateString("pt-BR") : "Indeterminado"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              asg.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {asg.is_active ? "Ativa" : "Encerrada"}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedAssignment(asg);
                                setAssignmentModalOpen(true);
                              }}
                              className="text-violet-600 hover:text-violet-800 text-xs font-semibold px-2 py-1 rounded-md hover:bg-violet-50 transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 4: TURMAS */}
      {activeTab === "classes" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredClasses.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">Nenhuma turma cadastrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Turma</th>
                    <th className="px-6 py-3">Curso</th>
                    <th className="px-6 py-3">Período / Turno</th>
                    <th className="px-6 py-3">Ocupação / Vagas</th>
                    <th className="px-6 py-3">Situação</th>
                    {canManage && <th className="px-6 py-3 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClasses.map((cl) => {
                    const enrolled = cl.enrolled_count ?? 0;
                    const percent = cl.capacity > 0 ? Math.round((enrolled / cl.capacity) * 100) : 0;
                    return (
                      <tr key={cl.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{cl.name}</div>
                          {cl.code && <div className="text-xs text-slate-400">Sigla: {cl.code}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-700">{cl.course?.name || "—"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium">{cl.period_label || "Sem período fixo"}</div>
                          <div className="text-xs text-slate-400">{SHIFT_LABELS[cl.shift]}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{enrolled}</span>
                            <span className="text-xs text-slate-400">/ {cl.capacity} alunos</span>
                          </div>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-purple-600"
                              }`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                            {CLASS_STATUS_LABELS[cl.status]}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedClass(cl);
                                setClassModalOpen(true);
                              }}
                              className="text-purple-600 hover:text-purple-800 text-xs font-semibold px-2 py-1 rounded-md hover:bg-purple-50 transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 5: MATRÍCULAS */}
      {activeTab === "enrollments" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredEnrollments.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">Nenhuma matrícula registrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Matrícula</th>
                    <th className="px-6 py-3">Aluno</th>
                    <th className="px-6 py-3">Curso / Turma</th>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Situação</th>
                    {canManage && <th className="px-6 py-3 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEnrollments.map((enr) => (
                    <tr key={enr.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {enr.enrollment_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {enr.student?.full_name || "Aluno Desconhecido"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{enr.course?.name || "—"}</div>
                        <div className="text-xs text-slate-400">
                          {enr.class?.name ? `Turma: ${enr.class.name}` : "Sem turma (Avulso / EAD)"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(enr.enrolled_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            enr.status === "ativa"
                              ? "bg-emerald-50 text-emerald-700"
                              : enr.status === "trancada"
                              ? "bg-amber-50 text-amber-700"
                              : enr.status === "cancelada"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ENROLLMENT_STATUS_LABELS[enr.status]}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-right">
                          <select
                            value={enr.status}
                            disabled={isPending}
                            onChange={(e) =>
                              handleStatusChange(enr.id, e.target.value as EnrollmentStatus)
                            }
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
                          >
                            {Object.entries(ENROLLMENT_STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modais Integrados */}
      <CourseModal
        isOpen={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        onSave={handleSaveCourse}
        course={selectedCourse}
      />

      <ModuleModal
        isOpen={moduleModalOpen}
        onClose={() => setModuleModalOpen(false)}
        onSave={handleSaveModule}
        courses={courses.filter((c) => c.is_active)}
        module={selectedModule}
        defaultCourseId={selectedCourseId !== "all" ? selectedCourseId : undefined}
      />

      <SubjectModal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        onSave={handleSaveSubject}
        courses={courses.filter((c) => c.is_active)}
        modules={modules.filter((m) => m.is_active)}
        teachers={teachers}
        subject={selectedSubject}
        defaultCourseId={selectedCourseId !== "all" ? selectedCourseId : undefined}
      />

      <TeacherModal
        isOpen={teacherModalOpen}
        onClose={() => setTeacherModalOpen(false)}
        onSave={handleSaveTeacher}
        authUsers={authUsers}
        teacher={selectedTeacher}
      />

      <AssignmentModal
        isOpen={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        onSave={handleSaveAssignment}
        teachers={teachers.filter((t) => t.is_active)}
        classes={classes.filter((c) => c.is_active)}
        subjects={subjects.filter((s) => s.is_active)}
        assignment={selectedAssignment}
      />

      <ClassModal
        isOpen={classModalOpen}
        onClose={() => setClassModalOpen(false)}
        onSave={handleSaveClass}
        courses={courses.filter((c) => c.is_active)}
        schoolClass={selectedClass}
      />

      <EnrollmentModal
        isOpen={enrollmentModalOpen}
        onClose={() => setEnrollmentModalOpen(false)}
        onSave={handleCreateEnrollment}
        students={students.filter((s) => s.is_active)}
        courses={courses.filter((c) => c.is_active)}
        classes={classes.filter((c) => c.is_active)}
      />
    </div>
  );
}
