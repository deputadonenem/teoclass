"use client";

import React, { useState } from "react";
import type { Assessment, AssessmentInput } from "@/types/provas";
import type { Subject, SchoolClass } from "@/types/academico";
import { X, Loader2, Award, Calendar } from "lucide-react";

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AssessmentInput, assessmentId?: string) => Promise<{ success: boolean; error?: string }>;
  subjects: Subject[];
  classes: SchoolClass[];
  defaultSubjectId?: string;
  assessment?: Assessment | null;
}

export function AssessmentModal({
  isOpen,
  onClose,
  onSave,
  subjects,
  classes,
  defaultSubjectId,
  assessment,
}: AssessmentModalProps) {
  const [subjectId, setSubjectId] = useState(
    () => assessment?.subject_id || defaultSubjectId || (subjects.length > 0 ? subjects[0].id : "")
  );
  const [classId, setClassId] = useState(() => assessment?.class_id || "");
  const [title, setTitle] = useState(() => assessment?.title || "");
  const [description, setDescription] = useState(() => assessment?.description || "");
  const [questionsCount, setQuestionsCount] = useState(() => assessment?.questions_count ?? 10);
  const [durationMinutes, setDurationMinutes] = useState(() => assessment?.duration_minutes ?? 60);
  const [maxAttempts, setMaxAttempts] = useState(() => assessment?.max_attempts ?? 2);
  const [passingGrade, setPassingGrade] = useState(() => assessment?.passing_grade ?? 7.0);
  const [shuffleQuestions, setShuffleQuestions] = useState(() => assessment?.shuffle_questions ?? true);
  const [shuffleOptions, setShuffleOptions] = useState(() => assessment?.shuffle_options ?? true);
  const [releaseAnswerKey, setReleaseAnswerKey] = useState(() => assessment?.release_answer_key ?? true);
  const [startDate, setStartDate] = useState(() =>
    assessment?.start_date ? assessment.start_date.substring(0, 16) : ""
  );
  const [endDate, setEndDate] = useState(() =>
    assessment?.end_date ? assessment.end_date.substring(0, 16) : ""
  );
  const [isActive, setIsActive] = useState(() => assessment?.is_active ?? true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtra turmas do mesmo curso da disciplina selecionada
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const availableClasses = classes.filter(
    (c) => !selectedSubject || c.course_id === selectedSubject.course_id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("O título da avaliação é obrigatório.");
      return;
    }
    if (!subjectId) {
      setErrorMessage("Selecione a disciplina vinculada à avaliação.");
      return;
    }
    if (questionsCount <= 0) {
      setErrorMessage("A quantidade de questões deve ser superior a zero.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: AssessmentInput = {
        subject_id: subjectId,
        class_id: classId || null,
        title: title.trim(),
        description: description.trim() || null,
        questions_count: Number(questionsCount),
        duration_minutes: Number(durationMinutes),
        max_attempts: Number(maxAttempts) || 1,
        passing_grade: Number(passingGrade) || 7.0,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        release_answer_key: releaseAnswerKey,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        is_active: isActive,
      };

      const res = await onSave(payload, assessment?.id);
      if (!res.success) {
        setErrorMessage(res.error || "Erro ao salvar avaliação.");
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
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {assessment ? "Configurar Avaliação" : "Nova Avaliação EAD"}
              </h2>
              <p className="text-xs text-slate-500">
                Parâmetros de sorteio, tempo e critérios de aprovação
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Disciplina <span className="text-red-500">*</span>
              </label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setClassId("");
                }}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || "Sem cód."})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Turma Específica (Opcional)
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Todas as turmas do curso</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Título da Avaliação <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Prova Regular 1 — Bibliologia e Teontologia"
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instruções para o Aluno
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Orientações sobre tempo, consulta permitida e tentativas..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Configurações de Regra da Prova */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Qtd. Questões
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={questionsCount}
                onChange={(e) => setQuestionsCount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Duração (min)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Max. Tentativas
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Média Mínima
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={10}
                value={passingGrade}
                onChange={(e) => setPassingGrade(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* Vigência */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Disponível a partir de
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Disponível até
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Opções de Embaralhamento e Gabarito */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium">Embaralhar ordem das questões a cada tentativa</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium">Embaralhar alternativas de múltipla escolha</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={releaseAnswerKey}
                onChange={(e) => setReleaseAnswerKey(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium">Liberar gabarito e comentários após submissão da prova</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium">Avaliação Ativa</span>
            </label>
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
              {assessment ? "Salvar Alterações" : "Criar Avaliação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
