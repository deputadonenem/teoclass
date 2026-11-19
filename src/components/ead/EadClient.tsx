"use client";

import React, { useState, useTransition, useMemo } from "react";
import type { Subject, Course } from "@/types/academico";
import type { LearningUnit, Lesson, LessonMaterial, LearningUnitInput, LessonInput, LessonMaterialInput } from "@/types/ead";
import {
  saveLearningUnitAction,
  saveLessonAction,
  saveLessonMaterialAction,
} from "@/app/actions/ead";
import { UnitModal } from "./UnitModal";
import { LessonModal } from "./LessonModal";
import { MaterialModal } from "./MaterialModal";
import {
  BookOpen,
  Layers,
  Video,
  FileText,
  Link as LinkIcon,
  Plus,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  Lock,
  ExternalLink,
  Edit2,
  Eye,
  GraduationCap,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface EadClientProps {
  courses: Course[];
  subjects: Subject[];
  initialUnits: LearningUnit[];
  userRole: string;
  isTeacherAssigned?: boolean;
}

export function EadClient({
  courses,
  subjects,
  initialUnits,
  userRole,
  isTeacherAssigned = false,
}: EadClientProps) {
  // Filtro de seleção de matéria
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    () => (subjects.length > 0 ? subjects[0].id : "")
  );

  const [units, setUnits] = useState<LearningUnit[]>(initialUnits);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(() => {
    for (const u of initialUnits) {
      if (u.lessons && u.lessons.length > 0) return u.lessons[0].id;
    }
    return null;
  });

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(() => {
    const acc: Record<string, boolean> = {};
    initialUnits.forEach((u) => {
      acc[u.id] = true;
    });
    return acc;
  });

  // Modais de Criação/Edição
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<LearningUnit | null>(null);

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [targetUnitIdForLesson, setTargetUnitIdForLesson] = useState<string | undefined>();

  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<LessonMaterial | null>(null);

  const [isPending, startTransition] = useTransition();

  // Pode gerenciar EAD se for Admin, Secretaria ou Professor com atribuição ativa
  const canManage =
    userRole === "admin" ||
    userRole === "secretaria" ||
    (userRole === "professor" && isTeacherAssigned);

  // Disciplina atualmente selecionada
  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  // Lista plana de todas as aulas para navegação sequencial
  const allLessons = useMemo(() => {
    const list: Lesson[] = [];
    units.forEach((u) => {
      (u.lessons || []).forEach((l) => list.push(l));
    });
    return list;
  }, [units]);

  // Aula selecionada
  const activeLesson = useMemo(() => {
    if (!activeLessonId) return allLessons[0] || null;
    return allLessons.find((l) => l.id === activeLessonId) || null;
  }, [allLessons, activeLessonId]);

  // Índices para navegação anterior / próxima aula
  const activeLessonIndex = useMemo(() => {
    if (!activeLesson) return -1;
    return allLessons.findIndex((l) => l.id === activeLesson.id);
  }, [allLessons, activeLesson]);

  const prevLesson = activeLessonIndex > 0 ? allLessons[activeLessonIndex - 1] : null;
  const nextLesson =
    activeLessonIndex >= 0 && activeLessonIndex < allLessons.length - 1
      ? allLessons[activeLessonIndex + 1]
      : null;

  const toggleUnitExpand = (uId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [uId]: !prev[uId] }));
  };

  // Handlers de Salvar
  const handleSaveUnit = async (data: LearningUnitInput, unitId?: string) => {
    const res = await saveLearningUnitAction(data, unitId);
    if (res.success && res.data) {
      if (unitId) {
        setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, ...res.data! } : u)));
      } else {
        setUnits((prev) => [...prev, { ...res.data!, lessons: [] }]);
      }
    }
    return res;
  };

  const handleSaveLesson = async (data: LessonInput, lessonId?: string) => {
    const res = await saveLessonAction(data, lessonId);
    if (res.success && res.data) {
      const savedLesson = res.data;
      setUnits((prev) =>
        prev.map((u) => {
          if (u.id === savedLesson.unit_id) {
            const lessons = u.lessons || [];
            const exists = lessons.some((l) => l.id === savedLesson.id);
            const updatedLessons = exists
              ? lessons.map((l) => (l.id === savedLesson.id ? { ...l, ...savedLesson } : l))
              : [...lessons, { ...savedLesson, materials: [] }];
            return { ...u, lessons: updatedLessons };
          }
          return u;
        })
      );
      setActiveLessonId(savedLesson.id);
    }
    return res;
  };

  const handleSaveMaterial = async (data: LessonMaterialInput, materialId?: string) => {
    const res = await saveLessonMaterialAction(data, materialId);
    if (res.success && res.data) {
      const savedMat = res.data;
      setUnits((prev) =>
        prev.map((u) => ({
          ...u,
          lessons: (u.lessons || []).map((l) => {
            if (l.id === savedMat.lesson_id) {
              const materials = l.materials || [];
              const exists = materials.some((m) => m.id === savedMat.id);
              const updated = exists
                ? materials.map((m) => (m.id === savedMat.id ? savedMat : m))
                : [...materials, savedMat];
              return { ...l, materials: updated };
            }
            return l;
          }),
        }))
      );
    }
    return res;
  };

  // Renderizador de vídeo externo (YouTube ou Vimeo)
  const renderVideoPlayer = (url: string) => {
    let embedUrl: string | null = null;

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      let videoId = "";
      if (url.includes("youtu.be/")) {
        videoId = url.split("youtu.be/")[1]?.split("?")[0] || "";
      } else if (url.includes("watch?v=")) {
        videoId = url.split("watch?v=")[1]?.split("&")[0] || "";
      } else if (url.includes("embed/")) {
        videoId = url.split("embed/")[1]?.split("?")[0] || "";
      }
      if (videoId) embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
    } else if (url.includes("vimeo.com")) {
      const parts = url.split("vimeo.com/");
      const videoId = parts[1]?.split("?")[0] || "";
      if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }

    if (!embedUrl) {
      return (
        <div className="p-4 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center justify-between">
          <span>Vídeo externo disponível em link direto.</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
          >
            Abrir vídeo <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      );
    }

    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 bg-black">
        <iframe
          src={embedUrl}
          title="Videoaula TeoClass"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Topo do Módulo EAD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              EAD Teológico
            </span>
            <h1 className="text-xl font-bold text-slate-900">Sala de Aula & Conteúdos</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Unidades de aprendizagem, videoaulas, textos expositivos e apostilas teológicas
          </p>
        </div>

        {/* Seletor de Disciplina */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-slate-600">Disciplina:</div>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code || "Sem código"})
              </option>
            ))}
          </select>

          {canManage && (
            <button
              onClick={() => {
                setSelectedUnit(null);
                setUnitModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Nova Unidade
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal: Trilha Lateral e Área de Visualização */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo: Trilha Curricular de Unidades e Aulas (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                Estrutura de Aulas
              </h2>
              <span className="text-[11px] font-semibold text-slate-500">
                {allLessons.length} {allLessons.length === 1 ? "aula" : "aulas"}
              </span>
            </div>

            {units.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-700">Nenhuma unidade cadastrada</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {canManage
                    ? "Crie a primeira unidade pedagógica para organizar as aulas."
                    : "A instituição ainda não publicou conteúdos para esta matéria."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[75vh] overflow-y-auto">
                {units.map((unit) => {
                  const isExpanded = expandedUnits[unit.id] ?? true;
                  const unitLessons = unit.lessons || [];

                  return (
                    <div key={unit.id} className="bg-white">
                      {/* Cabeçalho da Unidade */}
                      <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                        <button
                          onClick={() => toggleUnitExpand(unit.id)}
                          className="flex items-center gap-2 text-left flex-1 min-w-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div className="truncate">
                            <h3 className="text-xs font-bold text-slate-800 truncate">
                              {unit.title}
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              {unitLessons.length} {unitLessons.length === 1 ? "aula" : "aulas"}
                              {!unit.is_published && " • Não publicada"}
                            </p>
                          </div>
                        </button>

                        {canManage && (
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => {
                                setTargetUnitIdForLesson(unit.id);
                                setSelectedLesson(null);
                                setLessonModalOpen(true);
                              }}
                              title="Adicionar Aula nesta Unidade"
                              className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUnit(unit);
                                setUnitModalOpen(true);
                              }}
                              title="Editar Unidade"
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Lista de Aulas da Unidade */}
                      {isExpanded && (
                        <div className="bg-slate-50/50 pl-4 pr-2 py-1 space-y-1 border-t border-slate-100">
                          {unitLessons.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic py-2 pl-4">
                              Nenhuma aula nesta unidade.
                            </p>
                          ) : (
                            unitLessons.map((l) => {
                              const isActive = l.id === activeLesson?.id;
                              return (
                                <button
                                  key={l.id}
                                  onClick={() => setActiveLessonId(l.id)}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                    isActive
                                      ? "bg-emerald-600 text-white font-semibold shadow-sm"
                                      : "hover:bg-slate-200/60 text-slate-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <BookOpen
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        isActive ? "text-white" : "text-slate-400"
                                      }`}
                                    />
                                    <span className="truncate">{l.title}</span>
                                  </div>
                                  {!l.is_published && (
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-normal shrink-0 ${
                                        isActive ? "bg-emerald-700 text-emerald-100" : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      Rascunho
                                    </span>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Painel Direito: Exibição da Aula Selecionada e Materiais (8 cols) */}
        <div className="lg:col-span-8">
          {!activeLesson ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h2 className="text-base font-bold text-slate-800">Nenhuma aula selecionada</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Selecione uma lição na trilha lateral ou cadastre uma nova aula na disciplina teológica.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
              {/* Cabeçalho da Aula */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Aula #{activeLesson.order_index}
                    </span>
                    {!activeLesson.is_published && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        Rascunho / Não Publicada
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{activeLesson.title}</h2>
                  {activeLesson.summary && (
                    <p className="text-xs text-slate-600 mt-1">{activeLesson.summary}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canManage && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedMaterial(null);
                          setMaterialModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Material
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLesson(activeLesson);
                          setTargetUnitIdForLesson(activeLesson.unit_id);
                          setLessonModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Editar Aula"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Materiais em Destaque (Vídeos) */}
              {activeLesson.materials &&
                activeLesson.materials
                  .filter((m) => m.material_type === "video" && m.url)
                  .map((videoMat) => (
                    <div key={videoMat.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <Video className="w-4 h-4 text-purple-600" />
                          {videoMat.title}
                        </h4>
                        {videoMat.description && (
                          <span className="text-[11px] text-slate-400">{videoMat.description}</span>
                        )}
                      </div>
                      {renderVideoPlayer(videoMat.url!)}
                    </div>
                  ))}

              {/* Texto Expositivo da Aula */}
              {activeLesson.content_text && (
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Notas Teológicas & Roteiro Expositivo
                  </h3>
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line font-serif">
                    {activeLesson.content_text}
                  </div>
                </div>
              )}

              {/* Materiais Complementares (PDFs, Links e Textos) */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  Materiais Complementares da Aula
                </h3>

                {(!activeLesson.materials || activeLesson.materials.length === 0) ? (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500 text-center">
                    Nenhum material complementar associado a esta lição.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeLesson.materials.map((mat) => (
                      <div
                        key={mat.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-shadow flex items-start justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                            {mat.material_type === "video" && <Video className="w-4 h-4 text-purple-600" />}
                            {mat.material_type === "pdf" && <FileText className="w-4 h-4 text-red-600" />}
                            {mat.material_type === "link" && <LinkIcon className="w-4 h-4 text-blue-600" />}
                            {mat.material_type === "text" && <BookOpen className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-slate-800 truncate">{mat.title}</h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {mat.description || (mat.material_type === "pdf" ? "Documento PDF" : "Link externo")}
                            </p>
                          </div>
                        </div>

                        {mat.url && (
                          <a
                            href={mat.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition-colors shrink-0"
                            title="Acessar material"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Navegação Sequencial Entre Aulas */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                {prevLesson ? (
                  <button
                    onClick={() => setActiveLessonId(prevLesson.id)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    ← Aula Anterior ({prevLesson.title})
                  </button>
                ) : (
                  <div />
                )}

                {nextLesson && (
                  <button
                    onClick={() => setActiveLessonId(nextLesson.id)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    Próxima Aula ({nextLesson.title}) →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modais Integrados */}
      <UnitModal
        isOpen={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        onSave={handleSaveUnit}
        subjectId={selectedSubjectId}
        unit={selectedUnit}
        defaultOrderIndex={units.length + 1}
      />

      <LessonModal
        isOpen={lessonModalOpen}
        onClose={() => setLessonModalOpen(false)}
        onSave={handleSaveLesson}
        units={units}
        subjectId={selectedSubjectId}
        defaultUnitId={targetUnitIdForLesson}
        lesson={selectedLesson}
      />

      {activeLesson && (
        <MaterialModal
          isOpen={materialModalOpen}
          onClose={() => setMaterialModalOpen(false)}
          onSave={handleSaveMaterial}
          lessonId={activeLesson.id}
          material={selectedMaterial}
        />
      )}
    </div>
  );
}
