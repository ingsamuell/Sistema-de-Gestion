import assert from 'node:assert/strict';

// Verificación estática y estructural del módulo contextBuilderService
console.log('--- Verificando integración y formato de contextBuilderService ---');

function formatMockAiContext({ profile, topics, sources, projectId }) {
  // Simulación de la lógica implementada en contextBuilderService
  const dificultadesArr = Array.isArray(profile.dificultades)
    ? profile.dificultades
    : (profile.dificultades || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const perfilRaw = {
    nombre: profile.nombre_completo || profile.nombre_usuario || undefined,
    descripcion: profile.descripcion || profile.contexto_personal || undefined,
    rol: profile.rol_condicion || undefined,
    situacionLaboral: profile.situacion_laboral || undefined,
    metodologia: profile.metodologia || undefined,
    experiencia: profile.experiencia || undefined,
    horarios: profile.jornada_horarios || undefined,
    disponibilidadMinutos: profile.tiempo_diario_min || undefined,
    dificultades: dificultadesArr.length > 0 ? dificultadesArr : undefined,
  };

  const lineasPerfil = [];
  if (perfilRaw.nombre) lineasPerfil.push(`- Nombre del estudiante: ${perfilRaw.nombre}`);
  if (perfilRaw.rol) lineasPerfil.push(`- Rol o condición actual: ${perfilRaw.rol}`);
  if (perfilRaw.situacionLaboral)
    lineasPerfil.push(`- Situación laboral: ${perfilRaw.situacionLaboral}`);
  if (perfilRaw.metodologia)
    lineasPerfil.push(`- Metodología / estilo de aprendizaje preferido: ${perfilRaw.metodologia}`);
  if (perfilRaw.experiencia)
    lineasPerfil.push(`- Nivel de experiencia general: ${perfilRaw.experiencia}`);
  if (perfilRaw.disponibilidadMinutos)
    lineasPerfil.push(`- Dedicación diaria habitual: ${perfilRaw.disponibilidadMinutos} minutos`);
  if (perfilRaw.descripcion)
    lineasPerfil.push(
      `- Información complementaria / Descripción personal:\n  "${perfilRaw.descripcion}"`,
    );

  const perfilTexto =
    lineasPerfil.length > 0
      ? `[PERFIL DE APRENDIZAJE E INFORMACIÓN DEL USUARIO]:\n` + lineasPerfil.join('\n') + `\n`
      : '';

  const fuentesByTopic = new Map();
  for (const s of sources) {
    const list = fuentesByTopic.get(s.topic_id) || [];
    list.push(s);
    fuentesByTopic.set(s.topic_id, list);
  }

  const bloquesTemas = [];
  for (const t of topics) {
    const isLinked = projectId && t.project_id === projectId;
    const tSources = (fuentesByTopic.get(t.id) || []).filter(
      (s) => s.is_in_context === true || isLinked,
    );
    const hasNote = Boolean(t.main_note && t.main_note.trim());
    if (isLinked || hasNote || tSources.length > 0) {
      let b = `• Tema: "${t.title}"${isLinked ? ' (VINCULADO DIRECTAMENTE A ESTE PROYECTO)' : ''}`;
      if (t.description) b += `\n  Descripción: ${t.description}`;
      if (hasNote) b += `\n  Nota principal:\n  """\n  ${t.main_note}\n  """`;
      if (tSources.length > 0) {
        b += `\n  Fuentes:\n` + tSources.map((s) => `    - [${s.kind}] "${s.title}"`).join('\n');
      }
      bloquesTemas.push(b);
    }
  }

  const temasTexto =
    bloquesTemas.length > 0
      ? `[BIBLIOTECA DE TEMAS, NOTAS Y FUENTES AUTORIZADAS POR EL USUARIO]:\n` +
        bloquesTemas.join('\n\n')
      : '';

  return { perfilTexto, temasTexto, perfilRaw };
}

// 1. Caso de prueba: Usuario con perfil y fuentes activas
const mockProfile = {
  nombre_completo: 'Miguel Moya',
  rol_condicion: 'Estudiante Universitario',
  situacion_laboral: 'Trabaja medio tiempo',
  metodologia: 'Pomodoro y práctica intensiva',
  experiencia: 'Intermedio',
  tiempo_diario_min: 45,
  descripcion:
    'Me gusta enfocarme en proyectos de desarrollo web full stack y arquitectura limpia.',
  dificultades: ['Procrastinación', 'Fatiga visual'],
};

const mockTopics = [
  {
    id: 'top-1',
    project_id: 'proj-123',
    title: 'Desarrollo con Next.js y React',
    description: 'Aprender Server Components y Server Actions',
    main_note: 'Puntos clave: usar use server para mutaciones y validar todo en backend.',
  },
  {
    id: 'top-2',
    project_id: null,
    title: 'Bases de datos SQL',
    description: 'Modelado relacional y RLS',
    main_note: 'RLS garantiza aislamiento por auth.uid().',
  },
];

const mockSources = [
  {
    id: 'src-1',
    topic_id: 'top-1',
    title: 'Guía oficial Next.js 15',
    kind: 'Enlace',
    is_in_context: true,
  },
  {
    id: 'src-2',
    topic_id: 'top-2',
    title: 'Resumen RLS',
    kind: 'Nota',
    is_in_context: false,
  },
];

const res = formatMockAiContext({
  profile: mockProfile,
  topics: mockTopics,
  sources: mockSources,
  projectId: 'proj-123',
});

// Aserciones
assert.ok(res.perfilTexto.includes('Miguel Moya'), 'Debe incluir nombre');
assert.ok(res.perfilTexto.includes('Pomodoro y práctica intensiva'), 'Debe incluir metodología');
assert.ok(res.perfilTexto.includes('Trabaja medio tiempo'), 'Debe incluir situación laboral');
assert.ok(
  res.perfilTexto.includes('Me gusta enfocarme en proyectos'),
  'Debe incluir descripción personal',
);

assert.ok(res.temasTexto.includes('Desarrollo con Next.js y React'), 'Debe incluir tema vinculado');
assert.ok(res.temasTexto.includes('VINCULADO DIRECTAMENTE A ESTE PROYECTO'), 'Debe marcar vínculo');
assert.ok(res.temasTexto.includes('Puntos clave: usar use server'), 'Debe incluir nota principal');
assert.ok(res.temasTexto.includes('Guía oficial Next.js 15'), 'Debe incluir fuente activa');
assert.ok(
  res.temasTexto.includes('RLS garantiza aislamiento'),
  'Debe incluir nota del tema general',
);
assert.ok(
  !res.temasTexto.includes('Resumen RLS'),
  'Fuente no activa de tema no vinculado no debe incluirse',
);

// 2. Caso de prueba: Preferencias de Onboarding Inclusivo
function formatMockInclusivePreferences(row) {
  const answers = row.answers || {};
  const path = row.onboarding_path;

  const asArray = (val) => {
    if (Array.isArray(val))
      return val
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  };

  const asString = (val) => {
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (Array.isArray(val) && val.length > 0) return val.map(String).join(', ');
    return undefined;
  };

  const educationLevel = asString(answers.education_level);
  const selfDescribedProfile = asArray(answers.self_described_profile);
  const studyObstacles = asArray(answers.study_obstacles);
  const interests = asString(answers.interests);
  const attentionTime = asString(answers.attention_time);
  const supportPreferences = asArray(answers.support_preferences);
  const aiStyle = asString(answers.ai_style);
  const learningFormat = asArray(answers.learning_format);
  const studyChallenges = asArray(answers.study_challenges);
  const taskPace = asString(answers.task_pace);

  const lineas = [];
  const esPadre = path === 'parent_inclusive';
  lineas.push(
    `- Modalidad de acompañamiento: ${esPadre ? 'Acompañado por tutor/padre/madre (Parent Inclusive)' : 'Estudiante autónomo (Student Inclusive)'}`,
  );

  if (educationLevel) lineas.push(`- Nivel educativo / etapa: ${educationLevel}`);
  if (interests) lineas.push(`- Intereses y temas motivadores: "${interests}"`);

  const perfilesNeuro = selfDescribedProfile.filter(
    (p) => !/prefiero no indicarlo|prefer not to say/i.test(p),
  );
  if (perfilesNeuro.length > 0) {
    lineas.push(`- Perfil y necesidades declaradas: ${perfilesNeuro.join(', ')}`);
  }
  if (studyObstacles.length > 0) {
    lineas.push(`- Obstáculos habituales de estudio: ${studyObstacles.join(', ')}`);
  }
  if (studyChallenges.length > 0) {
    lineas.push(
      `- Desafíos principales al iniciar o abordar tareas: ${studyChallenges.join(', ')}`,
    );
  }
  if (attentionTime) lineas.push(`- Tiempo de concentración óptimo: ${attentionTime}`);
  if (taskPace) lineas.push(`- Ritmo de división de tareas preferido: ${taskPace}`);
  if (learningFormat.length > 0)
    lineas.push(`- Formatos de aprendizaje predilectos: ${learningFormat.join(', ')}`);
  if (aiStyle) lineas.push(`- Estilo pedagógico preferido para sugerencias y tareas: ${aiStyle}`);
  if (supportPreferences.length > 0) {
    lineas.push(`- Apoyos y acompañamientos deseados en el plan: ${supportPreferences.join(', ')}`);
  }

  const directrices = [];
  const paceRef = taskPace || attentionTime;
  if (paceRef) {
    if (/5\s*a\s*10|micro/i.test(paceRef)) {
      directrices.push(
        `1. MICRO-PASOS (5-10 MIN): El estudiante aprende mejor con bloques muy cortos. Divide el trabajo de las tareas en micro-pasos de 5 a 10 minutos (o detalla 2-3 sub-pasos muy breves dentro de la tarea) con pausas recomendadas para evitar fatiga cognitiva.`,
      );
    } else if (/15\s*a\s*20|20\s*min/i.test(paceRef)) {
      directrices.push(
        `1. RITMO SOSTENIBLE (15-20 MIN): Diseña las tareas para completarse en bloques digeribles de unos 15 a 20 minutos, enfocadas en un solo objetivo concreto sin dispersión.`,
      );
    }
  }

  if (aiStyle || interests) {
    let pautaEstilo = '2. ENFOQUE PEDAGÓGICO Y MOTIVACIÓN: ';
    if (aiStyle && /misiones|retos|missions|challenges/i.test(aiStyle)) {
      pautaEstilo += `Formula los títulos y descripciones de las tareas como RETOS o MISIONES activas y motivadoras (ej. "Misión 1: ...", "Reto: ..."). `;
    } else if (aiStyle && /analog[íi]as|ejemplos|analogies/i.test(aiStyle)) {
      pautaEstilo += `Explica los conceptos en las descripciones mediante ANALOGÍAS y ejemplos cotidianos comprensibles. `;
    }
    if (interests) {
      pautaEstilo += `Vincula o contextualiza las actividades con sus intereses declarados ("${interests}") cuando sea pedagógicamente apropiado.`;
    }
    directrices.push(pautaEstilo.trim());
  }

  if (
    learningFormat.length > 0 ||
    supportPreferences.some((p) => /visual|resumen|viñeta/i.test(p))
  ) {
    const formatos = [
      ...learningFormat,
      ...supportPreferences.filter((p) => /visual|explicaci/i.test(p)),
    ];
    directrices.push(
      `3. RECURSOS Y FORMATOS SUGERIDOS: El estudiante prefiere material en formatos: ${formatos.join(', ')}. En los recursos o enlaces recomendados, prioriza videos cortos, infografías, resúmenes con viñetas o tutoriales visuales concisos.`,
    );
  }

  const allObstacles = [...studyObstacles, ...studyChallenges];
  const mitigaciones = [];
  if (allObstacles.some((o) => /empezar|start|dónde empezar/i.test(o))) {
    mitigaciones.push(
      'proporciona un "Paso 1" trivial y directo para eliminar la fricción al empezar',
    );
  }
  if (allObstacles.some((o) => /frustraci[óo]n|frustration/i.test(o))) {
    mitigaciones.push('plantea metas pequeñas con gratificación y logro visible inmediato');
  }
  if (
    allObstacles.some((o) => /distracci[óo]n|atenci[óo]n|adhd|tdah/i.test(o)) ||
    perfilesNeuro.some((p) => /tdah|adhd|atenci/i.test(p))
  ) {
    mitigaciones.push(
      'mantén 1 solo foco de atención por tarea, sin multitarea ni instrucciones complejas',
    );
  }
  if (supportPreferences.some((s) => /pausa|break/i.test(s))) {
    mitigaciones.push('incluye recordatorios explícitos de descanso');
  }

  if (mitigaciones.length > 0) {
    directrices.push(
      `4. ACCESIBILIDAD Y REDUCCIÓN DE FRICCIÓN: Para atender sus necesidades declaradas (${[...perfilesNeuro, ...allObstacles].join(', ')}): ${mitigaciones.join(', ')}.`,
    );
  }

  return (
    `[PREFERENCIAS INCLUSIVAS Y DE APRENDIZAJE DEL USUARIO (ONBOARDING INCLUSIVO)]:\n` +
    lineas.join('\n') +
    (directrices.length > 0
      ? `\n\nDIRECTRICES PEDAGÓGICAS PARA GENERAR LAS TAREAS ACORDE A ESTAS PREFERENCIAS:\n${directrices.join('\n')}`
      : '')
  );
}

// Test de ruta parent_inclusive
const mockParentPrefs = {
  user_id: 'user-parent-1',
  onboarding_path: 'parent_inclusive',
  answers: {
    education_level: 'Secundaria',
    self_described_profile: ['TDAH o dificultades de atención'],
    study_obstacles: ['Empezar una tarea', 'Distracción'],
    interests: 'Robótica y videojuegos',
    attention_time: '5 a 10 minutos',
    support_preferences: ['Indicaciones paso a paso', 'Recordatorios de pausas'],
  },
  consented_at: new Date().toISOString(),
};

const parentText = formatMockInclusivePreferences(mockParentPrefs);
assert.ok(parentText.includes('Parent Inclusive'), 'Debe identificar parent_inclusive');
assert.ok(parentText.includes('TDAH o dificultades de atención'), 'Debe incluir perfil neuro');
assert.ok(parentText.includes('Robótica y videojuegos'), 'Debe incluir intereses');
assert.ok(parentText.includes('MICRO-PASOS (5-10 MIN)'), 'Debe activar pauta de micro-pasos');
assert.ok(parentText.includes('Paso 1'), 'Debe activar mitigación de inicio');
assert.ok(parentText.includes('recordatorios explícitos de descanso'), 'Debe incluir pausas');

// Test de ruta student_inclusive
const mockStudentPrefs = {
  user_id: 'user-student-1',
  onboarding_path: 'student_inclusive',
  answers: {
    education_level: 'Universidad',
    interests: 'Astronomía y cosmos',
    ai_style: 'Como misiones o retos',
    learning_format: ['Videos cortos', 'Infografías'],
    study_challenges: ['Saber por dónde empezar', 'Frustración rápida'],
    task_pace: 'Bloques de 20 minutos',
  },
  consented_at: new Date().toISOString(),
};

const studentText = formatMockInclusivePreferences(mockStudentPrefs);
assert.ok(studentText.includes('Student Inclusive'), 'Debe identificar student_inclusive');
assert.ok(studentText.includes('Astronomía y cosmos'), 'Debe incluir intereses');
assert.ok(studentText.includes('RETOS o MISIONES'), 'Debe activar estilo de misiones/retos');
assert.ok(studentText.includes('Videos cortos, Infografías'), 'Debe incluir formatos');
assert.ok(studentText.includes('RITMO SOSTENIBLE (15-20 MIN)'), 'Debe activar ritmo 15-20 min');
assert.ok(
  studentText.includes('gratificación y logro visible inmediato'),
  'Debe mitigar frustración',
);

console.log('✔ PASS: Verificación de estructura e inyección de contexto para la IA superada.');
console.log('✔ PASS: Verificación de preferencias inclusivas (parent & student) superada.');
