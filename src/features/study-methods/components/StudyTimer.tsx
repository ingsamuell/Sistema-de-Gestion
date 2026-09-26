'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, ArrowRight } from 'lucide-react';
import { StudyTechnique } from '../data/techniques';
import { cn } from '@/lib/utils';

interface StudyTimerProps {
  technique: StudyTechnique;
  onFinish?: () => void;
}

type TimerPhase = 'focus' | 'break' | 'long_break';

export function StudyTimer({ technique, onFinish }: StudyTimerProps) {
  const [phase, setPhase] = useState<TimerPhase>('focus');
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(technique.focusMinutes * 60);
  const [isActive, setIsActive] = useState(false);

  // Update initial time if technique changes (render-time adjustment)
  const [prevTechnique, setPrevTechnique] = useState(technique);
  if (prevTechnique !== technique) {
    setPrevTechnique(technique);
    setPhase('focus');
    setCyclesCompleted(0);
    setTimeLeft(technique.focusMinutes * 60);
    setIsActive(false);
  }

  const getPhaseDuration = useCallback(
    (currentPhase: TimerPhase) => {
      switch (currentPhase) {
        case 'focus':
          return technique.focusMinutes * 60;
        case 'break':
          return technique.breakMinutes * 60;
        case 'long_break':
          return technique.longBreakMinutes * 60;
        default:
          return technique.focusMinutes * 60;
      }
    },
    [technique],
  );

  const handlePhaseComplete = useCallback(() => {
    setIsActive(false);

    if (phase === 'focus') {
      const newCycles = cyclesCompleted + 1;
      setCyclesCompleted(newCycles);

      if (newCycles % technique.cyclesBeforeLongBreak === 0) {
        setPhase('long_break');
        setTimeLeft(getPhaseDuration('long_break'));
      } else {
        setPhase('break');
        setTimeLeft(getPhaseDuration('break'));
      }
    } else {
      // Return to focus after a break
      setPhase('focus');
      setTimeLeft(getPhaseDuration('focus'));
      onFinish?.();
    }
  }, [cyclesCompleted, getPhaseDuration, onFinish, phase, technique.cyclesBeforeLongBreak]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handlePhaseComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isActive, handlePhaseComplete]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(getPhaseDuration(phase));
  };

  const skipPhase = () => {
    handlePhaseComplete();
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const currentDuration = getPhaseDuration(phase);
  const percentage =
    currentDuration > 0 ? ((currentDuration - timeLeft) / currentDuration) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto bg-surface p-8 rounded-[32px] border border-outline-variant shadow-sm relative overflow-hidden">
      {/* Background subtle gradient based on phase */}
      <div
        className={cn(
          'absolute inset-0 opacity-10 transition-colors duration-1000',
          phase === 'focus' ? 'bg-accent-amber' : 'bg-status-success',
        )}
      />

      <div className="relative z-10 w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-on-surface mb-2">{technique.name}</h2>
          <div className="flex items-center justify-center gap-2 text-on-surface-variant font-medium">
            {phase === 'focus' ? (
              <>
                <Brain className="size-5 text-accent-amber" /> <span>Fase de Enfoque</span>
              </>
            ) : (
              <>
                <Coffee className="size-5 text-status-success" /> <span>Fase de Descanso</span>
              </>
            )}
            <span className="mx-2">•</span>
            <span>Ciclo {cyclesCompleted + 1}</span>
          </div>
        </div>

        {/* Circular Timer Display */}
        <div className="relative w-64 h-64 mx-auto mb-10 flex items-center justify-center">
          {/* SVG Progress Circle */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-surface-container-highest"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="289.026"
              strokeDashoffset={289.026 - (289.026 * percentage) / 100}
              strokeLinecap="round"
              className={cn(
                'transition-all duration-1000 ease-linear',
                phase === 'focus' ? 'text-accent-amber' : 'text-status-success',
              )}
            />
          </svg>

          {/* Time Text */}
          <div className="text-5xl font-bold tracking-tighter tabular-nums text-on-surface">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={resetTimer}
            className="p-4 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
            title="Reiniciar"
          >
            <RotateCcw className="size-6" />
          </button>

          <button
            onClick={toggleTimer}
            className={cn(
              'p-6 rounded-full text-white shadow-md transition-all hover:scale-105 active:scale-95',
              phase === 'focus'
                ? 'bg-accent-amber hover:bg-accent-amber/90'
                : 'bg-status-success hover:bg-status-success/90',
            )}
          >
            {isActive ? (
              <Pause className="size-8 fill-current" />
            ) : (
              <Play className="size-8 fill-current ml-1" />
            )}
          </button>

          <button
            onClick={skipPhase}
            className="p-4 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
            title="Saltar fase"
          >
            <ArrowRight className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
