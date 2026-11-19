"use client";

import React, { useState } from "react";
import { Student, StudentInput, Gender } from "@/types/secretaria";
import { saveStudentAction } from "@/app/actions/secretaria";
import { formatCpf } from "@/lib/utils/cpf";
import { formatPhone } from "@/lib/utils/phone";
import { X, Loader2, Save, User, Church } from "lucide-react";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentToEdit?: Student | null;
}

export function StudentModal({
  isOpen,
  onClose,
  onSuccess,
  studentToEdit,
}: StudentModalProps) {
  const [formData, setFormData] = useState<StudentInput>(() => {
    if (studentToEdit) {
      return {
        first_name: studentToEdit.first_name,
        last_name: studentToEdit.last_name,
        cpf: studentToEdit.cpf,
        rg: studentToEdit.rg,
        rg_issuer: studentToEdit.rg_issuer,
        birth_date: studentToEdit.birth_date,
        gender: studentToEdit.gender,
        email: studentToEdit.email,
        phone: studentToEdit.phone,
        whatsapp: studentToEdit.whatsapp,
        postal_code: studentToEdit.postal_code,
        street: studentToEdit.street,
        number: studentToEdit.number,
        complement: studentToEdit.complement,
        neighborhood: studentToEdit.neighborhood,
        city: studentToEdit.city,
        state: studentToEdit.state,
        church_name: studentToEdit.church_name,
        pastor_name: studentToEdit.pastor_name,
        ministry_role: studentToEdit.ministry_role,
        general_notes: studentToEdit.general_notes,
        is_active: studentToEdit.is_active,
      };
    }
    return {
      first_name: "",
      last_name: "",
      cpf: "",
      rg: "",
      rg_issuer: "",
      birth_date: "",
      gender: "uninformed",
      email: "",
      phone: "",
      whatsapp: "",
      postal_code: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      church_name: "",
      pastor_name: "",
      ministry_role: "",
      general_notes: "",
      is_active: true,
    };
  });

  const [activeTab, setActiveTab] = useState<"dados" | "eclesiastico" | "endereco">("dados");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const res = await saveStudentAction(formData, studentToEdit?.id);

    if (!res.success) {
      setErrorMsg(res.error || "Falha ao salvar dados do aluno.");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {studentToEdit ? "Editar Aluno" : "Novo Cadastro de Aluno"}
              </h2>
              <p className="text-xs text-slate-500">
                Ficha de aluno para seminário e escola teológica
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs de Navegação Interna */}
        <div className="px-6 border-b border-slate-200 flex gap-4 text-xs font-semibold text-slate-500">
          <button
            type="button"
            onClick={() => setActiveTab("dados")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "dados"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent hover:text-slate-700"
            }`}
          >
            Identificação & Contato
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("eclesiastico")}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "eclesiastico"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent hover:text-slate-700"
            }`}
          >
            <Church className="w-3.5 h-3.5" />
            <span>Dados Ministeriais (Opcional)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("endereco")}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === "endereco"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent hover:text-slate-700"
            }`}
          >
            Endereço & Notas
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          {activeTab === "dados" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="Primeiro nome"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sobrenome *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="Sobrenome completo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPF
                  </label>
                  <input
                    type="text"
                    value={formData.cpf || ""}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCpf(e.target.value) })}
                    maxLength={14}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    RG
                  </label>
                  <input
                    type="text"
                    value={formData.rg || ""}
                    onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="Número do documento"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    value={formData.birth_date || ""}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="aluno@exemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.whatsapp || formData.phone || ""}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setFormData({ ...formData, whatsapp: formatted, phone: formatted });
                    }}
                    maxLength={15}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "eclesiastico" && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                As informações ministeriais são <strong>estritamente opcionais</strong> para cadastro no seminário, sem exigência de dados sensíveis ou confissão obrigatória.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Igreja Local ou Congregação
                </label>
                <input
                  type="text"
                  value={formData.church_name || ""}
                  onChange={(e) => setFormData({ ...formData, church_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="Nome da igreja que congrega"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pastor / Líder Responsável
                  </label>
                  <input
                    type="text"
                    value={formData.pastor_name || ""}
                    onChange={(e) => setFormData({ ...formData, pastor_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="Nome do pastor local"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Atuação Ministerial
                  </label>
                  <input
                    type="text"
                    value={formData.ministry_role || ""}
                    onChange={(e) => setFormData({ ...formData, ministry_role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="Ex: Diácono, Líder de Jovens, Membro"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "endereco" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Logradouro / Rua
                  </label>
                  <input
                    type="text"
                    value={formData.street || ""}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="Rua, Avenida, etc."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    value={formData.number || ""}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.city || ""}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado (UF)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.state || ""}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="SP"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code || ""}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    placeholder="00000-000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observações Gerais da Secretaria
                </label>
                <textarea
                  rows={2}
                  value={formData.general_notes || ""}
                  onChange={(e) => setFormData({ ...formData, general_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="Histórico prévio, objetivos com o curso, etc."
                />
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs shadow-indigo-700/20 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{studentToEdit ? "Salvar Alterações" : "Cadastrar Aluno"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
