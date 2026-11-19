"use client";

import React, { useState } from "react";
import type { Lesson, LessonInput, LearningUnit } from "@/types/ead";
import { X, Loader2, BookOpen } from "lucide-react";

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LessonInput, lessonId?: string) => Promise<{ success: boolean; error?: string }>;
  units: LearningUnit[];
  subjectId: string;
  defaultUnitId?: string;
  lesson?: Lesson | null;
  defaultOrderIndex?: number;
}

export function LessonModal({
  isOpen,
  onClose,
  onSave,
  units,
  subjectId,
  defaultUnitId,
  lesson,
  defaultOrderIndex = 1,
}: LessonModalProps) {
  const [unitId, setUnitId] = useState(
    () => lesson?.unit_id || defaultUnitId || (units.length > 0 ? units[0].id : "")
  );
  const [title, setTitle] = useState(() => lesson?.title || "");
  const [summary, setSummary] = useState(() => lesson?.summary || "");
  const [contentText, setContentText] = useState(() => lesson?.content_text || "");
  const [durationMinutes, setDurationMinutes] = useState(() => lesson?.duration_minutes ?? 45);
  const [orderIndex, setOrderIndex] = useState(() => lesson?.order_index ?? defaultOrderIndex);
  const [isPublished, setIsPublished] = useState(() => lesson?.is_published ?? true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("O título da aula é obrigatório.");
      return;
    }
    if (!unitId) {
      setErrorMessage("Selecione uma unidade pedagógica.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: LessonInput = {
        unit_id: unitId,
        subject_id: subjectId,
        title: title.trim(),
        summary: summary.trim() || null,
        content_text: contentText.trim() || null,
        duration_minutes: Number(durationMinutes) || 0,
        order_index: Number(orderIndex) || 1,
        is_published: isPublished,
      };

      const res = await onSave(payload, lesson?.id);
      if (!res.success) {
        setErrorMessage(res.error || "Erro ao salvar aula.");
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
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {lesson ? "Editar Aula Teológica" : "Nova Aula EAD"}
              </h2>
              <p className="text-xs text-slate-500">
                Conteúdo expositivo e estrutura pedagógica da aula
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unidade Pedagógica <span className="text-red-500">*</span>
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título da Aula <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aula 1 — Origem e Transmissão dos Manuscritos Bíblicos"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Resumo / Sinopse
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Breve introdução aos tópicos abordados nesta lição..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Texto Expositivo da Aula (Notas Teológicas)
            </label>
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Texto completo ou roteiro pedagógico da lição teológica..."
              rows={5}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duração (min)
              </label>
              <input
                type="number"
                min={0}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ordem na Unidade
              </label>
              <input
                type="number"
                min={1}
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium">Publicada</span>
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
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {lesson ? "Salvar Alterações" : "Criar Aula"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
