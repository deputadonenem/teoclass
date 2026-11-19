"use client";

import React, { useState } from "react";
import type { SchoolClass, ClassInput, Course, ClassShift, ClassStatus } from "@/types/academico";
import { SHIFT_LABELS, CLASS_STATUS_LABELS } from "@/types/academico";
import { X, Loader2, Users } from "lucide-react";

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ClassInput, classId?: string) => Promise<{ success: boolean; error?: string }>;
  courses: Course[];
  schoolClass?: SchoolClass | null;
  defaultCourseId?: string;
}

export function ClassModal({
  isOpen,
  onClose,
  onSave,
  courses,
  schoolClass,
  defaultCourseId,
}: ClassModalProps) {
  const [courseId, setCourseId] = useState(
    () => schoolClass?.course_id || defaultCourseId || (courses.length > 0 ? courses[0].id : "")
  );
  const [name, setName] = useState(() => schoolClass?.name || "");
  const [code, setCode] = useState(() => schoolClass?.code || "");
  const [periodLabel, setPeriodLabel] = useState(() => schoolClass?.period_label || "");
  const [shift, setShift] = useState<ClassShift>(() => schoolClass?.shift || "noturno");
  const [status, setStatus] = useState<ClassStatus>(() => schoolClass?.status || "prevista");
  const [capacity, setCapacity] = useState(() => schoolClass?.capacity ?? 40);
  const [startDate, setStartDate] = useState(() => schoolClass?.start_date || "");
  const [endDate, setEndDate] = useState(() => schoolClass?.end_date || "");
  const [isActive, setIsActive] = useState(() => (schoolClass ? schoolClass.is_active : true));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar campos quando schoolClass mudar
  const [prevClassId, setPrevClassId] = useState<string | undefined>(schoolClass?.id);
  if (schoolClass?.id !== prevClassId) {
    setPrevClassId(schoolClass?.id);
    setCourseId(schoolClass?.course_id || defaultCourseId || (courses.length > 0 ? courses[0].id : ""));
    setName(schoolClass?.name || "");
    setCode(schoolClass?.code || "");
    setPeriodLabel(schoolClass?.period_label || "");
    setShift(schoolClass?.shift || "noturno");
    setStatus(schoolClass?.status || "prevista");
    setCapacity(schoolClass?.capacity ?? 40);
    setStartDate(schoolClass?.start_date || "");
    setEndDate(schoolClass?.end_date || "");
    setIsActive(schoolClass ? schoolClass.is_active : true);
    setError(null);
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome da turma é obrigatório.");
      return;
    }
    if (!courseId) {
      setError("Selecione um curso teológico para a turma.");
      return;
    }
    if (capacity < 0) {
      setError("A capacidade não pode ser negativa.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: ClassInput = {
      course_id: courseId,
      name: name.trim(),
      code: code.trim() || null,
      period_label: periodLabel.trim() || null,
      shift,
      status,
      capacity: Number(capacity),
      start_date: startDate || null,
      end_date: endDate || null,
      is_active: isActive,
    };

    const result = await onSave(input, schoolClass?.id);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao salvar turma.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {schoolClass ? "Editar Turma Teológica" : "Nova Turma Teológica"}
              </h3>
              <p className="text-xs text-slate-500">Defina o curso, período, turno e vagas</p>
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
              Curso Vinculado *
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
              required
            >
              <option value="" disabled>
                Selecione o curso teológico...
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.modality})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Nome da Turma *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Turma Alpha - Noite, Intensivo 2026"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Período / Semestre
              </label>
              <input
                type="text"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Ex: 2026/1, Módulo I"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Turno / Regime *
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as ClassShift)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
              >
                {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Situação da Turma *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ClassStatus)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
              >
                {Object.entries(CLASS_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Capacidade Máxima (Vagas) *
              </label>
              <input
                type="number"
                min="0"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Data de Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Data de Término
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveClass"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
            />
            <label htmlFor="isActiveClass" className="text-sm font-medium text-slate-700 cursor-pointer">
              Turma ativa e visível para matrículas
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {schoolClass ? "Salvar Alterações" : "Criar Turma"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
