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

export interface OnboardingSurveyProps {
  locale: Locale;
  devModeOverride?: (answers: Record<number, string>) => void | Promise<void>;
}

export function OnboardingSurvey({ locale, devModeOverride }: OnboardingSurveyProps) {
  const router = useRouter();
  const copy = onboardingCopy[locale];
  const questions = getOnboardingQuestions(locale);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [onboardingPath, setOnboardingPath] = useState<'standard' | 'parent_inclusive' | 'student_inclusive' | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [parentAnswers, setParentAnswers] = useState<Record<string, any>>({});
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const totalSteps = onboardingPath === 'parent_inclusive' || onboardingPath === 'student_inclusive' ? 6 : questions.length;
  const currentQuestion = currentStep >= 0 ? questions[currentStep] : null;
  const selectedAnswer = currentStep >= 0 && currentQuestion ? answers[currentQuestion.id] : undefined;
  const progressPercent = currentStep >= 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0;

  const handleSelectOption = (option: string) => {
    if (saveError) setSaveError(null);
    if (!currentQuestion) return;
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
    if (currentStep > -1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setSaveError(null);
    setIsFinishing(true);

    if (devModeOverride) {
      try {
        await devModeOverride(answers);
        setIsFinishing(false);
      } catch (e) {
        console.error(e);
        setSaveError('Error en dev mode override.');
        setIsFinishing(false);
      }
      return;
    }

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

  const showThematicBg = currentStep === -1 || (onboardingPath !== 'standard' && onboardingPath !== null);

  return (
    <>
      <style>{`
        @keyframes blob-morph {
          0% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
          34% { border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%; }
          67% { border-radius: 100% 60% 60% 100% / 100% 100% 60% 60%; }
          100% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; }
        }
      `}</style>
      
      {/* Fondo Degradado Temático (Mariposa / Inclusivo) */}
      <div 
        className={`fixed inset-0 -z-10 transition-opacity duration-1000 ${
          showThematicBg ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          background: 'radial-gradient(circle at top right, rgba(253,230,138,0.4) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(216,180,254,0.4) 0%, rgba(191,219,254,0.3) 40%, transparent 80%), #FFF8F3'
        }}
      />

      <div className="w-[90%] max-w-[1050px] min-h-[80vh] mx-auto flex items-center justify-center py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center justify-items-center w-full">
        {/* ========================================================
            COLUMNA IZQUIERDA: Persistente (Mr. Chiwi & Diálogo)
        ======================================================== */}
        <div className="flex flex-col items-center text-center w-full max-w-[420px]">
          {/* Títulos superiores manuscritos */}
          <div className="mb-4">
            <h1 className="font-handwriting text-3xl sm:text-4xl font-bold text-[#2C1F14] tracking-wide leading-tight">
              {currentStep === -1 
                ? 'Hola, soy la Mariposa del Destino' 
                : ((currentStep >= 0 && currentStep <= 5) && onboardingPath === 'parent_inclusive'
                  ? 'Hola Somos Mr Chiwi & Martha'
                  : (currentStep >= 0 && currentStep <= 5) && onboardingPath === 'student_inclusive'
                  ? '¡Hola! Mi Nombre es Martha,'
                  : copy.hello)
              }
            </h1>
            {currentStep !== -1 && (
              <p className="font-handwriting text-xl sm:text-2xl text-[#845326] font-semibold mt-0.5">
                {(currentStep >= 0 && currentStep <= 5) && onboardingPath === 'parent_inclusive'
                  ? 'Queremos conocer mejor tu caso'
                  : (currentStep >= 0 && currentStep <= 5) && onboardingPath === 'student_inclusive'
                  ? 'Aprende Conmigo'
                  : copy.know}
              </p>
            )}
          </div>

          {/* Nube de Pensamiento Óvalo Perfecto */}
          <div className="relative w-full max-w-[380px] mb-1 sm:mb-2 z-10">
            <div className="relative bg-white border-2 border-[#1A1A1A] rounded-[100px] p-4 min-h-[80px] flex items-center justify-center text-center shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-300">
              <p
                key={currentStep}
                className="font-handwriting font-bold leading-snug text-sm sm:text-base animate-in fade-in slide-in-from-bottom-2 duration-300 text-[#1A1A1A] px-2"
              >
                {currentStep === -1 
                  ? 'La decisión que tomes en esta pregunta afectará directamente el comportamiento e interfaz de la página.' 
                  : (onboardingPath === 'parent_inclusive'
                    ? (currentStep === 0 ? 'Hola, Soy Mr Chiwi, te presento a mi hija Martha. Juntos te ayudaremos a crear el mejor entorno de apoyo.'
                      : currentStep === 1 ? 'Desde que Martha nació supimos que su mente era única. Acompañarla en su camino ha sido el viaje más hermoso de nuestras vidas.'
                      : currentStep === 2 ? 'A veces, sentarse a estudiar parece una misión imposible por el caos. Entendemos perfectamente esos momentos de frustración.'
                      : currentStep === 3 ? 'Pero cuando algo capta su interés, ¡es imparable! Usaremos esas pasiones como nuestro súper poder para aprender.'
                      : currentStep === 4 ? 'Cada mente tiene su propio ritmo. Respetar sus tiempos de atención y saber cuándo hacer una pausa es la clave del éxito.'
                      : currentStep === 5 ? 'No están solos en esto. Queremos darles las herramientas exactas para que toda la familia se sienta tranquila y apoyada.'
                      : currentQuestion?.chiwiSpeech)
                    : onboardingPath === 'student_inclusive'
                    ? (currentStep === 0 ? 'A veces mi mente vuela persiguiendo mariposas, pero cuando un tema me atrapa, ¡le dedico toda mi energía! ¿Qué es eso que te apasiona tanto hoy?'
                      : currentStep === 1 ? 'No importa en qué etapa estemos, siempre tenemos un lienzo en blanco listo para crear algo nuevo. ¿En qué punto de tu aventura estás?'
                      : currentStep === 2 ? 'Me encanta mezclar mis pasatiempos con mis deberes para que no sean tan aburridos. ¿Cómo te gustaría que usemos tu interés especial?'
                      : currentStep === 3 ? 'Para mí, una buena canción o un dibujo valen más que mil palabras largas. ¿Cómo te gusta absorber la información?'
                      : currentStep === 4 ? 'A veces tengo tantas ideas a la vez que me paralizo y no sé por dónde empezar. ¡Es súper normal! ¿Qué es lo que más te cuesta a ti?'
                      : currentStep === 5 ? 'Descubrí que dividir las cosas enormes en pasitos muy pequeños me ayuda a no abrumarme. ¿A qué ritmo te gustaría que trabajemos?'
                      : currentQuestion?.chiwiSpeech)
                    : currentQuestion?.chiwiSpeech)
                }
              </p>
            </div>
          </div>

          {/* Slot del Personaje (.character-slot) */}
          <div className={`character-slot relative flex items-center justify-center ${(onboardingPath === 'parent_inclusive' || onboardingPath === 'student_inclusive') ? 'w-full mt-1 sm:mt-2' : 'w-56 h-56 sm:w-72 sm:h-72 mt-3'}`}>
            {currentStep === -1 ? (
              <div className="relative w-full h-full flex items-center justify-center motion-safe:animate-[chigui-float_4s_ease-in-out_infinite]">
                <img
                  src="/images/mascot/mariposa.png"
                  alt="Mariposa del Destino"
                  className="w-80 max-w-full max-h-[320px] object-contain mx-auto transition-transform duration-300 hover:scale-105"
                />
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center motion-safe:animate-[chigui-float_4s_ease-in-out_infinite]">
                {onboardingPath === 'parent_inclusive' || onboardingPath === 'student_inclusive' ? (
                  <img
                    src={
                      onboardingPath === 'parent_inclusive' ? (
                        currentStep === 0 ? "/images/mascot/ChiwiMartha.png" :
                        currentStep === 1 ? "/images/mascot/familiaMartha.png" :
                        currentStep === 2 ? "/images/mascot/mrchiwimarthapregunta3.png" :
                        currentStep === 3 ? "/images/mascot/marthaychiwipregunta4.png" :
                        currentStep === 4 ? "/images/mascot/chiwimarthapregunta5.png" :
                        currentStep === 5 ? "/images/mascot/chiwimarthapregunta6.png" :
                        "/images/mascot/ChiwiMartha.png"
                      ) : (
                        currentStep === 0 ? "/images/mascot/marthapregunta1.png" :
                        currentStep === 1 ? "/images/mascot/marthapregunta2.png" :
                        currentStep === 2 ? "/images/mascot/marthapregunta3.png" :
                        currentStep === 3 ? "/images/mascot/marthapregunta4.png" :
                        currentStep === 4 ? "/images/mascot/marthapregunta5.png" :
                        currentStep === 5 ? "/images/mascot/marthapregunta6.png" :
                        "/images/mascot/marthapregunta1.png"
                      )
                    }
                    alt="Mascot"
                    className={`${
                      (onboardingPath === 'parent_inclusive' && currentStep === 2) || (onboardingPath === 'student_inclusive' && currentStep === 4)
                        ? 'w-full max-w-md h-auto'
                        : 'w-80 max-w-full max-h-[320px]'
                    } object-contain mx-auto drop-shadow-md transition-transform duration-300 hover:scale-105`}
                  />
                ) : (
                  <Image
                    src="/images/mascot/chigui-welcome.png"
                    alt={locale === 'es' ? 'Mr. Chiwi, tutor' : 'Mr. Chiwi, tutor'}
                    fill
                    priority
                    className="object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            COLUMNA DERECHA: Tarjeta de Preguntas Compacta (Login Style)
        ======================================================== */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-[480px] bg-white border border-[#EAE3DC] rounded-[20px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all">
            {/* Encabezado e Indicador de Progreso */}
            {currentStep >= 0 && (
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
            )}

            {/* Alerta de Error al Guardar */}
            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3 text-red-800 text-xs sm:text-sm animate-in fade-in">
                <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{saveError}</span>
              </div>
            )}

            {currentStep === -1 ? (
              <>
                <div className="mb-5">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                    ¿Quieres entrar a nuestro plan de proyectos para perfiles inclusivos y neurodivergentes?
                  </h2>
                </div>
                <div className="space-y-2.5 mb-6">
                  {[
                    { id: 'standard', label: 'No, continuar con el plan estándar.' },
                    { id: 'parent_inclusive', label: 'Sí, soy familiar/cuidador de un estudiante.' },
                    { id: 'student_inclusive', label: 'Sí, es para mi uso personal.' }
                  ].map((opt) => {
                    const isSelected = onboardingPath === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOnboardingPath(opt.id as any)}
                        className={`w-full rounded-[16px] py-3 px-[18px] text-left text-sm sm:text-base flex items-center justify-between transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5EFE9] border-[1.5px] border-[#2C1F14] text-[#2C1F14] font-semibold shadow-xs'
                            : 'bg-white border-[1.5px] border-[#E2D9D0] text-[#2C1F14] hover:bg-[#F5EFE9] hover:border-[#2C1F14]'
                        }`}
                      >
                        <span className="pr-3 leading-snug">{opt.label}</span>
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
              </>
            ) : (
              <>
                {currentStep === 0 && onboardingPath === 'parent_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Qué edad tiene tu hijo/a o a qué nivel educativo cursa?
                      </h2>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {['Primaria', 'Secundaria', 'Universidad/Adulto'].map((option, idx) => {
                        const isSelected = parentAnswers['q1'] === option;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              setParentAnswers((prev) => ({ ...prev, q1: option }));
                            }}
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
                  </>
                ) : currentStep === 1 && onboardingPath === 'parent_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Con qué condición o perfil se identifica mejor?
                      </h2>
                    </div>
                    
                    <div className="space-y-2.5 mb-4">
                      {['TDAH (Déficit de Atención e Hiperactividad)', 'TEA / Asperger', 'Altas Capacidades / Superdotación', 'Sin diagnóstico formal'].map((option, idx) => {
                        const selectedConditions = (parentAnswers['q2_conditions'] || []) as string[];
                        const isSelected = selectedConditions.includes(option);
                        
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              const newSelection = isSelected
                                ? selectedConditions.filter(item => item !== option)
                                : [...selectedConditions, option];
                              setParentAnswers(prev => ({ ...prev, q2_conditions: newSelection }));
                            }}
                            className={`w-full rounded-[16px] py-3 px-[18px] text-left text-sm sm:text-base flex items-center justify-between transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'bg-[#F5EFE9] border-[1.5px] border-[#2C1F14] text-[#2C1F14] font-semibold shadow-xs'
                                : 'bg-white border-[1.5px] border-[#E2D9D0] text-[#2C1F14] hover:bg-[#F5EFE9] hover:border-[#2C1F14]'
                            }`}
                          >
                            <span className="pr-3 leading-snug">{option}</span>
                            <span
                              className={`size-5 shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
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

                    <div className="bg-gray-50 rounded-lg p-3 mt-4">
                      <p className="text-sm font-semibold text-[#2C1F14] mb-2">Documentación adicional (Opcional)</p>
                      <input 
                        type="file" 
                        multiple 
                        accept=".pdf,.png,.jpg"
                        onChange={(e) => {
                          if (e.target.files) {
                            const filesArray = Array.from(e.target.files).slice(0, 2);
                            setParentAnswers(prev => ({ ...prev, q2_files: filesArray }));
                          }
                        }}
                        className="block w-full text-xs sm:text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#F5EFE9] file:text-[#845326] hover:file:bg-[#eadecf] cursor-pointer focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-2 leading-tight">
                        Nota: Puedes subir diagnósticos o notas de profesores (Máx. 2 archivos). Estos datos son estrictamente privados, opcionales y la IA los utilizará exclusivamente para personalizar los proyectos.
                      </p>
                    </div>
                  </>
                ) : currentStep === 2 && onboardingPath === 'parent_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Cuál es el mayor obstáculo cuando se sienta a estudiar?
                      </h2>
                    </div>
                    
                    <div className="space-y-2.5 mb-6">
                      {['Parálisis de inicio', 'Frustración rápida', 'Distracción constante', 'Desorganización', 'Aburrimiento profundo', 'Otro'].map((option, idx) => {
                        const selectedObstacles = (parentAnswers['q3_obstacles'] || []) as string[];
                        const isSelected = selectedObstacles.includes(option);
                        
                        return (
                          <div key={idx} className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (saveError) setSaveError(null);
                                const newSelection = isSelected
                                  ? selectedObstacles.filter(item => item !== option)
                                  : [...selectedObstacles, option];
                                setParentAnswers(prev => ({ ...prev, q3_obstacles: newSelection }));
                              }}
                              className={`w-full rounded-[16px] py-3 px-[18px] text-left text-sm sm:text-base flex items-center justify-between transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#F5EFE9] border-[1.5px] border-[#2C1F14] text-[#2C1F14] font-semibold shadow-xs'
                                  : 'bg-white border-[1.5px] border-[#E2D9D0] text-[#2C1F14] hover:bg-[#F5EFE9] hover:border-[#2C1F14]'
                              }`}
                            >
                              <span className="pr-3 leading-snug">{option}</span>
                              <span
                                className={`size-5 shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'border-[#2C1F14] bg-[#2C1F14] text-white'
                                    : 'border-[#E2D9D0] bg-transparent'
                                }`}
                              >
                                {isSelected && <Check className="size-3 stroke-[3]" />}
                              </span>
                            </button>
                            {option === 'Otro' && isSelected && (
                              <input
                                type="text"
                                maxLength={60}
                                placeholder="Especifica el obstáculo..."
                                value={parentAnswers['q3_other_text'] || ''}
                                onChange={(e) => setParentAnswers(prev => ({ ...prev, q3_other_text: e.target.value }))}
                                className="w-full mt-1 bg-white border-[1.5px] border-[#E2D9D0] rounded-[12px] py-2.5 px-4 text-sm text-[#2C1F14] placeholder-gray-400 focus:outline-none focus:border-[#2C1F14] transition-colors"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : currentStep === 3 && onboardingPath === 'parent_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Cuáles son los temas o actividades que le apasionan obsesivamente?
                      </h2>
                    </div>
                    
                    <div className="mb-6">
                      <textarea
                        maxLength={150}
                        rows={4}
                        placeholder="Ej: Dinosaurios, videojuegos, el espacio, construir cosas..."
                        value={parentAnswers['q4_interests'] || ''}
                        onChange={(e) => {
                          if (saveError) setSaveError(null);
                          setParentAnswers(prev => ({ ...prev, q4_interests: e.target.value }))
                        }}
                        className="w-full bg-white border-[1.5px] border-[#E2D9D0] rounded-[16px] py-3 px-4 text-sm sm:text-base text-[#2C1F14] placeholder-gray-400 focus:outline-none focus:border-[#2C1F14] transition-colors resize-none"
                      />
                      <div className="text-right mt-1.5 text-xs font-semibold text-gray-400">
                        {(parentAnswers['q4_interests'] || '').length}/150
                      </div>
                    </div>
                  </>
                ) : currentStep === 4 && onboardingPath === 'parent_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Cuánto tiempo continuo puede mantener la atención?
                      </h2>
                    </div>
                    
                    <div className="space-y-2.5 mb-6">
                      {['5–10 min', '15–20 min', '30+ min'].map((option, idx) => {
                        const isSelected = parentAnswers['q5_time'] === option;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              setParentAnswers((prev) => ({ ...prev, q5_time: option }));
                            }}
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
                  </>
                ) : currentStep === 5 && onboardingPath === 'parent_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Qué tipo de apoyo prefieres recibir en el plan generado?
                      </h2>
                    </div>
                    
                    <div className="space-y-2.5 mb-6">
                      {['Indicaciones paso a paso', 'Recordatorios de pausas', 'Enlaces a recursos visuales', 'Guiones cortos de explicación'].map((option, idx) => {
                        const selectedSupport = (parentAnswers['q6_support'] || []) as string[];
                        const isSelected = selectedSupport.includes(option);
                        
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              const newSelection = isSelected
                                ? selectedSupport.filter(item => item !== option)
                                : [...selectedSupport, option];
                              setParentAnswers(prev => ({ ...prev, q6_support: newSelection }));
                            }}
                            className={`w-full rounded-[16px] py-3 px-[18px] text-left text-sm sm:text-base flex items-center justify-between transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'bg-[#F5EFE9] border-[1.5px] border-[#2C1F14] text-[#2C1F14] font-semibold shadow-xs'
                                : 'bg-white border-[1.5px] border-[#E2D9D0] text-[#2C1F14] hover:bg-[#F5EFE9] hover:border-[#2C1F14]'
                            }`}
                          >
                            <span className="pr-3 leading-snug">{option}</span>
                            <span
                              className={`size-5 shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
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
                  </>
                ) : currentStep === 0 && onboardingPath === 'student_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Qué tema, pasatiempo o universo te apasiona completamente en este momento?
                      </h2>
                    </div>
                    
                    <div className="mb-6">
                      <textarea
                        maxLength={100}
                        rows={4}
                        placeholder="Ej: Dinosaurios, videojuegos, el espacio, construir cosas..."
                        value={studentAnswers['q1_interests'] || ''}
                        onChange={(e) => {
                          if (saveError) setSaveError(null);
                          setStudentAnswers(prev => ({ ...prev, q1_interests: e.target.value }))
                        }}
                        className="w-full bg-white border-[1.5px] border-[#E2D9D0] rounded-[16px] py-3 px-4 text-sm sm:text-base text-[#2C1F14] placeholder-gray-400 focus:outline-none focus:border-[#2C1F14] transition-colors resize-none"
                      />
                      <div className="text-right mt-1.5 text-xs font-semibold text-gray-400">
                        {(studentAnswers['q1_interests'] || '').length}/100
                      </div>
                    </div>
                  </>
                ) : currentStep === 1 && onboardingPath === 'student_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿En qué nivel educativo o situación actual te encuentras?
                      </h2>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {['Primaria', 'Secundaria', 'Universidad', 'Trabajo', 'No estudio ni trabajo'].map((option, idx) => {
                        const isSelected = studentAnswers['q2_level'] === option;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              setStudentAnswers((prev) => ({ ...prev, q2_level: option }));
                            }}
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
                  </>
                ) : currentStep === 2 && onboardingPath === 'student_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Cómo prefieres que la IA incorpore tu tema favorito?
                      </h2>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {[
                        'Usa analogías y ejemplos basados en mi tema favorito.',
                        'Redacta las tareas como si fueran misiones de ese universo.',
                        'Solo úsalo para darme ejemplos prácticos en conceptos abstractos.'
                      ].map((option, idx) => {
                        const isSelected = studentAnswers['q3_ai_usage'] === option;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              setStudentAnswers((prev) => ({ ...prev, q3_ai_usage: option }));
                            }}
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
                  </>
                ) : currentStep === 3 && onboardingPath === 'student_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿De qué forma procesas mejor la información al aprender?
                      </h2>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {['Videos cortos', 'Artículos con viñetas', 'Infografías', 'Audios/Podcasts'].map((option, idx) => {
                        const selectedFormats = (studentAnswers['q4_format'] || []) as string[];
                        const isSelected = selectedFormats.includes(option);
                        
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              const newSelection = isSelected
                                ? selectedFormats.filter(item => item !== option)
                                : [...selectedFormats, option];
                              setStudentAnswers(prev => ({ ...prev, q4_format: newSelection }));
                            }}
                            className={`w-full rounded-[16px] py-3 px-[18px] text-left text-sm sm:text-base flex items-center justify-between transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'bg-[#F5EFE9] border-[1.5px] border-[#2C1F14] text-[#2C1F14] font-semibold shadow-xs'
                                : 'bg-white border-[1.5px] border-[#E2D9D0] text-[#2C1F14] hover:bg-[#F5EFE9] hover:border-[#2C1F14]'
                            }`}
                          >
                            <span className="pr-3 leading-snug">{option}</span>
                            <span
                              className={`size-5 shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
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
                  </>
                ) : currentStep === 4 && onboardingPath === 'student_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Cuál es tu mayor desafío al abordar un proyecto o tarea?
                      </h2>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {[
                        'Saber por dónde empezar (parálisis por análisis)', 
                        'Mantener el interés en textos largos', 
                        'Cambiar de una tarea a otra', 
                        'Retener muchas instrucciones a la vez'
                      ].map((option, idx) => {
                        const selectedChallenges = (studentAnswers['q5_challenges'] || []) as string[];
                        const isSelected = selectedChallenges.includes(option);
                        
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              const newSelection = isSelected
                                ? selectedChallenges.filter(item => item !== option)
                                : [...selectedChallenges, option];
                              setStudentAnswers(prev => ({ ...prev, q5_challenges: newSelection }));
                            }}
                            className={`w-full rounded-[16px] py-3 px-[18px] text-left text-sm sm:text-base flex items-center justify-between transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'bg-[#F5EFE9] border-[1.5px] border-[#2C1F14] text-[#2C1F14] font-semibold shadow-xs'
                                : 'bg-white border-[1.5px] border-[#E2D9D0] text-[#2C1F14] hover:bg-[#F5EFE9] hover:border-[#2C1F14]'
                            }`}
                          >
                            <span className="pr-3 leading-snug">{option}</span>
                            <span
                              className={`size-5 shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
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
                  </>
                ) : currentStep === 5 && onboardingPath === 'student_inclusive' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        ¿Cómo prefieres que dividamos tus tareas?
                      </h2>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {[
                        'Micro-pasos de 5-10 min', 
                        'Bloques medianos de 20 min', 
                        'Bloques de 30 min o más'
                      ].map((option, idx) => {
                        const isSelected = studentAnswers['q6_pace'] === option;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (saveError) setSaveError(null);
                              setStudentAnswers((prev) => ({ ...prev, q6_pace: option }));
                            }}
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
                  </>
                ) : (
                  <>
                    {/* Pregunta Actual */}
                    <div className="mb-5">
                      <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] leading-snug tracking-tight">
                        {currentQuestion?.question}
                      </h2>
                    </div>

                    {/* Opciones de Respuesta (Botones) */}
                    <div className="space-y-2.5 mb-6">
                      {currentQuestion?.options.map((option, idx) => {
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
                  </>
                )}
              </>
            )}

            {/* Botones de Navegación Inferior */}
            <div className="flex items-center justify-between pt-4 border-t border-[#EAE3DC]">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentStep === -1}
                className="rounded-[25px] bg-[#E8DCD1] hover:bg-[#dfd1c4] text-[#2C1F14] px-5 py-2.5 font-semibold text-xs sm:text-sm transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 active:scale-[0.99]"
              >
                <ArrowLeft className="size-3.5" />
                <span>{copy.previous}</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={
                  currentStep === -1 
                    ? !onboardingPath 
                    : (onboardingPath === 'parent_inclusive'
                        ? (currentStep === 0 ? !parentAnswers['q1'] || isFinishing
                          : currentStep === 1 ? (!parentAnswers['q2_conditions'] || parentAnswers['q2_conditions'].length === 0) || isFinishing
                          : currentStep === 2 ? (!parentAnswers['q3_obstacles'] || parentAnswers['q3_obstacles'].length === 0 || ((parentAnswers['q3_obstacles'] as string[]).includes('Otro') && !(parentAnswers['q3_other_text']?.trim()))) || isFinishing
                          : currentStep === 3 ? !(parentAnswers['q4_interests']?.trim()) || isFinishing
                          : currentStep === 4 ? !parentAnswers['q5_time'] || isFinishing
                          : currentStep === 5 ? (!parentAnswers['q6_support'] || parentAnswers['q6_support'].length === 0) || isFinishing
                          : !selectedAnswer || isFinishing)
                        : onboardingPath === 'student_inclusive'
                        ? (currentStep === 0 ? !(studentAnswers['q1_interests']?.trim()) || isFinishing
                          : currentStep === 1 ? !studentAnswers['q2_level'] || isFinishing
                          : currentStep === 2 ? !studentAnswers['q3_ai_usage'] || isFinishing
                          : currentStep === 3 ? (!studentAnswers['q4_format'] || studentAnswers['q4_format'].length === 0) || isFinishing
                          : currentStep === 4 ? (!studentAnswers['q5_challenges'] || studentAnswers['q5_challenges'].length === 0) || isFinishing
                          : currentStep === 5 ? !studentAnswers['q6_pace'] || isFinishing
                          : !selectedAnswer || isFinishing)
                        : !selectedAnswer || isFinishing)
                }
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
    </>
  );
}
