import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, Calendar } from 'lucide-react';
import type { Locale } from '@/lib/i18n/locale';
import { localizedProjectHref } from '@/lib/i18n/routes';

export interface Project {
  id: string;
  name: string;
  importance: string;
  tasksCount: number;
  progress: number;
  createdAt: string;
  fechaLimite?: string | null;
}

interface ProjectCardProps {
  project: Project;
  index: number;
  onDelete?: (id: string) => void;
  locale: Locale;
}

const GRADIENTS = [
  'linear-gradient(135deg, #E8B4B8 0%, #F7D6BF 100%)',
  'linear-gradient(135deg, #C8D6AF 0%, #E8B4B8 100%)',
  'linear-gradient(135deg, #D8C4E0 0%, #C8D6AF 100%)',
];

const CHIGUI_IMAGES = [
  'chigui-celebrate.png',
  'chigui-focus.png',
  'chigui-idle.png',
  'chigui-rest.png',
  'chigui-welcome.png',
  'imagendechiwiconcafe.png',
];

export function ProjectCard({ project, index, onDelete, locale }: ProjectCardProps) {
  const copy =
    locale === 'es'
      ? {
          illustration: 'Ilustración de proyecto',
          tasks: 'Nro. de tareas:',
          delete: 'Eliminar proyecto',
          deadline: 'Límite:',
          progress: 'Progreso',
        }
      : {
          illustration: 'Project illustration',
          tasks: 'Tasks:',
          delete: 'Delete project',
          deadline: 'Deadline:',
          progress: 'Progress',
        };
  const gradient = GRADIENTS[index % GRADIENTS.length];

  // Determinar color de la píldora de importancia
  let importanceBg = 'bg-gray-100 text-gray-700';
  const importanceLower = (project.importance || '').toLowerCase();

  if (importanceLower.includes('obligatorio')) {
    importanceBg = 'bg-[#FBE6DD] text-[#845326]'; // rosa/durazno suave
  } else if (importanceLower.includes('prioritario')) {
    importanceBg = 'bg-[#fbece9] text-[#b84a39]'; // urgent/durazno intenso
  } else if (importanceLower.includes('hobby')) {
    importanceBg = 'bg-[#eaf4ee] text-[#3d7a5a]'; // menta/verde suave
  }

  return (
    <Link
      href={localizedProjectHref(locale, project.id)}
      className="group relative flex flex-col bg-white rounded-[20px] border border-[#EAE3DC] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200 ease-in-out hover:-translate-y-[3px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] block"
    >
      {/* Cabecera superior ("Fondo Cute") */}
      <div
        className="h-[130px] w-full flex items-center justify-center relative"
        style={{ background: gradient }}
      >
        <div className="relative w-[85%] h-[85%] m-auto">
          <Image
            src={`/images/mascot/${CHIGUI_IMAGES[index % CHIGUI_IMAGES.length]}`}
            alt={copy.illustration}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain"
          />
        </div>
      </div>

      {/* Cuerpo inferior de la tarjeta */}
      <div className="flex flex-col flex-1 p-5 pb-6 gap-4 relative">
        {/* Fila superior: Nombre e Importancia */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-[#2C1F14] text-lg leading-tight line-clamp-2">
            {project.name}
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${importanceBg}`}
          >
            {project.importance?.split(' ')[0]}
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          {/* Fila intermedia: Texto informativo */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#845326]">
              {copy.tasks} {project.tasksCount}
            </p>

            {/* Botón de Eliminación (Abajo a la Derecha) */}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(project.id);
                }}
                className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 ease-in-out shadow-xs border border-red-200/60 cursor-pointer active:scale-90"
                title={copy.delete}
                aria-label={copy.delete}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          {/* Fecha Límite */}
          {project.fechaLimite && (
            <div className="flex items-center gap-1.5 text-xs text-[#845326] font-medium">
              <Calendar className="size-3.5 text-[#845326]/70 shrink-0" />
              <span>
                {copy.deadline}{' '}
                <span className="font-semibold text-[#2C1F14]">
                  {(() => {
                    try {
                      const dPart = project.fechaLimite.split('T')[0];
                      const [y, m, d] = dPart.split('-');
                      return `${d}/${m}/${y}`;
                    } catch {
                      return project.fechaLimite.slice(0, 10);
                    }
                  })()}
                </span>
              </span>
            </div>
          )}

          {/* Fila inferior (Progreso) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-[#2C1F14]">
              <span>{copy.progress}</span>
              <span>{project.progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#EAE3DC] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${project.progress}%`,
                  background: gradient, // Usamos el mismo gradiente para que combine!
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
