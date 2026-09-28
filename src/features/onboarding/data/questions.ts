export interface OnboardingQuestion {
  id: number;
  question: string;
  chiwiSpeech: string;
  options: string[];
}

const questions: Record<'es' | 'en', OnboardingQuestion[]> = {
  es: [
    {
      id: 1,
      question: '¿Cuál es tu rol o condición actual?',
      chiwiSpeech: 'yo soy un chiwire autodidacta',
      options: [
        'Estudiante de bachillerato',
        'Estudiante universitario',
        'Autodidacta',
        'Profesional independiente',
      ],
    },
    {
      id: 2,
      question: '¿Cuál es tu edad?',
      chiwiSpeech: 'yo tengo 5 años de chiwire',
      options: ['Menos de 18', 'Entre 18 y 25 años', '26 años o más'],
    },
    {
      id: 3,
      question: '¿Cuál es tu situación laboral u ocupación actual?',
      chiwiSpeech: 'Mi trabajo es ser tu tutor ¡Me Chiwiencanta!',
      options: ['Solo estudio', 'Solo trabajo', 'Estudio y trabajo', 'Ninguna de las anteriores'],
    },
    {
      id: 4,
      question: '¿Qué tipo de esquema de horarios tienes en tu ocupación principal?',
      chiwiSpeech: 'Yo siempre estare disponible en tu horario, porque soy tu chiwire de confianza',
      options: [
        'Jornada completa',
        'Media jornada',
        'Jornada nocturna',
        'Horario rotativo, flexible o impredecible',
      ],
    },
    {
      id: 5,
      question: '¿Cuánto tiempo diario tienes disponible para dedicar a tus proyectos de estudio?',
      chiwiSpeech: 'Chiwitastico, espero que pasemos mucho tiempo juntos',
      options: [
        'Entre 30 a 60 minutos al día',
        'Entre 1 a 2 horas al día',
        'Entre 2 a 4 horas al día',
        'Más de 4 horas al día',
      ],
    },
    {
      id: 6,
      question: '¿Qué técnica o metodología de aprendizaje prefieres utilizar inicialmente?',
      chiwiSpeech:
        'Tu no te preocupes este chiwire te enseñara a cumplir tus metas con tecnicas reales de estudio, sino mirame a mi que soy tutor',
      options: [
        'Método Pomodoro',
        'Regla 50/10',
        'Ritmos Ultradianos',
        'Pausas Activas',
        'No tengo experiencia previa con estas técnicas',
      ],
    },
    {
      id: 7,
      question: '¿Cuál es tu nivel de experiencia previa estructurando planes de estudio?',
      chiwiSpeech: 'Chiwires somos tu y yo. A darle a esos proyectos. Animo!!',
      options: [
        'Básico (Me cuesta organizarme y suelo procrastinar)',
        'Intermedio (Uso listas de tareas, pero no siempre las cumplo)',
        'Avanzado (Tengo buena disciplina, pero busco optimizar mi rendimiento)',
      ],
    },
  ],
  en: [
    {
      id: 1,
      question: 'What is your current role or situation?',
      chiwiSpeech: 'I am a self-taught chiwire!',
      options: [
        'High school student',
        'University student',
        'Self-taught learner',
        'Independent professional',
      ],
    },
    {
      id: 2,
      question: 'How old are you?',
      chiwiSpeech: 'I am a five-year-old chiwire!',
      options: ['Under 18', 'Between 18 and 25', '26 or older'],
    },
    {
      id: 3,
      question: 'What is your current work or occupation situation?',
      chiwiSpeech: 'My job is being your tutor. I chiwi-love it!',
      options: ['I only study', 'I only work', 'I study and work', 'None of the above'],
    },
    {
      id: 4,
      question: 'What kind of schedule do you have in your main occupation?',
      chiwiSpeech:
        'I will always be available for your schedule, because I am your trusted chiwire.',
      options: [
        'Full-time',
        'Part-time',
        'Night shift',
        'Rotating, flexible, or unpredictable schedule',
      ],
    },
    {
      id: 5,
      question: 'How much time do you have each day for your study projects?',
      chiwiSpeech: 'Chiwi-tastic! I hope we spend lots of time together.',
      options: [
        'Between 30 and 60 minutes a day',
        'Between 1 and 2 hours a day',
        'Between 2 and 4 hours a day',
        'More than 4 hours a day',
      ],
    },
    {
      id: 6,
      question: 'Which learning technique or method would you like to use first?',
      chiwiSpeech:
        'Do not worry: this chiwire will teach you real study techniques to reach your goals. Look at me, I am a tutor!',
      options: [
        'Pomodoro method',
        '50/10 Rule',
        'Ultradian Rhythms',
        'Active Breaks',
        'I have no previous experience with these techniques',
      ],
    },
    {
      id: 7,
      question: 'What is your previous experience with structuring study plans?',
      chiwiSpeech: 'We are chiwires, you and me. Let’s tackle those projects!',
      options: [
        'Beginner (I struggle to organize myself and often procrastinate)',
        'Intermediate (I use task lists, but do not always follow them)',
        'Advanced (I have good discipline, but want to optimize my performance)',
      ],
    },
  ],
};

export const onboardingQuestions = questions.es;

export function getOnboardingQuestions(locale: 'es' | 'en'): OnboardingQuestion[] {
  return questions[locale];
}
