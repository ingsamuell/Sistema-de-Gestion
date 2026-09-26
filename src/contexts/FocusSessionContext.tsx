'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STUDY_TECHNIQUES, StudyTechnique } from '@/features/study-methods/data/techniques';
import { useToast } from '@/components/ui/Toast';

export type SessionPhase = 'idle' | 'focus' | 'break' | 'longBreak';

export interface FocusSessionState {
  isActive: boolean;
  isPlaying: boolean;
  phase: SessionPhase;
  timeLeft: number;
  totalDuration: number;
  cycleCount: number;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  technique: StudyTechnique | null;
}

interface FocusSessionContextType extends FocusSessionState {
  startSession: (techniqueId: string, taskId?: string, taskTitle?: string) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => void;
  skipPhase: () => void;
  attachTask: (taskId: string, taskTitle: string) => void;
}

const FocusSessionContext = createContext<FocusSessionContextType | undefined>(undefined);

export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FocusSessionState>({
    isActive: false,
    isPlaying: false,
    phase: 'idle',
    timeLeft: 0,
    totalDuration: 0,
    cycleCount: 0,
    activeTaskId: null,
    activeTaskTitle: null,
    technique: null,
  });

  const { success, info } = useToast();

  const handlePhaseComplete = useCallback(() => {
    setState((prev) => {
      if (!prev.technique) return prev;

      if (prev.phase === 'focus') {
        const nextCycle = prev.cycleCount + 1;
        const isLongBreak = nextCycle % prev.technique.cyclesBeforeLongBreak === 0;
        const nextPhase = isLongBreak ? 'longBreak' : 'break';
        const duration = isLongBreak
          ? prev.technique.longBreakMinutes * 60
          : prev.technique.breakMinutes * 60;

        playBeep();
        success(
          isLongBreak
            ? '¡Tiempo de enfoque terminado! Toma un descanso largo bien merecido.'
            : '¡Tiempo de enfoque terminado! Tómate un breve respiro.',
        );

        return {
          ...prev,
          phase: nextPhase,
          cycleCount: nextCycle,
          timeLeft: duration,
          totalDuration: duration,
          isPlaying: false, // Wait for user to start break
        };
      } else {
        // Break is over, back to focus
        const duration = prev.technique.focusMinutes * 60;

        playBeep();
        info('El descanso ha terminado. ¡Hora de volver al enfoque!');

        return {
          ...prev,
          phase: 'focus',
          timeLeft: duration,
          totalDuration: duration,
          isPlaying: false, // Wait for user to start next focus session
        };
      }
    });
  }, [success, info]);

  useEffect(() => {
    if (!state.isActive || !state.isPlaying) return;

    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.timeLeft <= 1) {
          clearInterval(interval);
          handlePhaseComplete();
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [state.isActive, state.isPlaying, handlePhaseComplete]);

  const startSession = useCallback((techniqueId: string, taskId?: string, taskTitle?: string) => {
    const tech = STUDY_TECHNIQUES.find((t) => t.id === techniqueId);
    if (!tech) return;

    const duration = tech.focusMinutes * 60;
    setState({
      isActive: true,
      isPlaying: true,
      phase: 'focus',
      timeLeft: duration,
      totalDuration: duration,
      cycleCount: 0,
      activeTaskId: taskId || null,
      activeTaskTitle: taskTitle || null,
      technique: tech,
    });
  }, []);

  const pauseSession = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const resumeSession = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const stopSession = useCallback(() => {
    setState({
      isActive: false,
      isPlaying: false,
      phase: 'idle',
      timeLeft: 0,
      totalDuration: 0,
      cycleCount: 0,
      activeTaskId: null,
      activeTaskTitle: null,
      technique: null,
    });
  }, []);

  const skipPhase = useCallback(() => {
    handlePhaseComplete();
  }, [handlePhaseComplete]);

  const attachTask = useCallback((taskId: string, taskTitle: string) => {
    setState((prev) => ({ ...prev, activeTaskId: taskId, activeTaskTitle: taskTitle }));
  }, []);

  return (
    <FocusSessionContext.Provider
      value={{
        ...state,
        startSession,
        pauseSession,
        resumeSession,
        stopSession,
        skipPhase,
        attachTask,
      }}
    >
      {children}
    </FocusSessionContext.Provider>
  );
}

export function useFocusSession() {
  const context = useContext(FocusSessionContext);
  if (context === undefined) {
    throw new Error('useFocusSession must be used within a FocusSessionProvider');
  }
  return context;
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Función auxiliar para emitir un sonido cuando se acaba el tiempo
function playBeep() {
  if (typeof window !== 'undefined') {
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // Do (C5)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // Sube a A5

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Browser might block audio context if not interacted, ignore
    }
  }
}
