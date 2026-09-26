'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, SkipForward, Coffee, BrainCircuit } from 'lucide-react';
import { useFocusSession } from '@/contexts/FocusSessionContext';

export function GlobalFocusBar() {
  const {
    isActive,
    isPlaying,
    phase,
    timeLeft,
    activeTaskTitle,
    technique,
    pauseSession,
    resumeSession,
    stopSession,
    skipPhase,
  } = useFocusSession();

  if (!isActive || !technique) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPhaseConfig = () => {
    switch (phase) {
      case 'focus':
        return {
          color: 'bg-primary',
          text: 'text-white',
          icon: <BrainCircuit className="size-4" />,
          label: 'Enfoque',
        };
      case 'break':
        return {
          color: 'bg-accent-amber',
          text: 'text-surface',
          icon: <Coffee className="size-4" />,
          label: 'Descanso',
        };
      case 'longBreak':
        return {
          color: 'bg-status-success',
          text: 'text-white',
          icon: <Coffee className="size-4" />,
          label: 'Descanso Largo',
        };
      default:
        return {
          color: 'bg-surface-container',
          text: 'text-on-surface',
          icon: null,
          label: 'Inactivo',
        };
    }
  };

  const phaseConfig = getPhaseConfig();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0, height: 0 }}
        animate={{ y: 0, opacity: 1, height: 'auto' }}
        exit={{ y: -50, opacity: 0, height: 0 }}
        className="w-full bg-[#fdfaf7] border-b border-[#E8DCD1] shadow-sm p-3 px-4 md:px-8 flex items-center justify-between gap-4 overflow-hidden"
      >
        <div className="flex items-center gap-4 flex-1 overflow-hidden">
          {/* Phase Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider ${phaseConfig.color} ${phaseConfig.text}`}
          >
            {phaseConfig.icon}
            <span className="hidden sm:inline">{phaseConfig.label}</span>
          </div>

          {/* Timer & Task */}
          <div className="flex flex-col min-w-0">
            <span className="text-xl sm:text-2xl font-black text-on-surface leading-none font-mono">
              {formatTime(timeLeft)}
            </span>
            <div className="text-xs text-on-surface-variant font-medium truncate">
              {activeTaskTitle ? (
                <>
                  <span className="opacity-70">Tarea:</span>{' '}
                  <span className="text-primary font-bold">{activeTaskTitle}</span>
                </>
              ) : (
                <span>{technique.name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isPlaying ? (
            <button
              onClick={pauseSession}
              className="p-2 sm:p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
              title="Pausar"
            >
              <Pause className="size-5" />
            </button>
          ) : (
            <button
              onClick={resumeSession}
              className="p-2 sm:p-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white transition-colors"
              title="Reanudar"
            >
              <Play className="size-5" fill="currentColor" />
            </button>
          )}

          <button
            onClick={skipPhase}
            className="p-2 sm:p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
            title="Saltar a siguiente fase"
          >
            <SkipForward className="size-4" />
          </button>

          <button
            onClick={stopSession}
            className="p-2 sm:p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title="Terminar sesión"
          >
            <Square className="size-4" fill="currentColor" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
