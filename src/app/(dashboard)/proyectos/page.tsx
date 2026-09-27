'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Project, ProjectCard } from '@/features/proyectos/components/ProjectCard';
import { DeleteConfirmModal } from '@/features/proyectos/components/DeleteConfirmModal';
import {
  getProjectsAction,
  deleteProjectAction,
  ProjectRecord,
} from '@/features/proyectos/actions/proyectoActions';
import { useProjectsTour } from '@/hooks/useProjectsTour';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export default function ProyectosPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const copy =
    locale === 'es'
      ? {
          start: '¡Empieza tu nuevo proyecto!',
          empty:
            'Crea tu primer espacio de estudio o trabajo y organiza todas tus tareas de forma sencilla.',
          createFirst: 'Crear mi primer proyecto',
          newProject: 'Nuevo proyecto',
          deleteTitle: '¿Eliminar proyecto?',
          deleteDescription:
            'Esta acción eliminará de forma permanente el proyecto y todas sus tareas asociadas. Esta acción no se puede deshacer.',
          delete: 'Eliminar proyecto',
        }
      : {
          start: 'Start your new project!',
          empty: 'Create your first study or work space and organize all your tasks with ease.',
          createFirst: 'Create my first project',
          newProject: 'New project',
          deleteTitle: 'Delete project?',
          deleteDescription:
            'This will permanently delete the project and all of its associated tasks. This action cannot be undone.',
          delete: 'Delete project',
        };
  const [proyectos, setProyectos] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Registrar el tour contextual
  useProjectsTour(proyectos.length === 0);

  useEffect(() => {
    let isMounted = true;

    const fetchProjects = async () => {
      try {
        const res = await getProjectsAction();
        if (!isMounted) return;

        if (res.success && res.projects) {
          const mapped: Project[] = (res.projects as ProjectRecord[]).map((p) => {
            const tareas = p.tareas || [];
            const tasksCount = tareas.length;
            const completedCount = tareas.filter((t) => t.completado).length;
            const calculatedProgress =
              tasksCount === 0
                ? (p.progreso ?? 0)
                : Math.round((completedCount / tasksCount) * 100);

            return {
              id: p.id,
              name: p.titulo,
              importance: p.prioridad || 'Normal',
              tasksCount,
              progress: calculatedProgress,
              createdAt: p.fecha_limite || new Date().toISOString(),
              fechaLimite: p.fecha_limite,
            };
          });

          setProyectos(mapped);
        } else {
          setProyectos([]);
        }
      } catch (error) {
        console.error('Error cargando proyectos desde Supabase:', error);
        setProyectos([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDeleteClick = (id: string) => {
    const found = proyectos.find((p) => p.id === id);
    if (found) {
      setProjectToDelete(found);
    }
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete || isDeleting) return;
    setIsDeleting(true);

    const id = projectToDelete.id;
    const previous = [...proyectos];
    // Optimistic update
    const updated = proyectos.filter((p) => p.id !== id);
    setProyectos(updated);

    window.dispatchEvent(new Event('projects_updated'));

    try {
      const result = await deleteProjectAction(id);
      if (!result.success) {
        console.error('Error al borrar proyecto en Supabase:', result.error);
        setProyectos(previous);
        window.dispatchEvent(new Event('projects_updated'));
      }
    } catch (error) {
      console.error('Error al invocar deleteProjectAction:', error);
      setProyectos(previous);
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[80vh] items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#E8DCD1] border-t-[#845326] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[80vh] flex-col animate-in fade-in duration-500">
      {proyectos.length === 0 ? (
        /* ============================
           EMPTY STATE
           ============================ */
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative mb-8 flex h-[200px] w-[200px] items-center justify-center overflow-hidden border-4 bg-surface-container-lowest animate-morph-glow">
            <video
              src="/images/mascot/mrChiwiVideo.mp4"
              loop
              muted
              autoPlay
              playsInline
              disablePictureInPicture
              className="h-full w-full object-cover"
            />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-on-surface">{copy.start}</h1>
          <p className="max-w-md text-on-surface-variant">{copy.empty}</p>
          <Link
            href={localizedHref(locale, 'newProject')}
            id="tour-empty-create"
            className="mt-8 flex items-center justify-center gap-2 rounded-full bg-[#f5e5d9] px-6 py-3 text-[15px] font-bold text-[#845326] shadow-sm transition-all hover:-translate-y-[2px] hover:bg-[#E8DCD1] hover:shadow-md active:scale-[0.98]"
          >
            <Plus className="size-5" />
            {copy.createFirst}
          </Link>
        </div>
      ) : (
        /* ============================
           GRID DE PROYECTOS
           ============================ */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
          {/* Tarjetas de Proyectos Creados */}
          {proyectos.map((proyecto, index) => (
            <div key={proyecto.id} id={index === 0 ? 'tour-project-card' : undefined}>
              <ProjectCard
                project={proyecto}
                index={index}
                onDelete={handleDeleteClick}
                locale={locale}
              />
            </div>
          ))}

          {/* Tarjeta de Agregar Proyecto Rápido */}
          <Link
            href={localizedHref(locale, 'newProject')}
            id="tour-project-create"
            className="group flex flex-col items-center justify-center bg-transparent rounded-[20px] border-2 border-dashed border-[#d2c4bb] hover:border-[#845326] hover:bg-[#FDFBF9] transition-all min-h-[250px] cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-[#f5e5d9] group-hover:bg-[#E8DCD1] text-[#845326] flex items-center justify-center mb-4 transition-colors">
              <Plus className="size-6" />
            </div>
            <span className="font-bold text-[#845326] group-hover:text-[#433022] transition-colors">
              {copy.newProject}
            </span>
          </Link>
        </div>
      )}

      {/* Modal de confirmación para eliminar proyecto desde la tarjeta */}
      <DeleteConfirmModal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        onConfirm={confirmDeleteProject}
        title={copy.deleteTitle}
        description={copy.deleteDescription}
        itemName={projectToDelete?.name}
        confirmText={copy.delete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
