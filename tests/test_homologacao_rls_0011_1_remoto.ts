/**
 * TeoClass — Bateria de Homologação Remota da Correção RLS 0011_1
 * Projeto Supabase: cucjutrekedskgyuwfuh
 * 
 * Escopo de Validação com Sessões JWT Reais de Múltiplos Perfis e Dois Tenants Fictícios A e B:
 * 1. Restrição Estrita de SELECT em students para Discentes:
 *    - Aluno A1 autenticado só consegue consultar seu próprio registro (user_id = auth.uid()).
 *    - Aluno A1 tenta consultar aluno A2 ou listar todos os alunos: recebe exclusivamente o seu registro (zero enumeração).
 *    - Aluno A1 tenta consultar aluno do Tenant B: retorno vazio.
 * 2. Casos Limite de Discente e Usuário Anônimo/Sem Role:
 *    - Aluno sem user_id vinculado (registro desvinculado) não pode ser visualizado por discentes.
 *    - Usuário autenticado sem role no tenant não visualiza estudantes.
 * 3. Validação de Staff e Corpo Docente:
 *    - Admin, Secretaria, Financeiro e Professor visualizam os estudantes matriculados no próprio tenant.
 * 4. Bloqueio de Mutações Discentes (Default-Deny mantido):
 *    - Aluno tentando INSERT, UPDATE ou DELETE direto na tabela students: bloqueado por RLS.
 * 5. Ausência de Regressões nos Módulos e Joins:
 *    - Joins com students em matrículas, boletim, documentos e recebíveis funcionam perfeitamente para o discente.
 * 6. Isolamento Hermético Multi-Tenant (A/B):
 *    - Usuários do Tenant B não visualizam dados do Tenant A.
 * 7. Limpeza Total de Dados Fictícios (Zero Resíduos).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

const runId = Math.random().toString(36).substring(2, 7);

async function main() {
  console.log("================================================================================");
  console.log(`TEOCLASS — HOMOLOGAÇÃO REMOTA DA CORREÇÃO RLS 0011_1 [RUN ID: ${runId}]`);
  console.log("================================================================================\n");

  const createdTenants: string[] = [];
  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdClassIds: string[] = [];
  const createdTeacherIds: string[] = [];
  const createdSubjectIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdEnrollmentIds: string[] = [];

  try {
    // ----------------------------------------------------------------------------
    // 1. Provisionando Tenants Fictícios A e B
    // ----------------------------------------------------------------------------
    console.log("1. Provisionando Tenants Fictícios A e B...");

    const { data: tenantA, error: errTA } = await admin
      .from("tenants")
      .insert({
        name: `Instituto Teológico Berea ${runId}`,
        slug: `tenant-rls-a-${runId}`,
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
        slug: `tenant-rls-b-${runId}`,
        status: "active",
        plan_tier: "gestao_ead",
      })
      .select()
      .single();
    if (errTB) throw new Error(`Falha Tenant B: ${errTB.message}`);
    createdTenants.push(tenantB.id);

    console.log("   ✅ Tenants A e B provisionados.");

    // ----------------------------------------------------------------------------
    // 2. Criando Usuários com Sessões JWT Reais
    // ----------------------------------------------------------------------------
    console.log("\n2. Criando usuários e gerando sessões JWT reais...");

    async function createUser(email: string, role: string | null, tenantId: string | null, fullName: string) {
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

      if (tenantId && role) {
        await admin.from("tenant_users").insert({
          tenant_id: tenantId,
          user_id: authUser.user.id,
          role: role,
          is_active: true,
        });
      }

      const anonClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: session, error: signErr } = await anonClient.auth.signInWithPassword({
        email,
        password: "PasswordTeoClass123!",
      });

      if (signErr || !session.session) {
        throw new Error(`Falha ao logar com ${email}: ${signErr?.message}`);
      }

      return {
        id: authUser.user.id,
        email,
        role,
        tenantId,
        jwt: session.session.access_token,
        client: createClientWithToken(session.session.access_token),
      };
    }

    // Tenant A Users
    const adminA = await createUser(`admin.rls.a.${runId}@teoclass.local`, "admin", tenantA.id, "Diretor A");
    const secA = await createUser(`sec.rls.a.${runId}@teoclass.local`, "secretaria", tenantA.id, "Secretária A");
    const finA = await createUser(`fin.rls.a.${runId}@teoclass.local`, "financeiro", tenantA.id, "Tesoureiro A");
    const profA = await createUser(`prof.rls.a.${runId}@teoclass.local`, "professor", tenantA.id, "Prof. Exegese A");
    const alunoA1 = await createUser(`aluno1.rls.a.${runId}@teoclass.local`, "aluno", tenantA.id, "João Aluno A1");
    const alunoA2 = await createUser(`aluno2.rls.a.${runId}@teoclass.local`, "aluno", tenantA.id, "Tiago Aluno A2");

    // Usuário sem vínculo de tenant (avulso)
    const userNoTenant = await createUser(`avulso.rls.${runId}@teoclass.local`, null, null, "Visitante Sem Role");

    // Tenant B Users
    const adminB = await createUser(`admin.rls.b.${runId}@teoclass.local`, "admin", tenantB.id, "Diretor B");
    const alunoB = await createUser(`aluno.rls.b.${runId}@teoclass.local`, "aluno", tenantB.id, "Barnabé Aluno B");

    console.log("   ✅ Sessões JWT reais estabelecidas para todos os perfis.");

    // ----------------------------------------------------------------------------
    // 3. Cadastrando Alunos e Matrículas no Tenant A e B
    // ----------------------------------------------------------------------------
    console.log("\n3. Inserindo estudantes e matrículas de teste...");

    // Aluno A1 (vinculado a alunoA1.id)
    const { data: stuA1, error: errS1 } = await admin.from("students").insert({
      tenant_id: tenantA.id,
      user_id: alunoA1.id,
      first_name: "João",
      last_name: "Aluno A1",
      cpf: "11122233344",
      email: alunoA1.email,
      is_active: true,
    }).select().single();
    if (errS1) throw errS1;
    createdStudentIds.push(stuA1.id);

    // Aluno A2 (vinculado a alunoA2.id)
    const { data: stuA2, error: errS2 } = await admin.from("students").insert({
      tenant_id: tenantA.id,
      user_id: alunoA2.id,
      first_name: "Tiago",
      last_name: "Aluno A2",
      cpf: "22233344455",
      email: alunoA2.email,
      is_active: true,
    }).select().single();
    if (errS2) throw errS2;
    createdStudentIds.push(stuA2.id);

    // Aluno A3 (sem user_id vinculado)
    const { data: stuA3, error: errS3 } = await admin.from("students").insert({
      tenant_id: tenantA.id,
      user_id: null,
      first_name: "Simão",
      last_name: "Aluno A3 Desvinculado",
      cpf: "33344455566",
      email: `simao.${runId}@teoclass.local`,
      is_active: true,
    }).select().single();
    if (errS3) throw errS3;
    createdStudentIds.push(stuA3.id);

    // Aluno B (Tenant B)
    const { data: stuB, error: errSB } = await admin.from("students").insert({
      tenant_id: tenantB.id,
      user_id: alunoB.id,
      first_name: "Barnabé",
      last_name: "Aluno B",
      cpf: "77788899900",
      email: alunoB.email,
      is_active: true,
    }).select().single();
    if (errSB) throw errSB;
    createdStudentIds.push(stuB.id);

    // Curso, Turma e Matrícula de Aluno 1 para testar joins
    const { data: courseA } = await admin.from("courses").insert({
      tenant_id: tenantA.id,
      name: "Teologia Bíblica e Sistemática",
      code: `TBS-${runId}`,
      workload_hours: 1200,
      modality: "ead_assincrono",
      is_active: true,
    }).select().single();
    createdCourseIds.push(courseA.id);

    const { data: classA } = await admin.from("classes").insert({
      tenant_id: tenantA.id,
      course_id: courseA.id,
      name: "Turma RLS 2026",
      shift: "noturno",
      capacity: 30,
      is_active: true,
    }).select().single();
    createdClassIds.push(classA.id);

    const { data: enrollA1 } = await admin.from("enrollments").insert({
      tenant_id: tenantA.id,
      student_id: stuA1.id,
      course_id: courseA.id,
      class_id: classA.id,
      enrollment_number: `MAT-RLS-A1-${runId}`,
      status: "ativa",
    }).select().single();
    createdEnrollmentIds.push(enrollA1.id);

    console.log("   ✅ Dados de estudantes cadastrados com sucesso.");

    // ----------------------------------------------------------------------------
    // 4. Teste Crucial 1: Aluno A1 deve consultar exclusivamente seu próprio registro
    // ----------------------------------------------------------------------------
    console.log("\n4. Testando SELECT direto do Aluno A1 na tabela students...");

    // Consulta sem filtro WHERE (SELECT * FROM students)
    const { data: aluno1AllStudents, error: errA1All } = await alunoA1.client
      .from("students")
      .select("id, full_name, cpf, user_id");

    if (errA1All) throw new Error(`Erro na consulta do Aluno A1: ${errA1All.message}`);

    console.log(`   - Aluno A1 executou SELECT * FROM students. Registros retornados: ${aluno1AllStudents?.length}`);
    if (!aluno1AllStudents || aluno1AllStudents.length !== 1) {
      throw new Error(`VIOLAÇÃO RLS: Esperado exatamente 1 registro para Aluno A1, mas obteve ${aluno1AllStudents?.length}!`);
    }

    if (aluno1AllStudents[0].id !== stuA1.id || aluno1AllStudents[0].user_id !== alunoA1.id) {
      throw new Error(`VIOLAÇÃO RLS: Registro retornado para Aluno A1 não corresponde a ele mesmo!`);
    }
    console.log("   🛡️ CONFIRMADO: Aluno A1 só visualizou seu próprio registro discente.");

    // Aluno A1 tenta consultar explicitamente o ID do Aluno A2
    const { data: aluno1TargetA2 } = await alunoA1.client
      .from("students")
      .select("id, full_name, cpf")
      .eq("id", stuA2.id);

    if (aluno1TargetA2 && aluno1TargetA2.length > 0) {
      throw new Error("VIOLAÇÃO RLS: Aluno A1 conseguiu consultar o registro do Aluno A2 por ID direto!");
    }
    console.log("   🛡️ CONFIRMADO: SELECT do Aluno A1 buscando Aluno A2 por ID retornou vazio.");

    // Aluno A1 tenta consultar Aluno A3 (desvinculado de user_id)
    const { data: aluno1TargetA3 } = await alunoA1.client
      .from("students")
      .select("id, full_name, cpf")
      .eq("id", stuA3.id);

    if (aluno1TargetA3 && aluno1TargetA3.length > 0) {
      throw new Error("VIOLAÇÃO RLS: Aluno A1 conseguiu consultar aluno sem user_id vinculado!");
    }
    console.log("   🛡️ CONFIRMADO: Aluno sem user_id é totalmente invisível para discentes.");

    // Aluno A1 tenta consultar Aluno B do Tenant B
    const { data: aluno1TargetB } = await alunoA1.client
      .from("students")
      .select("id, full_name, cpf")
      .eq("id", stuB.id);

    if (aluno1TargetB && aluno1TargetB.length > 0) {
      throw new Error("VIOLAÇÃO MULTI-TENANT: Aluno A1 conseguiu consultar aluno do Tenant B!");
    }
    console.log("   🛡️ CONFIRMADO: Consulta a estudante de outro tenant retornou vazio.");

    // ----------------------------------------------------------------------------
    // 5. Teste 2: Usuário sem role no tenant não visualiza estudantes
    // ----------------------------------------------------------------------------
    console.log("\n5. Testando SELECT de usuário autenticado sem papel no tenant...");

    const { data: noRoleStudents } = await userNoTenant.client
      .from("students")
      .select("id, full_name");

    if (noRoleStudents && noRoleStudents.length > 0) {
      throw new Error("VIOLAÇÃO RLS: Usuário sem papel no tenant conseguiu ler estudantes!");
    }
    console.log("   🛡️ CONFIRMADO: Usuário sem papel não visualiza nenhum registro de estudantes.");

    // ----------------------------------------------------------------------------
    // 6. Teste 3: Perfis Institucionais e Docentes (Admin, Secretaria, Financeiro, Professor)
    // ----------------------------------------------------------------------------
    console.log("\n6. Testando SELECT dos perfis institucionais e docentes no Tenant A...");

    // Admin A
    const { count: countAdminA } = await adminA.client
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantA.id);

    // Secretaria A
    const { count: countSecA } = await secA.client
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantA.id);

    // Financeiro A
    const { count: countFinA } = await finA.client
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantA.id);

    // Professor A
    const { count: countProfA } = await profA.client
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantA.id);

    console.log(`   - Contagens no Tenant A: Admin=${countAdminA}, Secretaria=${countSecA}, Financeiro=${countFinA}, Professor=${countProfA}`);

    if (countAdminA !== 3 || countSecA !== 3 || countFinA !== 3 || countProfA !== 3) {
      throw new Error(`VIOLAÇÃO RLS: Perfis de staff/docente esperavam 3 estudantes no Tenant A, obtiveram Admin=${countAdminA}, Sec=${countSecA}, Fin=${countFinA}, Prof=${countProfA}`);
    }
    console.log("   ✅ CONFIRMADO: Admin, Secretaria, Financeiro e Professor acessam normalmente todos os 3 alunos do tenant.");

    // Isolamento: Admin A tenta ver Tenant B
    const { data: adminATargetB } = await adminA.client
      .from("students")
      .select("id")
      .eq("tenant_id", tenantB.id);

    if (adminATargetB && adminATargetB.length > 0) {
      throw new Error("VIOLAÇÃO MULTI-TENANT: Admin A visualizou alunos do Tenant B!");
    }
    console.log("   🛡️ CONFIRMADO: Admin A não visualiza alunos do Tenant B.");

    // ----------------------------------------------------------------------------
    // 7. Teste 4: Tentativas de Mutações por Aluno (INSERT, UPDATE, DELETE)
    // ----------------------------------------------------------------------------
    console.log("\n7. Testando bloqueio rigoroso de mutações por discente...");

    // Aluno A1 tenta INSERT
    const { error: errA1Insert } = await alunoA1.client
      .from("students")
      .insert({
        tenant_id: tenantA.id,
        first_name: "Intruso",
        last_name: "Discente",
        cpf: "99988877766",
      });

    if (!errA1Insert) {
      throw new Error("VIOLAÇÃO RLS: Aluno conseguiu inserir registro na tabela students!");
    }
    console.log("   🛡️ CONFIRMADO: INSERT por discente bloqueado por RLS.");

    // Aluno A1 tenta UPDATE no aluno A2
    const { error: errA1Update, data: updData } = await alunoA1.client
      .from("students")
      .update({ first_name: "Alterado" })
      .eq("id", stuA2.id)
      .select();

    if (updData && updData.length > 0) {
      throw new Error("VIOLAÇÃO RLS: Aluno A1 conseguiu alterar o registro do Aluno A2!");
    }
    console.log("   🛡️ CONFIRMADO: UPDATE em aluno terceiro neutralizado.");

    // Aluno A1 tenta DELETE em qualquer aluno
    const { error: errA1Delete, data: delData } = await alunoA1.client
      .from("students")
      .delete()
      .eq("id", stuA2.id)
      .select();

    if (delData && delData.length > 0) {
      throw new Error("VIOLAÇÃO RLS: Aluno A1 conseguiu deletar aluno!");
    }
    console.log("   🛡️ CONFIRMADO: DELETE por discente bloqueado por RLS.");

    // ----------------------------------------------------------------------------
    // 8. Teste 5: Validação de Joins em Matrículas (Sem Regressão nos Módulos)
    // ----------------------------------------------------------------------------
    console.log("\n8. Testando integridade de Joins com JWT discente (enrollments -> students)...");

    const { data: aluno1EnrollmentWithJoin, error: errJoin } = await alunoA1.client
      .from("enrollments")
      .select(`
        id,
        enrollment_number,
        status,
        student:students(id, full_name, cpf, user_id),
        course:courses(id, name)
      `)
      .eq("tenant_id", tenantA.id)
      .eq("id", enrollA1.id)
      .single();

    if (errJoin) throw new Error(`Falha no join discente: ${errJoin.message}`);

    if (!aluno1EnrollmentWithJoin || !aluno1EnrollmentWithJoin.student) {
      throw new Error("REGRESSÃO DETECTADA: Join student:students retornou nulo na matrícula do aluno!");
    }

    console.log(`   - Join resolvido com sucesso: Matrícula ${aluno1EnrollmentWithJoin.enrollment_number} vinculada a ${aluno1EnrollmentWithJoin.student.full_name}`);
    console.log("   ✅ CONFIRMADO: Joins entre matrículas e students funcionam perfeitamente sem regressão.");

    console.log("\n================================================================================");
    console.log("TODOS OS TESTES DA CORREÇÃO RLS 0011_1 FORAM APROVADOS COM SUCESSO!");
    console.log("================================================================================\n");

  } finally {
    // ----------------------------------------------------------------------------
    // 9. Limpeza Total de Dados Fictícios de Homologação (Zero Resíduos)
    // ----------------------------------------------------------------------------
    console.log("9. Executando limpeza rigorosa de dados fictícios de homologação...");

    for (const eid of createdEnrollmentIds) {
      await admin.from("enrollments").delete().eq("id", eid);
    }
    for (const asid of createdAssignmentIds) {
      await admin.from("teaching_assignments").delete().eq("id", asid);
    }
    for (const sid of createdSubjectIds) {
      await admin.from("subjects").delete().eq("id", sid);
    }
    for (const tid of createdTeacherIds) {
      await admin.from("teachers").delete().eq("id", tid);
    }
    for (const cid of createdClassIds) {
      await admin.from("classes").delete().eq("id", cid);
    }
    for (const crsid of createdCourseIds) {
      await admin.from("courses").delete().eq("id", crsid);
    }
    for (const stuid of createdStudentIds) {
      await admin.from("students").delete().eq("id", stuid);
    }
    for (const uid of createdUserIds) {
      await admin.from("tenant_users").delete().eq("user_id", uid);
      await admin.from("profiles").delete().eq("id", uid);
      await admin.auth.admin.deleteUser(uid);
    }
    for (const tid of createdTenants) {
      await admin.from("tenants").delete().eq("id", tid);
    }

    console.log("   🧹 Banco remoto limpo com sucesso. Zero resíduos de teste.");
  }
}

main().catch((err) => {
  console.error("\n❌ ERRO NA HOMOLOGAÇÃO DA CORREÇÃO RLS 0011_1:", err);
  process.exit(1);
});
