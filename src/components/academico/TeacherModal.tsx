"use client";

import React, { useState } from "react";
import type { Teacher, TeacherInput } from "@/types/academico";
import { X, Loader2, GraduationCap } from "lucide-react";

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TeacherInput, teacherId?: string) => Promise<{ success: boolean; error?: string }>;
  authUsers: Array<{ id: string; email: string; full_name: string }>;
  teacher?: Teacher | null;
}

export function TeacherModal({
  isOpen,
  onClose,
  onSave,
  authUsers,
  teacher,
}: TeacherModalProps) {
  const [firstName, setFirstName] = useState(() => teacher?.first_name || "");
  const [lastName, setLastName] = useState(() => teacher?.last_name || "");
  const [email, setEmail] = useState(() => teacher?.email || "");
  const [phone, setPhone] = useState(() => teacher?.phone || "");
  const [academicTitle, setAcademicTitle] = useState(() => teacher?.academic_title || "");
  const [theologicalSpecialties, setTheologicalSpecialties] = useState(
    () => teacher?.theological_specialties || ""
  );
  const [bio, setBio] = useState(() => teacher?.bio || "");
  const [userId, setUserId] = useState(() => teacher?.user_id || "");
  const [isActive, setIsActive] = useState(() => (teacher ? teacher.is_active : true));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronização ao abrir/editar
  const [prevId, setPrevId] = useState<string | undefined>(teacher?.id);
  if (teacher?.id !== prevId) {
    setPrevId(teacher?.id);
    setFirstName(teacher?.first_name || "");
    setLastName(teacher?.last_name || "");
    setEmail(teacher?.email || "");
    setPhone(teacher?.phone || "");
    setAcademicTitle(teacher?.academic_title || "");
    setTheologicalSpecialties(teacher?.theological_specialties || "");
    setBio(teacher?.bio || "");
    setUserId(teacher?.user_id || "");
    setIsActive(teacher ? teacher.is_active : true);
    setError(null);
  }

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("O primeiro nome é obrigatório.");
      return;
    }
    if (!lastName.trim()) {
      setError("O sobrenome é obrigatório.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const input: TeacherInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      academic_title: academicTitle.trim() || null,
      theological_specialties: theologicalSpecialties.trim() || null,
      bio: bio.trim() || null,
      user_id: userId || null,
      is_active: isActive,
    };

    const result = await onSave(input, teacher?.id);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao salvar professor.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                {teacher ? "Editar Docente Teológico" : "Novo Docente Teológico"}
              </h3>
              <p className="text-xs text-slate-500">
                Cadastre professores, mestres e preletores da instituição
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Primeiro Nome *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex: Carlos"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Sobrenome *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex: de Oliveira"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="professor@exemplo.com"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Titulação Acadêmica
              </label>
              <input
                type="text"
                value={academicTitle}
                onChange={(e) => setAcademicTitle(e.target.value)}
                placeholder="Ex: Mestre em Teologia, Doutor, Esp."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Conta de Acesso (Vínculo)
              </label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="">Sem conta vinculada (Cadastro avulso)</option>
                {authUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Especialidades Teológicas
            </label>
            <input
              type="text"
              value={theologicalSpecialties}
              onChange={(e) => setTheologicalSpecialties(e.target.value)}
              placeholder="Ex: Teologia Sistemática, Hermenêutica, Grego, História da Igreja"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Breve Biografia / Perfil Ministerial
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Resumo da trajetória pastoral, docente e publicações..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActiveTeacher"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
            />
            <label htmlFor="isActiveTeacher" className="text-sm font-medium text-slate-700 cursor-pointer">
              Docente ativo e disponível para atribuições de turmas e disciplinas
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
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {teacher ? "Salvar Alterações" : "Criar Professor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
