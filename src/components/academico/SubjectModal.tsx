"use client";

import React, { useState } from "react";
import type { Subject, SubjectInput, Course, CourseModule } from "@/types/academico";
import { X, Loader2, Bookmark } from "lucide-react";

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SubjectInput, subjectId?: string) => Promise<{ success: boolean; error?: string }>;
  courses: Course[];
  modules: CourseModule[];
  teachers: Array<{ id: string; full_name: string; email?: string | null }>;
  subject?: Subject | null;
  defaultCourseId?: string;
  defaultModuleId?: string;
}

export function SubjectModal({
  isOpen,
  onClose,
  onSave,
  courses,
  modules,
  teachers,
  subject,
  defaultCourseId,
  defaultModuleId,
}: SubjectModalProps) {
  const [courseId, setCourseId] = useState(
    () => subject?.course_id || defaultCourseId || (courses.length > 0 ? courses[0].id : "")
  );
  const [moduleId, setModuleId] = useState(
    () => subject?.module_id || defaultModuleId || ""
  );
  const [name, setName] = useState(() => subject?.name || "");
  const [code, setCode] = useState(() => subject?.code || "");
  const [syllabus, setSyllabus] = useState(() => subject?.syllabus || "");
  const [workloadHours, setWorkloadHours] = useState(() => subject?.workload_hours ?? 40);
  const [orderIndex, setOrderIndex] = useState(() => subject?.order_index ?? 1);
  const [teacherId, setTeacherId] = useState(() => subject?.teacher_id || "");
  const [isActive, setIsActive] = useState(() => (subject ? subject.is_active : true));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrar módulos do curso selecionado
  const courseModules = modules.filter((m) => m.course_id === courseId);

  // Sincronização ao abrir/editar
  const [prevId, setPrevId] = useState<string | undefined>(subject?.id);
  if (subject?.id !== prevId) {
    setPrevId(subject?.id);
    setCourseId(subject?.course_id || defaultCourseId || (courses.length > 0 ? courses[0].id : ""));
    setModuleId(subject?.module_id || defaultModuleId || "");
    setName(subject?.name || "");
    setCode(subject?.code || "");
    setSyllabus(subject?.syllabus || "");
    setWorkloadHours(subject?.workload_hours ?? 40);
    setOrderIndex(subject?.order_index ?? 1);
    setTeacherId(subject?.teacher_id || "");
    setIsActive(subject ? subject.is_active : true);
    setError(null);
  }

  const handleCourseChange = (newCourseId: string) => {
    setCourseId(newCourseId);
    // Se o módulo atual não pertencer ao novo curso, limpa módulo
    const match = modules.find((m) => m.id === moduleId && m.course_id === newCourseId);
    if (!match) {
      setModuleId("");
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome da disciplina é obrigatório.");
      return;
    }
    if (!courseId) {
      setError("Selecione um curso teológico.");
      return;
    }
    if (workloadHours <= 0) {
      setError("A carga horária deve ser maior que zero.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: SubjectInput = {
      course_id: courseId,
      module_id: moduleId || null,
      name: name.trim(),
      code: code.trim() || null,
      syllabus: syllabus.trim() || null,
      workload_hours: Number(workloadHours),
      order_index: Number(orderIndex),
      teacher_id: teacherId || null,
      is_active: isActive,
    };

    const result = await onSave(input, subject?.id);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao salvar disciplina.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {subject ? "Editar Disciplina Teológica" : "Nova Disciplina Teológica"}
              </h3>
              <p className="text-xs text-slate-500">
                Teologia Bíblica, Sistemática, Hermenêutica, Homilética, Grego, etc.
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
              Curso Vinculado *
            </label>
            <select
              value={courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
              required
            >
              <option value="" disabled>
                Selecione o curso...
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Módulo / Bloco (Opcional)
            </label>
            <select
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Sem módulo fixo (Disciplina direta / Curso simples)</option>
              {courseModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Nome da Disciplina *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Teologia Sistemática I: Bibliologia e Teologia Própria"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
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
                placeholder="Ex: TEO-SYS-101"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
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
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Ordem / Sequência *
              </label>
              <input
                type="number"
                min="1"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Professor Titular Responsável
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">A definir / Sem professor fixo</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ementa Teológica / Bibliografia Recomendada
            </label>
            <textarea
              rows={3}
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              placeholder="Objetivos formativos, temas abordados e autores de referência..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveSubject"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <label htmlFor="isActiveSubject" className="text-sm font-medium text-slate-700 cursor-pointer">
              Disciplina ativa na grade curricular do curso
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {subject ? "Salvar Alterações" : "Criar Disciplina"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
