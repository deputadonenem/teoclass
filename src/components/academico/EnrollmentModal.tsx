"use client";

import React, { useState, useMemo } from "react";
import type { EnrollmentInput, Course, SchoolClass } from "@/types/academico";
import type { Student } from "@/types/secretaria";
import { X, Loader2, UserCheck, AlertTriangle } from "lucide-react";

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EnrollmentInput) => Promise<{ success: boolean; error?: string }>;
  students: Student[];
  courses: Course[];
  classes: SchoolClass[];
}

export function EnrollmentModal({
  isOpen,
  onClose,
  onSave,
  students,
  courses,
  classes,
}: EnrollmentModalProps) {
  const [studentId, setStudentId] = useState(() => (students.length > 0 ? students[0].id : ""));
  const [courseId, setCourseId] = useState(() => (courses.length > 0 ? courses[0].id : ""));
  const [classId, setClassId] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrar turmas que pertencem ao curso selecionado
  const availableClasses = useMemo(() => {
    if (!courseId) return [];
    return classes.filter((c) => c.course_id === courseId && c.is_active);
  }, [courseId, classes]);

  // Verificar capacidade da turma selecionada
  const selectedClass = useMemo(() => {
    if (!classId) return null;
    return classes.find((c) => c.id === classId);
  }, [classId, classes]);

  const isClassFull = useMemo(() => {
    if (!selectedClass) return false;
    return (
      selectedClass.capacity > 0 &&
      (selectedClass.enrolled_count ?? 0) >= selectedClass.capacity
    );
  }, [selectedClass]);

  const handleCourseChange = (newCourseId: string) => {
    setCourseId(newCourseId);
    // Se a turma selecionada não pertencer ao novo curso, limpa seleção
    const match = classes.find((c) => c.id === classId && c.course_id === newCourseId);
    if (!match) {
      setClassId("");
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError("Selecione um aluno.");
      return;
    }
    if (!courseId) {
      setError("Selecione um curso teológico.");
      return;
    }
    if (isClassFull) {
      setError("A turma selecionada está com a capacidade máxima preenchida.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: EnrollmentInput = {
      student_id: studentId,
      course_id: courseId,
      class_id: classId || null,
      enrollment_number: enrollmentNumber.trim() || undefined,
      notes: notes.trim() || null,
    };

    const result = await onSave(input);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao efetuar matrícula.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Nova Matrícula Teológica</h3>
              <p className="text-xs text-slate-500">
                Vincule o aluno ao curso e turma respeitando limites e regras
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
              Aluno(a) *
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
              required
            >
              <option value="" disabled>
                Selecione o aluno cadastrado...
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} {s.cpf ? `(CPF: ${s.cpf})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Curso Teológico *
            </label>
            <select
              value={courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
              required
            >
              <option value="" disabled>
                Selecione o curso...
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
              Turma (Opcional para EAD ou ritmo próprio)
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="">Sem turma vinculada (Avulso / Ritmo Próprio)</option>
              {availableClasses.map((cl) => {
                const count = cl.enrolled_count ?? 0;
                const full = cl.capacity > 0 && count >= cl.capacity;
                return (
                  <option key={cl.id} value={cl.id} disabled={full}>
                    {cl.name} ({cl.shift}) — {count}/{cl.capacity} alunos {full ? "[LOTADA]" : ""}
                  </option>
                );
              })}
            </select>

            {isClassFull && (
              <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Esta turma atingiu a capacidade máxima. Selecione outra turma ou aumente as vagas.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Código / Matrícula (Opcional - Gerado automaticamente se vazio)
            </label>
            <input
              type="text"
              value={enrollmentNumber}
              onChange={(e) => setEnrollmentNumber(e.target.value)}
              placeholder="Ex: MAT-2026-001"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Observações da Matrícula
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bolsa pastoral, convênio de igreja local, dispensa de disciplina..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
            />
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
              disabled={submitting || isClassFull}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Efetivar Matrícula
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
