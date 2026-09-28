import esDict from './locales/es.json';
import enDict from './locales/en.json';
import { SupportedLocale, ModerationDictionary, ContentValidationResult } from './types';

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DICTIONARIES: Record<SupportedLocale, ModerationDictionary> = {
  es: esDict as ModerationDictionary,
  en: enDict as ModerationDictionary,
};

function prepareWordSet(words: string[]): Set<string> {
  const set = new Set<string>();
  for (const word of words) {
    const norm = normalizeText(word);
    if (norm) {
      set.add(norm);
    }
  }
  return set;
}

function preparePhrases(phrases: string[]): string[] {
  return phrases.map((phrase) => normalizeText(phrase)).filter(Boolean);
}

const DANGEROUS_WORDS = prepareWordSet([...esDict.dangerous.words, ...enDict.dangerous.words]);
const DANGEROUS_PHRASES = preparePhrases([
  ...esDict.dangerous.phrases,
  ...enDict.dangerous.phrases,
]);
const OBSCENE_WORDS = prepareWordSet([...esDict.obscene.words, ...enDict.obscene.words]);
const OBSCENE_PHRASES = preparePhrases([...esDict.obscene.phrases, ...enDict.obscene.phrases]);

export function validateClientContent(
  text: string,
  locale: SupportedLocale = 'es',
): ContentValidationResult {
  if (!text || text.trim() === '') {
    return { isValid: true };
  }

  const messages = DICTIONARIES[locale]?.messages || DICTIONARIES.es.messages;
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(Boolean);

  const rawAlphabeticalWords = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const candidateWords = new Set([...words, ...rawAlphabeticalWords]);

  for (const word of candidateWords) {
    if (DANGEROUS_WORDS.has(word)) {
      return {
        isValid: false,
        error: messages.dangerous,
        detectedTerm: word,
        type: 'dangerous',
      };
    }
  }

  for (const phrase of DANGEROUS_PHRASES) {
    if (normalized.includes(phrase)) {
      return {
        isValid: false,
        error: messages.dangerous,
        detectedTerm: phrase,
        type: 'dangerous',
      };
    }
  }

  for (const word of candidateWords) {
    if (OBSCENE_WORDS.has(word)) {
      return {
        isValid: false,
        error: 'No se permiten contenidos obscenos.',
        detectedTerm: word,
        type: 'obscene',
      };
    }
  }

  for (const phrase of OBSCENE_PHRASES) {
    if (normalized.includes(phrase)) {
      return {
        isValid: false,
        error: 'No se permiten contenidos obscenos.',
        detectedTerm: phrase,
        type: 'obscene',
      };
    }
  }

  return { isValid: true };
}

/**
 * Retorna true si el texto (nombre de archivo, URL, descripción) contiene contenido obsceno.
 */
export function hasObsceneContent(text: string): boolean {
  const result = validateClientContent(text);
  return !result.isValid && result.type === 'obscene';
}
