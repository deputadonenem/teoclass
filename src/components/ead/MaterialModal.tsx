"use client";

import React, { useState } from "react";
import type { LessonMaterial, LessonMaterialInput, MaterialType } from "@/types/ead";
import { MATERIAL_TYPE_LABELS, validateMaterialUrl } from "@/types/ead";
import { X, Loader2, Paperclip, Video, FileText, Link as LinkIcon } from "lucide-react";

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LessonMaterialInput, materialId?: string) => Promise<{ success: boolean; error?: string }>;
  lessonId: string;
  material?: LessonMaterial | null;
  defaultOrderIndex?: number;
}

export function MaterialModal({
  isOpen,
  onClose,
  onSave,
  lessonId,
  material,
  defaultOrderIndex = 1,
}: MaterialModalProps) {
  const [materialType, setMaterialType] = useState<MaterialType>(
    () => material?.material_type || "video"
  );
  const [title, setTitle] = useState(() => material?.title || "");
  const [description, setDescription] = useState(() => material?.description || "");
  const [url, setUrl] = useState(() => material?.url || "");
  const [contentText, setContentText] = useState(() => material?.content_text || "");
  const [orderIndex, setOrderIndex] = useState(() => material?.order_index ?? defaultOrderIndex);
  const [isActive, setIsActive] = useState(() => material?.is_active ?? true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("O título do material é obrigatório.");
      return;
    }

    if (materialType !== "text") {
      const urlCheck = validateMaterialUrl(materialType, url);
      if (!urlCheck.isValid) {
        setErrorMessage(urlCheck.error || "URL inválida.");
        return;
      }
    } else {
      if (!contentText.trim()) {
        setErrorMessage("O texto do material complementar é obrigatório.");
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload: LessonMaterialInput = {
        lesson_id: lessonId,
        title: title.trim(),
        description: description.trim() || null,
        material_type: materialType,
        url: materialType !== "text" ? url.trim() : null,
        content_text: materialType === "text" ? contentText.trim() : null,
        order_index: Number(orderIndex) || 1,
        is_active: isActive,
      };

      const res = await onSave(payload, material?.id);
      if (!res.success) {
        setErrorMessage(res.error || "Erro ao salvar material didático.");
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {material ? "Editar Material Didático" : "Adicionar Material à Aula"}
              </h2>
              <p className="text-xs text-slate-500">
                Vídeo externo, documento PDF, link ou texto complementar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Recurso <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMaterialType("video")}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  materialType === "video"
                    ? "border-purple-600 bg-purple-50 text-purple-800 font-semibold shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <Video className="w-4 h-4 text-purple-600" />
                Vídeo (YouTube/Vimeo)
              </button>

              <button
                type="button"
                onClick={() => setMaterialType("pdf")}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  materialType === "pdf"
                    ? "border-purple-600 bg-purple-50 text-purple-800 font-semibold shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <FileText className="w-4 h-4 text-red-600" />
                Documento PDF (Link)
              </button>

              <button
                type="button"
                onClick={() => setMaterialType("link")}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  materialType === "link"
                    ? "border-purple-600 bg-purple-50 text-purple-800 font-semibold shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <LinkIcon className="w-4 h-4 text-blue-600" />
                Link / Artigo Web
              </button>

              <button
                type="button"
                onClick={() => setMaterialType("text")}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                  materialType === "text"
                    ? "border-purple-600 bg-purple-50 text-purple-800 font-semibold shadow-sm"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <Paperclip className="w-4 h-4 text-slate-600" />
                Texto Complementar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título do Material <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Videoaula: Hermenêutica de Textos Poéticos"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {materialType !== "text" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                URL do Recurso <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  materialType === "video"
                    ? "https://www.youtube.com/watch?v=... ou https://vimeo.com/..."
                    : "https://seusite.com/apostila.pdf"
                }
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {materialType === "video"
                  ? "Suporta vídeos do YouTube (não-listados ou públicos) e Vimeo."
                  : "Insira a URL pública e segura (HTTPS) para download ou visualização."}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Texto / Nota Expositiva <span className="text-red-500">*</span>
              </label>
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Insira as notas de rodapé, referências bibliográficas ou orientações..."
                rows={4}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição / Orientações ao Aluno (Opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Leitura obrigatória das páginas 15 a 30 antes da aula"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ordem de Exibição
              </label>
              <input
                type="number"
                min={1}
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs font-medium">Material Ativo</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {material ? "Salvar Alterações" : "Adicionar Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
