'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { saveOnboardingAnswers } from '@/features/onboarding/actions/saveOnboardingAction';
import { saveInclusiveOnboardingAnswers } from '@/features/onboarding/actions/saveInclusiveOnboardingAction';
import {
  getInclusiveContent,
  type InclusiveAnswer,
  type InclusivePath,
} from '@/features/onboarding/data/inclusiveQuestions';
import { getOnboardingQuestions } from '@/features/onboarding/data/questions';
import type { Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

type OnboardingPath = 'standard' | InclusivePath;

export type OnboardingSubmission =
  | { path: 'standard'; answers: Record<number, string> }
  | { path: InclusivePath; answers: Record<string, InclusiveAnswer>; consent: true };

export interface OnboardingSurveyProps {
  locale: Locale;
  devModeOverride?: (submission: OnboardingSubmission) => void | Promise<void>;
}

const copy = {
  es: {
    welcome: 'Hola, soy la Mariposa del Destino',
    prompt: '¿Qué experiencia deseas configurar?',
    standard: 'Continuar con el plan estándar',
    parent: 'Soy familiar o cuidador de un estudiante',
    student: 'Es para mi uso personal',
    privacy:
      'Tus respuestas inclusivas son voluntarias. No pedimos ni guardamos diagnósticos o documentos médicos.',
    consent: 'Confirmación de privacidad',
    consentDescription:
      'Autorizo a Komorebi a guardar estas preferencias voluntarias para personalizar mi experiencia de estudio. Puedo solicitar su eliminación al equipo.',
    consentAi: 'Estas preferencias no se enviarán automáticamente a servicios de IA.',
    step: 'Paso',
    of: 'de',
    previous: 'Anterior',
    next: 'Siguiente',
    finish: 'Finalizar',
    saving: 'Guardando…',
    required: 'Selecciona o escribe una respuesta para continuar.',
    saveError: 'No fue posible guardar tus respuestas. Inténtalo de nuevo.',
    unexpected: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
    standardSpeech: 'Conocer tus hábitos nos ayuda a proponerte un mejor plan de estudio.',
  },
  en: {
    welcome: 'Hi, I am the Destiny Butterfly',
    prompt: 'Which experience would you like to set up?',
    standard: 'Continue with the standard plan',
    parent: 'I am a family member or caregiver',
    student: 'This is for my personal use',
    privacy:
      'Inclusive answers are voluntary. We do not request or store diagnoses or medical documents.',
    consent: 'Privacy confirmation',
    consentDescription:
      'I authorize Komorebi to store these voluntary preferences to personalize my study experience. I can ask the team to delete them.',
    consentAi: 'These preferences will not be sent automatically to AI services.',
    step: 'Step',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    finish: 'Finish',
    saving: 'Saving…',
    required: 'Select or write an answer to continue.',
    saveError: 'We could not save your answers. Please try again.',
    unexpected: 'An unexpected error occurred. Please try again.',
    standardSpeech: 'Learning about your habits helps us suggest a better study plan.',
  },
} as const;

const mascotImages: Record<InclusivePath, string[]> = {
  parent_inclusive: [
    '/images/mascot/ChiwiMartha.png',
    '/images/mascot/familiaMartha.png',
    '/images/mascot/mrchiwimarthapregunta3.png',
    '/images/mascot/marthaychiwipregunta4.png',
    '/images/mascot/chiwimarthapregunta5.png',
    '/images/mascot/chiwimarthapregunta6.png',
  ],
  student_inclusive: [
    '/images/mascot/marthapregunta1.png',
    '/images/mascot/marthapregunta2.png',
    '/images/mascot/marthapregunta3.png',
    '/images/mascot/marthapregunta4.png',
    '/images/mascot/marthapregunta5.png',
    '/images/mascot/marthapregunta6.png',
  ],
};

export function OnboardingSurvey({ locale, devModeOverride }: OnboardingSurveyProps) {
  const router = useRouter();
  const text = copy[locale];
  const standardQuestions = getOnboardingQuestions(locale);
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [step, setStep] = useState(-1);
  const [standardAnswers, setStandardAnswers] = useState<Record<number, string>>({});
  const [inclusiveAnswers, setInclusiveAnswers] = useState<Record<string, InclusiveAnswer>>({});
  const [hasConsent, setHasConsent] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const inclusiveContent = path && path !== 'standard' ? getInclusiveContent(locale, path) : null;
  const isConsentStep = Boolean(inclusiveContent && step === inclusiveContent.questions.length);
  const currentStandardQuestion = path === 'standard' && step >= 0 ? standardQuestions[step] : null;
  const currentInclusiveQuestion =
    inclusiveContent && step >= 0 && !isConsentStep ? inclusiveContent.questions[step] : null;
  const totalSteps =
    path === 'standard'
      ? standardQuestions.length
      : inclusiveContent
        ? inclusiveContent.questions.length + 1
        : 0;
  const progress = step >= 0 && totalSteps ? Math.round(((step + 1) / totalSteps) * 100) : 0;
  const selectedValue = currentInclusiveQuestion
    ? inclusiveAnswers[currentInclusiveQuestion.id]
    : undefined;
  const clearError = () => saveError && setSaveError(null);

  const canContinue = () => {
    if (step === -1) return Boolean(path);
    if (isConsentStep) return hasConsent;
    if (currentStandardQuestion) return Boolean(standardAnswers[currentStandardQuestion.id]);
    if (currentInclusiveQuestion?.type === 'text')
      return typeof selectedValue === 'string' && selectedValue.trim().length > 0;
    return Array.isArray(selectedValue) ? selectedValue.length > 0 : Boolean(selectedValue);
  };

  const setInclusiveValue = (value: InclusiveAnswer) => {
    if (!currentInclusiveQuestion) return;
    clearError();
    setInclusiveAnswers((answers) => ({ ...answers, [currentInclusiveQuestion.id]: value }));
  };
  const toggleInclusiveOption = (option: string) => {
    if (!currentInclusiveQuestion) return;
    if (currentInclusiveQuestion.type === 'single') return setInclusiveValue(option);
    const selected = Array.isArray(selectedValue) ? selectedValue : [];
    setInclusiveValue(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option],
    );
  };

  const complete = async () => {
    setSaveError(null);
    setIsFinishing(true);
    try {
      const submission: OnboardingSubmission =
        path === 'standard'
          ? { path: 'standard', answers: standardAnswers }
          : { path: path as InclusivePath, answers: inclusiveAnswers, consent: true };
      if (devModeOverride) {
        await devModeOverride(submission);
        setIsFinishing(false);
        return;
      }
      const result =
        path === 'standard'
          ? await saveOnboardingAnswers({
              rol_condicion: standardAnswers[1] || '',
              edad: standardAnswers[2] || '',
              situacion_laboral: standardAnswers[3] || '',
              jornada_horarios: standardAnswers[4] || '',
              tiempo_diario_min: standardAnswers[5] || '',
              metodologia: standardAnswers[6] || '',
              experiencia: standardAnswers[7] || '',
            })
          : await saveInclusiveOnboardingAnswers({
              path: path as InclusivePath,
              answers: inclusiveAnswers,
              consent: hasConsent,
            });
      if (!result.success) {
        setSaveError(result.error || text.saveError);
        setIsFinishing(false);
        return;
      }
      if (typeof window !== 'undefined')
        localStorage.setItem('komorebi_onboarding_completed', 'true');
      router.push(localizedHref(locale, 'app'));
      router.refresh();
    } catch {
      setSaveError(text.unexpected);
      setIsFinishing(false);
    }
  };
  const next = () => {
    if (!canContinue()) return setSaveError(text.required);
    if (step < totalSteps - 1) setStep((value) => value + 1);
    else void complete();
  };
  const previous = () => {
    if (step > -1) setStep((value) => value - 1);
    clearError();
  };

  const heading =
    step === -1
      ? text.welcome
      : inclusiveContent
        ? inclusiveContent.title
        : locale === 'es'
          ? 'Hola, me llamo Mr. Chiwi'
          : 'Hi, my name is Mr. Chiwi';
  const subheading =
    step === -1
      ? text.prompt
      : inclusiveContent
        ? inclusiveContent.subtitle
        : locale === 'es'
          ? 'Quiero conocerte mejor'
          : 'I want to get to know you better';
  const speech =
    currentInclusiveQuestion?.speech || currentStandardQuestion?.chiwiSpeech || text.standardSpeech;
  const inclusiveImage =
    inclusiveContent && step >= 0 && !isConsentStep
      ? mascotImages[path as InclusivePath][step]
      : null;

  return (
    <div className="w-full max-w-5xl px-4 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="flex flex-col items-center text-center">
          <h1 className="font-handwriting text-3xl font-bold tracking-wide text-[#2C1F14] sm:text-4xl">
            {heading}
          </h1>
          <p className="mt-1 font-handwriting text-xl font-semibold text-[#845326] sm:text-2xl">
            {subheading}
          </p>
          <div className="mt-5 max-w-md rounded-[40px] border-2 border-[#1A1A1A] bg-white px-6 py-4 shadow-sm">
            <p className="font-handwriting font-bold text-[#1A1A1A]">
              {step === -1 ? text.privacy : speech}
            </p>
          </div>
          <div className="relative mt-4 h-64 w-full max-w-sm sm:h-72">
            {step === -1 ? (
              <Image
                src="/images/mascot/mariposa.png"
                alt=""
                fill
                priority
                className="object-contain"
              />
            ) : inclusiveImage ? (
              <Image src={inclusiveImage} alt="" fill priority className="object-contain" />
            ) : (
              <Image
                src="/images/mascot/chigui-welcome.png"
                alt="Mr. Chiwi"
                fill
                priority
                className="object-contain"
              />
            )}
          </div>
        </section>
        <section className="rounded-[20px] border border-[#EAE3DC] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] sm:p-8">
          {step >= 0 && (
            <Progress
              step={step}
              total={totalSteps}
              percent={progress}
              label={text.step}
              of={text.of}
            />
          )}
          {saveError && (
            <div className="mb-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {saveError}
            </div>
          )}
          {step === -1 ? (
            <div className="space-y-3">
              {(
                [
                  ['standard', text.standard],
                  ['parent_inclusive', text.parent],
                  ['student_inclusive', text.student],
                ] as const
              ).map(([option, label]) => (
                <Choice
                  key={option}
                  label={label}
                  selected={path === option}
                  onClick={() => {
                    clearError();
                    setPath(option);
                  }}
                />
              ))}
            </div>
          ) : isConsentStep ? (
            <Consent
              text={text}
              checked={hasConsent}
              onChange={(checked) => {
                clearError();
                setHasConsent(checked);
              }}
            />
          ) : currentStandardQuestion ? (
            <QuestionCard
              question={currentStandardQuestion.question}
              options={currentStandardQuestion.options}
              selected={standardAnswers[currentStandardQuestion.id]}
              onToggle={(option) => {
                clearError();
                setStandardAnswers((answers) => ({
                  ...answers,
                  [currentStandardQuestion.id]: option,
                }));
              }}
            />
          ) : currentInclusiveQuestion ? (
            <QuestionCard
              question={currentInclusiveQuestion.question}
              options={currentInclusiveQuestion.options}
              type={currentInclusiveQuestion.type}
              selected={selectedValue}
              placeholder={currentInclusiveQuestion.placeholder}
              maxLength={currentInclusiveQuestion.maxLength}
              onToggle={toggleInclusiveOption}
              onText={setInclusiveValue}
            />
          ) : null}
          <div className="mt-6 flex items-center justify-between border-t border-[#EAE3DC] pt-4">
            <button
              type="button"
              onClick={previous}
              disabled={step === -1 || isFinishing}
              className="inline-flex items-center gap-1 rounded-full bg-[#E8DCD1] px-5 py-2.5 text-sm font-semibold text-[#2C1F14] disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
              {text.previous}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!canContinue() || isFinishing}
              className="inline-flex items-center gap-1 rounded-full bg-[#2C1F14] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {isFinishing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {text.saving}
                </>
              ) : step === totalSteps - 1 ? (
                <>
                  {text.finish}
                  <Sparkles className="size-4 text-[#FEB800]" />
                </>
              ) : (
                <>
                  {text.next}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Progress({
  step,
  total,
  percent,
  label,
  of,
}: {
  step: number;
  total: number;
  percent: number;
  label: string;
  of: string;
}) {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex justify-between text-xs font-bold text-[#2C1F14]">
        <span>
          {label} {step + 1} {of} {total}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E8DCD1]">
        <div
          className="h-full rounded-full bg-[#2C1F14] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border-[1.5px] px-5 py-4 text-left text-sm transition ${selected ? 'border-[#2C1F14] bg-[#F5EFE9] font-semibold' : 'border-[#E2D9D0] hover:border-[#2C1F14]'}`}
    >
      <span>{label}</span>
      <span
        className={`flex size-5 items-center justify-center rounded-full border ${selected ? 'border-[#2C1F14] bg-[#2C1F14] text-white' : 'border-[#E2D9D0]'}`}
      >
        {selected && <Check className="size-3" />}
      </span>
    </button>
  );
}
function Consent({
  text,
  checked,
  onChange,
}: {
  text: (typeof copy)[Locale];
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#2C1F14]">{text.consent}</h2>
      <p className="text-sm leading-relaxed text-[#5E5148]">{text.consentDescription}</p>
      <p className="rounded-xl bg-[#F5EFE9] p-3 text-sm font-medium text-[#5E5148]">
        {text.consentAi}
      </p>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E2D9D0] p-4 text-sm text-[#2C1F14]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 accent-[#2C1F14]"
        />
        <span>{text.consentDescription}</span>
      </label>
    </div>
  );
}
function QuestionCard({
  question,
  options,
  type = 'single',
  selected,
  placeholder,
  maxLength,
  onToggle,
  onText,
}: {
  question: string;
  options?: string[];
  type?: 'single' | 'multiple' | 'text';
  selected?: InclusiveAnswer;
  placeholder?: string;
  maxLength?: number;
  onToggle: (option: string) => void;
  onText?: (value: string) => void;
}) {
  if (type === 'text')
    return (
      <div>
        <h2 className="mb-5 text-xl font-bold leading-snug text-[#2C1F14] sm:text-2xl">
          {question}
        </h2>
        <textarea
          rows={4}
          maxLength={maxLength}
          value={typeof selected === 'string' ? selected : ''}
          onChange={(event) => onText?.(event.target.value)}
          placeholder={placeholder}
          className="w-full resize-none rounded-2xl border-[1.5px] border-[#E2D9D0] p-4 text-sm outline-none focus:border-[#2C1F14]"
        />
        <p className="mt-1 text-right text-xs text-gray-500">
          {typeof selected === 'string' ? selected.length : 0}/{maxLength}
        </p>
      </div>
    );
  const selectedOptions = Array.isArray(selected) ? selected : selected ? [selected] : [];
  return (
    <div>
      <h2 className="mb-5 text-xl font-bold leading-snug text-[#2C1F14] sm:text-2xl">{question}</h2>
      <div className="space-y-2.5">
        {options?.map((option) => (
          <Choice
            key={option}
            label={option}
            selected={selectedOptions.includes(option)}
            onClick={() => onToggle(option)}
          />
        ))}
      </div>
    </div>
  );
}
