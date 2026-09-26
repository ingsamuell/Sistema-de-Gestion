'use client';

import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileText,
  FolderKanban,
  FolderOpen,
  Link2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
  Loader2,
  Edit2,
  Trash2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Topic, TopicSource, LinkedProject, SourceStatus } from '@/features/topics/types';
import {
  getTopicsAction,
  createTopicAction,
  updateTopicAction,
  deleteTopicAction,
} from '@/features/topics/actions/topicsActions';
import {
  createNoteSourceAction,
  createLinkSourceAction,
  createFileSourceAction,
  toggleSourceContextAction,
  deleteSourceAction,
} from '@/features/topics/actions/sourcesActions';
import { unlinkProjectAction } from '@/features/topics/actions/projectsActions';
import { TopicModal } from './TopicModal';
import { NoteModal } from './NoteModal';
import { LinkProjectModal } from './LinkProjectModal';
import { useTopicsTour } from '@/hooks/useTopicsTour';

const statusCopy: Record<SourceStatus, { label: string; className: string }> = {
  ready: { label: 'Lista para IA', className: 'bg-status-success-bg text-status-success' },
  processing: { label: 'Procesando', className: 'bg-status-attention-bg text-status-attention' },
  pending: { label: 'Pendiente', className: 'bg-surface-container-high text-on-surface-variant' },
};

export function TopicsWorkspace() {
  const toast = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Modales
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [openSourceMenuId, setOpenSourceMenuId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useTopicsTour(topics.length === 0);

  useEffect(() => {
    let isMounted = true;

    getTopicsAction()
      .then((res) => {
        if (!isMounted) return;
        setLoading(false);
        if (res.success && res.data) {
          setTopics(res.data);
          if (res.data.length > 0) {
            const first = res.data[0];
            setSelectedTopicId(first.id);
            setNote(first.mainNote);
          }
        } else if (res.error) {
          toast.error(res.error);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
        toast.error('Error al conectar con la base de datos');
      });

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? null;
  const filteredTopics = topics.filter((topic) =>
    topic.name.toLowerCase().includes(search.toLowerCase()),
  );
  const activeSourceCount = selectedTopic
    ? selectedTopic.sources.filter((source) => source.enabledForAi).length
    : 0;

  function selectTopic(topic: Topic) {
    setSelectedTopicId(topic.id);
    setNote(topic.mainNote);
    setNoteError(null);
    setIsAddingLink(false);
    setOpenSourceMenuId(null);
  }

  // --- CRUD DE TEMAS ---
  async function handleCreateTopic(title: string, description: string) {
    const res = await createTopicAction({ title, description });
    if (res.success && res.data) {
      const created = res.data;
      setTopics((prev) => [created, ...prev]);
      setSelectedTopicId(created.id);
      setNote(created.mainNote);
      setNoteError(null);
      toast.success('Tema creado con éxito');
    } else {
      throw new Error(res.error || 'No se pudo crear el tema');
    }
  }

  async function handleUpdateTopic(title: string, description: string) {
    if (!selectedTopic) return;
    const res = await updateTopicAction({
      id: selectedTopic.id,
      title,
      description,
    });
    if (res.success && res.data) {
      setTopics((prev) =>
        prev.map((t) =>
          t.id === selectedTopic.id
            ? { ...t, name: title, description, lastEdited: 'Editado ahora' }
            : t,
        ),
      );
      toast.success('Tema actualizado');
    } else {
      throw new Error(res.error || 'No se pudo actualizar');
    }
  }

  async function handleDeleteTopic(topicId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este tema y todas sus fuentes asociadas?')) {
      return;
    }
    const res = await deleteTopicAction(topicId);
    if (res.success) {
      setTopics((prev) => {
        const remaining = prev.filter((t) => t.id !== topicId);
        if (selectedTopicId === topicId) {
          const next = remaining[0] ?? null;
          setSelectedTopicId(next?.id ?? null);
          setNote(next?.mainNote ?? '');
          setNoteError(null);
        }
        return remaining;
      });
      toast.success('Tema eliminado');
    } else {
      toast.error(res.error || 'Error al eliminar tema');
    }
  }

  // --- NOTA PRINCIPAL ---
  async function saveNote() {
    if (!selectedTopic) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await updateTopicAction({
        id: selectedTopic.id,
        mainNote: note,
      });
      if (res.success) {
        setTopics((prev) =>
          prev.map((t) =>
            t.id === selectedTopic.id ? { ...t, mainNote: note, lastEdited: 'Editado ahora' } : t,
          ),
        );
        setNoteError(null);
        toast.success('Nota principal guardada');
      } else {
        const errMsg = res.error || 'Error al guardar la nota';
        setNoteError(errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Ocurrió un error al guardar la nota';
      setNoteError(errMsg);
    } finally {
      setSavingNote(false);
    }
  }

  // --- GESTIÓN DE FUENTES ---
  async function handleCreateNoteSource(title: string, content: string) {
    if (!selectedTopic) return;
    const res = await createNoteSourceAction({
      topicId: selectedTopic.id,
      title,
      content,
    });
    if (res.success && res.data) {
      const newSource = res.data;
      setTopics((prev) =>
        prev.map((t) =>
          t.id === selectedTopic.id
            ? { ...t, sources: [...t.sources, newSource], lastEdited: 'Editado ahora' }
            : t,
        ),
      );
      toast.success('Nota de fuente agregada');
    } else {
      throw new Error(res.error || 'Error al agregar nota');
    }
  }

  async function handleAddLink() {
    if (!selectedTopic) return;
    const cleanUrl = linkValue.trim();
    if (!cleanUrl) return;

    try {
      const res = await createLinkSourceAction({
        topicId: selectedTopic.id,
        title: cleanUrl,
        url: cleanUrl,
      });
      if (res.success && res.data) {
        const newSource = res.data;
        setTopics((prev) =>
          prev.map((t) =>
            t.id === selectedTopic.id
              ? { ...t, sources: [...t.sources, newSource], lastEdited: 'Editado ahora' }
              : t,
          ),
        );
        setLinkValue('');
        setIsAddingLink(false);
        toast.success('Enlace añadido a las fuentes');
      } else {
        toast.error(res.error || 'Error al añadir enlace');
      }
    } catch {
      toast.error('Error al añadir enlace');
    }
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    if (!selectedTopic) return;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadingFile(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        toast.error('Debes iniciar sesión para subir archivos');
        return;
      }

      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${user.id}/${selectedTopic.id}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('topic-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          toast.error(`Error al subir ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { data: publicUrlData } = supabase.storage.from('topic-files').getPublicUrl(filePath);

        const fileExt = file.name.split('.').pop() || 'archivo';

        const res = await createFileSourceAction({
          topicId: selectedTopic.id,
          title: file.name,
          filePath,
          fileUrl: publicUrlData.publicUrl,
          fileSize: file.size,
          fileType: fileExt,
        });

        if (res.success && res.data) {
          const newSource = res.data;
          setTopics((prev) =>
            prev.map((t) =>
              t.id === selectedTopic.id
                ? { ...t, sources: [...t.sources, newSource], lastEdited: 'Editado ahora' }
                : t,
            ),
          );
          toast.success(`Archivo "${file.name}" subido`);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error durante la subida');
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  }

  async function toggleSource(sourceId: string) {
    if (!selectedTopic) return;
    const source = selectedTopic.sources.find((s) => s.id === sourceId);
    if (!source) return;

    // Actualización optimista
    const targetStatus = !source.enabledForAi;
    setTopics((prev) =>
      prev.map((t) =>
        t.id === selectedTopic.id
          ? {
              ...t,
              sources: t.sources.map((s) =>
                s.id === sourceId ? { ...s, enabledForAi: targetStatus } : s,
              ),
            }
          : t,
      ),
    );

    const res = await toggleSourceContextAction(sourceId, source.enabledForAi);
    if (res.success) {
      toast.info(
        targetStatus
          ? `Fuente "${source.title}" incluida en contexto de IA`
          : `Fuente "${source.title}" excluida del contexto`,
      );
    } else {
      // Revertir optimismo
      setTopics((prev) =>
        prev.map((t) =>
          t.id === selectedTopic.id
            ? {
                ...t,
                sources: t.sources.map((s) =>
                  s.id === sourceId ? { ...s, enabledForAi: source.enabledForAi } : s,
                ),
              }
            : t,
        ),
      );
      toast.error(res.error || 'No se pudo actualizar el estado');
    }
  }

  async function handleDeleteSource(sourceId: string) {
    if (!selectedTopic) return;
    const res = await deleteSourceAction(sourceId);
    if (res.success) {
      setTopics((prev) =>
        prev.map((t) =>
          t.id === selectedTopic.id
            ? { ...t, sources: t.sources.filter((s) => s.id !== sourceId) }
            : t,
        ),
      );
      setOpenSourceMenuId(null);
      toast.success('Fuente eliminada');
    } else {
      toast.error(res.error || 'Error al eliminar fuente');
    }
  }

  // --- PROYECTOS VINCULADOS ---
  function handleProjectLinked(project: LinkedProject) {
    if (!selectedTopic) return;
    setTopics((prev) =>
      prev.map((t) => (t.id === selectedTopic.id ? { ...t, projectId: project.id, project } : t)),
    );
    toast.success(`Proyecto "${project.name}" vinculado`);
  }

  async function handleUnlinkProject(projectId: string) {
    if (!selectedTopic) return;
    const res = await unlinkProjectAction(selectedTopic.id, projectId);
    if (res.success) {
      setTopics((prev) =>
        prev.map((t) =>
          t.id === selectedTopic.id ? { ...t, projectId: undefined, project: undefined } : t,
        ),
      );
      toast.info('Proyecto desvinculado');
    } else {
      toast.error(res.error || 'Error al desvincular proyecto');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-primary">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm font-semibold">Cargando biblioteca de temas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden animate-in fade-in duration-500 xl:-mx-4">
      {/* Encabezado */}
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary">
              <BookOpen className="size-4" />
            </span>
            Biblioteca personal
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Temas</h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Reúne notas y fuentes que luego podrás activar como contexto para la IA o vincular a un
            proyecto.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11 shrink-0 gap-2 self-start"
          onClick={() => {
            setIsEditingTopic(false);
            setIsTopicModalOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nuevo tema
        </Button>
      </header>

      {topics.length === 0 ? (
        <div
          id="tour-topics-empty"
          className="rounded-3xl border border-dashed border-outline-variant bg-surface-container-low/40 p-12 text-center"
        >
          <BookOpen className="mx-auto size-12 text-outline mb-4" />
          <h2 className="text-xl font-bold text-on-surface">Tu biblioteca está vacía</h2>
          <p className="mt-2 text-sm text-on-surface-variant max-w-md mx-auto">
            Crea tu primer tema de estudio para organizar tus notas, archivos y fuentes con contexto
            inteligente.
          </p>
          <Button
            size="md"
            className="mt-6 gap-2"
            onClick={() => {
              setIsEditingTopic(false);
              setIsTopicModalOpen(true);
            }}
          >
            <Plus className="size-4" />
            Crear mi primer tema
          </Button>
        </div>
      ) : (
        <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Barra lateral de temas */}
          <aside id="tour-topics-sidebar" className="min-w-0 max-w-full space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-outline" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar temas"
                className="w-full rounded-xl border border-outline-variant/50 bg-surface px-9 py-2.5 text-sm outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div className="grid w-full grid-cols-1 gap-2 xl:block xl:space-y-1.5">
              {filteredTopics.map((topic) => {
                const isSelected = selectedTopic?.id === topic.id;
                const enabled = topic.sources.filter((source) => source.enabledForAi).length;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => selectTopic(topic)}
                    className={cn(
                      'w-full min-w-0 max-w-full rounded-2xl border p-3.5 text-left shadow-sm transition-colors',
                      isSelected
                        ? 'border-primary/40 bg-surface-container-high ring-1 ring-primary/10'
                        : 'border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-sm font-bold">{topic.name}</span>
                      {enabled > 0 && <Sparkles className="size-4 shrink-0 text-accent-amber" />}
                    </div>
                    {topic.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">
                        {topic.description}
                      </p>
                    )}
                    <p className="mt-3 text-[11px] font-medium text-outline">
                      {topic.sources.length} fuentes · {topic.lastEdited}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Área principal del tema seleccionado */}
          {selectedTopic && (
            <section className="min-w-0 max-w-full space-y-5">
              {/* Tarjeta del Tema */}
              <Card className="max-w-full overflow-hidden border-outline-variant/60 p-0 shadow-[0_6px_22px_-8px_rgba(74,53,37,0.2)]">
                <div className="border-b border-outline-variant/30 px-5 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-accent-amber">
                          Tema seleccionado
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingTopic(true);
                              setIsTopicModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container-low transition-colors"
                            title="Editar nombre y descripción"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTopic(selectedTopic.id)}
                            className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error/10 transition-colors"
                            title="Eliminar tema"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <h2 className="mt-1 truncate text-2xl font-bold tracking-tight">
                        {selectedTopic.name}
                      </h2>
                      {selectedTopic.description && (
                        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                          {selectedTopic.description}
                        </p>
                      )}
                      <div className="mt-4 grid grid-cols-3 divide-x divide-outline-variant/60 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
                        <TopicMetric value={selectedTopic.sources.length} label="Fuentes" />
                        <TopicMetric value={activeSourceCount} label="En contexto" />
                        <TopicMetric
                          value={selectedTopic.lastEdited.replace('Editado ', '')}
                          label="Actualizado"
                          compact
                        />
                      </div>
                    </div>
                    <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-status-success-bg px-3 py-1.5 text-xs font-semibold text-status-success self-start">
                      <CheckCircle2 className="size-3.5" />
                      {activeSourceCount} activas
                    </span>
                  </div>
                </div>

                {/* Nota principal y panel de IA */}
                <div
                  id="tour-topics-note"
                  className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_15rem]"
                >
                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold">Nota principal</h3>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Resume lo que quieres conservar de este tema.
                        </p>
                      </div>
                      <FileText className="size-5 text-outline" />
                    </div>

                    {noteError && (
                      <div
                        role="alert"
                        className="mb-3 flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error font-medium animate-in fade-in"
                      >
                        <AlertCircle className="size-4 shrink-0 mt-0.5 text-error" />
                        <div className="flex-1">{noteError}</div>
                      </div>
                    )}

                    <textarea
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value);
                        if (noteError) setNoteError(null);
                      }}
                      placeholder="Escribe una nota para este tema..."
                      rows={7}
                      className={`block w-full max-w-full resize-y rounded-xl border bg-surface p-4 text-sm leading-relaxed shadow-inner outline-none transition-colors placeholder:text-outline ${
                        noteError
                          ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
                          : 'border-outline-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/15'
                      }`}
                    />
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-outline">
                        Los cambios se guardan directamente en tu biblioteca en Supabase.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingNote}
                        className="min-h-10 self-end sm:self-auto gap-1.5"
                        onClick={saveNote}
                      >
                        {savingNote && <Loader2 className="size-3.5 animate-spin" />}
                        {savingNote ? 'Guardando...' : 'Preparar cambios'}
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-outline-variant/30 bg-surface-container-low p-4 lg:border-l lg:border-t-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-primary">
                      <Sparkles className="size-4" />
                      Contexto para IA
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                      La IA solo utilizará las fuentes que actives aquí.
                    </p>
                    <div className="mt-5 rounded-xl border border-primary/10 bg-surface p-3">
                      <p className="text-xs font-semibold">Chat contextual</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
                        {activeSourceCount > 0
                          ? `${activeSourceCount} fuentes listas para alimentar tus consultas de estudio.`
                          : 'Activa al menos una fuente para usarla con el asistente.'}
                      </p>
                      <button
                        type="button"
                        disabled
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-outline"
                      >
                        <ArrowUpRight className="size-3.5" />
                        {activeSourceCount > 0 ? 'Conectado a fuentes' : 'Pendiente de conexión'}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Fuentes */}
              <Card
                id="tour-topics-sources"
                className="max-w-full border-outline-variant/60 p-5 shadow-[0_6px_22px_-8px_rgba(74,53,37,0.16)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Fuentes</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Notas, archivos y enlaces que pertenecen a este tema.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-10 gap-2"
                      onClick={() => setIsNoteModalOpen(true)}
                    >
                      <FileText className="size-3.5" />
                      Escribir nota
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={uploadingFile}
                      className="min-h-10 gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingFile ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      {uploadingFile ? 'Subiendo...' : 'Subir archivo'}
                    </Button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFileSelection}
                  accept=".pdf,.doc,.docx,.txt,.md"
                />

                <div className="mt-5 space-y-2">
                  {selectedTopic.sources.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/40 px-5 py-10 text-center">
                      <FolderOpen className="mx-auto size-7 text-outline" />
                      <p className="mt-3 text-sm font-semibold">Aún no hay fuentes</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Escribe una nota o sube un archivo para comenzar.
                      </p>
                    </div>
                  ) : (
                    selectedTopic.sources.map((source) => (
                      <SourceRow
                        key={source.id}
                        source={source}
                        isMenuOpen={openSourceMenuId === source.id}
                        onToggleMenu={() =>
                          setOpenSourceMenuId((curr) => (curr === source.id ? null : source.id))
                        }
                        onToggle={() => toggleSource(source.id)}
                        onDelete={() => handleDeleteSource(source.id)}
                      />
                    ))
                  )}
                </div>

                {/* Añadir enlace */}
                {isAddingLink ? (
                  <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3">
                    <Link2 className="mt-2 size-4 shrink-0 text-outline" />
                    <input
                      autoFocus
                      value={linkValue}
                      onChange={(event) => setLinkValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleAddLink();
                      }}
                      placeholder="https://..."
                      className="min-w-0 basis-[calc(100%-2rem)] flex-1 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-outline sm:min-w-[12rem] sm:basis-auto"
                    />
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="min-h-10 px-2 text-xs font-bold text-primary hover:text-primary-container"
                    >
                      Añadir
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingLink(false)}
                      className="flex size-10 items-center justify-center text-outline"
                      aria-label="Cancelar"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingLink(true)}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:text-primary-container"
                  >
                    <Link2 className="size-4" />
                    Añadir enlace
                  </button>
                )}
              </Card>

              {/* Proyectos Vinculados */}
              <Card
                id="tour-topics-projects"
                className="max-w-full border-outline-variant/60 p-5 shadow-[0_6px_22px_-8px_rgba(74,53,37,0.16)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Proyectos vinculados</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Los proyectos conectados podrán usar este tema como fuente de contexto.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-10 w-fit gap-2"
                    onClick={() => setIsLinkModalOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Vincular proyecto
                  </Button>
                </div>

                {selectedTopic.project ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ProjectLinkCard
                      project={selectedTopic.project}
                      onUnlink={() => handleUnlinkProject(selectedTopic.project!.id)}
                    />
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/40 px-4 py-6 text-center">
                    <FolderKanban className="mx-auto size-6 text-outline" />
                    <p className="mt-2 text-sm font-semibold">Este tema aún no está vinculado</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Vincúlalo a un proyecto para reutilizar sus fuentes y medir el progreso real.
                    </p>
                  </div>
                )}
              </Card>
            </section>
          )}
        </div>
      )}

      {/* Modales */}
      <TopicModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        onSubmit={isEditingTopic ? handleUpdateTopic : handleCreateTopic}
        initialTitle={isEditingTopic ? selectedTopic?.name : ''}
        initialDescription={isEditingTopic ? selectedTopic?.description : ''}
        isEditing={isEditingTopic}
      />

      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSubmit={handleCreateNoteSource}
      />

      {selectedTopic && (
        <LinkProjectModal
          isOpen={isLinkModalOpen}
          topicId={selectedTopic.id}
          onClose={() => setIsLinkModalOpen(false)}
          onProjectLinked={handleProjectLinked}
          onProjectUnlinked={(pid) => {
            if (selectedTopic.project?.id === pid) {
              setTopics((prev) =>
                prev.map((t) =>
                  t.id === selectedTopic.id
                    ? { ...t, projectId: undefined, project: undefined }
                    : t,
                ),
              );
            }
          }}
        />
      )}
    </div>
  );
}

interface SourceRowProps {
  source: TopicSource;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function SourceRow({ source, isMenuOpen, onToggleMenu, onToggle, onDelete }: SourceRowProps) {
  const status = statusCopy[source.status];

  return (
    <div className="relative flex min-w-0 max-w-full flex-col gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
          {source.kind === 'Enlace' ? (
            <Link2 className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{source.title}</p>
            {source.fileUrl && (
              <a
                href={source.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-outline hover:text-primary transition-colors"
                title="Abrir archivo"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
            {source.kind === 'Enlace' && source.content && (
              <a
                href={source.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-outline hover:text-primary transition-colors"
                title="Abrir enlace"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-on-surface-variant">
            {source.kind} · {source.detail}
          </p>
        </div>
      </div>

      <div className="flex max-w-full flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
        <span
          className={cn('rounded-full px-2.5 py-1.5 text-[11px] font-semibold', status.className)}
        >
          {status.label}
        </span>
        <button
          type="button"
          onClick={onToggle}
          disabled={source.status !== 'ready'}
          className={cn(
            'min-h-10 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            source.enabledForAi
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container-high text-on-surface-variant hover:text-primary',
          )}
        >
          {source.enabledForAi ? 'En contexto' : 'Incluir en IA'}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            className="flex size-10 items-center justify-center rounded-lg text-outline hover:bg-surface-container transition-colors"
            aria-label={`Opciones de ${source.title}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 min-w-[120px] rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-1 shadow-lg">
              <button
                type="button"
                onClick={onDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-error hover:bg-error/10 rounded-lg transition-colors text-left font-medium"
              >
                <Trash2 className="size-3.5" />
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicMetric({
  value,
  label,
  compact = false,
}: {
  value: string | number;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 px-2 py-2.5 text-center first:pl-2 sm:px-3 sm:text-left">
      <p
        className={cn(
          'truncate font-bold text-on-surface',
          compact ? 'text-[11px] sm:text-xs' : 'text-sm sm:text-base',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-outline sm:text-[10px]">
        {label}
      </p>
    </div>
  );
}

function ProjectLinkCard({ project, onUnlink }: { project: LinkedProject; onUnlink: () => void }) {
  return (
    <div className="group relative rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderKanban className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{project.name}</p>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">{project.detail}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onUnlink}
          className="opacity-0 group-hover:opacity-100 p-1 text-outline hover:text-error transition-all rounded"
          title="Desvincular del tema"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-accent-amber transition-all duration-300"
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-on-surface-variant">
          {project.progress}%
          {project.totalMilestones > 0 && (
            <span className="ml-1 text-[10px] text-outline">
              ({project.completedMilestones}/{project.totalMilestones})
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
