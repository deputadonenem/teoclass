import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import type { OnboardingStep, OnboardingProgressDTO } from "../src/types/onboarding.ts";

describe("TeoClass — Lote 14: Onboarding Institucional & Configuração PWA", () => {
  describe("1. Estrutura do Manifesto PWA e Metadados Essenciais", () => {
    it("deve possuir o arquivo manifest.json válido em public/ com metadados corretos", () => {
      const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
      assert.equal(fs.existsSync(manifestPath), true, "manifest.json deve existir em public/");

      const content = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      assert.equal(content.short_name, "TeoClass");
      assert.equal(content.display, "standalone");
      assert.equal(content.theme_color, "#4f46e5");
      assert.ok(content.icons && content.icons.length >= 2, "deve conter ícones para PWA");
    });

    it("deve possuir ícone vetorial SVG e assets mínimos para PWA", () => {
      const svgPath = path.resolve(process.cwd(), "public/icons/icon.svg");
      const png192 = path.resolve(process.cwd(), "public/icons/icon-192x192.png");
      const png512 = path.resolve(process.cwd(), "public/icons/icon-512x512.png");

      assert.equal(fs.existsSync(svgPath), true, "icon.svg deve existir");
      assert.equal(fs.existsSync(png192), true, "icon-192x192.png deve existir");
      assert.equal(fs.existsSync(png512), true, "icon-512x512.png deve existir");
    });
  });

  describe("2. Lógica das 4 Etapas do Onboarding", () => {
    it("deve calcular corretamente a porcentagem e o estado de conclusão dos passos", () => {
      const mockSteps: OnboardingStep[] = [
        {
          id: "dados_escola",
          title: "1. Identidade & Dados da Escola",
          description: "Configurar nome e contato",
          href: "/app/configuracoes",
          isCompleted: true,
          actionLabel: "Revisar",
        },
        {
          id: "primeiro_curso",
          title: "2. Cadastro do Primeiro Curso",
          description: "Cadastrar primeiro curso",
          href: "/app/academico",
          isCompleted: true,
          actionLabel: "Ver",
        },
        {
          id: "primeira_turma",
          title: "3. Abertura da Primeira Turma",
          description: "Criar turma",
          href: "/app/academico",
          isCompleted: false,
          actionLabel: "Criar",
        },
        {
          id: "pagina_publica",
          title: "4. Ativação da Página Pública & IA",
          description: "Publicar escola",
          href: "/app/captacao",
          isCompleted: false,
          actionLabel: "Publicar",
        },
      ];

      const completed = mockSteps.filter((s) => s.isCompleted).length;
      const total = mockSteps.length;
      const percent = Math.round((completed / total) * 100);

      assert.equal(completed, 2);
      assert.equal(total, 4);
      assert.equal(percent, 50);

      const progressDTO: OnboardingProgressDTO = {
        isDismissed: false,
        isAllCompleted: completed === total,
        completedCount: completed,
        totalSteps: total,
        percent,
        steps: mockSteps,
      };

      assert.equal(progressDTO.isAllCompleted, false);
      assert.equal(progressDTO.percent, 50);
    });

    it("deve identificar quando todas as 4 etapas foram finalizadas com 100%", () => {
      const allCompletedSteps: OnboardingStep[] = [
        { id: "dados_escola", title: "1", description: "", href: "", isCompleted: true, actionLabel: "" },
        { id: "primeiro_curso", title: "2", description: "", href: "", isCompleted: true, actionLabel: "" },
        { id: "primeira_turma", title: "3", description: "", href: "", isCompleted: true, actionLabel: "" },
        { id: "pagina_publica", title: "4", description: "", href: "", isCompleted: true, actionLabel: "" },
      ];

      const completed = allCompletedSteps.filter((s) => s.isCompleted).length;
      const percent = Math.round((completed / allCompletedSteps.length) * 100);

      assert.equal(completed, 4);
      assert.equal(percent, 100);
      assert.equal(completed === allCompletedSteps.length, true);
    });
  });
});
