import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * Função pura que espelha a lógica de especificidade de rota implementada no Sidebar do TeoClass
 */
function getActiveSidebarHref(pathname: string, navHrefs: string[]): string {
  if (!pathname) return "";

  const matchingHrefs = navHrefs.filter((href) => {
    if (pathname === href) return true;
    if (pathname.startsWith(`${href}/`)) return true;
    return false;
  });

  if (matchingHrefs.length === 0) return "";

  // Seleciona o item com maior especificidade (maior comprimento de href)
  matchingHrefs.sort((a, b) => b.length - a.length);
  return matchingHrefs[0];
}

describe("TeoClass — Resolução de Rota Ativa no Menu Lateral (Sidebar)", () => {
  const NAV_HREFS = [
    "/app/dashboard",
    "/app/secretaria",
    "/app/academico",
    "/app/academico/boletim",
    "/app/portal",
    "/app/ead",
    "/app/provas",
    "/app/financeiro",
    "/app/certificados",
    "/app/captacao",
    "/app/configuracoes",
  ];

  it("deve ativar EXCLUSIVAMENTE 'Boletim & Notas' quando o pathname for /app/academico/boletim", () => {
    const active = getActiveSidebarHref("/app/academico/boletim", NAV_HREFS);
    assert.strictEqual(active, "/app/academico/boletim");
    assert.notStrictEqual(active, "/app/academico");
  });

  it("deve ativar EXCLUSIVAMENTE 'Acadêmico' quando o pathname for /app/academico", () => {
    const active = getActiveSidebarHref("/app/academico", NAV_HREFS);
    assert.strictEqual(active, "/app/academico");
    assert.notStrictEqual(active, "/app/academico/boletim");
  });

  it("deve ativar subrotas de 'Acadêmico' que não sejam boletim (ex: /app/academico/turmas/123)", () => {
    const active = getActiveSidebarHref("/app/academico/turmas/123", NAV_HREFS);
    assert.strictEqual(active, "/app/academico");
  });

  it("deve ativar subrotas de 'Boletim & Notas' (ex: /app/academico/boletim/aluno-456)", () => {
    const active = getActiveSidebarHref("/app/academico/boletim/aluno-456", NAV_HREFS);
    assert.strictEqual(active, "/app/academico/boletim");
  });

  it("não deve ativar nenhum item quando a rota for desconhecida ou raiz", () => {
    assert.strictEqual(getActiveSidebarHref("/app/desconhecido", NAV_HREFS), "");
    assert.strictEqual(getActiveSidebarHref("", NAV_HREFS), "");
  });

  it("deve garantir unicidade estrita: apenas UM item ativo por rota", () => {
    const testRoutes = [
      "/app/dashboard",
      "/app/secretaria",
      "/app/secretaria/aluno/1",
      "/app/academico",
      "/app/academico/boletim",
      "/app/academico/cursos",
      "/app/financeiro",
      "/app/financeiro/faturas",
    ];

    for (const route of testRoutes) {
      const active = getActiveSidebarHref(route, NAV_HREFS);
      const activeItems = NAV_HREFS.filter((href) => href === active);
      assert.strictEqual(activeItems.length, 1, `A rota ${route} deve ter exatamente 1 item ativo`);
    }
  });
});
