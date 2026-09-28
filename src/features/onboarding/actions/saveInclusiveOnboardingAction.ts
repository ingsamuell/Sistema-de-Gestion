'use server';

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  getInclusiveContent,
  type InclusiveAnswer,
  type InclusivePath,
} from '@/features/onboarding/data/inclusiveQuestions';

const allowedPaths = new Set<InclusivePath>(['parent_inclusive', 'student_inclusive']);
const maxAnswerKeys = 6;

export interface InclusiveOnboardingInput {
  path: InclusivePath;
  answers: Record<string, InclusiveAnswer>;
  consent: boolean;
}

export interface SaveInclusiveOnboardingResponse {
  success: boolean;
  error?: string;
}

function hasValidAnswers(path: InclusivePath, answers: Record<string, InclusiveAnswer>): boolean {
  const questions = getInclusiveContent('es', path).questions;
  const expectedIds = new Set(questions.map((question) => question.id));
  const entries = Object.entries(answers);

  if (entries.length !== maxAnswerKeys || entries.some(([id]) => !expectedIds.has(id)))
    return false;

  return questions.every((question) => {
    const answer = answers[question.id];
    if (question.type === 'text') {
      return (
        typeof answer === 'string' &&
        answer.trim().length > 0 &&
        answer.length <= (question.maxLength || 150)
      );
    }

    const validOptions = new Set([
      ...(getInclusiveContent('es', path).questions.find((item) => item.id === question.id)
        ?.options || []),
      ...(getInclusiveContent('en', path).questions.find((item) => item.id === question.id)
        ?.options || []),
    ]);
    if (question.type === 'single') return typeof answer === 'string' && validOptions.has(answer);
    return (
      Array.isArray(answer) &&
      answer.length > 0 &&
      answer.length <= 6 &&
      new Set(answer).size === answer.length &&
      answer.every((item) => validOptions.has(item))
    );
  });
}

export async function saveInclusiveOnboardingAnswers(
  input: InclusiveOnboardingInput,
): Promise<SaveInclusiveOnboardingResponse> {
  if (!allowedPaths.has(input.path))
    return { success: false, error: 'Ruta de onboarding no válida.' };
  if (!input.consent)
    return { success: false, error: 'Debes aceptar el uso de estas preferencias para continuar.' };

  if (!hasValidAnswers(input.path, input.answers)) {
    return { success: false, error: 'Las respuestas del onboarding no son válidas.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: 'No se encontró una sesión activa.' };

  const { error } = await supabase.from('onboarding_inclusive_preferences').upsert(
    {
      user_id: user.id,
      onboarding_path: input.path,
      answers: input.answers,
      consented_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error)
    return { success: false, error: `No fue posible guardar tus preferencias: ${error.message}` };

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { onboarding_completed: true },
  });
  if (metadataError)
    return {
      success: false,
      error: 'Las preferencias se guardaron, pero no se pudo completar el onboarding.',
    };

  return { success: true };
}
