export interface StudyTechnique {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  focusMinutes: number;
  breakMinutes: number;
  cyclesBeforeLongBreak: number;
  longBreakMinutes: number;
  gradient: string;
}

export const STUDY_TECHNIQUES: StudyTechnique[] = [
  {
    id: 'pomodoro',
    name: 'Técnica Pomodoro',
    shortDescription: '25m enfoque / 5m descanso',
    description:
      'La técnica Pomodoro clásica, ideal para combatir la procrastinación. Trabaja intensamente durante 25 minutos y luego descansa 5 minutos. Tras 4 ciclos, toma un descanso más largo para recargar.',
    focusMinutes: 25,
    breakMinutes: 5,
    cyclesBeforeLongBreak: 4,
    longBreakMinutes: 15,
    gradient: 'linear-gradient(135deg, #FBE6DD 0%, #F7D6BF 100%)', // Durazno pastel
  },
  {
    id: 'rule-50-10',
    name: 'Regla 50/10',
    shortDescription: '50m enfoque / 10m descanso',
    description:
      'Perfecta para tareas que requieren una concentración más profunda y sostenida, como escribir o programar. Trabaja 50 minutos seguidos, luego aléjate por 10 minutos.',
    focusMinutes: 50,
    breakMinutes: 10,
    cyclesBeforeLongBreak: 2,
    longBreakMinutes: 20,
    gradient: 'linear-gradient(135deg, #D8C4E0 0%, #E8B4B8 100%)', // Morado/rosa pastel
  },
  {
    id: 'ultradian',
    name: 'Ritmos Ultradianos',
    shortDescription: '90m enfoque / 20m descanso',
    description:
      'Alinea tu estudio con los ciclos biológicos naturales del cerebro. Sumérgete en estado de flujo (Deep Work) durante 90 minutos y recompénsate con 20 minutos de recuperación total.',
    focusMinutes: 90,
    breakMinutes: 20,
    cyclesBeforeLongBreak: 1,
    longBreakMinutes: 20,
    gradient: 'linear-gradient(135deg, #BBD0F4 0%, #C8D6AF 100%)', // Azul/verde pastel
  },
  {
    id: 'active-pauses',
    name: 'Pausas Activas',
    shortDescription: '45m enfoque / 15m descanso activo',
    description:
      'Combina el estudio con la salud física. Después de 45 minutos de estudio, utiliza 15 minutos para estirarte, caminar o hacer ejercicios ligeros. Oxigena el cerebro para rendir mejor.',
    focusMinutes: 45,
    breakMinutes: 15,
    cyclesBeforeLongBreak: 2,
    longBreakMinutes: 30,
    gradient: 'linear-gradient(135deg, #C8D6AF 0%, #E8B4B8 100%)', // Verde pastel/rosa
  },
];
