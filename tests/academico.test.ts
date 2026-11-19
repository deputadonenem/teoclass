import test from "node:test";
import assert from "node:assert/strict";
import {
  hasActionAccess,
  assertPermission,
  hasModuleAccess,
} from "../src/lib/rbac/permissions.ts";
import {
  MODALITY_LABELS,
  FORMAT_LABELS,
  SHIFT_LABELS,
  CLASS_STATUS_LABELS,
  ENROLLMENT_STATUS_LABELS,
  TEACHING_ROLE_LABELS,
  type CourseInput,
  type CourseModuleInput,
  type SubjectInput,
  type TeacherInput,
  type TeachingAssignmentInput,
  type ClassInput,
  type EnrollmentInput,
} from "../src/types/academico.ts";

test("TeoClass — Módulo Acadêmico, Currículo & Matrículas (Testes Locais de Regras e RBAC)", async (t) => {
  await t.test("RBAC: Permissões de Cursos, Turmas, Currículo e Docentes por Papel", () => {
    // Admin e Secretaria podem gerenciar cursos, turmas, matriz curricular e professores
    assert.equal(hasActionAccess("admin", "academico:manage_courses"), true);
    assert.equal(hasActionAccess("admin", "academico:manage_classes"), true);
    assert.equal(hasActionAccess("admin", "academico:manage_curriculum"), true);
    assert.equal(hasActionAccess("admin", "academico:manage_teachers"), true);
    assert.equal(hasActionAccess("secretaria", "academico:manage_courses"), true);
    assert.equal(hasActionAccess("secretaria", "academico:manage_classes"), true);
    assert.equal(hasActionAccess("secretaria", "academico:manage_curriculum"), true);
    assert.equal(hasActionAccess("secretaria", "academico:manage_teachers"), true);
    assert.equal(hasActionAccess("secretaria", "secretaria:manage_enrollments"), true);

    // Aluno e Financeiro NÃO podem gerenciar professores nem currículo
    assert.equal(hasActionAccess("aluno", "academico:manage_teachers"), false);
    assert.equal(hasActionAccess("aluno", "academico:manage_curriculum"), false);
    assert.equal(hasActionAccess("aluno", "academico:manage_courses"), false);
    assert.equal(hasActionAccess("aluno", "academico:manage_classes"), false);
    assert.equal(hasActionAccess("financeiro", "academico:manage_teachers"), false);
    assert.equal(hasActionAccess("financeiro", "academico:manage_curriculum"), false);
    assert.equal(hasActionAccess("professor", "academico:manage_teachers"), false);
    assert.equal(hasActionAccess("professor", "academico:manage_curriculum"), false);

    // Acesso ao módulo acadêmico
    assert.equal(hasModuleAccess("admin", "academico"), true);
    assert.equal(hasModuleAccess("secretaria", "academico"), true);
    assert.equal(hasModuleAccess("professor", "academico"), true);
    assert.equal(hasModuleAccess("financeiro", "academico"), false);
    assert.equal(hasModuleAccess("aluno", "academico"), false);
  });

  await t.test("Contratos e Dicionários de Domínio Teológico", () => {
    assert.equal(MODALITY_LABELS.presencial, "Presencial");
    assert.equal(MODALITY_LABELS.ead_assincrono, "EAD Assíncrono");
    assert.equal(FORMAT_LABELS.simples, "Simples (Direto por Aulas)");
    assert.equal(FORMAT_LABELS.estruturado, "Estruturado (Módulos & Disciplinas)");
    assert.equal(SHIFT_LABELS.sabado, "Sábados / Intensivo");
    assert.equal(CLASS_STATUS_LABELS.prevista, "Prevista");
    assert.equal(ENROLLMENT_STATUS_LABELS.ativa, "Ativa");
    assert.equal(ENROLLMENT_STATUS_LABELS.trancada, "Trancada");
    assert.equal(TEACHING_ROLE_LABELS.titular, "Professor Titular");
    assert.equal(TEACHING_ROLE_LABELS.adjunto, "Professor Adjunto / Co-docente");
    assert.equal(TEACHING_ROLE_LABELS.tutor, "Tutor Acadêmico");
    assert.equal(TEACHING_ROLE_LABELS.convidado, "Professor Convidado / Preletor");
  });

  await t.test("Validação Local de DTOs Curriculares e Docentes (Cursos, Módulos, Disciplinas, Professores)", () => {
    // 1. Curso
    const courseDto: CourseInput = {
      name: "Bacharel Livre em Teologia",
      code: "TEO-101",
      description: "Formação ministerial pastoral",
      modality: "presencial",
      format: "estruturado",
      workload_hours: 1200,
      duration_months: 36,
      is_active: true,
    };
    assert.ok(courseDto.name.length >= 3);
    assert.ok(courseDto.workload_hours > 0);

    // 2. Módulo / Bloco
    const moduleDto: CourseModuleInput = {
      course_id: "fake-uuid-course",
      name: "Módulo I: Fundamentos Bíblicos",
      description: "Introdução à hermenêutica e teologia bíblica",
      order_index: 1,
      is_active: true,
    };
    assert.ok(moduleDto.name.length >= 2);
    assert.ok(moduleDto.course_id.length > 0);
    assert.ok(moduleDto.order_index >= 1);

    // 3. Disciplina
    const subjectDto: SubjectInput = {
      course_id: "fake-uuid-course",
      module_id: "fake-uuid-module",
      name: "Teologia Sistemática I: Deus e a Revelação",
      code: "TEO-SYS-101",
      syllabus: "Bibliologia, atributos divinos e a Trindade",
      workload_hours: 60,
      order_index: 1,
      is_active: true,
    };
    assert.ok(subjectDto.name.length >= 2);
    assert.ok(subjectDto.workload_hours > 0);
    assert.ok(subjectDto.course_id.length > 0);

    // 4. Professor
    const teacherDto: TeacherInput = {
      full_name: "Rev. Dr. C. H. Spurgeon",
      email: "spurgeon@metropolitantabernacle.org",
      phone: "+5511988887777",
      academic_degree: "Doutorado em Teologia Histórica",
      specialties: ["Homilética", "Teologia Reformada", "Eclesiologia"],
      bio: "Pastor e pregador batista reformado com vasta produção teológica.",
      status: "ativo",
    };
    assert.ok(teacherDto.full_name.length >= 2);
    assert.ok(teacherDto.specialties.length > 0);
    assert.equal(teacherDto.status, "ativo");

    // 5. Atribuição Docente
    const assignmentDto: TeachingAssignmentInput = {
      teacher_id: "fake-uuid-teacher",
      class_id: "fake-uuid-class",
      subject_id: "fake-uuid-subject",
      role: "titular",
      academic_year: 2026,
      academic_term: "1º Semestre",
      status: "ativo",
    };
    assert.ok(assignmentDto.teacher_id.length > 0);
    assert.equal(assignmentDto.role, "titular");
    assert.equal(assignmentDto.academic_year, 2026);
  });
});

test("TeoClass — Suíte de Testes Remotos de Docentes e Atribuições (Pendente da Migration 0005)", async (t) => {
  await t.test(
    "TESTE PENDENTE: Cadastro de docente no Tenant A e verificação de não-visibilidade no Tenant B (Isolamento)",
    { todo: "Aguardando aplicação da migration 0005_teachers_and_assignments.sql no Supabase TeoClass." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Bloqueio de inserção/edição de docente por perfil Aluno/Professor via RLS teachers_write_policy",
    { todo: "Aguardando aplicação da migration 0005 no Supabase." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Imutabilidade de tenant_id em teachers e teaching_assignments via trigger prevent_tenant_id_change",
    { todo: "Aguardando aplicação da migration 0005 no Supabase." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Bloqueio de FK composta estrita ao tentar associar disciplina a módulo de outro curso",
    { todo: "Aguardando aplicação da migration 0005 (fk_subjects_module_strict)." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Acesso do professor autenticado apenas às turmas/disciplinas atribuídas a ele via RLS",
    { todo: "Aguardando aplicação da migration 0005 (teaching_assignments_select_policy)." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Verificação de trilha de auditoria para TEACHER_CREATED, TEACHER_UPDATED e TEACHING_ASSIGNMENT_CREATED",
    { todo: "Aguardando aplicação da migration 0005 e homologação remota da auditoria." },
    () => {}
  );
});
