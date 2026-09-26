'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
  X,
  Loader2,
  Brain,
  AlertCircle,
  Award,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  generateQuizAction,
  QuizQuestion,
  markTaskQuizPassedAction,
} from '@/features/certifications/actions/generateQuizAction';
import { cn } from '@/lib/utils';

export interface QuizModalProps {
  taskId: string | null;
  taskTitle?: string;
  taskDescription?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (taskId: string) => void;
  hasFullName?: boolean;
}

export function QuizModal({
  taskId,
  taskTitle,
  taskDescription,
  isOpen,
  onClose,
  onSuccess,
}: QuizModalProps) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<'loading' | 'quiz' | 'evaluating' | 'result' | 'error'>('loading');

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'gemini' | 'n8n' | 'fallback'>('gemini');
  const [quizScore, setQuizScore] = useState<{ score: number; total: number; passed: boolean } | null>(
    null,
  );

  const handleSafeClose = useCallback(() => {
    if (quizScore?.passed && taskId) {
      onSuccess(taskId);
    }
    onClose();
  }, [quizScore?.passed, taskId, onSuccess, onClose]);

  // Manejo de la tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'evaluating') {
        handleSafeClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, handleSafeClose]);

  // Bloquear scroll de la página de fondo cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Reiniciar estado al abrir o cambiar de tarea
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  if (isOpen && taskId && prevTaskId !== taskId) {
    setPrevTaskId(taskId);
    setStep('loading');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers([]);
    setError(null);
    setQuizScore(null);
  } else if (!isOpen && prevTaskId !== null) {
    setPrevTaskId(null);
  }

  // Carga o regeneración del quiz
  const fetchQuiz = useCallback(
    (forceFallback = false) => {
      if (!taskId) return;
      startTransition(async () => {
        setError(null);
        setStep('loading');
        setQuizScore(null);
        setSelectedAnswers([]);
        setCurrentQuestionIndex(0);

        const res = await generateQuizAction({
          taskId,
          taskTitle,
          taskDescription,
          forceFallback,
        });

        if (res.success && res.questions && res.questions.length > 0) {
          setQuestions(res.questions);
          setProvider(res.provider || (res.isFallback ? 'fallback' : 'gemini'));
          setStep('quiz');
        } else {
          setError(res.error || 'No se pudo generar el cuestionario con IA.');
          setStep('error');
        }
      });
    },
    [taskId, taskTitle, taskDescription],
  );

  // Cargar preguntas automáticamente al abrir
  useEffect(() => {
    if (isOpen && taskId && step === 'loading' && questions.length === 0 && !error && !isPending) {
      fetchQuiz();
    }
  }, [isOpen, taskId, step, questions.length, error, isPending, fetchQuiz]);

  const handleSelectAnswer = (optionIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((c) => c + 1);
    } else {
      evaluateQuiz();
    }
  };

  const evaluateQuiz = () => {
    if (!taskId) return;
    setStep('evaluating');
    startTransition(async () => {
      let score = 0;
      questions.forEach((q, i) => {
        if (selectedAnswers[i] === q.correctAnswerIndex) {
          score++;
        }
      });

      // Se requiere al menos un 75% para aprobar (3 de 4 preguntas)
      const passingScore = Math.ceil(questions.length * 0.75);
      const passed = score >= passingScore;

      setQuizScore({ score, total: questions.length, passed });

      if (passed) {
        const res = await markTaskQuizPassedAction(taskId);
        if (res.success) {
          onSuccess(taskId);
          setStep('result');
        } else {
          setError(res.error || 'Aprobaste, pero hubo un error al guardar tu progreso.');
          setStep('quiz');
        }
      } else {
        setStep('result');
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'evaluating') {
          handleSafeClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-modal-title"
    >
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl relative animate-in zoom-in-95 duration-200 border border-[#E8DCD1] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Botón cerrar X en la esquina superior derecha */}
        <button
          type="button"
          onClick={handleSafeClose}
          disabled={step === 'evaluating'}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Cerrar cuestionario"
        >
          <X className="size-5" />
        </button>

        {/* Encabezado con estética cálida */}
        <div className="mb-4 pr-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF3EC] border border-[#E8DCD1] text-xs font-semibold text-[#845326] mb-2.5">
            <Sparkles className="size-3.5 text-[#845326]" />
            <span>Quiz de Conocimiento</span>
            {step === 'quiz' && (
              <span className="text-[10px] opacity-80 font-normal ml-1">
                • {provider === 'gemini' ? 'Gemini IA' : provider === 'n8n' ? 'n8n IA' : 'Contingencia'}
              </span>
            )}
          </div>

          <h3
            id="quiz-modal-title"
            className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-tight"
          >
            {taskTitle || 'Evaluación de la tarea'}
          </h3>
          <p className="text-xs sm:text-sm text-[#845326] mt-1 line-clamp-1">
            4 preguntas de selección simple para validar tu aprendizaje y acreditar esta tarea.
          </p>
        </div>

        {/* Mensaje de error general si existe */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs sm:text-sm flex gap-2.5 items-start">
            <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Estado 1: CARGANDO (Generación con IA ultra rápida) */}
        {step === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF3EC] border border-[#E8DCD1] flex items-center justify-center text-[#845326] mb-4 shadow-xs">
              <Sparkles className="size-7 text-[#845326] animate-pulse" />
            </div>
            <h4 className="text-lg font-bold text-[#2C1F14]">Generando preguntas con IA...</h4>
            <p className="text-xs sm:text-sm text-[#845326] mt-1.5 max-w-sm leading-relaxed">
              Estructurando 4 preguntas personalizadas sobre el contenido de tu tarea.
            </p>
            <div className="mt-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF7F4] border border-[#E8DCD1] text-xs font-medium text-[#845326]">
              <Loader2 className="size-3.5 animate-spin text-[#845326]" />
              <span>Priorizando generación rápida (Gemini Flash & n8n)</span>
            </div>
          </div>
        )}

        {/* Estado 2: EVALUANDO RESPUESTAS */}
        {step === 'evaluating' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF3EC] border border-[#E8DCD1] flex items-center justify-center text-[#845326] mb-4 shadow-xs">
              <Loader2 className="size-7 animate-spin text-[#845326]" />
            </div>
            <h4 className="text-lg font-bold text-[#2C1F14]">Evaluando tus respuestas...</h4>
            <p className="text-xs sm:text-sm text-[#845326] mt-1 max-w-xs leading-relaxed">
              Validando el resultado para registrar tu acreditación en el sistema.
            </p>
          </div>
        )}

        {/* Estado 3: ERROR DE GENERACIÓN */}
        {step === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-4">
              <Brain className="size-7" />
            </div>
            <h4 className="text-lg font-bold text-[#2C1F14] mb-1.5">No se pudo generar el quiz</h4>
            <p className="text-xs sm:text-sm text-[#845326] max-w-sm mb-6 leading-relaxed">
              Los servicios de IA están experimentando alta demanda momentánea. Puedes reintentar o
              utilizar el cuestionario de contingencia académica.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={() => fetchQuiz(false)}
                disabled={isPending}
                className="flex-1 py-3 px-4 rounded-2xl border border-[#E8DCD1] bg-white hover:bg-[#FAF7F4] text-[#2C1F14] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => fetchQuiz(true)}
                disabled={isPending}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#2C1F14] hover:bg-[#433022] text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-xs"
              >
                Cuestionario Rápido
              </button>
            </div>
          </div>
        )}

        {/* Estado 4: RESULTADO (Aprobado o No Aprobado) */}
        {step === 'result' && quizScore && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 animate-in fade-in">
            {quizScore.passed ? (
              <>
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
                  <Award className="size-8 text-emerald-600" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-3 border border-emerald-200">
                  <CheckCircle2 className="size-3.5" />
                  <span>¡Quiz Aprobado!</span>
                </div>
                <h4 className="text-xl sm:text-2xl font-bold text-[#2C1F14] mb-2">
                  ¡Excelente dominio del tema!
                </h4>
                <p className="text-xs sm:text-sm text-[#845326] max-w-sm mb-4 leading-relaxed">
                  Has obtenido{' '}
                  <strong className="text-[#2C1F14]">
                    {quizScore.score} de {quizScore.total} respuestas correctas
                  </strong>
                  . Esta tarea ha quedado acreditada para tu certificación.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (taskId) onSuccess(taskId);
                    onClose();
                  }}
                  className="w-full max-w-xs py-3.5 px-5 rounded-2xl bg-[#2C1F14] hover:bg-[#433022] text-white font-semibold text-sm transition-all shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Continuar</span>
                  <ArrowRight className="size-4" />
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 mb-4 shadow-xs">
                  <AlertCircle className="size-8 text-amber-600" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold mb-3 border border-amber-200">
                  <span>Puntaje: {quizScore.score} de {quizScore.total}</span>
                </div>
                <h4 className="text-xl sm:text-2xl font-bold text-[#2C1F14] mb-2">
                  Casi lo logras
                </h4>
                <p className="text-xs sm:text-sm text-[#845326] max-w-sm mb-6 leading-relaxed">
                  Necesitas al menos 3 de 4 respuestas correctas (75%) para aprobar la tarea. Revisa
                  los recursos del tema e inténtalo de nuevo.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 px-4 rounded-2xl border border-[#E8DCD1] bg-white hover:bg-[#FAF7F4] text-[#2C1F14] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                  >
                    Estudiar más
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchQuiz(false)}
                    disabled={isPending}
                    className="flex-1 py-3 px-4 rounded-2xl bg-[#2C1F14] hover:bg-[#433022] text-white font-semibold text-xs sm:text-sm transition-all shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Reintentar</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Estado 5: PREGUNTAS DEL QUIZ (4 preguntas de selección simple) */}
        {step === 'quiz' && questions.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 animate-in fade-in">
            {/* Barra de progreso de 4 preguntas */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-bold text-[#845326] mb-2">
                <span>
                  Pregunta {currentQuestionIndex + 1} de {questions.length}
                </span>
                <span>
                  {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      selectedAnswers[idx] !== undefined && idx < currentQuestionIndex
                        ? 'bg-emerald-600'
                        : idx === currentQuestionIndex
                        ? 'bg-[#845326]'
                        : 'bg-[#E8DCD1]/60',
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Recuadro de la pregunta actual */}
            <div className="p-4 bg-[#FAF7F4] border border-[#EAE3DC] rounded-2xl mb-4 shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#845326] block mb-1">
                Pregunta {currentQuestionIndex + 1}
              </span>
              <p className="text-sm sm:text-base font-bold text-[#2C1F14] leading-relaxed">
                {questions[currentQuestionIndex].question}
              </p>
            </div>

            {/* Las 4 opciones de selección simple */}
            <div className="flex flex-col gap-2.5 mb-5 flex-1 overflow-y-auto pr-1 min-h-0">
              {questions[currentQuestionIndex].options.map((option, idx) => {
                const letter = String.fromCharCode(65 + idx); // A, B, C, D
                const isSelected = selectedAnswers[currentQuestionIndex] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectAnswer(idx)}
                    className={cn(
                      'w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 text-xs sm:text-sm flex items-center gap-3 cursor-pointer',
                      isSelected
                        ? 'border-2 border-[#845326] bg-[#FAF3EC] text-[#2C1F14] font-semibold shadow-xs'
                        : 'border-[#E8DCD1] bg-[#FAF7F4] hover:bg-[#FAF3EC]/60 hover:border-[#845326]/40 text-[#433022]',
                    )}
                  >
                    <div
                      className={cn(
                        'size-6 sm:size-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                        isSelected
                          ? 'bg-[#845326] text-white'
                          : 'bg-white border border-[#E8DCD1] text-[#845326]',
                      )}
                    >
                      {letter}
                    </div>
                    <span className="flex-1 leading-snug">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Barra de navegación de preguntas */}
            <div className="flex items-center gap-3 pt-3 border-t border-[#E8DCD1]/60 shrink-0">
              {currentQuestionIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((c) => c - 1)}
                  className="px-4 py-3 rounded-2xl border border-[#E8DCD1] text-[#433022] hover:bg-[#FAF7F4] font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Anterior</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={selectedAnswers[currentQuestionIndex] === undefined || isPending}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-[#2C1F14] hover:bg-[#433022] text-white font-semibold text-xs sm:text-sm transition-all shadow-sm active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : currentQuestionIndex === questions.length - 1 ? (
                  <>
                    <span>Finalizar y Evaluar</span>
                    <CheckCircle2 className="size-4" />
                  </>
                ) : (
                  <>
                    <span>Siguiente Pregunta</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
