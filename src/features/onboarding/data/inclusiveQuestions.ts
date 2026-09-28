import type { Locale } from '@/lib/i18n/locale';

export type InclusivePath = 'parent_inclusive' | 'student_inclusive';
export type InclusiveAnswer = string | string[];

export interface InclusiveQuestion {
  id: string;
  question: string;
  speech: string;
  type: 'single' | 'multiple' | 'text';
  options?: string[];
  placeholder?: string;
  maxLength?: number;
}

type InclusivePathContent = {
  title: string;
  subtitle: string;
  questions: InclusiveQuestion[];
};

const content: Record<Locale, Record<InclusivePath, InclusivePathContent>> = {
  es: {
    parent_inclusive: {
      title: 'Hola, somos Mr. Chiwi y Martha',
      subtitle: 'Queremos conocer sus preferencias de apoyo',
      questions: [
        {
          id: 'education_level',
          question: '¿Qué nivel educativo cursa la persona estudiante?',
          speech: 'Así adaptaremos el lenguaje y el ritmo del plan.',
          type: 'single',
          options: ['Primaria', 'Secundaria', 'Universidad o educación para adultos'],
        },
        {
          id: 'self_described_profile',
          question:
            'De forma opcional, ¿hay alguna necesidad o perfil que quieras tener en cuenta?',
          speech: 'Puedes omitir esta información. No necesitamos diagnósticos ni documentos.',
          type: 'multiple',
          options: [
            'TDAH o dificultades de atención',
            'Autismo o necesidades sensoriales',
            'Altas capacidades',
            'Prefiero no indicarlo',
            'Otro',
          ],
        },
        {
          id: 'study_obstacles',
          question: '¿Qué suele dificultar más el momento de estudiar?',
          speech: 'Entender el obstáculo nos ayuda a proponer pasos más amables.',
          type: 'multiple',
          options: [
            'Empezar una tarea',
            'Frustración rápida',
            'Distracción',
            'Organización',
            'Textos o tareas muy extensas',
            'Otro',
          ],
        },
        {
          id: 'interests',
          question: '¿Qué temas o actividades le motivan actualmente?',
          speech: 'Podemos usar esos intereses para hacer el estudio más cercano.',
          type: 'text',
          placeholder: 'Por ejemplo: videojuegos, espacio, animales, música…',
          maxLength: 150,
        },
        {
          id: 'attention_time',
          question: '¿Qué duración aproximada de concentración funciona mejor?',
          speech: 'Cada persona tiene su propio ritmo y las pausas también cuentan.',
          type: 'single',
          options: ['5 a 10 minutos', '15 a 20 minutos', '30 minutos o más'],
        },
        {
          id: 'support_preferences',
          question: '¿Qué apoyos prefieres recibir en el plan?',
          speech: 'Selecciona los que puedan resultar más útiles.',
          type: 'multiple',
          options: [
            'Indicaciones paso a paso',
            'Recordatorios de pausas',
            'Recursos visuales',
            'Explicaciones breves',
          ],
        },
      ],
    },
    student_inclusive: {
      title: 'Hola, soy Martha',
      subtitle: 'Aprendamos a tu manera',
      questions: [
        {
          id: 'interests',
          question: '¿Qué tema, pasatiempo o universo te apasiona ahora?',
          speech: 'Podemos usar lo que te gusta para que estudiar sea más tuyo.',
          type: 'text',
          placeholder: 'Por ejemplo: videojuegos, espacio, animales, música…',
          maxLength: 100,
        },
        {
          id: 'education_level',
          question: '¿En qué etapa o situación estás?',
          speech: 'Así podremos proponer proyectos que encajen contigo.',
          type: 'single',
          options: [
            'Primaria',
            'Secundaria',
            'Universidad',
            'Trabajo',
            'No estudio ni trabajo actualmente',
          ],
        },
        {
          id: 'ai_style',
          question: '¿Cómo prefieres que usemos tus intereses en las sugerencias?',
          speech: 'Esto no comparte tus datos con la IA automáticamente.',
          type: 'single',
          options: [
            'Con analogías y ejemplos',
            'Como misiones o retos',
            'Solo para ejemplos prácticos',
          ],
        },
        {
          id: 'learning_format',
          question: '¿Qué formato te ayuda más a aprender?',
          speech: 'No hay una opción correcta: elige las que te sirvan.',
          type: 'multiple',
          options: ['Videos cortos', 'Artículos con viñetas', 'Infografías', 'Audios o podcasts'],
        },
        {
          id: 'study_challenges',
          question: '¿Qué te cuesta más al empezar un proyecto o tarea?',
          speech: 'Dividirlo en pasos pequeños puede hacer una gran diferencia.',
          type: 'multiple',
          options: [
            'Saber por dónde empezar',
            'Mantener el interés en textos largos',
            'Cambiar entre tareas',
            'Recordar muchas instrucciones',
          ],
        },
        {
          id: 'task_pace',
          question: '¿Cómo prefieres dividir tus tareas?',
          speech: 'Podemos respetar tu energía y avanzar a un ritmo sostenible.',
          type: 'single',
          options: [
            'Micro-pasos de 5 a 10 minutos',
            'Bloques de 20 minutos',
            'Bloques de 30 minutos o más',
          ],
        },
      ],
    },
  },
  en: {
    parent_inclusive: {
      title: 'Hi, we are Mr. Chiwi and Martha',
      subtitle: 'Let’s learn about support preferences',
      questions: [
        {
          id: 'education_level',
          question: 'What educational level is the student currently in?',
          speech: 'This helps us adapt the language and pace of the plan.',
          type: 'single',
          options: ['Primary school', 'Secondary school', 'University or adult education'],
        },
        {
          id: 'self_described_profile',
          question: 'Optionally, is there a need or profile you would like us to consider?',
          speech: 'You may skip this. We do not need diagnoses or documents.',
          type: 'multiple',
          options: [
            'ADHD or attention difficulties',
            'Autism or sensory needs',
            'Giftedness',
            'Prefer not to say',
            'Other',
          ],
        },
        {
          id: 'study_obstacles',
          question: 'What usually makes studying more difficult?',
          speech: 'Understanding the obstacle helps us suggest kinder, smaller steps.',
          type: 'multiple',
          options: [
            'Starting a task',
            'Quick frustration',
            'Distraction',
            'Organization',
            'Very long texts or tasks',
            'Other',
          ],
        },
        {
          id: 'interests',
          question: 'Which topics or activities are motivating right now?',
          speech: 'We can use those interests to make studying feel more relevant.',
          type: 'text',
          placeholder: 'For example: games, space, animals, music…',
          maxLength: 150,
        },
        {
          id: 'attention_time',
          question: 'What approximate focus duration works best?',
          speech: 'Everyone has their own pace, and breaks count too.',
          type: 'single',
          options: ['5 to 10 minutes', '15 to 20 minutes', '30 minutes or more'],
        },
        {
          id: 'support_preferences',
          question: 'Which supports would you prefer in the plan?',
          speech: 'Choose the ones that may be most helpful.',
          type: 'multiple',
          options: [
            'Step-by-step guidance',
            'Break reminders',
            'Visual resources',
            'Short explanations',
          ],
        },
      ],
    },
    student_inclusive: {
      title: 'Hi, I am Martha',
      subtitle: 'Let’s learn your way',
      questions: [
        {
          id: 'interests',
          question: 'What topic, hobby, or universe are you excited about right now?',
          speech: 'We can use what you enjoy to make studying feel more like you.',
          type: 'text',
          placeholder: 'For example: games, space, animals, music…',
          maxLength: 100,
        },
        {
          id: 'education_level',
          question: 'What stage or situation are you currently in?',
          speech: 'This helps us suggest projects that fit you.',
          type: 'single',
          options: [
            'Primary school',
            'Secondary school',
            'University',
            'Work',
            'I am not studying or working right now',
          ],
        },
        {
          id: 'ai_style',
          question: 'How would you like us to use your interests in suggestions?',
          speech: 'This does not automatically share your information with AI.',
          type: 'single',
          options: [
            'With analogies and examples',
            'As missions or challenges',
            'Only for practical examples',
          ],
        },
        {
          id: 'learning_format',
          question: 'Which format helps you learn best?',
          speech: 'There is no right answer: choose what helps you.',
          type: 'multiple',
          options: ['Short videos', 'Bullet-point articles', 'Infographics', 'Audio or podcasts'],
        },
        {
          id: 'study_challenges',
          question: 'What is hardest when you begin a project or task?',
          speech: 'Breaking it into small steps can make a big difference.',
          type: 'multiple',
          options: [
            'Knowing where to start',
            'Staying interested in long texts',
            'Switching between tasks',
            'Remembering many instructions',
          ],
        },
        {
          id: 'task_pace',
          question: 'How would you like to divide your tasks?',
          speech: 'We can respect your energy and move at a sustainable pace.',
          type: 'single',
          options: ['5 to 10 minute micro-steps', '20 minute blocks', '30 minute blocks or longer'],
        },
      ],
    },
  },
};

export function getInclusiveContent(locale: Locale, path: InclusivePath): InclusivePathContent {
  return content[locale][path];
}
