"use client";

import React, { useState } from "react";
import type { AssessmentQuestion, AssessmentQuestionInput, QuestionType, QuestionOptionInput } from "@/types/provas";
import { QUESTION_TYPE_LABELS } from "@/types/provas";
import { X, Loader2, HelpCircle, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AssessmentQuestionInput, questionId?: string) => Promise<{ success: boolean; error?: string }>;
  subjectId: string;
  question?: AssessmentQuestion | null;
}

export function QuestionModal({
  isOpen,
  onClose,
  onSave,
  subjectId,
  question,
}: QuestionModalProps) {
  const [questionType, setQuestionType] = useState<QuestionType>(
    () => question?.question_type || "multipla_escolha"
  );
  const [prompt, setPrompt] = useState(() => question?.prompt || "");
  const [explanation, setExplanation] = useState(() => question?.explanation || "");
  const [points, setPoints] = useState(() => question?.points ?? 1.0);
  const [isActive, setIsActive] = useState(() => question?.is_active ?? true);

  const [options, setOptions] = useState<QuestionOptionInput[]>(() => {
    if (question?.options && question.options.length > 0) {
      return question.options.map((o) => ({
        id: o.id,
        option_text: o.option_text,
        is_correct: Boolean(o.is_correct),
        order_index: o.order_index,
      }));
    }
    return [
      { option_text: "", is_correct: true, order_index: 1 },
      { option_text: "", is_correct: false, order_index: 2 },
      { option_text: "", is_correct: false, order_index: 3 },
      { option_text: "", is_correct: false, order_index: 4 },
    ];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTypeChange = (newType: QuestionType) => {
    setQuestionType(newType);
    if (newType === "verdadeiro_falso") {
      setOptions([
        { option_text: "Verdadeiro", is_correct: true, order_index: 1 },
        { option_text: "Falso", is_correct: false, order_index: 2 },
      ]);
    } else if (options.length === 2 && options[0].option_text === "Verdadeiro") {
      setOptions([
        { option_text: "", is_correct: true, order_index: 1 },
        { option_text: "", is_correct: false, order_index: 2 },
        { option_text: "", is_correct: false, order_index: 3 },
        { option_text: "", is_correct: false, order_index: 4 },
      ]);
    }
  };

  const handleSetCorrect = (index: number) => {
    setOptions((prev) =>
      prev.map((opt, i) => ({
        ...opt,
        is_correct: i === index,
      }))
    );
  };

  const handleOptionTextChange = (index: number, text: string) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, option_text: text } : opt))
    );
  };

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [
      ...prev,
      { option_text: "", is_correct: false, order_index: prev.length + 1 },
    ]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const removedWasCorrect = options[index].is_correct;
    const newOptions = options.filter((_, i) => i !== index);
    if (removedWasCorrect && newOptions.length > 0) {
      newOptions[0].is_correct = true;
    }
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!prompt.trim()) {
      setErrorMessage("O enunciado da questão é obrigatório.");
      return;
    }

    const emptyOpt = options.some((o) => !o.option_text.trim());
    if (emptyOpt) {
      setErrorMessage("Preencha o texto de todas as alternativas cadastradas.");
      return;
    }

    const correctCount = options.filter((o) => o.is_correct).length;
    if (correctCount === 0) {
      setErrorMessage("Selecione qual alternativa representa o gabarito correto.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: AssessmentQuestionInput = {
        subject_id: subjectId,
        question_type: questionType,
        prompt: prompt.trim(),
        explanation: explanation.trim() || null,
        points: Number(points) || 1.0,
        is_active: isActive,
        options,
      };

      const res = await onSave(payload, question?.id);
      if (!res.success) {
        setErrorMessage(res.error || "Erro ao salvar questão.");
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
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {question ? "Editar Questão Teológica" : "Nova Questão no Banco"}
              </h2>
              <p className="text-xs text-slate-500">
                Enunciado, alternativas e gabarito protegido
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
                Tipo de Questão
              </label>
              <select
                value={questionType}
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="multipla_escolha">Múltipla Escolha</option>
                <option value="verdadeiro_falso">Verdadeiro ou Falso</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pontuação Base
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Enunciado da Questão <span className="text-red-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: De acordo com a Teologia Sistemática Reformada, qual o conceito bíblico de Justificação pela Fé?"
              rows={3}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-serif"
            />
          </div>

          {/* Alternativas */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Alternativas (Selecione o Gabarito Correto)
              </label>
              {questionType === "multipla_escolha" && options.length < 6 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Alternativa
                </button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                    opt.is_correct
                      ? "border-emerald-500 bg-emerald-50/50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSetCorrect(idx)}
                    title={opt.is_correct ? "Gabarito Correto" : "Marcar como correta"}
                    className={`p-1.5 rounded-full transition-colors ${
                      opt.is_correct
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={opt.option_text}
                    onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    placeholder={`Texto da alternativa ${String.fromCharCode(65 + idx)}...`}
                    required
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />

                  {questionType === "multipla_escolha" && options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Comentário Exegético / Justificativa (Opcional)
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explicação teológica exibida ao aluno após a liberação do gabarito..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
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
              {question ? "Salvar Alterações" : "Cadastrar Questão"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
