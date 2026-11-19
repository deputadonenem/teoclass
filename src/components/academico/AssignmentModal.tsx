"use client";

import React, { useState } from "react";
import type {
  TeachingAssignment,
  TeachingAssignmentInput,
  TeachingRole,
  Teacher,
  SchoolClass,
  Subject,
} from "@/types/academico";
import { TEACHING_ROLE_LABELS } from "@/types/academico";
import { X, Loader2, BookOpenCheck } from "lucide-react";

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: TeachingAssignmentInput,
    assignmentId?: string
  ) => Promise<{ success: boolean; error?: string }>;
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  assignment?: TeachingAssignment | null;
  defaultTeacherId?: string;
}

export function AssignmentModal({
  isOpen,
  onClose,
  onSave,
  teachers,
  classes,
  subjects,
  assignment,
  defaultTeacherId,
}: AssignmentModalProps) {
  const [teacherId, setTeacherId] = useState(
    () => assignment?.teacher_id || defaultTeacherId || (teachers.length > 0 ? teachers[0].id : "")
  );
  const [classId, setClassId] = useState(() => assignment?.class_id || "");
  const [subjectId, setSubjectId] = useState(() => assignment?.subject_id || "");
  const [roleDescription, setRoleDescription] = useState<TeachingRole>(
    () => assignment?.role_description || "titular"
  );
  const [startDate, setStartDate] = useState(() => assignment?.start_date || "");
  const [endDate, setEndDate] = useState(() => assignment?.end_date || "");
  const [notes, setNotes] = useState(() => assignment?.notes || "");
  const [isActive, setIsActive] = useState(() => (assignment ? assignment.is_active : true));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronização ao abrir/editar
  const [prevId, setPrevId] = useState<string | undefined>(assignment?.id);
  if (assignment?.id !== prevId) {
    setPrevId(assignment?.id);
    setTeacherId(assignment?.teacher_id || defaultTeacherId || (teachers.length > 0 ? teachers[0].id : ""));
    setClassId(assignment?.class_id || "");
    setSubjectId(assignment?.subject_id || "");
    setRoleDescription(assignment?.role_description || "titular");
    setStartDate(assignment?.start_date || "");
    setEndDate(assignment?.end_date || "");
    setNotes(assignment?.notes || "");
    setIsActive(assignment ? assignment.is_active : true);
    setError(null);
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) {
      setError("Selecione um professor.");
      return;
    }
    if (!classId && !subjectId) {
      setError("Informe ao menos uma turma ou disciplina para a atribuição.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: TeachingAssignmentInput = {
      teacher_id: teacherId,
      class_id: classId || null,
      subject_id: subjectId || null,
      role_description: roleDescription,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes.trim() || null,
      is_active: isActive,
    };

    const result = await onSave(input, assignment?.id);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao salvar atribuição docente.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {assignment ? "Editar Atribuição Docente" : "Nova Atribuição Docente"}
              </h3>
              <p className="text-xs text-slate-500">
                Vincule o professor à turma, disciplina ou ambas na instituição
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
              Professor(a) *
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm"
              required
            >
              <option value="" disabled>
                Selecione o professor...
              </option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} {t.academic_title ? `(${t.academic_title})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Turma (Opcional)
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm"
              >
                <option value="">Sem turma específica (Atribuição geral)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.shift})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Disciplina (Opcional)
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm"
              >
                <option value="">Sem disciplina específica (Regência geral)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.course?.name || "Curso"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Papel / Função do Docente *
            </label>
            <select
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value as TeachingRole)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm"
            >
              {Object.entries(TEACHING_ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
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
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm"
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
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Observações / Instruções
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Responsável pelo lançamento de notas, módulo intensivo..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveAssignment"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300"
            />
            <label htmlFor="isActiveAssignment" className="text-sm font-medium text-slate-700 cursor-pointer">
              Atribuição vigente e ativa
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {assignment ? "Salvar Alterações" : "Criar Atribuição"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
