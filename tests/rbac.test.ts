import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ROLE_DEFINITIONS,
  hasModuleAccess,
  hasActionAccess,
  assertPermission,
  type TeoClassRole,
  type TeoClassAction,
  type TeoClassModule,
} from "../src/lib/rbac/permissions.ts";

describe("TeoClass RBAC Centralizado — Testes Unitários de Autorização", () => {
  it("deve cobrir exatamente os cinco perfis definidos na especificação", () => {
    const roles: TeoClassRole[] = ["admin", "secretaria", "financeiro", "professor", "aluno"];
    assert.equal(Object.keys(ROLE_DEFINITIONS).length, 5);

    for (const role of roles) {
      assert.ok(ROLE_DEFINITIONS[role], `Perfil '${role}' deve estar registrado na matriz.`);
    }
  });

  describe("Isolamento de Ações por Perfil (Default-Deny)", () => {
    it("Aluno NÃO deve ter permissões administrativas, financeiras ou de docência", () => {
      const unauthorizedActions: TeoClassAction[] = [
        "secretaria:manage_students",
        "secretaria:manage_enrollments",
        "academico:manage_courses",
        "academico:record_grades",
        "financeiro:view",
        "financeiro:manage_receivables",
        "financeiro:record_payments",
        "financeiro:configure_gateway",
        "certificados:issue",
        "certificados:revoke",
        "config:manage_institution",
      ];

      for (const action of unauthorizedActions) {
        assert.equal(
          hasActionAccess("aluno", action),
          false,
          `Aluno não pode ter permissão para '${action}'`
        );
        assert.throws(
          () => assertPermission("aluno", action),
          /Acesso negado/,
          `Deve lançar erro de acesso negado para '${action}'`
        );
      }
    });

    it("Professor deve poder registrar notas e gerenciar banco de provas, mas NÃO o financeiro", () => {
      assert.equal(hasActionAccess("professor", "academico:record_grades"), true);
      assert.equal(hasActionAccess("professor", "provas:manage_bank"), true);
      assert.equal(hasActionAccess("professor", "financeiro:view"), false);
      assert.equal(hasActionAccess("professor", "financeiro:manage_receivables"), false);
      assert.equal(hasActionAccess("professor", "config:manage_institution"), false);
    });

    it("Financeiro deve poder gerenciar contas a receber, mas NÃO lançar notas acadêmicas", () => {
      assert.equal(hasActionAccess("financeiro", "financeiro:view"), true);
      assert.equal(hasActionAccess("financeiro", "financeiro:manage_receivables"), true);
      assert.equal(hasActionAccess("financeiro", "academico:record_grades"), false);
      assert.equal(hasActionAccess("financeiro", "secretaria:manage_students"), false);
    });

    it("Secretaria deve gerenciar matrículas e alunos, mas NÃO configurar gateway financeiro", () => {
      assert.equal(hasActionAccess("secretaria", "secretaria:manage_students"), true);
      assert.equal(hasActionAccess("secretaria", "secretaria:manage_enrollments"), true);
      assert.equal(hasActionAccess("secretaria", "financeiro:configure_gateway"), false);
      assert.equal(hasActionAccess("secretaria", "config:manage_institution"), false);
    });

    it("Administrador deve possuir todas as ações institucionais autorizadas", () => {
      assert.equal(hasActionAccess("admin", "config:manage_institution"), true);
      assert.equal(hasActionAccess("admin", "financeiro:configure_gateway"), true);
      assert.equal(hasActionAccess("admin", "certificados:revoke"), true);
    });
  });

  describe("Controle de Módulos por Perfil", () => {
    it("Aluno acessa portal_aluno, ead, provas e certificados, mas NÃO financeiro nem configuracoes", () => {
      assert.equal(hasModuleAccess("aluno", "portal_aluno"), true);
      assert.equal(hasModuleAccess("aluno", "ead"), true);
      assert.equal(hasModuleAccess("aluno", "financeiro"), false);
      assert.equal(hasModuleAccess("aluno", "configuracoes"), false);
      assert.equal(hasModuleAccess("aluno", "secretaria"), false);
    });

    it("Financeiro acessa inicio e financeiro, mas NÃO ead nem provas", () => {
      assert.equal(hasModuleAccess("financeiro", "financeiro"), true);
      assert.equal(hasModuleAccess("financeiro", "ead"), false);
      assert.equal(hasModuleAccess("financeiro", "provas"), false);
    });
  });
});
