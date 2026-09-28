export interface ComplementaryQuestionOption {
  id: string;
  label: string;
  field: 'objetivo' | 'ritmo' | 'dificultades' | 'area_prioritaria';
  description?: string;
  isMultiple?: boolean;
  options: string[];
}

const learningOptions = {
  es: {
    objectives: [
      'Aprobar una materia o examen académico',
      'Desarrollar un proyecto extenso (Tesis, Trabajo de Grado)',
      'Aprender una nueva habilidad por cuenta propia',
      'Mejorar mi perfil profesional / Actualizar portafolio',
      'Aprender por hobby o crecimiento personal',
    ],
    paces: [
      'Constante y moderado',
      'Intensivo / Inmersivo',
      'Fines de semana / Bloques concentrados',
      'Relajado y flexible',
    ],
    difficulties: [
      'Procrastinación severa',
      'Falta de constancia',
      'Distracciones frecuentes',
      'Mala estimación del tiempo',
    ],
    priorityAreas: [
      'Tecnología, Informática y Datos',
      'Ciencias Exactas e Ingeniería',
      'Negocios, Finanzas y Emprendimiento',
      'Idiomas y Comunicación',
      'Artes, Diseño y Humanidades',
      'Ciencias de la Salud o Biológicas',
    ],
  },
  en: {
    objectives: [
      'Pass a course or academic exam',
      'Develop an extensive project (thesis or degree project)',
      'Learn a new skill independently',
      'Improve my professional profile or update my portfolio',
      'Learn for a hobby or personal growth',
    ],
    paces: [
      'Steady and moderate',
      'Intensive / immersive',
      'Weekends / focused blocks',
      'Relaxed and flexible',
    ],
    difficulties: [
      'Severe procrastination',
      'Lack of consistency',
      'Frequent distractions',
      'Poor time estimation',
    ],
    priorityAreas: [
      'Technology, computing, and data',
      'Exact sciences and engineering',
      'Business, finance, and entrepreneurship',
      'Languages and communication',
      'Arts, design, and humanities',
      'Health and biological sciences',
    ],
  },
} as const;

export type LearningOptionGroup = keyof (typeof learningOptions)['es'];

export function getLearningOptions(locale: 'es' | 'en') {
  return learningOptions[locale];
}

export function localizeLearningOption(
  value: string,
  group: LearningOptionGroup,
  locale: 'es' | 'en',
) {
  const index = learningOptions.es[group].indexOf(value as never);
  if (index >= 0) return learningOptions[locale][group][index];

  const englishIndex = learningOptions.en[group].indexOf(value as never);
  return englishIndex >= 0 ? learningOptions[locale][group][englishIndex] : value;
}

export function toCanonicalLearningOption(value: string, group: LearningOptionGroup) {
  const englishIndex = learningOptions.en[group].indexOf(value as never);
  return englishIndex >= 0 ? learningOptions.es[group][englishIndex] : value;
}

export const OBJETIVOS_OPTIONS = learningOptions.es.objectives;
export const RITMOS_OPTIONS = learningOptions.es.paces;
export const DIFICULTADES_OPTIONS = learningOptions.es.difficulties;
export const AREAS_PRIORITARIAS_OPTIONS = learningOptions.es.priorityAreas;
