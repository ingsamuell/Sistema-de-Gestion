import { Type } from '@google/genai';
import { GEMINI_DEFAULT_MODEL } from '@/lib/gemini/geminiClient';
import { callGeminiWithRetry } from '@/lib/gemini/geminiRetry';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  GeneratedSchedule,
  generatedScheduleSchema,
  ExtractedScheduleResponse,
  extractedScheduleResponseSchema,
} from '@/features/schedule/types/scheduleSchemas';
import { logAiInteraction } from './aiLogger';
import { extractScheduleFromN8n } from '@/services/automation/n8nTasksService';
import { getUserAiContext } from './contextBuilderService';

export interface GenerateScheduleParams {
  usuarioId?: string;
  proyectoId: string;
  nombre: string;
  objetivo: string;
  fechaLimite?: string;
  importancia?: string;
  nivel?: string;
  tiempoDiario?: string | number;
  bloquesLibresPorDia?: string;
  textoExtraidoArchivos?: string;
  enlaces?: string[];
}

export interface RegenerateScheduleParams {
  usuarioId?: string;
  proyectoId: string;
  nombre: string;
  fechaLimite?: string;
  cambiosDisponibilidad: string;
  bloquesFuturosActuales: string;
  tareasCompletadas: string;
}

/**
 * Esquema JSON estricto para Gemini SDK para devolver el cronograma.
 */
const scheduleJsonSchema = {
  type: Type.OBJECT,
  properties: {
    resumen: {
      type: Type.STRING,
      description: 'Resumen ejecutivo de la planificación del proyecto y distribución de tiempos.',
    },
    hitos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING, description: 'Título del hito' },
          fecha: { type: Type.STRING, description: 'Fecha límite del hito (YYYY-MM-DD)' },
        },
        required: ['titulo', 'fecha'],
      },
      description: 'Hitos clave o entregables periódicos.',
    },
    bloques: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fecha: { type: Type.STRING, description: 'Fecha del bloque (YYYY-MM-DD)' },
          hora_inicio: { type: Type.STRING, description: 'Hora de inicio (HH:MM)' },
          hora_fin: { type: Type.STRING, description: 'Hora de finalización (HH:MM)' },
          tarea: { type: Type.STRING, description: 'Nombre de la tarea asignada' },
          descripcion: { type: Type.STRING, description: 'Descripción o objetivo de la sesión' },
          proyecto_id: { type: Type.STRING, description: 'ID del proyecto' },
        },
        required: ['fecha', 'hora_inicio', 'hora_fin', 'tarea'],
      },
      description: 'Bloques diarios de trabajo asignados respetando disponibilidad.',
    },
  },
  required: ['resumen', 'hitos', 'bloques'],
};

/**
 * Genera el cronograma inicial con Gemini AI
 */
export async function generateScheduleWithGemini(
  params: GenerateScheduleParams,
): Promise<GeneratedSchedule> {
  const startTime = Date.now();

  let contextPart = '';
  if (params.usuarioId) {
    try {
      const userContext = await getUserAiContext({
        userId: params.usuarioId,
        projectId: params.proyectoId,
      });
      if (userContext.promptContextoCompleto) {
        contextPart = `\n\n${userContext.promptContextoCompleto}`;
      }
    } catch (cErr) {
      console.warn('Error al cargar contexto de usuario para cronograma:', cErr);
    }
  }

  const prompt = `Eres un planificador académico/laboral. Genera un cronograma realista para el siguiente proyecto.

DATOS DEL PROYECTO:
Nombre: ${params.nombre}
Objetivo: ${params.objetivo}
Fecha límite: ${params.fechaLimite || '30 días a partir de hoy'}
Importancia: ${params.importancia || 'Prioritario'}
Nivel de conocimiento: ${params.nivel || 'Principiante'}
Tiempo diario disponible: ${params.tiempoDiario || '30 minutos'}

DISPONIBILIDAD DEL USUARIO (extraída de sus horarios):
${params.bloquesLibresPorDia || 'Disponibilidad general según el tiempo diario declarado.'}

MATERIAL DE REFERENCIA:
${params.textoExtraidoArchivos ? `Texto extraído de documentos:\n${params.textoExtraidoArchivos}` : 'Sin archivos adjuntos adicionales.'}
${params.enlaces && params.enlaces.length > 0 ? `Enlaces de referencia:\n${params.enlaces.join('\n')}` : ''}${contextPart}

REGLAS:
1. Respeta estrictamente los bloques ocupados del usuario.
2. Distribuye las tareas según la importancia y el tiempo diario disponible.
3. No asignes más horas de las disponibles por día.
4. Considera el nivel de conocimiento: si es "ninguno" o "principiante", añade tareas de fundamentos; si es "intermedio" o "avanzado", omite lo básico y profundiza.
5. Considera las preferencias de aprendizaje y contexto de temas si fueron provistos.
6. Deja margen de holgura (buffer) para imprevistos.
7. El campo "proyecto_id" de cada bloque debe ser exactamente: "${params.proyectoId}".
8. Genera bloques concretos con fechas (YYYY-MM-DD) y horas (HH:MM).
9. DÍAS LIBRES: Evita programar bloques todos los días seguidos. Deja libres los fines de semana (Sábados y Domingos) e intercala días de descanso si el plazo disponible lo permite.`;

  try {
    const response = await callGeminiWithRetry(
      (ai, model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: scheduleJsonSchema,
            temperature: 0.3,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      { maxRetries: 1, initialDelayMs: 1500, timeoutMs: 25000 },
    );

    const rawText = response.text || '{}';
    const parsedJson = JSON.parse(rawText);
    const validated = generatedScheduleSchema.parse(parsedJson);

    // Asegurar que cada bloque tenga el proyecto_id correcto
    validated.bloques = validated.bloques.map((b) => ({
      ...b,
      proyecto_id: params.proyectoId,
    }));

    await logAiInteraction({
      usuarioId: params.usuarioId,
      proyectoId: params.proyectoId,
      tipoOperacion: 'generacion_cronograma',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: rawText,
      duracionMs: Date.now() - startTime,
    });

    return validated;
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    await logAiInteraction({
      usuarioId: params.usuarioId,
      proyectoId: params.proyectoId,
      tipoOperacion: 'generacion_cronograma',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: '',
      duracionMs: Date.now() - startTime,
      error: errMessage,
    });
    throw new Error(`Error en generación de cronograma con Gemini: ${errMessage}`);
  }
}

/**
 * Regenera los bloques futuros del cronograma ante cambios en disponibilidad
 */
export async function regenerateScheduleWithGemini(
  params: RegenerateScheduleParams,
): Promise<GeneratedSchedule> {
  const startTime = Date.now();

  const prompt = `El usuario modificó su disponibilidad. Regenera el cronograma del proyecto "${params.nombre}" manteniendo las tareas ya completadas y ajustando solo los bloques futuros.

CAMBIOS EN DISPONIBILIDAD:
${params.cambiosDisponibilidad}

CRONOGRAMA ACTUAL (bloques futuros):
${params.bloquesFuturosActuales}

TAREAS COMPLETADAS (no tocar):
${params.tareasCompletadas || 'Ninguna tarea completada hasta ahora.'}

${params.fechaLimite ? `NUEVA FECHA LÍMITE: ${params.fechaLimite}` : ''}

REGLAS:
1. No modifiques tareas ya completadas.
2. Reajusta solo bloques cuya fecha sea >= hoy.
3. Mantén la fecha límite original salvo que el usuario la haya cambiado.
4. Devuelve el mismo JSON que en la generación inicial, solo con los bloques futuros y los hitos actualizados.
5. El campo "proyecto_id" de cada bloque debe ser exactamente: "${params.proyectoId}".`;

  try {
    const response = await callGeminiWithRetry(
      (ai, model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: scheduleJsonSchema,
            temperature: 0.3,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      { maxRetries: 1, initialDelayMs: 1500, timeoutMs: 25000 },
    );

    const rawText = response.text || '{}';
    const parsedJson = JSON.parse(rawText);
    const validated = generatedScheduleSchema.parse(parsedJson);

    validated.bloques = validated.bloques.map((b) => ({
      ...b,
      proyecto_id: params.proyectoId,
    }));

    await logAiInteraction({
      usuarioId: params.usuarioId,
      proyectoId: params.proyectoId,
      tipoOperacion: 'regeneracion_cronograma',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: rawText,
      duracionMs: Date.now() - startTime,
    });

    return validated;
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    await logAiInteraction({
      usuarioId: params.usuarioId,
      proyectoId: params.proyectoId,
      tipoOperacion: 'regeneracion_cronograma',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: '',
      duracionMs: Date.now() - startTime,
      error: errMessage,
    });
    throw new Error(`Error en regeneración de cronograma con Gemini: ${errMessage}`);
  }
}

/**
 * Usa Gemini con visión para extraer bloques de disponibilidad desde imágenes de horarios.
 * Implementa reintentos automáticos ante saturación (429/503) y compresión semántica.
 */
export async function extractScheduleFromImageWithGemini(params: {
  base64Data: string;
  mimeType: string;
  usuarioId?: string;
}): Promise<ExtractedScheduleResponse> {
  const startTime = Date.now();

  const prompt = `Analiza la imagen o documento adjunto correspondiente a un horario laboral, académico, universitario o escolar.
Extrae minuciosamente todos los bloques de clases, materias, asignaturas, turnos o actividades con su día de la semana y horas de inicio y fin.
Instrucciones clave:
1. Mapea el día a un número: 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado.
2. Cada bloque debe tener hora_inicio y hora_fin en formato militar HH:MM (ejemplo "08:00", "10:30", "14:00").
3. Clasifica el campo "tipo" exactamente como una de estas opciones: "ocupado", "estudio", "trabajo" o "otra_actividad" (usa "estudio" u "ocupado" para materias de clase).
4. En "etiqueta" coloca el nombre de la materia o actividad (ej. "Cálculo I", "Física", "Laboratorio", "Programación").
5. Si un bloque dura varias horas (ej. 08:00 a 10:00), extrae el intervalo completo con su hora de inicio y fin.
Devuelve la lista de bloques en formato JSON.`;

  const extractionSchema = {
    type: Type.OBJECT,
    properties: {
      bloques: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dia_semana: { type: Type.INTEGER, description: '0 (Domingo) a 6 (Sábado)' },
            hora_inicio: { type: Type.STRING, description: 'HH:MM' },
            hora_fin: { type: Type.STRING, description: 'HH:MM' },
            tipo: {
              type: Type.STRING,
              description: 'ocupado, tareas, estudio, trabajo o otra_actividad',
            },
            etiqueta: { type: Type.STRING, description: 'Materia o actividad' },
          },
          required: ['dia_semana', 'hora_inicio', 'hora_fin', 'tipo'],
        },
      },
      observaciones: { type: Type.STRING },
    },
    required: ['bloques'],
  };

  try {
    const response = await callGeminiWithRetry(
      (ai, model) =>
        ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: params.base64Data,
                    mimeType: params.mimeType,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: extractionSchema,
            temperature: 0.1,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      { maxRetries: 1, initialDelayMs: 1500, timeoutMs: 30000 },
    );

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText);
    const validated = extractedScheduleResponseSchema.parse(parsed);

    await logAiInteraction({
      usuarioId: params.usuarioId,
      tipoOperacion: 'extraccion_horario',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: rawText,
      duracionMs: Date.now() - startTime,
    });

    return validated;
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `[Extracción Horario] Gemini tardó más de 8s o falló (${errMessage}). Reintentando con n8n...`,
    );

    // Fallback a n8n si Gemini tarda más de 5-10 segundos o experimenta error
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        const n8nResult = await extractScheduleFromN8n({
          base64Data: params.base64Data,
          mimeType: params.mimeType,
          usuarioId: params.usuarioId,
        });

        await logAiInteraction({
          usuarioId: params.usuarioId,
          tipoOperacion: 'extraccion_horario',
          modelo: 'n8n-webhook',
          promptEnviado: `Reintento con n8n tras timeout/fallo de Gemini (${errMessage})`,
          respuestaCruda: JSON.stringify(n8nResult),
          duracionMs: Date.now() - startTime,
        });

        return n8nResult;
      } catch (n8nErr) {
        console.error('[Extracción Horario] El reintento con n8n también falló:', n8nErr);
      }
    }

    await logAiInteraction({
      usuarioId: params.usuarioId,
      tipoOperacion: 'extraccion_horario',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: '',
      duracionMs: Date.now() - startTime,
      error: errMessage,
    });
    throw new Error(`Error extrayendo horario con IA: ${errMessage}`);
  }
}

export interface ProjectForGeminiTaskGeneration {
  id: string;
  user_id: string;
  titulo: string;
  objetivo?: string | null;
  fecha_limite?: string | null;
  prioridad?: string | null;
  nivel_conocimiento?: string | null;
  minutos_diarios?: number | null;
  material_url?: string | null;
  file_content?: string | null;
  file_name?: string | null;
  existing_tasks?: Array<{
    id?: string;
    titulo: string;
    descripcion?: string | null;
    completado?: boolean | null;
    fecha_inicio?: string | null;
    duracion?: number | null;
  }> | null;
}

/**
 * Calcula de forma determinista las fechas calendario disponibles entre startDateStr y deadlineStr (inclusive).
 * Incorpora descanso inteligente (evitando fines de semana si el plazo lo permite),
 * pero asegurando que si quedan pocos días (<= 3), se utilicen todos los días disponibles
 * para que el usuario cumpla sus tareas pendientes sin superar jamás el deadlineStr.
 */
export function calculateAvailableStudyDates(startDateStr: string, deadlineStr: string): string[] {
  if (!startDateStr || !deadlineStr || startDateStr > deadlineStr) {
    return [];
  }

  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [dy, dm, dd] = deadlineStr.split('-').map(Number);

  const startMidnight = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  const deadMidnight = new Date(dy, dm - 1, dd, 0, 0, 0, 0);

  // Recopilar todos los días calendario en el intervalo
  const allDays: string[] = [];
  const curr = new Date(startMidnight);

  while (curr.getTime() <= deadMidnight.getTime()) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    allDays.push(`${y}-${m}-${d}`);
    curr.setDate(curr.getDate() + 1);
  }

  const totalDays = allDays.length;
  if (totalDays === 0) return [];

  // Caso A: Plazo muy corto (1, 2 o 3 días restantes)
  // Se usan todos los días disponibles de forma exacta.
  if (totalDays <= 3) {
    return allDays;
  }

  // Caso B: Plazo corto (4 a 6 días restantes)
  // Priorizar días de semana (lunes a viernes). Si hay menos de 3 días de semana,
  // incluir fines de semana para garantizar al menos 3 a 4 sesiones de estudio sin sobrepasar el límite.
  if (totalDays <= 6) {
    const weekdays = allDays.filter((dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });

    if (weekdays.length >= 3) {
      return weekdays;
    }
    return allDays.slice(0, Math.max(3, totalDays - 1));
  }

  // Caso C: Plazo medio o amplio (> 6 días)
  // Excluir fines de semana (sábados y domingos).
  const weekdaysOnly = allDays.filter((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  });

  const basePool = weekdaysOnly.length >= 3 ? weekdaysOnly : allDays;

  // Si el plazo es muy amplio (> 15 días hábiles), limitar a un conjunto razonable inicial
  if (basePool.length > 15) {
    return basePool.filter((_, idx) => idx % 2 === 0 || idx % 3 === 0).slice(0, 15);
  }

  return basePool;
}

/**
 * Genera tareas inteligentes con Gemini para un proyecto y las organiza en el calendario
 * respetando la disponibilidad del usuario (sin colisiones con clases, trabajo u ocupado).
 */
export async function generateProjectTasksAndScheduleWithGemini(
  project: ProjectForGeminiTaskGeneration,
) {
  const startTime = Date.now();
  const supabase = await createClient();
  const adminDb = getAdminClient();
  const db = adminDb || supabase;

  try {
    const existingTasks = project.existing_tasks || [];
    let latestExistingDayStr: string | null = null;
    for (const t of existingTasks) {
      if (t.fecha_inicio) {
        const dStr = t.fecha_inicio.split('T')[0];
        if (!latestExistingDayStr || dStr > latestExistingDayStr) {
          latestExistingDayStr = dStr;
        }
      }
    }

    const deadlineStr = project.fecha_limite ? project.fecha_limite.split('T')[0] : '';

    // 0. Validar si las tareas existentes ya cubren toda la duración del proyecto hasta su fecha límite
    if (deadlineStr && latestExistingDayStr && latestExistingDayStr >= deadlineStr) {
      return {
        success: false,
        error:
          'Las tareas ya están asignadas a toda la duración del proyecto. Si deseas agregar más tareas, por favor modifica la fecha límite del proyecto.',
      };
    }

    // 1. Obtener disponibilidad del usuario (bloques ocupados de trabajo, estudio o clases)
    const { data: bloquesDisp } = await db
      .from('bloques_disponibilidad')
      .select('*')
      .eq('usuario_id', project.user_id);

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    let disponibilidadDesc = 'Sin bloques ocupados específicos registrados en el perfil.';
    const busyBlocks = (bloquesDisp || []).filter(
      (b) => b.tipo === 'ocupado' || b.tipo === 'trabajo' || b.tipo === 'estudio',
    );

    if (busyBlocks.length > 0) {
      disponibilidadDesc = busyBlocks
        .map((b) => {
          const dName =
            b.fecha_especifica ||
            (b.dia_semana !== null && b.dia_semana !== undefined ? dayNames[b.dia_semana] : 'Día');
          return `- ${dName}: ${b.hora_inicio} a ${b.hora_fin} (Ocupado por ${b.tipo})`;
        })
        .join('\n');
    }

    // 2. Obtener eventos de calendario existentes para evitar colisiones
    const nowIso = new Date().toISOString();
    const { data: eventosExistentes } = await db
      .from('eventos_calendario')
      .select('inicio, fin, titulo')
      .eq('usuario_id', project.user_id)
      .gte('fin', nowIso)
      .neq('estado', 'cancelado')
      .limit(50);

    let eventosDesc = 'Sin otros eventos agendados próximos.';
    if (eventosExistentes && eventosExistentes.length > 0) {
      eventosDesc = eventosExistentes
        .map((e) => {
          const d = new Date(e.inicio);
          const fechaStr = d.toISOString().split('T')[0];
          const horaStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          return `- ${fechaStr} a las ${horaStr}: "${e.titulo}"`;
        })
        .join('\n');
    }

    // 3. Determinar fecha de inicio y ranuras de fechas autorizadas
    const today = new Date();
    const ty = today.getFullYear();
    const tm = String(today.getMonth() + 1).padStart(2, '0');
    const td = String(today.getDate()).padStart(2, '0');
    const todayStr = `${ty}-${tm}-${td}`;

    let startDateStr = todayStr;
    if (latestExistingDayStr && latestExistingDayStr >= todayStr) {
      const [ey, em, ed] = latestExistingDayStr.split('-').map(Number);
      const nextD = new Date(ey, em - 1, ed + 1);
      const ny = nextD.getFullYear();
      const nm = String(nextD.getMonth() + 1).padStart(2, '0');
      const nd = String(nextD.getDate()).padStart(2, '0');
      startDateStr = `${ny}-${nm}-${nd}`;
    } else {
      // Comenzar mañana si no hay tareas existentes y la fecha límite es posterior a hoy
      if (deadlineStr && todayStr < deadlineStr) {
        const [cy, cm, cd] = todayStr.split('-').map(Number);
        const tomD = new Date(cy, cm - 1, cd + 1);
        const tomy = tomD.getFullYear();
        const tomm = String(tomD.getMonth() + 1).padStart(2, '0');
        const tomd = String(tomD.getDate()).padStart(2, '0');
        startDateStr = `${tomy}-${tomm}-${tomd}`;
      } else {
        startDateStr = todayStr;
      }
    }

    // Fallback de fecha límite si no viene definida
    let effectiveDeadlineStr = deadlineStr;
    if (!effectiveDeadlineStr) {
      const [sy, sm, sd] = startDateStr.split('-').map(Number);
      const defDead = new Date(sy, sm - 1, sd + 30);
      const dy = defDead.getFullYear();
      const dm = String(defDead.getMonth() + 1).padStart(2, '0');
      const dd = String(defDead.getDate()).padStart(2, '0');
      effectiveDeadlineStr = `${dy}-${dm}-${dd}`;
    }

    const targetDates = calculateAvailableStudyDates(startDateStr, effectiveDeadlineStr);

    if (targetDates.length === 0) {
      return {
        success: false,
        error:
          'Las tareas ya están asignadas a toda la duración del proyecto. Si deseas agregar más tareas, por favor modifica la fecha límite del proyecto.',
      };
    }

    const maxTasks = targetDates.length;
    const datesListFormatted = targetDates.map((d, i) => `   - Tarea ${i + 1}: ${d}`).join('\n');

    const minutosDiarios = Math.max(15, Number(project.minutos_diarios) || 30);
    const nivel = project.nivel_conocimiento || 'Principiante';
    const prioridad = project.prioridad || 'Prioritario';

    let existingTasksPrompt = '';
    if (existingTasks.length > 0) {
      existingTasksPrompt =
        `\n\nTAREAS ACTUALES YA REGISTRADAS EN ESTE PROYECTO (${existingTasks.length} tareas existentes que el usuario YA TIENE):\n` +
        existingTasks
          .map(
            (t, idx) =>
              `- Tarea existente ${idx + 1}: "${t.titulo}" (${t.completado ? 'Completada' : 'Pendiente'})${
                t.descripcion ? ` - ${t.descripcion}` : ''
              }`,
          )
          .join('\n') +
        `\n\nREQUISITO OBLIGATORIO DE CONTINUIDAD:\n` +
        `El usuario ya tiene registradas las tareas anteriores. NO repitas ninguna de esas tareas bajo ninguna circunstancia ni generes tareas equivalentes. ` +
        `Genera ÚNICAMENTE un conjunto de tareas NUEVAS y DIFERENTES que continúen la progresión hacia el objetivo del proyecto a partir de la última tarea existente.`;
    }

    const filePart = project.file_content
      ? `\n- Documento de referencia adjunto ("${project.file_name || 'archivo'}"):\n--- INICIO DEL DOCUMENTO ---\n${project.file_content.slice(0, 12000)}\n--- FIN DEL DOCUMENTO ---\nPor favor toma en cuenta este documento para extraer o estructurar las tareas del proyecto.`
      : '';

    // 3.5. Obtener contexto del perfil del usuario y biblioteca de temas/fuentes autorizadas
    const userAiContext = await getUserAiContext({
      userId: project.user_id,
      projectId: project.id,
    });

    // 4. Prompt pedagógico para Gemini
    const prompt = `Eres un mentor y planificador académico/profesional de alto nivel.
Genera un plan de tareas detallado y progresivo para el siguiente proyecto estudiantil/laboral, y organízalas en un cronograma diario sin colisiones.

DATOS DEL PROYECTO:
- Título: ${project.titulo}
- Objetivo: ${project.objetivo || 'Dominar los conceptos y completar el proyecto satisfactoriamente'}
- Nivel de conocimiento inicial del usuario: ${nivel}
- Prioridad: ${prioridad}
- Fecha de inicio para las nuevas tareas: ${startDateStr}
- Fecha límite final: ${effectiveDeadlineStr} (Ranuras disponibles: ${maxTasks})
- Tiempo disponible diario del usuario: ${minutosDiarios} minutos por día.
${project.material_url ? `- Material o recurso suministrado: ${project.material_url}` : ''}${filePart}${existingTasksPrompt}
${userAiContext.perfilTexto ? `\n${userAiContext.perfilTexto}` : ''}
${userAiContext.preferenciasInclusivasTexto ? `\n${userAiContext.preferenciasInclusivasTexto}` : ''}
${userAiContext.temasTexto ? `\n${userAiContext.temasTexto}` : ''}
HORARIOS OCUPADOS DEL USUARIO (¡PROHIBIDO ASIGNAR TAREAS EN ESTAS FRANJAS!):
${disponibilidadDesc}

EVENTOS PUNTUALES YA AGENDADOS:
${eventosDesc}

🚨 REGLA ESTRICTA DE CANTIDAD DE TAREAS Y FECHAS AUTORIZADAS:
- Quedan exactamente ${maxTasks} fecha(s) autorizada(s) para este proyecto antes de la fecha límite (${effectiveDeadlineStr}):
${datesListFormatted}
- Debes generar ${maxTasks <= 3 ? `EXACTAMENTE ${maxTasks}` : `como máximo ${maxTasks}`} tareas en total (¡PROHIBIDO generar más de ${maxTasks} tareas!).
- Cada tarea generada DEBE asignarse a una de las fechas autorizadas anteriores en estricto orden cronológico.
- ¡BAJO NINGUNA CIRCUNSTANCIA generes tareas con fechas posteriores al ${effectiveDeadlineStr}!

DIRECTRICES ADICIONALES:
1. DURACIÓN DIARIA: Cada tarea debe tener una duración estimada en minutos que coincida con la disponibilidad diaria del usuario (${minutosDiarios} minutos).
2. DIFICULTAD Y COMPLEJIDAD:
   - Si el nivel es "Principiante" o "ninguno", inicia con tareas de conceptos fundamentales, entorno y pasos introductorios antes de avanzar.
   - Si una tarea o concepto es complejo, divídelo en sesiones consecutivas de ${minutosDiarios} minutos cada una.
3. ASIGNACIÓN AL CALENDARIO COHERENTE Y SIN COLISIONES:
   - Para cada tarea debes proponer la fecha ("fecha": YYYY-MM-DD seleccionada de las autorizadas), una hora de inicio ("hora_inicio": HH:MM militar) y hora de fin ("hora_fin": HH:MM militar).
   - Las horas deben ser diurnas y lógicas (entre las 08:00 y las 21:00).
   - ¡NO DEBE COINCIDIR ni solaparse con ningún bloque ocupado de clases, trabajo o eventos existentes! Elige momentos en que el usuario tenga bloques de tareas.
4. Para cada tarea, incluye una breve descripción y una URL de recurso o búsqueda sugerida (documentación, guía o tutorial).
5. EVALUACIÓN DE VIABILIDAD: Determina si el objetivo es humanamente posible en el plazo disponible. Si es manifiestamente imposible (ej. aprender medicina o una carrera entera en 3 días), marca es_posible: false y detalla motivo_imposible. Si es viable, marca es_posible: true y genera las tareas.
6. ADAPTACIÓN AL PERFIL DEL USUARIO:
   - Si el perfil define una metodología de aprendizaje preferida (ej. Pomodoro, práctica intensiva, proyectos paso a paso), adapta la secuencia y dinámica de las sesiones a esa metodología.
   - Toma en cuenta su situación laboral y retos o dificultades declaradas para que el plan sea alcanzable.
7. INCORPORACIÓN DE TEMAS, NOTAS PRINCIPALES Y FUENTES AUTORIZADAS:
   - Si el usuario tiene temas vinculados a este proyecto o fuentes autorizadas en su biblioteca de Temas, úsalas como guía temática y documental central para estructurar las tareas.
8. ADAPTACIÓN A PREFERENCIAS INCLUSIVAS Y DE APRENDIZAJE:
   - Si el usuario cuenta con preferencias inclusivas (ritmo, obstáculos de estudio, tiempo de atención, formato de aprendizaje, estilo de IA o intereses):
     * Ritmo y micro-pasos: Si prefiere bloques breves (5 a 10 min o 15 a 20 min) o pausas frecuentes, estructura las tareas para que se cumplan en micro-pasos digeribles, evitando saturación cognitiva.
     * Estilo pedagógico e intereses: Si prefiere estilo con retos/misiones o analogías, enmarca los títulos y descripciones acordemente (ej. "Misión 1: ...", "Reto: ..."), vinculando con sus temas de interés cuando sea pertinente.
     * Formatos y recursos recomendados: Prioriza recursos y enlaces acordes al formato preferido del estudiante (videos cortos, infografías, resúmenes con viñetas o audios).
     * Mitigación de barreras: Ante retos como saber por dónde empezar o frustración rápida, proporciona un paso 1 trivial e indicaciones paso a paso directas y concisas.`;

    const projectTasksSchema = {
      type: Type.OBJECT,
      properties: {
        es_posible: {
          type: Type.BOOLEAN,
          description:
            'true si el objetivo es factible en el tiempo y plazo; false si es imposible.',
        },
        motivo_imposible: {
          type: Type.STRING,
          description: 'Explicación si el proyecto es manifiestamente imposible.',
        },
        resumen: {
          type: Type.STRING,
          description: 'Breve resumen pedagógico del plan de trabajo estructurado.',
        },
        tareas: {
          type: Type.ARRAY,
          description: `Lista estructurada de tareas (máximo ${maxTasks} tareas).`,
          items: {
            type: Type.OBJECT,
            properties: {
              titulo: {
                type: Type.STRING,
                description: 'Título conciso y accionable de la tarea (máx 100 caracteres)',
              },
              descripcion: {
                type: Type.STRING,
                description: 'Detalle de qué se aprenderá o practicará en esta sesión',
              },
              duracion_minutos: {
                type: Type.INTEGER,
                description: 'Duración estimada en minutos (aprox. la disponibilidad diaria)',
              },
              fecha: {
                type: Type.STRING,
                description: 'Fecha seleccionada de la lista de fechas autorizadas (YYYY-MM-DD)',
              },
              hora_inicio: {
                type: Type.STRING,
                description: 'Hora de inicio recomendada (HH:MM en formato militar 24h, ej. 09:00)',
              },
              hora_fin: {
                type: Type.STRING,
                description: 'Hora de finalización (HH:MM en formato militar 24h, ej. 09:30)',
              },
              prioridad: {
                type: Type.STRING,
                description: 'Prioridad asignada: Alta, Media o Baja',
              },
              url_recomendada: {
                type: Type.STRING,
                description: 'Enlace web, documentación oficial o tutorial recomendado',
              },
            },
            required: ['titulo', 'duracion_minutos', 'fecha', 'hora_inicio', 'hora_fin'],
          },
        },
      },
      required: ['tareas'],
    };

    // 5. Llamada con retry y fallback a Gemini
    const response = await callGeminiWithRetry(
      (ai, model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: projectTasksSchema,
            temperature: 0.2,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      { maxRetries: 1, initialDelayMs: 1500, timeoutMs: 25000 },
    );

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText) as {
      es_posible?: boolean;
      motivo_imposible?: string;
      resumen?: string;
      tareas?: Array<{
        titulo: string;
        descripcion?: string;
        duracion_minutos?: number;
        fecha: string;
        hora_inicio: string;
        hora_fin: string;
        prioridad?: string;
        url_recomendada?: string;
      }>;
    };

    // Si la IA dictaminó que el proyecto es pedagógicamente imposible
    if (parsed.es_posible === false) {
      return {
        success: false,
        es_imposible: true,
        motivo: parsed.motivo_imposible || 'El tiempo asignado es insuficiente para este objetivo.',
        error: `Es imposible realizar el proyecto en el tiempo límite indicado. ${parsed.motivo_imposible || ''}`,
      };
    }

    let tasksList = parsed.tareas || [];
    if (tasksList.length === 0) {
      return {
        success: false,
        error: 'La IA no devolvió tareas estructuradas.',
      };
    }

    // Truncar estrictamente al número máximo de ranuras autorizadas
    if (tasksList.length > targetDates.length) {
      tasksList = tasksList.slice(0, targetDates.length);
    }

    // 6. Preparar inserción de tareas en la tabla 'tareas' de Supabase asegurando ranuras válidas
    const tasksToInsert = tasksList.map((t, index) => {
      const taskId = crypto.randomUUID();
      const duracion = Math.max(15, Number(t.duracion_minutos) || minutosDiarios);

      // Asignar determinísticamente la fecha autorizada correspondiente a esta ranura
      const assignedDate = targetDates[index] || targetDates[targetDates.length - 1];
      const horaInicio =
        t.hora_inicio && /^\d{2}:\d{2}$/.test(t.hora_inicio) ? t.hora_inicio : '09:00';
      const horaFin = t.hora_fin && /^\d{2}:\d{2}$/.test(t.hora_fin) ? t.hora_fin : '10:00';
      const fechaInicioIso = new Date(`${assignedDate}T${horaInicio}:00`).toISOString();

      return {
        id: taskId,
        id_proyecto: project.id,
        titulo: t.titulo.trim(),
        descripcion: t.descripcion?.trim() || null,
        duracion,
        completado: false,
        fecha_inicio: fechaInicioIso,
        prioridad: t.prioridad || prioridad,
        resources: t.url_recomendada || project.material_url || null,
        fecha: assignedDate,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
      };
    });

    const { data: insertedTasks, error: insertTasksErr } = await db
      .from('tareas')
      .insert(
        tasksToInsert.map((t) => ({
          id: t.id,
          id_proyecto: t.id_proyecto,
          titulo: t.titulo,
          descripcion: t.descripcion,
          duracion: t.duracion,
          completado: t.completado,
          fecha_inicio: t.fecha_inicio,
          prioridad: t.prioridad,
          resources: t.resources,
        })),
      )
      .select();

    if (insertTasksErr) {
      console.error('Error al insertar tareas generadas por Gemini:', insertTasksErr);
      return {
        success: false,
        error: `Error al persistir tareas en Supabase: ${insertTasksErr.message}`,
      };
    }

    // 7. Insertar eventos correspondientes en 'eventos_calendario'
    const eventsToInsert = tasksToInsert.map((t) => {
      const startIso = new Date(`${t.fecha}T${t.hora_inicio}:00`).toISOString();
      const endIso = new Date(`${t.fecha}T${t.hora_fin}:00`).toISOString();

      return {
        id: crypto.randomUUID(),
        usuario_id: project.user_id,
        proyecto_id: project.id,
        tarea_id: t.id,
        titulo: t.titulo,
        descripcion: t.descripcion || '',
        inicio: startIso,
        fin: endIso,
        estado: 'pendiente' as const,
        generado_por_ia: true,
      };
    });

    const { error: insertEventsErr } = await db.from('eventos_calendario').insert(eventsToInsert);

    if (insertEventsErr) {
      console.warn('Advertencia insertando eventos de calendario:', insertEventsErr);
    }

    // 8. Actualizar progreso del proyecto recalculando con todas las tareas
    const { data: allTasks } = await db
      .from('tareas')
      .select('completado')
      .eq('id_proyecto', project.id);

    let newProgreso = 0;
    if (allTasks && allTasks.length > 0) {
      const completedCount = allTasks.filter((t) => t.completado).length;
      newProgreso = Math.round((completedCount / allTasks.length) * 100);
    }

    await db
      .from('projects')
      .update({ progreso: newProgreso, completado: false })
      .eq('id', project.id);

    // 9. Registrar log de interacción IA
    await logAiInteraction({
      usuarioId: project.user_id,
      proyectoId: project.id,
      tipoOperacion: 'generacion_cronograma',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: rawText,
      duracionMs: Date.now() - startTime,
    });

    return {
      success: true,
      count: tasksToInsert.length,
      tasks: insertedTasks || tasksToInsert,
      events: eventsToInsert,
      resumen: parsed.resumen || '',
      progreso: newProgreso,
    };
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    await logAiInteraction({
      usuarioId: project.user_id,
      proyectoId: project.id,
      tipoOperacion: 'generacion_cronograma',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: `Proyecto: ${project.titulo}`,
      respuestaCruda: '',
      duracionMs: Date.now() - startTime,
      error: errMessage,
    });
    console.warn(
      `[Generación Tareas] Gemini falló o tardó más de 8s (${errMessage}). Intentando fallback con n8n...`,
    );

    if (process.env.N8N_WEBHOOK_URL) {
      try {
        const { generateProjectTasksFromN8n } =
          await import('@/services/automation/n8nTasksService');
        const n8nResult = await generateProjectTasksFromN8n({
          id: project.id,
          user_id: project.user_id,
          titulo: project.titulo,
          objetivo: project.objetivo,
          fecha_limite: project.fecha_limite,
          prioridad: project.prioridad,
          nivel_conocimiento: project.nivel_conocimiento,
          minutos_diarios: project.minutos_diarios,
          material_url: project.material_url,
        });

        if (n8nResult.success) {
          await logAiInteraction({
            usuarioId: project.user_id,
            proyectoId: project.id,
            tipoOperacion: 'generacion_cronograma',
            modelo: 'n8n-webhook',
            promptEnviado: `Fallback n8n tras fallo de Gemini (${errMessage})`,
            respuestaCruda: JSON.stringify(n8nResult),
            duracionMs: Date.now() - startTime,
          });

          return {
            success: true,
            count: n8nResult.count || n8nResult.tasks?.length || 0,
            tasks: n8nResult.tasks || [],
            resumen: 'Tareas generadas mediante el servicio de respaldo (n8n).',
          };
        }
      } catch (n8nErr) {
        console.error('[Generación Tareas] El fallback con n8n también falló:', n8nErr);
      }
    }

    return {
      success: false,
      error: `Error al generar tareas con Gemini: ${errMessage}`,
    };
  }
}
export interface CheckProjectFeasibilityParams {
  titulo: string;
  objetivo?: string | null;
  fecha_limite?: string | null;
  minutos_diarios?: number | null;
  nivel_conocimiento?: string | null;
  usuario_id?: string;
}

export interface FeasibilityResult {
  es_posible: boolean;
  motivo?: string;
  tiempo_minimo_recomendado?: string;
  error?: string;
}

/**
 * Evalúa mediante IA (Gemini) si un proyecto es humanamente y pedagógicamente
 * alcanzable en el tiempo límite y dedicación diaria especificados por el usuario.
 */
export async function checkProjectFeasibilityWithGemini(
  params: CheckProjectFeasibilityParams,
): Promise<FeasibilityResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let diffDays = 30;

  if (params.fecha_limite) {
    const deadline = new Date(params.fecha_limite);
    if (!isNaN(deadline.getTime())) {
      deadline.setHours(0, 0, 0, 0);
      const diffMs = deadline.getTime() - today.getTime();
      diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  const minutosDiarios = Math.max(15, Number(params.minutos_diarios) || 30);
  const horasTotales = Math.round((diffDays * minutosDiarios) / 60);

  // Si no hay API key configurada, realizar validación heurística básica de seguridad
  if (!process.env.GEMINI_API_KEY) {
    if (diffDays <= 1 && (params.objetivo?.length || 0) > 100) {
      return {
        es_posible: false,
        motivo: 'El plazo de 1 día es insuficiente para un objetivo tan complejo.',
        error: `Es imposible realizar el proyecto en solo ${diffDays} día(s). Se necesita más tiempo para alcanzar este objetivo.`,
      };
    }
    return { es_posible: true };
  }

  const feasibilityJsonSchema = {
    type: Type.OBJECT,
    properties: {
      es_posible: {
        type: Type.BOOLEAN,
        description:
          'true si el proyecto es pedagógicamente viable y alcanzable en el tiempo disponible; false si es manifiestamente imposible.',
      },
      motivo: {
        type: Type.STRING,
        description:
          'Explicación detallada y pedagógica en español de por qué es posible o imposible.',
      },
      tiempo_minimo_recomendado: {
        type: Type.STRING,
        description:
          'Tiempo mínimo estimado que realmente se requeriría (ej. "al menos 2 meses", "mínimo 4 semanas").',
      },
    },
    required: ['es_posible', 'motivo'],
  };

  let userProfileContext = '';
  if (params.usuario_id) {
    try {
      const userContext = await getUserAiContext({ userId: params.usuario_id });
      const contextBlocks = [
        userContext.perfilTexto,
        userContext.preferenciasInclusivasTexto,
      ].filter(Boolean);
      if (contextBlocks.length > 0) {
        userProfileContext = `\n${contextBlocks.join('\n\n')}`;
      }
    } catch {
      // Omitir si no se puede cargar el contexto
    }
  }
  const prompt = `Eres un evaluador académico, pedagógico y de viabilidad de proyectos de estudio.
Tu labor es determinar con rigurosidad y honestidad pedagógica si el siguiente proyecto es FACTIBLE o IMPOSIBLE de realizar en el plazo y tiempo diario asignado por el estudiante.

DATOS DEL PROYECTO:
- Título: ${params.titulo}
- Objetivo declarado: ${params.objetivo || 'Avanzar en el aprendizaje del tema'}
- Nivel actual del estudiante: ${params.nivel_conocimiento || 'Principiante'}
- Plazo límite: ${params.fecha_limite || 'No especificado'} (${diffDays} días restantes)
- Dedicación diaria: ${minutosDiarios} minutos al día.
- Tiempo total disponible de trabajo: ~${horasTotales} horas de dedicación en todo el proyecto.
${userProfileContext}
CRITERIOS ESTRICTOS DE EVALUACIÓN:
1. IMPOSIBLE (es_posible = false):
   - Metas de aprendizaje o desarrollo que objetivamente requieren cientos o miles de horas de estudio/práctica (por ejemplo: dominar una carrera profesional completa, medicina, ingeniería de software desde cero, dominar múltiples idiomas extranjeros, construir un sistema operativo o cohete) pero el usuario tiene pocos días o semanas, o una cantidad ínfima de horas totales (~menos de 20-50 horas cuando se requieren cientos o miles).
   - Metas amplias o complejas con un plazo ridículamente estrecho (ejemplo: 1 a 7 días para dominar un campo amplio o completar una meta muy ambiciosa).
   - Si es IMPOSIBLE, explica con empatía y claridad que es imposible realizar el proyecto en ese tiempo, detallando por qué y cuánto tiempo mínimo realmente necesitaría.

2. FACTIBLE (es_posible = true):
   - Metas acotadas, razonables o realistas para el tiempo disponible (ejemplo: aprender fundamentos básicos de Python en 1 mes, preparar un examen específico en 2 semanas, hacer un taller práctico, rediseñar una página web).
   - Proyectos donde la meta está alineada con las horas totales de dedicación.

Responde ÚNICAMENTE un objeto JSON que siga el esquema especificado.`;

  try {
    const startTime = Date.now();
    const response = await callGeminiWithRetry(
      (ai, model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: feasibilityJsonSchema,
            temperature: 0.1,
            maxOutputTokens: 300,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      {
        maxRetries: 1,
        initialDelayMs: 1000,
        models: ['gemini-3.6-flash', 'gemini-3.8-flash'],
      },
    );

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText) as {
      es_posible?: boolean;
      motivo?: string;
      tiempo_minimo_recomendado?: string;
    };

    await logAiInteraction({
      usuarioId: params.usuario_id,
      tipoOperacion: 'evaluacion_viabilidad',
      modelo: GEMINI_DEFAULT_MODEL,
      promptEnviado: prompt,
      respuestaCruda: rawText,
      duracionMs: Date.now() - startTime,
    });

    if (parsed.es_posible === false) {
      const recom = parsed.tiempo_minimo_recomendado
        ? ` Tiempo mínimo recomendado: ${parsed.tiempo_minimo_recomendado}.`
        : '';
      return {
        es_posible: false,
        motivo: parsed.motivo,
        tiempo_minimo_recomendado: parsed.tiempo_minimo_recomendado,
        error: `Es imposible realizar el proyecto en el tiempo límite indicado (${diffDays} días). ${parsed.motivo || 'Se necesita más tiempo para alcanzar este objetivo.'}${recom}`,
      };
    }

    return {
      es_posible: true,
      motivo: parsed.motivo,
    };
  } catch (error) {
    console.warn(
      'Advertencia: Error al evaluar viabilidad con Gemini, permitiendo fallback:',
      error,
    );
    // En caso de falla de red con Gemini, no bloquear al usuario a menos que sea plazo 0 o negativo
    return { es_posible: true };
  }
}

export interface RescheduledTaskItem {
  eventoId: string;
  tareaId?: string | null;
  titulo: string;
  fechaAnterior: string;
  horaAnterior: string;
  nuevaFecha: string;
  nuevaHoraInicio: string;
  nuevaHoraFin: string;
  motivo?: string;
}

export interface RescheduleConflictingTasksResult {
  success: boolean;
  reagendadas: number;
  tareasReagendadas: RescheduledTaskItem[];
  resumen?: string;
  error?: string;
}

function timeStrToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Detecta si hay tareas en 'eventos_calendario' que colisionen con los bloques ocupados
 * del usuario en 'bloques_disponibilidad' y las reagenda automáticamente usando Gemini
 * (con fallback determinista) a horas y días libres sin solapamientos.
 */
export async function rescheduleConflictingCalendarTasksWithGemini(
  usuarioId: string,
): Promise<RescheduleConflictingTasksResult> {
  const startTime = Date.now();
  const supabase = await createClient();
  const adminDb = getAdminClient();
  const db = adminDb || supabase;

  try {
    // 1. Obtener bloques de disponibilidad donde el usuario esté ocupado (no tareas)
    const { data: busyBlocks, error: busyErr } = await db
      .from('bloques_disponibilidad')
      .select('*')
      .eq('usuario_id', usuarioId)
      .neq('tipo', 'tareas');

    if (busyErr) {
      console.warn('Error consultando bloques_disponibilidad en reagendamiento:', busyErr);
    }

    if (!busyBlocks || busyBlocks.length === 0) {
      return {
        success: true,
        reagendadas: 0,
        tareasReagendadas: [],
        resumen: 'No hay bloques ocupados que generen conflictos.',
      };
    }

    // 2. Obtener eventos de calendario activos futuros o pendientes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const { data: pendingEvents, error: eventsErr } = await db
      .from('eventos_calendario')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('estado', 'pendiente')
      .gte('fin', todayIso)
      .order('inicio', { ascending: true });

    if (eventsErr) {
      console.warn('Error consultando eventos_calendario en reagendamiento:', eventsErr);
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      return {
        success: true,
        reagendadas: 0,
        tareasReagendadas: [],
        resumen: 'No hay tareas agendadas pendientes para reagendar.',
      };
    }

    // 3. Identificar eventos en conflicto
    interface ConflictingItem {
      ev: (typeof pendingEvents)[0];
      dateStr: string;
      dayOfWeek: number;
      startSlot: string;
      endSlot: string;
      durationMin: number;
      conflictReason: string;
    }

    interface NonConflictingItem {
      ev: (typeof pendingEvents)[0];
      dateStr: string;
      dayOfWeek: number;
      startSlot: string;
      endSlot: string;
      startMin: number;
      endMin: number;
    }

    const conflictingEvents: ConflictingItem[] = [];
    const nonConflictingEvents: NonConflictingItem[] = [];

    for (const ev of pendingEvents) {
      const startDate = new Date(ev.inicio);
      const endDate = new Date(ev.fin);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayOfWeek = startDate.getDay(); // 0: Dom, 1: Lun, ... 6: Sab

      const startH = String(startDate.getHours()).padStart(2, '0');
      const startM = String(startDate.getMinutes()).padStart(2, '0');
      const endH = String(endDate.getHours()).padStart(2, '0');
      const endM = String(endDate.getMinutes()).padStart(2, '0');
      const startSlot = `${startH}:${startM}`;
      const endSlot = `${endH}:${endM}`;

      const evStartMin = startDate.getHours() * 60 + startDate.getMinutes();
      const evEndMin = endDate.getHours() * 60 + endDate.getMinutes();
      const durationMin = Math.max(
        15,
        Math.round((endDate.getTime() - startDate.getTime()) / (60 * 1000)),
      );

      let conflictReason = '';
      let hasConflict = false;

      for (const busy of busyBlocks) {
        let matchesDay = false;
        if (busy.fecha_especifica) {
          matchesDay = busy.fecha_especifica === dateStr;
        } else if (busy.dia_semana !== null && busy.dia_semana !== undefined) {
          matchesDay = busy.dia_semana === dayOfWeek;
        }

        if (matchesDay) {
          const busyStartMin = timeStrToMinutes(busy.hora_inicio);
          const busyEndMin = timeStrToMinutes(busy.hora_fin);

          if (intervalsOverlap(evStartMin, evEndMin, busyStartMin, busyEndMin)) {
            hasConflict = true;
            conflictReason = `Cruce con horario ocupado (${busy.tipo}) de ${busy.hora_inicio} a ${busy.hora_fin}`;
            break;
          }
        }
      }

      if (hasConflict) {
        conflictingEvents.push({
          ev,
          dateStr,
          dayOfWeek,
          startSlot,
          endSlot,
          durationMin,
          conflictReason,
        });
      } else {
        nonConflictingEvents.push({
          ev,
          dateStr,
          dayOfWeek,
          startSlot,
          endSlot,
          startMin: evStartMin,
          endMin: evEndMin,
        });
      }
    }

    if (conflictingEvents.length === 0) {
      return {
        success: true,
        reagendadas: 0,
        tareasReagendadas: [],
        resumen: 'No se encontraron tareas en conflicto con el horario.',
      };
    }

    // 4. Reagendamiento determinista local instantáneo (0 tokens de IA, sin colisiones)
    console.info(
      `[Reagendamiento Local] Reorganizando ${conflictingEvents.length} tareas en conflicto de forma determinista y sin solapamientos...`,
    );

    // Helper de fallback determinista para encontrar el primer slot libre
    const findDeterministicSlot = (
      dateStr: string,
      durationMin: number,
      alreadyBooked: Array<{ date: string; startMin: number; endMin: number }>,
    ): { fecha: string; startMin: number; endMin: number } => {
      let candidateDate = new Date(`${dateStr}T00:00:00`);
      if (isNaN(candidateDate.getTime())) candidateDate = new Date();

      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const curDate = new Date(candidateDate);
        curDate.setDate(curDate.getDate() + dayOffset);
        const y = curDate.getFullYear();
        const m = String(curDate.getMonth() + 1).padStart(2, '0');
        const d = String(curDate.getDate()).padStart(2, '0');
        const curDateStr = `${y}-${m}-${d}`;
        const curDayOfWeek = curDate.getDay();

        // Buscar entre las 08:00 (480 min) y 20:00 (1200 min)
        for (let candidateStart = 480; candidateStart + durationMin <= 1260; candidateStart += 30) {
          const candidateEnd = candidateStart + durationMin;

          // Verificar si solapa con busyBlocks
          const collidesBusy = busyBlocks.some((b) => {
            let mDay = false;
            if (b.fecha_especifica) mDay = b.fecha_especifica === curDateStr;
            else if (b.dia_semana !== null && b.dia_semana !== undefined)
              mDay = b.dia_semana === curDayOfWeek;

            if (mDay) {
              const bStart = timeStrToMinutes(b.hora_inicio);
              const bEnd = timeStrToMinutes(b.hora_fin);
              return intervalsOverlap(candidateStart, candidateEnd, bStart, bEnd);
            }
            return false;
          });

          if (collidesBusy) continue;

          // Verificar si solapa con alreadyBooked
          const collidesBooked = alreadyBooked.some(
            (b) =>
              b.date === curDateStr &&
              intervalsOverlap(candidateStart, candidateEnd, b.startMin, b.endMin),
          );

          if (collidesBooked) continue;

          // Slot encontrado
          return { fecha: curDateStr, startMin: candidateStart, endMin: candidateEnd };
        }
      }

      // Último recurso: 18:00 del mismo día
      return { fecha: dateStr, startMin: 18 * 60, endMin: 18 * 60 + durationMin };
    };

    const bookedSlots: Array<{ date: string; startMin: number; endMin: number }> =
      nonConflictingEvents.map((n) => ({
        date: n.dateStr,
        startMin: n.startMin,
        endMin: n.endMin,
      }));

    const finalRescheduled: RescheduledTaskItem[] = [];

    for (const conf of conflictingEvents) {
      const slot = findDeterministicSlot(conf.dateStr, conf.durationMin, bookedSlots);
      const targetDate = slot.fecha;
      const targetStart = minutesToTimeStr(slot.startMin);
      const targetEnd = minutesToTimeStr(slot.endMin);
      const motivo = 'Reagendado automáticamente al siguiente horario libre disponible';

      bookedSlots.push({
        date: targetDate,
        startMin: slot.startMin,
        endMin: slot.endMin,
      });

      // 5. Actualizar en Supabase
      const startIso = new Date(`${targetDate}T${targetStart}:00`).toISOString();
      const endIso = new Date(`${targetDate}T${targetEnd}:00`).toISOString();

      // Actualizar evento_calendario
      await db
        .from('eventos_calendario')
        .update({
          inicio: startIso,
          fin: endIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conf.ev.id)
        .eq('usuario_id', usuarioId);

      // Si tiene tarea_id, actualizar fecha_inicio en tareas
      if (conf.ev.tarea_id) {
        await db
          .from('tareas')
          .update({
            fecha_inicio: startIso,
          })
          .eq('id', conf.ev.tarea_id);
      }

      // Si tiene proyecto_id, actualizar cronograma activo si existe
      if (conf.ev.proyecto_id) {
        const { data: activeCron } = await db
          .from('cronogramas')
          .select('id, datos')
          .eq('proyecto_id', conf.ev.proyecto_id)
          .eq('activo', true)
          .maybeSingle();

        if (activeCron && activeCron.datos) {
          const rawDatos = activeCron.datos as { bloques?: Array<Record<string, unknown>> };
          const bloques = rawDatos.bloques || [];
          let updatedCron = false;

          const updatedBloques = bloques.map((b) => {
            const bTarea = typeof b.tarea === 'string' ? b.tarea : '';
            if (bTarea && (bTarea === conf.ev.titulo || conf.ev.titulo.includes(bTarea))) {
              updatedCron = true;
              return {
                ...b,
                fecha: targetDate,
                hora_inicio: targetStart,
                hora_fin: targetEnd,
              };
            }
            return b;
          });

          if (updatedCron) {
            await db
              .from('cronogramas')
              .update({
                datos: { ...rawDatos, bloques: updatedBloques },
                estado: 'vigente',
                updated_at: new Date().toISOString(),
              })
              .eq('id', activeCron.id);
          }
        }
      }

      finalRescheduled.push({
        eventoId: conf.ev.id,
        tareaId: conf.ev.tarea_id,
        titulo: conf.ev.titulo,
        fechaAnterior: conf.dateStr,
        horaAnterior: `${conf.startSlot}-${conf.endSlot}`,
        nuevaFecha: targetDate,
        nuevaHoraInicio: targetStart,
        nuevaHoraFin: targetEnd,
        motivo,
      });
    }

    // 6. Registrar log del reagendamiento algorítmico local
    await logAiInteraction({
      usuarioId,
      tipoOperacion: 'regeneracion_cronograma',
      modelo: 'algoritmo-local-determinista',
      promptEnviado: `Reagendadas ${finalRescheduled.length} tareas en conflicto`,
      respuestaCruda: JSON.stringify(finalRescheduled),
      duracionMs: Date.now() - startTime,
    });

    return {
      success: true,
      reagendadas: finalRescheduled.length,
      tareasReagendadas: finalRescheduled,
      resumen: `Se reagendaron exitosamente ${finalRescheduled.length} tareas para evitar cruces con tu nuevo horario sin consumir cuota de IA.`,
    };
  } catch (err) {
    console.error('Error general en rescheduleConflictingCalendarTasksWithGemini:', err);
    return {
      success: false,
      reagendadas: 0,
      tareasReagendadas: [],
      error: err instanceof Error ? err.message : 'Error inesperado al reagendar tareas',
    };
  }
}
