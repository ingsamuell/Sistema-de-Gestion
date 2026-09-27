'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { saveOnboardingAnswers } from '@/features/onboarding/actions/saveOnboardingAction';
import { getOnboardingQuestions, onboardingQuestions } from '@/features/onboarding/data/questions';
import type { Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export { onboardingQuestions as onboardingData } from '@/features/onboarding/data/questions';

const onboardingCopy = {
  es: {
    hello: 'Hola, me llamo Mr. Chiwi',
    know: 'Quiero conocerte mejor',
    step: 'Paso',
    of: 'de',
    previous: 'Anterior',
    next: 'Siguiente',
    finish: 'Finalizar',
    saving: 'Guardando...',
    saveError: 'Ocurrió un error al guardar tus respuestas.',
    unexpected: 'Error inesperado al conectar con el servidor. Inténtalo de nuevo.',
  },
  en: {
    hello: 'Hi, my name is Mr. Chiwi',
    know: 'I want to get to know you better',
    step: 'Step',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    finish: 'Finish',
    saving: 'Saving...',
    saveError: 'An error occurred while saving your answers.',
    unexpected: 'An unexpected connection error occurred. Please try again.',
  },
} as const;

export function OnboardingSurvey({ locale }: { locale: Locale }) {
  const router = useRouter();
  const copy = onboardingCopy[locale];
  const questions = getOnboardingQuestions(locale);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const totalSteps = questions.length;
  const currentQuestion = questions[currentStep];
  const selectedAnswer = answers[currentQuestion.id];
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);

  const handleSelectOption = (option: string) => {
    if (saveError) setSaveError(null);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setSaveError(null);
    setIsFinishing(true);

    try {
      const response = await saveOnboardingAnswers({
        rol_condicion: answers[1] || '',
        edad: answers[2] || '',
        situacion_laboral: answers[3] || '',
        jornada_horarios: answers[4] || '',
        tiempo_diario_min: answers[5] || '',
        metodologia: answers[6] || '',
        experiencia: answers[7] || '',
      });

      if (!response.success) {
        setSaveError(response.error || copy.saveError);
        setIsFinishing(false);
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('komorebi_onboarding_answers', JSON.stringify(answers));
        localStorage.setItem('komorebi_onboarding_completed', 'true');
      }

      router.push(localizedHref(locale, 'app'));
      router.refresh();
    } catch {
      setSaveError(copy.unexpected);
      setIsFinishing(false);
    }
  };

  return (
    <div className="w-[90%] max-w-[1050px] min-h-[80vh] mx-auto flex items-center justify-center py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center justify-items-center w-full">
        {/* ========================================================
            COLUMNA IZQUIERDA: Persistente (Mr. Chiwi & Diálogo)
        ======================================================== */}
        <div className="flex flex-col items-center text-center w-full max-w-[420px]">
          {/* Títulos superiores manuscritos */}
          <div className="mb-4">
            <h1 className="font-handwriting text-3xl sm:text-4xl font-bold text-[#2C1F14] tracking-wide leading-tight">
              {copy.hello}
            </h1>
            <p className="font-handwriting text-xl sm:text-2xl text-[#845326] font-semibold mt-0.5">
              {copy.know}
            </p>
          </div>

          {/* Nube de Pensamiento Óvalo Perfecto */}
          <div className="relative w-full max-w-[380px] mb-6 z-10">
            <div className="relative bg-white border-2 border-[#1A1A1A] rounded-[100px] px-9 py-6 min-h-[100px] flex items-center justify-center text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-300">
              <p
                key={currentStep}
                className="font-handwriting text-xl sm:text-2xl text-[#1A1A1A] font-bold leading-snug animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                &ldquo;{currentQuestion.chiwiSpeech}&rdquo;
              </p>
            </div>
          </div>

          {/* Slot del Personaje (.character-slot) */}
          <div className="character-slot relative w-44 h-44 sm:w-52 sm:h-52 mt-3 flex items-center justify-center">
            <div className="relative w-full h-full motion-safe:animate-[chigui-float_4s_ease-in-out_infinite]">
              <Image
                src="/images/mascot/chigui-welcome.png"
                alt={locale === 'es' ? 'Mr. Chiwi, tutor' : 'Mr. Chiwi, tutor'}
                fill
                priority
                className="object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105"
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            COLUMNA DERECHA: Tarjeta de Preguntas Compacta (Login Style)
        ======================================================== */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-[480px] bg-white border border-[#EAE3DC] rounded-[20px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all">
            {/* Encabezado e Indicador de Progreso */}
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#E8DCD1] text-xs font-semibold text-[#2C1F14] uppercase tracking-wider">
                  {copy.step} {currentStep + 1} {copy.of} {totalSteps}
                </span>
                <span className="text-xs font-bold text-[#2C1F14]/70">{progressPercent}%</span>
              </div>

              {/* Barra de Progreso */}
              <div className="w-full h-2 rounded-full bg-[#E8DCD1]/50 overflow-hidden">
                <div
                  className="h-full bg-[#2C1F14] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Alerta de Error al Guardar */}
            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3 text-red-800 text-xs sm:text-sm animate-in fade-in">
                <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{saveError}</span>
              </div>
            )}

            {/* Pregunta Actual */}
            <div className="mb-5">
              <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Opciones de Respuesta (Botones) */}
            <div className="space-y-2.5 mb-6">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedAnswer === option;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(option)}
                    className={`w-full rounded-[16px] py-3 px-[18px] text-left text-sm sm:text-base flex items-center justify-between transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-[#F5EFE9] border-[1.5px] border-[#2C1F14] text-[#2C1F14] font-semibold shadow-xs'
                        : 'bg-white border-[1.5px] border-[#E2D9D0] text-[#2C1F14] hover:bg-[#F5EFE9] hover:border-[#2C1F14]'
                    }`}
                  >
                    <span className="pr-3 leading-snug">{option}</span>
                    <span
                      className={`size-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-[#2C1F14] bg-[#2C1F14] text-white'
                          : 'border-[#E2D9D0] bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="size-3 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Botones de Navegación Inferior */}
            <div className="flex items-center justify-between pt-4 border-t border-[#EAE3DC]">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="rounded-[25px] bg-[#E8DCD1] hover:bg-[#dfd1c4] text-[#2C1F14] px-5 py-2.5 font-semibold text-xs sm:text-sm transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 active:scale-[0.99]"
              >
                <ArrowLeft className="size-3.5" />
                <span>{copy.previous}</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={!selectedAnswer || isFinishing}
                className="rounded-[25px] bg-[#2C1F14] hover:bg-[#433022] text-white px-6 py-2.5 font-semibold text-xs sm:text-sm shadow-sm transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
              >
                {isFinishing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{copy.saving}</span>
                  </>
                ) : currentStep === totalSteps - 1 ? (
                  <>
                    <span>{copy.finish}</span>
                    <Sparkles className="size-3.5 text-[#FEB800]" />
                  </>
                ) : (
                  <>
                    <span>{copy.next}</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
