"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Student } from "@/types/secretaria";
import { StudentModal } from "./StudentModal";
import { toggleStudentStatusAction } from "@/app/actions/secretaria";
import {
  Users,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Eye,
  Church,
} from "lucide-react";

interface SecretariaClientProps {
  initialStudents: Student[];
  tenantName: string;
}

export function SecretariaClient({
  initialStudents,
  tenantName,
}: SecretariaClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  const filteredStudents = initialStudents.filter((s) => {
    const matchesStatus =
      statusFilter === "all" ? true : statusFilter === "active" ? s.is_active : !s.is_active;

    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      s.full_name?.toLowerCase().includes(term) ||
      s.cpf?.toLowerCase().includes(term) ||
      s.email?.toLowerCase().includes(term) ||
      s.church_name?.toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  async function handleToggleStatus(id: string, currentStatus: boolean) {
    if (confirm(`Deseja ${currentStatus ? "desativar" : "ativar"} este aluno?`)) {
      const res = await toggleStudentStatusAction(id, !currentStatus);
      if (res.success) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        alert(res.error || "Falha ao alterar status.");
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Secretaria & Alunos</h1>
            <p className="text-xs text-slate-500">
              Gestão de cadastros e registros acadêmicos de <strong className="text-slate-700">{tenantName}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setStudentToEdit(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-600 rounded-xl shadow-xs shadow-indigo-700/20 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          + Novo Aluno
        </button>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF ou igreja..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Todos ({initialStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "active"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Ativos ({initialStudents.filter((s) => s.is_active).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Inativos ({initialStudents.filter((s) => !s.is_active).length})
          </button>
        </div>
      </div>

      {/* Listagem de Alunos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Nenhum aluno encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm
                ? "Não foram encontrados alunos correspondentes ao termo pesquisado."
                : "Ainda não há alunos cadastrados nesta instituição teológica."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Aluno</th>
                  <th className="py-3.5 px-4">Documentos / Contato</th>
                  <th className="py-3.5 px-4">Igreja Local</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {student.first_name[0]}
                          {student.last_name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{student.full_name}</div>
                          <div className="text-[11px] text-slate-400">
                            Cadastrado em {new Date(student.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-700 font-mono text-[11px]">
                        {student.cpf || "Sem CPF informado"}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {student.email || student.whatsapp || student.phone || "Sem contato"}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {student.church_name ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Church className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate max-w-[180px]">{student.church_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Não informada</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(student.id, student.is_active)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          student.is_active
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                        title="Clique para alternar status"
                      >
                        {student.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Ativo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Inativo</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingStudent(student)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Visualizar ficha"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStudentToEdit(student);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar aluno"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <StudentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
          studentToEdit={studentToEdit}
        />
      )}

      {/* Modal de Ficha Resumida */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewingStudent.full_name}</h3>
                <p className="text-xs text-slate-500">Ficha cadastral do aluno</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">CPF:</span>
                  <span className="font-semibold text-slate-800">{viewingStudent.cpf || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">RG:</span>
                  <span className="font-semibold text-slate-800">{viewingStudent.rg || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">E-mail:</span>
                  <span className="font-semibold text-slate-800">{viewingStudent.email || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Telefone/WhatsApp:</span>
                  <span className="font-semibold text-slate-800">{viewingStudent.whatsapp || viewingStudent.phone || "N/A"}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2 space-y-1">
                <span className="text-slate-400 block text-[10px]">Igreja / Congregação:</span>
                <span className="font-semibold text-indigo-700 block">{viewingStudent.church_name || "Não informada"}</span>
                {viewingStudent.pastor_name && (
                  <p className="text-[11px] text-slate-500">Pastor: {viewingStudent.pastor_name}</p>
                )}
                {viewingStudent.ministry_role && (
                  <p className="text-[11px] text-slate-500">Atuação: {viewingStudent.ministry_role}</p>
                )}
              </div>

              {viewingStudent.general_notes && (
                <div className="border-t border-slate-100 pt-2">
                  <span className="text-slate-400 block text-[10px]">Observações:</span>
                  <p className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg">
                    {viewingStudent.general_notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
