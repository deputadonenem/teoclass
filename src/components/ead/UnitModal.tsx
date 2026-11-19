"use client";

import React, { useState } from "react";
import type { LearningUnit, LearningUnitInput } from "@/types/ead";
import { X, Loader2, Layers } from "lucide-react";

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LearningUnitInput, unitId?: string) => Promise<{ success: boolean; error?: string }>;
  subjectId: string;
  unit?: LearningUnit | null;
  defaultOrderIndex?: number;
}

export function UnitModal({
  isOpen,
  onClose,
  onSave,
  subjectId,
  unit,
  defaultOrderIndex = 1,
}: UnitModalProps) {
  const [title, setTitle] = useState(() => unit?.title || "");
  const [description, setDescription] = useState(() => unit?.description || "");
  const [orderIndex, setOrderIndex] = useState(() => unit?.order_index ?? defaultOrderIndex);
  const [isPublished, setIsPublished] = useState(() => unit?.is_published ?? true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("O título da unidade é obrigatório.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: LearningUnitInput = {
        subject_id: subjectId,
        title: title.trim(),
        description: description.trim() || null,
        order_index: Number(orderIndex) || 1,
        is_published: isPublished,
      };

      const res = await onSave(payload, unit?.id);
      if (!res.success) {
        setErrorMessage(res.error || "Erro ao salvar unidade pedagógica.");
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
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {unit ? "Editar Unidade Pedagógica" : "Nova Unidade de Aprendizagem"}
              </h2>
              <p className="text-xs text-slate-500">
                Organize a disciplina teológica em blocos temáticos
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
              Título da Unidade <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Unidade 1 — Bibliologia e Canonicidade"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição / Ementa do Bloco (Opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Apresentação dos objetivos pedagógicos desta unidade..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ordem de Apresentação
              </label>
              <input
                type="number"
                min={1}
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium">Unidade Publicada</span>
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
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {unit ? "Salvar Alterações" : "Criar Unidade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
