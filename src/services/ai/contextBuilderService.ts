import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export interface BuildUserAiContextParams {
  userId: string;
  projectId?: string | null;
}

export interface InclusivePreferencesContext {
  path: 'parent_inclusive' | 'student_inclusive' | string;
  educationLevel?: string;
  selfDescribedProfile?: string[];
  studyObstacles?: string[];
  interests?: string;
  attentionTime?: string;
  supportPreferences?: string[];
  aiStyle?: string;
  learningFormat?: string[];
  studyChallenges?: string[];
  taskPace?: string;
  answers: Record<string, string | string[]>;
  consentedAt: string;
}

export interface UserAiContext {
  perfilTexto: string;
  preferenciasInclusivasTexto: string;
  temasTexto: string;
  promptContextoCompleto: string;
  perfilRaw: {
    nombre?: string;
    descripcion?: string;
    rol?: string;
    situacionLaboral?: string;
    metodologia?: string;
    experiencia?: string;
    horarios?: string;
    disponibilidadMinutos?: string | number;
    dificultades?: string[];
    areasPrioritarias?: string[];
    ritmo?: string;
  } | null;
  preferenciasInclusivasRaw: InclusivePreferencesContext | null;
  temasRaw: Array<{
    id: string;
    titulo: string;
    descripcion?: string;
    notaPrincipal?: string;
    esTemaDelProyecto: boolean;
    fuentes: Array<{
      id: string;
      titulo: string;
      tipo: string;
      contenido?: string;
      url?: string;
      habilitadaParaIa: boolean;
    }>;
  }>;
  fuentesActivasCount: number;
}

interface OnboardingInclusiveRow {
  user_id: string;
  onboarding_path: string;
  answers: Record<string, unknown>;
  consented_at: string;
}

function parseAndFormatInclusivePreferences(row: OnboardingInclusiveRow): {
  raw: InclusivePreferencesContext;
  texto: string;
} {
  const answers = (row.answers || {}) as Record<string, unknown>;
  const path = row.onboarding_path;

  const asArray = (val: unknown): string[] => {
    if (Array.isArray(val))
      return val
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  };

  const asString = (val: unknown): string | undefined => {
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

  const cleanAnswers: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (Array.isArray(v)) {
      cleanAnswers[k] = v.map(String);
    } else if (typeof v === 'string') {
      cleanAnswers[k] = v;
    }
  }

  const raw: InclusivePreferencesContext = {
    path,
    educationLevel,
    selfDescribedProfile: selfDescribedProfile.length > 0 ? selfDescribedProfile : undefined,
    studyObstacles: studyObstacles.length > 0 ? studyObstacles : undefined,
    interests,
    attentionTime,
    supportPreferences: supportPreferences.length > 0 ? supportPreferences : undefined,
    aiStyle,
    learningFormat: learningFormat.length > 0 ? learningFormat : undefined,
    studyChallenges: studyChallenges.length > 0 ? studyChallenges : undefined,
    taskPace,
    answers: cleanAnswers,
    consentedAt: row.consented_at,
  };

  const lineas: string[] = [];
  const esPadre = path === 'parent_inclusive';
  lineas.push(
    `- Modalidad de acompañamiento: ${esPadre ? 'Acompañado por tutor/padre/madre (Parent Inclusive)' : 'Estudiante autónomo (Student Inclusive)'}`,
  );

  if (educationLevel) {
    lineas.push(`- Nivel educativo / etapa: ${educationLevel}`);
  }
  if (interests) {
    lineas.push(`- Intereses y temas motivadores: "${interests}"`);
  }

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
  if (attentionTime) {
    lineas.push(`- Tiempo de concentración óptimo: ${attentionTime}`);
  }
  if (taskPace) {
    lineas.push(`- Ritmo de división de tareas preferido: ${taskPace}`);
  }
  if (learningFormat.length > 0) {
    lineas.push(`- Formatos de aprendizaje predilectos: ${learningFormat.join(', ')}`);
  }
  if (aiStyle) {
    lineas.push(`- Estilo pedagógico preferido para sugerencias y tareas: ${aiStyle}`);
  }
  if (supportPreferences.length > 0) {
    lineas.push(`- Apoyos y acompañamientos deseados en el plan: ${supportPreferences.join(', ')}`);
  }

  // Pautas pedagógicas derivadas
  const directrices: string[] = [];

  // Pauta 1: Ritmo y micro-pasos
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
    } else {
      directrices.push(
        `1. RITMO GRADUAL: Respeta la preferencia de ritmo del usuario (${paceRef}), asegurando una progresión clara y alcanzable.`,
      );
    }
  }

  // Pauta 2: Estilo pedagógico y contextualización
  if (aiStyle || interests) {
    let pautaEstilo = '2. ENFOQUE PEDAGÓGICO Y MOTIVACIÓN: ';
    if (aiStyle && /misiones|retos|missions|challenges/i.test(aiStyle)) {
      pautaEstilo += `Formula los títulos y descripciones de las tareas como RETOS o MISIONES activas y motivadoras (ej. "Misión 1: ...", "Reto: ..."). `;
    } else if (aiStyle && /analog[íi]as|ejemplos|analogies/i.test(aiStyle)) {
      pautaEstilo += `Explica los conceptos en las descripciones mediante ANALOGÍAS y ejemplos cotidianos comprensibles. `;
    } else if (aiStyle && /pr[áa]cticos|practical/i.test(aiStyle)) {
      pautaEstilo += `Enfoca las tareas en la práctica directa y ejercicios aplicados desde la primera sesión. `;
    }
    if (interests) {
      pautaEstilo += `Vincula o contextualiza las actividades con sus intereses declarados ("${interests}") cuando sea pedagógicamente apropiado.`;
    }
    directrices.push(pautaEstilo.trim());
  }

  // Pauta 3: Formatos de recursos sugeridos
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

  // Pauta 4: Mitigación de barreras y accesibilidad cognitiva
  const allObstacles = [...studyObstacles, ...studyChallenges];
  const mitigaciones: string[] = [];
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
  if (allObstacles.some((o) => /textos.*extensos|long text/i.test(o))) {
    mitigaciones.push('redacta las descripciones en viñetas breves, evitando párrafos densos');
  }
  if (supportPreferences.some((s) => /paso a paso|step-by-step/i.test(s))) {
    mitigaciones.push('desglosa cada tarea en pasos numerados claros');
  }
  if (supportPreferences.some((s) => /pausa|break/i.test(s))) {
    mitigaciones.push('incluye recordatorios explícitos de descanso');
  }

  if (mitigaciones.length > 0) {
    directrices.push(
      `4. ACCESIBILIDAD Y REDUCCIÓN DE FRICCIÓN: Para atender sus necesidades declaradas (${[...perfilesNeuro, ...allObstacles].join(', ')}): ${mitigaciones.join(', ')}.`,
    );
  }

  const directricesTexto =
    directrices.length > 0
      ? `\n\nDIRECTRICES PEDAGÓGICAS PARA GENERAR LAS TAREAS ACORDE A ESTAS PREFERENCIAS:\n${directrices.join('\n')}`
      : '';

  const texto =
    `[PREFERENCIAS INCLUSIVAS Y DE APRENDIZAJE DEL USUARIO (ONBOARDING INCLUSIVO)]:\n` +
    lineas.join('\n') +
    directricesTexto;

  return { raw, texto };
}

/**
 * Recopila y estructura el contexto pedagógico y personal del usuario:
 * 1. Información del Perfil (descripción, preferencias de aprendizaje, rol, situación laboral, experiencia).
 * 2. Preferencias voluntarias del Onboarding Inclusivo (ritmo, obstáculos, estilo de IA, apoyos).
 * 3. Temas de estudio y fuentes activadas para la IA (notas principales y recursos de la biblioteca).
 */
export async function getUserAiContext({
  userId,
  projectId,
}: BuildUserAiContextParams): Promise<UserAiContext> {
  let dbClient;
  try {
    const supabase = await createClient();
    const adminDb = getAdminClient();
    dbClient = adminDb || supabase;
  } catch {
    dbClient = getAdminClient();
  }

  if (!dbClient || !userId) {
    return {
      perfilTexto: '',
      preferenciasInclusivasTexto: '',
      temasTexto: '',
      promptContextoCompleto: '',
      perfilRaw: null,
      preferenciasInclusivasRaw: null,
      temasRaw: [],
      fuentesActivasCount: 0,
    };
  }

  // 1. Obtener perfil de usuario
  let perfilRaw: UserAiContext['perfilRaw'] = null;
  let perfilTexto = '';

  try {
    const { data: profile } = await dbClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      const dificultadesArr: string[] = Array.isArray(profile.dificultades)
        ? profile.dificultades
        : typeof profile.dificultades === 'string' && profile.dificultades.trim()
          ? profile.dificultades
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

      const areasArr: string[] = Array.isArray(profile.area_prioritaria)
        ? profile.area_prioritaria
        : typeof profile.area_prioritaria === 'string' && profile.area_prioritaria.trim()
          ? profile.area_prioritaria
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

      perfilRaw = {
        nombre: profile.nombre_completo || profile.nombre_usuario || undefined,
        descripcion: profile.descripcion || profile.contexto_personal || undefined,
        rol: profile.rol_condicion || undefined,
        situacionLaboral: profile.situacion_laboral || undefined,
        metodologia: profile.metodologia || undefined,
        experiencia: profile.experiencia || undefined,
        horarios: profile.jornada_horarios || undefined,
        disponibilidadMinutos: profile.tiempo_diario_min || undefined,
        dificultades: dificultadesArr.length > 0 ? dificultadesArr : undefined,
        areasPrioritarias: areasArr.length > 0 ? areasArr : undefined,
        ritmo: profile.ritmo || undefined,
      };

      const lineasPerfil: string[] = [];
      if (perfilRaw.nombre) lineasPerfil.push(`- Nombre del estudiante: ${perfilRaw.nombre}`);
      if (perfilRaw.rol) lineasPerfil.push(`- Rol o condición actual: ${perfilRaw.rol}`);
      if (perfilRaw.situacionLaboral)
        lineasPerfil.push(`- Situación laboral: ${perfilRaw.situacionLaboral}`);
      if (perfilRaw.metodologia)
        lineasPerfil.push(
          `- Metodología / estilo de aprendizaje preferido: ${perfilRaw.metodologia}`,
        );
      if (perfilRaw.experiencia)
        lineasPerfil.push(`- Nivel de experiencia general: ${perfilRaw.experiencia}`);
      if (perfilRaw.disponibilidadMinutos)
        lineasPerfil.push(
          `- Dedicación diaria habitual: ${perfilRaw.disponibilidadMinutos} minutos`,
        );
      if (perfilRaw.horarios)
        lineasPerfil.push(`- Franjas horarias preferidas: ${perfilRaw.horarios}`);
      if (perfilRaw.ritmo) lineasPerfil.push(`- Ritmo de estudio: ${perfilRaw.ritmo}`);
      if (perfilRaw.dificultades && perfilRaw.dificultades.length > 0) {
        lineasPerfil.push(
          `- Retos o dificultades declaradas: ${perfilRaw.dificultades.join(', ')}`,
        );
      }
      if (perfilRaw.areasPrioritarias && perfilRaw.areasPrioritarias.length > 0) {
        lineasPerfil.push(
          `- Áreas prioritarias de interés: ${perfilRaw.areasPrioritarias.join(', ')}`,
        );
      }
      if (perfilRaw.descripcion) {
        lineasPerfil.push(
          `- Información complementaria / Descripción personal:\n  "${perfilRaw.descripcion}"`,
        );
      }

      if (lineasPerfil.length > 0) {
        perfilTexto =
          `[PERFIL DE APRENDIZAJE E INFORMACIÓN DEL USUARIO]:\n` +
          lineasPerfil.join('\n') +
          `\n\nDirectriz pedagógica: Adapta la formulación de tareas, el ritmo, el tono y la estructura para que sean armónicos con su metodología preferida, su disponibilidad real y su nivel de experiencia.\n`;
      }
    }
  } catch (err) {
    console.warn('Error al obtener perfil para contexto de IA:', err);
  }

  // 1.5. Obtener preferencias inclusivas del usuario (onboarding inclusivo)
  let preferenciasInclusivasRaw: UserAiContext['preferenciasInclusivasRaw'] = null;
  let preferenciasInclusivasTexto = '';

  try {
    const { data: inclusiveRow } = await dbClient
      .from('onboarding_inclusive_preferences')
      .select('user_id, onboarding_path, answers, consented_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (inclusiveRow) {
      const parsed = parseAndFormatInclusivePreferences(inclusiveRow as OnboardingInclusiveRow);
      preferenciasInclusivasRaw = parsed.raw;
      preferenciasInclusivasTexto = parsed.texto;
    }
  } catch (err) {
    console.warn('Error al obtener preferencias inclusivas para contexto de IA:', err);
  }

  // 2. Obtener temas y fuentes
  const temasRaw: UserAiContext['temasRaw'] = [];
  let temasTexto = '';
  let fuentesActivasCount = 0;

  try {
    // Consultar temas del usuario
    const { data: topicsData } = await dbClient
      .from('topics')
      .select('id, title, description, main_note, project_id, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (topicsData && topicsData.length > 0) {
      const topicIds = topicsData.map((t) => t.id);

      // Consultar fuentes de esos temas
      const { data: sourcesData } = await dbClient
        .from('sources')
        .select('id, topic_id, title, kind, content, file_url, is_in_context')
        .in('topic_id', topicIds)
        .order('created_at', { ascending: true });

      interface RawSourceRow {
        id: string;
        topic_id: string;
        title: string;
        kind: string;
        content?: string | null;
        file_url?: string | null;
        is_in_context?: boolean | null;
      }

      const sourcesByTopic = new Map<string, RawSourceRow[]>();
      if (sourcesData) {
        for (const s of sourcesData as unknown as RawSourceRow[]) {
          const list = sourcesByTopic.get(s.topic_id) || [];
          list.push(s);
          sourcesByTopic.set(s.topic_id, list);
        }
      }

      const bloquesTemas: string[] = [];

      for (const t of topicsData) {
        const isLinkedToCurrentProject = Boolean(projectId && t.project_id === projectId);
        const topicSources = sourcesByTopic.get(t.id) || [];

        // Filtrar fuentes que están habilitadas para contexto (is_in_context === true)
        // o si este tema está directamente vinculado al proyecto en cuestión
        const relevantSources = topicSources.filter(
          (s) => s.is_in_context === true || isLinkedToCurrentProject,
        );

        if (relevantSources.some((s) => s.is_in_context)) {
          fuentesActivasCount += relevantSources.filter((s) => s.is_in_context).length;
        }

        const formattedSources = relevantSources.map((s) => ({
          id: s.id,
          titulo: s.title,
          tipo: s.kind,
          contenido: s.content ? s.content.slice(0, 3000) : undefined,
          url: s.file_url || undefined,
          habilitadaParaIa: Boolean(s.is_in_context),
        }));

        temasRaw.push({
          id: t.id,
          titulo: t.title,
          descripcion: t.description || undefined,
          notaPrincipal: t.main_note || undefined,
          esTemaDelProyecto: isLinkedToCurrentProject,
          fuentes: formattedSources,
        });

        // Formatear texto si tiene contenido relevante para la IA
        const tieneNotaPrincipal = Boolean(t.main_note && t.main_note.trim().length > 0);
        const tieneFuentesRelevantes = formattedSources.length > 0;

        // Si es el tema vinculado al proyecto o tiene notas/fuentes activas, se incluye
        if (isLinkedToCurrentProject || tieneNotaPrincipal || tieneFuentesRelevantes) {
          let temaDesc = `• Tema: "${t.title}"${isLinkedToCurrentProject ? ' (VINCULADO DIRECTAMENTE A ESTE PROYECTO)' : ''}`;
          if (t.description) {
            temaDesc += `\n  Descripción del tema: ${t.description}`;
          }
          if (tieneNotaPrincipal) {
            const notaCorta = (t.main_note || '').slice(0, 2500);
            temaDesc += `\n  Nota principal / Cuaderno de apuntes:\n  """\n  ${notaCorta}\n  """`;
          }
          if (tieneFuentesRelevantes) {
            const fuentesDesc = formattedSources
              .map((s) => {
                let fStr = `    - [${s.tipo}] "${s.titulo}"`;
                if (s.contenido) {
                  fStr += `: ${s.contenido.slice(0, 1000)}`;
                }
                if (s.url) {
                  fStr += ` (Enlace: ${s.url})`;
                }
                return fStr;
              })
              .join('\n');
            temaDesc += `\n  Fuentes y material de estudio habilitados:\n${fuentesDesc}`;
          }
          bloquesTemas.push(temaDesc);
        }
      }

      if (bloquesTemas.length > 0) {
        temasTexto =
          `[BIBLIOTECA DE TEMAS, NOTAS Y FUENTES AUTORIZADAS POR EL USUARIO]:\n` +
          `El usuario ha recopilado el siguiente material en su biblioteca de Temas. Utiliza estos conceptos, apuntes y recursos como base sustancial para orientar las tareas o responder sus consultas:\n\n` +
          bloquesTemas.join('\n\n') +
          `\n\n`;
      }
    }
  } catch (err) {
    console.warn('Error al obtener temas y fuentes para contexto de IA:', err);
  }

  const promptContextoCompleto = [perfilTexto, preferenciasInclusivasTexto, temasTexto]
    .filter(Boolean)
    .join('\n\n');

  return {
    perfilTexto,
    preferenciasInclusivasTexto,
    temasTexto,
    promptContextoCompleto,
    perfilRaw,
    preferenciasInclusivasRaw,
    temasRaw,
    fuentesActivasCount,
  };
}
