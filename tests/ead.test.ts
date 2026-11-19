import test from "node:test";
import assert from "node:assert/strict";
import {
  hasActionAccess,
  hasModuleAccess,
} from "../src/lib/rbac/permissions.ts";
import {
  validateMaterialUrl,
  MATERIAL_TYPE_LABELS,
  type LearningUnitInput,
  type LessonInput,
  type LessonMaterialInput,
} from "../src/types/ead.ts";

test("TeoClass — Fundação do EAD Teológico (Testes Locais de Regras e RBAC)", async (t) => {
  await t.test("RBAC: Permissões de Acesso e Gestão de Conteúdos EAD", () => {
    // Admin tem acesso e gestão
    assert.equal(hasActionAccess("admin", "ead:access_lessons"), true);
    assert.equal(hasActionAccess("admin", "ead:manage_content"), true);
    assert.equal(hasModuleAccess("admin", "ead"), true);

    // Professor tem acesso a aulas e gestão de conteúdos
    assert.equal(hasActionAccess("professor", "ead:access_lessons"), true);
    assert.equal(hasActionAccess("professor", "ead:manage_content"), true);
    assert.equal(hasModuleAccess("professor", "ead"), true);

    // Aluno pode acessar lições, mas NÃO pode gerenciar conteúdos
    assert.equal(hasActionAccess("aluno", "ead:access_lessons"), true);
    assert.equal(hasActionAccess("aluno", "ead:manage_content"), false);
    assert.equal(hasModuleAccess("aluno", "ead"), true);

    // Secretaria tem acesso estrito acadêmico/secretaria, mas o EAD pedagógico é do professor e admin
    assert.equal(hasActionAccess("secretaria", "ead:manage_content"), false);

    // Financeiro NÃO tem acesso ao EAD
    assert.equal(hasActionAccess("financeiro", "ead:access_lessons"), false);
    assert.equal(hasActionAccess("financeiro", "ead:manage_content"), false);
    assert.equal(hasModuleAccess("financeiro", "ead"), false);
  });

  await t.test("Validação Segura de URLs de Materiais (YouTube, Vimeo e PDFs)", () => {
    // Vídeos válidos
    const yt1 = validateMaterialUrl("video", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(yt1.isValid, true);

    const yt2 = validateMaterialUrl("video", "https://youtu.be/dQw4w9WgXcQ");
    assert.equal(yt2.isValid, true);

    const vimeo = validateMaterialUrl("video", "https://vimeo.com/123456789");
    assert.equal(vimeo.isValid, true);

    // Vídeos rejeitados (hospedagens não autorizadas / não-vídeo)
    const invalidVideo = validateMaterialUrl("video", "https://meuservidor.com/video.mp4");
    assert.equal(invalidVideo.isValid, false);
    assert.match(invalidVideo.error || "", /YouTube.*Vimeo/i);

    // PDFs e links válidos
    const pdfVal = validateMaterialUrl("pdf", "https://instituto.edu.br/apostilas/hermeneutica.pdf");
    assert.equal(pdfVal.isValid, true);

    const linkVal = validateMaterialUrl("link", "https://monergismo.com/artigos/calvino.html");
    assert.equal(linkVal.isValid, true);

    // URLs maliciosas ou protocolos não permitidos
    const javascriptUrl = validateMaterialUrl("link", "javascript:alert(1)");
    assert.equal(javascriptUrl.isValid, false);

    const fileUrl = validateMaterialUrl("pdf", "file:///C:/passwords.txt");
    assert.equal(fileUrl.isValid, false);

    // Tipo texto não exige URL
    const textMat = validateMaterialUrl("text", null);
    assert.equal(textMat.isValid, true);
  });

  await t.test("Contratos e DTOs de Unidades, Aulas e Materiais", () => {
    assert.equal(MATERIAL_TYPE_LABELS.video, "Vídeo Externo (YouTube / Vimeo)");
    assert.equal(MATERIAL_TYPE_LABELS.pdf, "Documento PDF");
    assert.equal(MATERIAL_TYPE_LABELS.link, "Link / Artigo Web");
    assert.equal(MATERIAL_TYPE_LABELS.text, "Texto Complementar");

    const unitDto: LearningUnitInput = {
      subject_id: "fake-uuid-subject",
      title: "Unidade 1: Introdução à Teologia Paulina",
      description: "Vida e cartas do Apóstolo Paulo",
      order_index: 1,
      is_published: true,
    };
    assert.ok(unitDto.title.length >= 2);
    assert.equal(unitDto.order_index, 1);

    const lessonDto: LessonInput = {
      unit_id: "fake-uuid-unit",
      subject_id: "fake-uuid-subject",
      title: "Aula 1: A Epístola aos Romanos e a Justificação pela Fé",
      summary: "Estrutura teológica de Romanos capítulos 1 a 5",
      duration_minutes: 60,
      order_index: 1,
      is_published: true,
    };
    assert.ok(lessonDto.title.length >= 2);
    assert.equal(lessonDto.duration_minutes, 60);

    const materialDto: LessonMaterialInput = {
      lesson_id: "fake-uuid-lesson",
      title: "Apostila em PDF — Comentário Exegético",
      material_type: "pdf",
      url: "https://seminario.com.br/materiais/romanos.pdf",
      order_index: 1,
      is_active: true,
    };
    assert.equal(materialDto.material_type, "pdf");
    assert.ok(materialDto.url && materialDto.url.startsWith("https://"));
  });
});

test("TeoClass — Suíte de Testes Remotos do EAD (Pendente da Migration 0006)", async (t) => {
  await t.test(
    "TESTE PENDENTE: Criação de unidade e aula no Tenant A e bloqueio de visibilidade no Tenant B",
    { todo: "Aguardando aplicação da migration 0006_ead_foundation_learning_units_lessons.sql no Supabase TeoClass." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Bloqueio de inserção/edição de aulas por aluno via RLS lessons_insert_policy",
    { todo: "Aguardando aplicação da migration 0006 no Supabase." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Imutabilidade de tenant_id em learning_units, lessons e lesson_materials",
    { todo: "Aguardando aplicação da migration 0006 no Supabase." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Restrição de edição do professor somente a matérias com atribuição docente ativa",
    { todo: "Aguardando aplicação da migration 0006 (has_teacher_subject_assignment)." },
    () => {}
  );

  await t.test(
    "TESTE PENDENTE: Trigger de integridade que bloqueia atribuição de turma e disciplina de cursos diferentes",
    { todo: "Aguardando aplicação da migration 0006 (check_teaching_assignment_course_integrity)." },
    () => {}
  );
});
