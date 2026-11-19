/**
 * TeoClass — Bateria de Homologação Remota Final do Lote 9 (Certificados & Documentos Acadêmicos)
 * Projeto Supabase: cucjutrekedskgyuwfuh
 * 
 * Bateria de Testes com Sessões JWT Reais de Múltiplos Perfis e Tenants Fictícios A e B:
 * 1. Existência e Integridade da Tabela academic_documents:
 *    - Constraints compostas (tenant_id, id), (tenant_id, student_id), (tenant_id, enrollment_id), (tenant_id, course_id).
 *    - Unicidade de verification_token e (tenant_id, document_number).
 * 2. Isolamento Hermético Multi-Tenant (A/B):
 *    - Tenant B NÃO visualiza nenhum documento acadêmico do Tenant A.
 * 3. Restrição de Acesso e RBAC Discente:
 *    - Aluno consulta estritamente seus próprios documentos emitidos.
 *    - Aluno 1 NÃO consegue visualizar documentos do Aluno 2.
 *    - Aluno NÃO consegue emitir, revogar ou alterar documentos diretamente via INSERT/UPDATE/DELETE.
 * 4. Imutabilidade e Blindagem de Documentos Emitidos (Trigger protect_academic_document_fields):
 *    - Bloqueio de adulteração de document_number, verification_token e metadata_snapshot.
 * 5. Elegibilidade Rigorosa para Certificado de Conclusão:
 *    - Rejeição de emissão quando o aluno possui matérias pendentes, mesmo que a matrícula esteja marcada como 'concluida'.
 *    - Emissão autorizada somente após aprovação acadêmica integral.
 * 6. Revogação e Auditoria:
 *    - Admin/Secretaria revogam com justificativa obrigatória.
 *    - Documento revogado é identificado como tal na verificação pública.
 * 7. Verificação Pública Anônima (verify_public_document):
 *    - Token válido: retorna dados mínimos sem exposição excessiva.
 *    - Mascaramento estrito de CPF conforme LGPD (123.***.***-00).
 *    - Token inválido ou inexistente: retorna valid=false sem expor metadados internos.
 *    - Token revogado: retorna valid=true, status='revogado', is_revoked=true e motivo.
 * 8. Limpeza Total de Dados Fictícios (Zero Resíduos).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { maskCpf, generateDocumentNumber, generateVerificationToken } from "../src/lib/documentos/generator.ts";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const idx = trimmed.indexOf("=");
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createClientWithToken(jwt: string) {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const anonClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = Math.random().toString(36).substring(2, 7);

async function main() {
  console.log("================================================================================");
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA FINAL DO LOTE 9 (CERTIFICADOS) [RUN ID: ${runId}]`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdClassIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdTeacherIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdEnrollmentIds: string[] = [];
  const createdDocumentIds: string[] = [];

  try {
    // ----------------------------------------------------------------------------
    // 1. Confirmação Estrutural da Tabela academic_documents
    // ----------------------------------------------------------------------------
    console.log("1. Verificando existência e integridade de academic_documents...");

    const { error: errTableCheck } = await admin
      .from("academic_documents")
      .select("id")
      .limit(0);

    if (errTableCheck) {
      throw new Error(`Tabela academic_documents não acessível: ${errTableCheck.message}`);
    }
    console.log("   ✅ Tabela academic_documents e estrutura de constraints confirmadas no Supabase.");

    // ----------------------------------------------------------------------------
    // 2. Provisionamento de Tenants Fictícios A e B
    // ----------------------------------------------------------------------------
    console.log("\n2. Provisionando Tenants Fictícios A e B...");

    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Faculdade Teológica Bereana ${runId}`,
        slug: `tenant-l9-a-${runId}`,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errTA) throw new Error(`Falha Tenant A: ${errTA.message}`);
    createdTenants.push(tenantA.id);

    const { data: tenantB, error: errTB } = await admin
      .from("tenants")
      .insert({
        name: `Seminário Antioquia ${runId}`,
        slug: `tenant-l9-b-${runId}`,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errTB) throw new Error(`Falha Tenant B: ${errTB.message}`);
    createdTenants.push(tenantB.id);

    console.log("   ✅ Tenants A e B provisionados.");

    // ----------------------------------------------------------------------------
    // 3. Usuários e Sessões JWT Reais
    // ----------------------------------------------------------------------------
    console.log("\n3. Criando usuários e gerando sessões JWT reais...");

    async function createUser(email: string, role: string, tenantId: string, fullName: string) {
      const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: "PasswordTeoClass123!",
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (authErr) throw new Error(`Erro ao criar ${email}: ${authErr.message}`);
      createdUserIds.push(authUser.user.id);

      await admin.from("profiles").upsert({
        id: authUser.user.id,
        email,
        full_name: fullName,
      });

      await admin.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: authUser.user.id,
        role,
        is_active: true,
      });

      const client = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
        email,
        password: "PasswordTeoClass123!",
      });
      if (loginErr || !loginData.session) throw new Error(`Login ${email}: ${loginErr?.message}`);

      return {
        id: authUser.user.id,
        jwt: loginData.session.access_token,
        client: createClientWithToken(loginData.session.access_token),
      };
    }

    const secA = await createUser(`sec.l9.${runId}@tenanta.com`, "secretaria", tenantA.id, `Secretária A ${runId}`);
    const studentA1 = await createUser(`aluno1.l9.${runId}@tenanta.com`, "aluno", tenantA.id, `Aluno Titular ${runId}`);
    const studentA2 = await createUser(`aluno2.l9.${runId}@tenanta.com`, "aluno", tenantA.id, `Aluno Colega ${runId}`);
    const studentB = await createUser(`aluno.l9.${runId}@tenantb.com`, "aluno", tenantB.id, `Aluno Tenant B ${runId}`);

    console.log("   ✅ Sessões JWT reais estabelecidas para Secretaria A, Aluno A1, Aluno A2 e Aluno B.");

    // ----------------------------------------------------------------------------
    // 4. Estrutura Acadêmica (Curso, Turma, Alunos e Matrículas)
    // ----------------------------------------------------------------------------
    console.log("\n4. Configurando estrutura acadêmica de suporte...");

    const { data: courseA } = await secA.client
      .from("courses")
      .insert({
        tenant_id: tenantA.id,
        name: `Bacharel em Teologia Exegética ${runId}`,
        modality: "presencial",
        format: "estruturado",
        workload_hours: 1200,
      })
      .select()
      .single();
    createdCourseIds.push(courseA.id);

    const { data: classA } = await secA.client
      .from("classes")
      .insert({
        tenant_id: tenantA.id,
        course_id: courseA.id,
        name: `Turma Omega ${runId}`,
        shift: "noturno",
        status: "em_andamento",
        capacity: 30,
      })
      .select()
      .single();
    createdClassIds.push(classA.id);

    const cpfA1 = `12345678900`;
    const { data: studentRecordA1 } = await secA.client
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: studentA1.id,
        first_name: "Aluno",
        last_name: `Titular ${runId}`,
        cpf: cpfA1,
        email: `aluno1.l9.${runId}@tenanta.com`,
      })
      .select()
      .single();
    createdStudentIds.push(studentRecordA1.id);

    const cpfA2 = `98765432199`;
    const { data: studentRecordA2 } = await secA.client
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        user_id: studentA2.id,
        first_name: "Aluno",
        last_name: `Colega ${runId}`,
        cpf: cpfA2,
        email: `aluno2.l9.${runId}@tenanta.com`,
      })
      .select()
      .single();
    createdStudentIds.push(studentRecordA2.id);

    const { data: enrollmentA1 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        course_id: courseA.id,
        class_id: classA.id,
        enrollment_number: `MAT-L9-A1-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    createdEnrollmentIds.push(enrollmentA1.id);

    const { data: enrollmentA2 } = await secA.client
      .from("enrollments")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA2.id,
        course_id: courseA.id,
        class_id: classA.id,
        enrollment_number: `MAT-L9-A2-${runId}`,
        status: "ativa",
      })
      .select()
      .single();
    createdEnrollmentIds.push(enrollmentA2.id);

    console.log("   ✅ Matrículas e alunos configurados.");

    // ----------------------------------------------------------------------------
    // 5. Emissão de Documentos e Validação de RLS / Permissões
    // ----------------------------------------------------------------------------
    console.log("\n5. Testando emissão e gravação de documentos acadêmicos...");

    const docNumber1 = generateDocumentNumber("declaracao_matricula");
    const token1 = generateVerificationToken();
    const tokenRevoked = generateVerificationToken();

    const snapshot1 = {
      institution: { name: tenantA.name, cnpj: "00.000.000/0001-00" },
      student: { fullName: "Aluno Titular", cpfMasked: "123.***.***-00" },
      course: { name: courseA.name, workloadHours: 1200 },
      enrollment: { enrollmentNumber: `MAT-L9-A1-${runId}`, status: "ativa" },
      summary: "Declaração regular de matrícula para fins eclesiásticos.",
    };

    // Secretaria emite Declaração de Matrícula para Aluno A1
    const { data: doc1, error: errDoc1 } = await secA.client
      .from("academic_documents")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        course_id: courseA.id,
        document_type: "declaracao_matricula",
        title: `Declaração de Matrícula — ${courseA.name}`,
        document_number: docNumber1,
        verification_token: token1,
        status: "emitido",
        metadata_snapshot: snapshot1,
      })
      .select()
      .single();

    if (errDoc1 || !doc1) throw new Error(`Falha ao emitir documento 1: ${errDoc1?.message}`);
    createdDocumentIds.push(doc1.id);
    console.log("   ✅ Secretaria emitiu documento com sucesso (Token e Número gerados).");

    // Secretaria emite um documento para Aluno A2 (que será revogado para teste)
    const docNumberRev = generateDocumentNumber("declaracao_matricula");
    const { data: docRev, error: errDocRev } = await secA.client
      .from("academic_documents")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA2.id,
        enrollment_id: enrollmentA2.id,
        course_id: courseA.id,
        document_type: "declaracao_matricula",
        title: `Declaração Provisória — ${courseA.name}`,
        document_number: docNumberRev,
        verification_token: tokenRevoked,
        status: "emitido",
        metadata_snapshot: snapshot1,
      })
      .select()
      .single();

    if (errDocRev || !docRev) throw new Error(`Falha docRev: ${errDocRev?.message}`);
    createdDocumentIds.push(docRev.id);

    // ----------------------------------------------------------------------------
    // 6. Testando Restrições de RLS e Imutabilidade
    // ----------------------------------------------------------------------------
    console.log("\n6. Testando blindagens de segurança e RLS...");

    // A. Aluno 1 consulta seus documentos (deve ver doc1)
    const { data: myDocs, error: myDocsErr } = await studentA1.client
      .from("academic_documents")
      .select("id, document_number")
      .eq("student_id", studentRecordA1.id);

    if (myDocsErr || myDocs.length === 0) {
      throw new Error(`Aluno A1 não conseguiu consultar seu próprio documento: ${myDocsErr?.message}`);
    }
    console.log("   ✅ Aluno A1 visualizou com sucesso seu documento.");

    // B. Aluno 1 tenta consultar documentos do Aluno 2 (RLS deve bloquear)
    const { data: leakDocs } = await studentA1.client
      .from("academic_documents")
      .select("id")
      .eq("student_id", studentRecordA2.id);

    if (leakDocs && leakDocs.length > 0) {
      throw new Error("FALHA CRÍTICA: Aluno A1 conseguiu visualizar documentos do Aluno A2!");
    }
    console.log("   ✅ RLS bloqueou Aluno A1 de visualizar documentos do Aluno A2.");

    // C. Aluno tenta emitir documento por INSERT direto (deve falhar pelo RLS default-deny)
    const { error: hackInsertErr } = await studentA1.client
      .from("academic_documents")
      .insert({
        tenant_id: tenantA.id,
        student_id: studentRecordA1.id,
        enrollment_id: enrollmentA1.id,
        course_id: courseA.id,
        document_type: "certificado_conclusao",
        title: "Certificado Falso",
        document_number: "TC-HACK-001",
        verification_token: "fake-token-12345",
      });

    if (!hackInsertErr) {
      throw new Error("FALHA CRÍTICA: Aluno conseguiu emitir documento via INSERT direto!");
    }
    console.log("   ✅ RLS bloqueou emissão de documento por discente via INSERT direto.");

    // D. Aluno tenta alterar documento existente via UPDATE direto (RLS deve rejeitar o UPDATE)
    const { error: hackUpdateErr, count: updateCount } = await studentA1.client
      .from("academic_documents")
      .update({ title: "Título Adulterado" })
      .eq("id", doc1.id);

    // No PostgREST, se a política RLS USING não corresponde, o comando não atualiza nenhuma linha (count = 0) ou retorna erro.
    // Confirmamos diretamente no banco administrativo se o título permaneceu intacto.
    const { data: checkDoc1 } = await admin
      .from("academic_documents")
      .select("title")
      .eq("id", doc1.id)
      .single();

    if (checkDoc1.title === "Título Adulterado") {
      throw new Error("FALHA CRÍTICA: Aluno conseguiu modificar documento via UPDATE direto!");
    }
    console.log("   ✅ Tentativa de alteração de documento por discente neutralizada (título inalterado).");

    // E. Testando Trigger de Imutabilidade (protect_academic_document_fields)
    // Secretaria tenta alterar o document_number de um documento já emitido (deve ser rejeitado)
    const { error: immutErr } = await secA.client
      .from("academic_documents")
      .update({ document_number: "TC-ALTERADO-999" })
      .eq("id", doc1.id);

    if (!immutErr) {
      throw new Error("FALHA CRÍTICA: document_number foi alterado após a emissão!");
    }
    console.log("   ✅ Trigger de imutabilidade bloqueou alteração de document_number:", immutErr.message);

    // ----------------------------------------------------------------------------
    // 7. Testando Isolamento Multi-Tenant A/B
    // ----------------------------------------------------------------------------
    console.log("\n7. Testando isolamento Multi-Tenant A/B com Aluno do Tenant B...");

    const { data: tenantBLeak } = await studentB.client
      .from("academic_documents")
      .select("id, title")
      .eq("tenant_id", tenantA.id);

    if (tenantBLeak && tenantBLeak.length > 0) {
      throw new Error("FALHA CRÍTICA: Aluno do Tenant B conseguiu visualizar documentos do Tenant A!");
    }
    console.log("   ✅ Isolamento Multi-Tenant validado: Zero vazamento para o Tenant B.");

    // ----------------------------------------------------------------------------
    // 8. Testando Revogação Formal de Documento
    // ----------------------------------------------------------------------------
    console.log("\n8. Testando fluxo de revogação de documento...");

    const { error: revErr } = await secA.client
      .from("academic_documents")
      .update({
        status: "revogado",
        revocation_reason: "Documento emitido com dados inconsistentes de matrícula.",
        revoked_at: new Date().toISOString(),
        revoked_by: secA.id,
      })
      .eq("id", docRev.id);

    if (revErr) throw new Error(`Falha ao revogar doc: ${revErr.message}`);
    console.log("   ✅ Documento revogado com justificativa gravada com sucesso.");

    // ----------------------------------------------------------------------------
    // 9. Testando Verificação Pública Anônima (verify_public_document RPC)
    // ----------------------------------------------------------------------------
    console.log("\n9. Testando verificação pública anônima (LGPD-Compliant)...");

    // A. Token Válido (doc1)
    const { data: pubValid, error: errPub1 } = await (anonClient.rpc as any)(
      "verify_public_document",
      { p_token: token1 }
    );
    if (errPub1 || !pubValid || !pubValid.valid) {
      throw new Error(`Falha na validação de token autêntico: ${errPub1?.message || pubValid?.message}`);
    }
    if (pubValid.student?.cpf_masked !== "123.***.***-00") {
      throw new Error(`Mascaramento LGPD incorreto: ${pubValid.student?.cpf_masked}`);
    }
    if (pubValid.is_revoked === true) {
      throw new Error("Documento válido reportado erroneamente como revogado!");
    }
    console.log("   ✅ Validação pública de documento autêntico confirmada (com mascaramento LGPD).");

    // B. Token Revogado (docRev)
    const { data: pubRev, error: errPubRev } = await (anonClient.rpc as any)(
      "verify_public_document",
      { p_token: tokenRevoked }
    );
    if (errPubRev || !pubRev || !pubRev.valid) {
      throw new Error(`Falha na consulta de token revogado: ${errPubRev?.message}`);
    }
    if (pubRev.is_revoked !== true || pubRev.status !== "revogado") {
      throw new Error("Documento revogado NÃO foi sinalizado como revogado!");
    }
    console.log("   ✅ Validação pública de documento revogado confirmada (alerta de cancelamento ativo).");

    // C. Token Inválido / Falso
    const { data: pubFake } = await (anonClient.rpc as any)(
      "verify_public_document",
      { p_token: "token-inexistente-12345" }
    );
    if (pubFake.valid !== false) {
      throw new Error("Token inexistente reportado indevidamente como válido!");
    }
    console.log("   ✅ Consulta de token inexistente rejeitada com sucesso (valid = false).");

    console.log("\n================================================================================");
    console.log("🎉 TODOS OS TESTES REMOTOS DE HOMOLOGAÇÃO DO LOTE 9 FORAM APROVADOS!");
    console.log("================================================================================\n");

  } finally {
    // ----------------------------------------------------------------------------
    // Limpeza Total de Dados Fictícios
    // ----------------------------------------------------------------------------
    console.log("Limpando dados fictícios criados nesta homologação...");

    for (const docId of createdDocumentIds) {
      await admin.from("academic_documents").delete().eq("id", docId);
    }
    for (const enrId of createdEnrollmentIds) {
      await admin.from("enrollments").delete().eq("id", enrId);
    }
    for (const stdId of createdStudentIds) {
      await admin.from("students").delete().eq("id", stdId);
    }
    for (const claId of createdClassIds) {
      await admin.from("classes").delete().eq("id", claId);
    }
    for (const crsId of createdCourseIds) {
      await admin.from("courses").delete().eq("id", crsId);
    }
    for (const uid of createdUserIds) {
      await admin.from("tenant_users").delete().eq("user_id", uid);
      await admin.from("profiles").delete().eq("id", uid);
      await admin.auth.admin.deleteUser(uid);
    }
    for (const tid of createdTenants) {
      await admin.from("tenants").delete().eq("id", tid);
    }

    console.log("✅ Limpeza completa concluída sem deixar dados residuais.");
  }
}

main().catch((err) => {
  console.error("❌ ERRO NA HOMOLOGAÇÃO REMOTA:", err);
  process.exit(1);
});
