"use client";

import React, { useState } from "react";
import type { CourseModule, CourseModuleInput, Course } from "@/types/academico";
import { X, Loader2, Layers } from "lucide-react";

interface ModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CourseModuleInput, moduleId?: string) => Promise<{ success: boolean; error?: string }>;
  courses: Course[];
  module?: CourseModule | null;
  defaultCourseId?: string;
}

export function ModuleModal({
  isOpen,
  onClose,
  onSave,
  courses,
  module,
  defaultCourseId,
}: ModuleModalProps) {
  const [courseId, setCourseId] = useState(
    () => module?.course_id || defaultCourseId || (courses.length > 0 ? courses[0].id : "")
  );
  const [name, setName] = useState(() => module?.name || "");
  const [description, setDescription] = useState(() => module?.description || "");
  const [orderIndex, setOrderIndex] = useState(() => module?.order_index ?? 1);
  const [isActive, setIsActive] = useState(() => (module ? module.is_active : true));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronização ao abrir/editar
  const [prevId, setPrevId] = useState<string | undefined>(module?.id);
  if (module?.id !== prevId) {
    setPrevId(module?.id);
    setCourseId(module?.course_id || defaultCourseId || (courses.length > 0 ? courses[0].id : ""));
    setName(module?.name || "");
    setDescription(module?.description || "");
    setOrderIndex(module?.order_index ?? 1);
    setIsActive(module ? module.is_active : true);
    setError(null);
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome do módulo é obrigatório.");
      return;
    }
    if (!courseId) {
      setError("Selecione um curso teológico.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: CourseModuleInput = {
      course_id: courseId,
      name: name.trim(),
      description: description.trim() || null,
      order_index: Number(orderIndex),
      is_active: isActive,
    };

    const result = await onSave(input, module?.id);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao salvar módulo curricular.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {module ? "Editar Módulo / Bloco" : "Novo Módulo / Período"}
              </h3>
              <p className="text-xs text-slate-500">
                Ex: Módulo Básico, Teologia Sistemática, 1º Semestre
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Curso Teológico *
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
              required
            >
              <option value="" disabled>
                Selecione o curso...
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.format})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Nome do Módulo / Bloco *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Módulo I: Fundamentos Bíblicos e Históricos"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ordem de Exibição / Sequência *
            </label>
            <input
              type="number"
              min="1"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Descrição do Módulo
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivos do bloco temático ou período formativo..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveModule"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
            />
            <label htmlFor="isActiveModule" className="text-sm font-medium text-slate-700 cursor-pointer">
              Módulo ativo e visível na grade do curso
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {module ? "Salvar Alterações" : "Criar Módulo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
