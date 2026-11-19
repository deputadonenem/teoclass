// ==============================================================================
// TeoClass — Tipos do Módulo EAD (Fundação: Unidades, Aulas e Materiais)
// ==============================================================================

import type { Subject, Course } from "./academico";

export type MaterialType = "video" | "pdf" | "link" | "text";

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  video: "Vídeo Externo (YouTube / Vimeo)",
  pdf: "Documento PDF",
  link: "Link / Artigo Web",
  text: "Texto Complementar",
};

/**
 * Unidade de Aprendizagem vinculada a uma Disciplina
 */
export interface LearningUnit {
  id: string;
  tenant_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Agregações opcionais
  subject?: Subject;
  lessons?: Lesson[];
  lessons_count?: number;
}

export interface LearningUnitInput {
  subject_id: string;
  title: string;
  description?: string | null;
  order_index?: number;
  is_published?: boolean;
}

/**
 * Aula Teológica pertencente a uma Unidade de Aprendizagem
 */
export interface Lesson {
  id: string;
  tenant_id: string;
  unit_id: string;
  subject_id: string;
  title: string;
  summary: string | null;
  content_text: string | null;
  duration_minutes: number;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Agregações opcionais
  unit?: LearningUnit;
  materials?: LessonMaterial[];
  materials_count?: number;
}

export interface LessonInput {
  unit_id: string;
  subject_id: string;
  title: string;
  summary?: string | null;
  content_text?: string | null;
  duration_minutes?: number;
  order_index?: number;
  is_published?: boolean;
}

/**
 * Material Didático da Aula
 */
export interface LessonMaterial {
  id: string;
  tenant_id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  url: string | null;
  content_text: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonMaterialInput {
  lesson_id: string;
  title: string;
  description?: string | null;
  material_type: MaterialType;
  url?: string | null;
  content_text?: string | null;
  order_index?: number;
  is_active?: boolean;
}

/**
 * Validação segura de URL de materiais
 */
export function validateMaterialUrl(
  materialType: MaterialType,
  urlStr?: string | null
): { isValid: boolean; error?: string } {
  if (materialType === "text") return { isValid: true };
  if (!urlStr || urlStr.trim().length === 0) {
    return { isValid: false, error: "A URL é obrigatória para este tipo de material." };
  }

  const trimmed = urlStr.trim();

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { isValid: false, error: "Apenas URLs HTTP ou HTTPS são permitidas." };
    }

    if (materialType === "video") {
      const hostname = parsed.hostname.toLowerCase();
      const isAllowedVideoHost =
        hostname.includes("youtube.com") ||
        hostname.includes("youtu.be") ||
        hostname.includes("vimeo.com");

      if (!isAllowedVideoHost) {
        return {
          isValid: false,
          error: "Para vídeos externos, utilize links do YouTube (youtube.com / youtu.be) ou Vimeo (vimeo.com).",
        };
      }
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: "Formato de URL inválido. Ex: https://exemplo.com/documento.pdf" };
  }
}
