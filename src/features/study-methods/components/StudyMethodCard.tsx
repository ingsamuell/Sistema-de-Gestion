'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Star, Info } from 'lucide-react';
import { StudyTechnique } from '../data/techniques';
import { updateLearningPreferences } from '@/features/profile/actions/updateLearningPreferencesAction';

interface StudyMethodCardProps {
  technique: StudyTechnique;
  isDefault: boolean;
}

export function StudyMethodCard({ technique, isDefault }: StudyMethodCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isHovered, setIsHovered] = useState(false);

  const handleSetDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await updateLearningPreferences({ methodology: technique.name });
    });
  };

  const handleStartStudy = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/tecnicas/sesion?technique=${technique.id}`);
  };

  return (
    <div
      className="relative w-full h-[220px] rounded-[24px] border border-[#EAE3DC] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 ease-in-out cursor-pointer group hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsHovered(!isHovered)}
    >
      {/* Background and Base Layer */}
      <div
        className="absolute inset-0 p-6 flex flex-col justify-between transition-opacity duration-300"
        style={{ background: technique.gradient }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-[#2C1F14] text-2xl mb-2">{technique.name}</h3>
            <span className="px-3 py-1.5 bg-white/40 backdrop-blur-sm rounded-full text-sm font-semibold text-[#845326]">
              {technique.shortDescription}
            </span>
          </div>
          {isDefault && (
            <div
              className="bg-accent-amber p-2 rounded-full text-white shadow-sm"
              title="Técnica Predeterminada"
            >
              <Star className="size-5 fill-current" />
            </div>
          )}
        </div>

        <div className="flex items-center text-[#845326] font-medium gap-2 opacity-70 group-hover:opacity-0 transition-opacity">
          <Info className="size-5" />
          <span>Haz clic o pasa el cursor para ver detalles</span>
        </div>
      </div>

      {/* Overlay Content */}
      <div
        className={`absolute inset-0 bg-white/95 backdrop-blur-md p-6 flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div>
          <h3 className="font-bold text-[#2C1F14] text-xl mb-3">{technique.name}</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-4 line-clamp-3">
            {technique.description}
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={handleStartStudy}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            <Play className="size-4" />
            Iniciar Estudio
          </button>

          <button
            onClick={handleSetDefault}
            disabled={isDefault || isPending}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-colors ${
              isDefault
                ? 'bg-status-success-bg text-status-success cursor-default'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
            }`}
          >
            <Star className={`size-4 ${isDefault ? 'fill-current' : ''}`} />
            {isDefault ? 'Técnica Predeterminada' : 'Elegir como Predeterminada'}
          </button>
        </div>
      </div>
    </div>
  );
}
