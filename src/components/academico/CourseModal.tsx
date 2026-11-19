"use client";

import React, { useState } from "react";
import type { Course, CourseInput, CourseModality, CourseFormat } from "@/types/academico";
import { MODALITY_LABELS, FORMAT_LABELS } from "@/types/academico";
import { X, Loader2, BookOpen } from "lucide-react";

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CourseInput, courseId?: string) => Promise<{ success: boolean; error?: string }>;
  course?: Course | null;
}

export function CourseModal({ isOpen, onClose, onSave, course }: CourseModalProps) {
  const [name, setName] = useState(() => course?.name || "");
  const [code, setCode] = useState(() => course?.code || "");
  const [description, setDescription] = useState(() => course?.description || "");
  const [modality, setModality] = useState<CourseModality>(() => course?.modality || "presencial");
  const [format, setFormat] = useState<CourseFormat>(() => course?.format || "simples");
  const [workloadHours, setWorkloadHours] = useState(() => course?.workload_hours || 60);
  const [durationMonths, setDurationMonths] = useState<number | "">(() => course?.duration_months ?? "");
  const [isActive, setIsActive] = useState(() => (course ? course.is_active : true));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar campos quando o curso mudar ao abrir/editar
  const [prevCourseId, setPrevCourseId] = useState<string | undefined>(course?.id);
  if (course?.id !== prevCourseId) {
    setPrevCourseId(course?.id);
    setName(course?.name || "");
    setCode(course?.code || "");
    setDescription(course?.description || "");
    setModality(course?.modality || "presencial");
    setFormat(course?.format || "simples");
    setWorkloadHours(course?.workload_hours || 60);
    setDurationMonths(course?.duration_months ?? "");
    setIsActive(course ? course.is_active : true);
    setError(null);
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome do curso teológico é obrigatório.");
      return;
    }
    if (workloadHours <= 0) {
      setError("A carga horária deve ser superior a zero.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: CourseInput = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      modality,
      format,
      workload_hours: Number(workloadHours),
      duration_months: durationMonths === "" ? null : Number(durationMonths),
      is_active: isActive,
    };

    const result = await onSave(input, course?.id);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao salvar curso.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {course ? "Editar Curso Teológico" : "Novo Curso Teológico"}
              </h3>
              <p className="text-xs text-slate-500">
                Bacharel, Médio em Teologia, Seminário, Liderança ou Extensão
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
              Nome do Curso *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Bacharel Livre em Teologia, Teologia Sistemática"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Código / Sigla
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: TEO-101"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Carga Horária (Horas) *
              </label>
              <input
                type="number"
                min="1"
                value={workloadHours}
                onChange={(e) => setWorkloadHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Modalidade *
              </label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as CourseModality)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {Object.entries(MODALITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Estrutura Curricular *
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as CourseFormat)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {Object.entries(FORMAT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Duração Estimada (Meses)
            </label>
            <input
              type="number"
              min="1"
              value={durationMonths}
              onChange={(e) => setDurationMonths(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Ex: 24 meses"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Descrição / Ementa
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Visão geral, pré-requisitos bíblicos e proposta ministerial do curso..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveCourse"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <label htmlFor="isActiveCourse" className="text-sm font-medium text-slate-700 cursor-pointer">
              Curso ativo (disponível para criação de turmas e matrículas)
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {course ? "Salvar Alterações" : "Criar Curso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
