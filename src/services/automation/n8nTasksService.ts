import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  ExtractedScheduleBlock,
  ExtractedScheduleResponse,
} from '@/features/schedule/types/scheduleSchemas';
import { calculateAvailableStudyDates } from '@/services/ai/scheduleAiService';
import { getUserAiContext } from '@/services/ai/contextBuilderService';

export interface ProjectForTaskGeneration {
  id: string;
  user_id: string;
  titulo: string;
  objetivo?: string | null;
  fecha_limite?: string | null;
  prioridad?: string | null;
  nivel_conocimiento?: string | null;
  material_url?: string | null;
  minutos_diarios?: number | null;
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

export interface GeneratedTaskCandidate {
  titulo?: string;
  title?: string;
  descripcion?: string;
  description?: string;
  duracion?: number | string;
  duration?: number | string;
  fecha_inicio?: string;
  startDate?: string;
  prioridad?: string;
  priority?: string;
  url_recomendada?: string;
  resources?: string;
  resourceUrl?: string;
  resource_url?: string;
  resourceName?: string;
  timeSlot?: string;
}

/**
 * Extrae URLs de recursos de un registro de tarea proveniente de n8n o IA,
 * soportando múltiples nombres de campos (resourceUrl, resource_url, resources, url, link, etc.),
 * arrays de strings u objetos, y fallback a escaneo de expresiones regulares.
 */
function extractResourcesFromRecord(record: Record<string, unknown>): string | undefined {
  if (!record || typeof record !== 'object') return undefined;

  const resourceKeys = [
    'resources',
    'resource',
    'resourceUrl',
    'resource_url',
    'url_recomendada',
    'urlRecomendada',
    'recommended_url',
    'recommendedUrl',
    'url',
    'urls',
    'link',
    'links',
    'enlace',
    'enlaces',
    'material',
    'materiales',
    'material_url',
    'materialUrl',
    'recurso',
    'recursos',
    'recurso_url',
    'recursoUrl',
    'source_url',
    'sourceUrl',
    'web_url',
    'webUrl',
    'href',
    'link_recomendado',
    'referencia',
    'documentacion',
    'docs',
  ];

  const foundUrls: string[] = [];

  const addUrl = (val: unknown) => {
    if (!val) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      const matches = trimmed.match(/https?:\/\/[^\s),"'>]+/gi);
      if (matches) {
        for (const m of matches) {
          if (!foundUrls.includes(m)) foundUrls.push(m);
        }
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!foundUrls.includes(trimmed)) foundUrls.push(trimmed);
      }
    } else if (Array.isArray(val)) {
      for (const item of val) addUrl(item);
    } else if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      if (obj.url) addUrl(obj.url);
      if (obj.resourceUrl) addUrl(obj.resourceUrl);
      if (obj.resource_url) addUrl(obj.resource_url);
      if (obj.link) addUrl(obj.link);
      if (obj.href) addUrl(obj.href);
      if (obj.enlace) addUrl(obj.enlace);
    }
  };

  for (const key of resourceKeys) {
    if (key in record && record[key]) {
      addUrl(record[key]);
    }
  }

  // Si no se encontró en las claves directas, escanear todos los campos del objeto
  if (foundUrls.length === 0) {
    for (const [, v] of Object.entries(record)) {
      if (typeof v === 'string') {
        const matches = v.match(/https?:\/\/[^\s),"'>]+/gi);
        if (matches) {
          for (const m of matches) {
            if (!foundUrls.includes(m)) foundUrls.push(m);
          }
        }
      }
    }
  }

  return foundUrls.length > 0 ? foundUrls.join(' ') : undefined;
}

/**
 * Normaliza la duración en minutos recibida de la IA (p. ej., "60 min", "1.5h", 45).
 */
function parseDurationMinutes(rawDuration: unknown, fallback: number): number {
  if (typeof rawDuration === 'number' && !isNaN(rawDuration) && rawDuration > 0) {
    return Math.round(rawDuration);
  }
  if (typeof rawDuration === 'string') {
    const trimmed = rawDuration.trim();
    const hourMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h(?:ora(?:s)?)?/i);
    if (hourMatch && !trimmed.toLowerCase().includes('min')) {
      const hours = parseFloat(hourMatch[1]);
      if (!isNaN(hours) && hours > 0) return Math.round(hours * 60);
    }
    const minMatch = trimmed.match(/(\d+)\s*(?:m|min|minuto(?:s)?)?/i);
    if (minMatch) {
      const mins = parseInt(minMatch[1], 10);
      if (!isNaN(mins) && mins > 0) return mins;
    }
    const num = parseInt(trimmed.replace(/\D+/g, ''), 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return fallback;
}

/**
 * Extrae y parsea un array de tareas candidatas desde cualquier respuesta de n8n:
 * - Array de objetos con cualquier clave común (titulo, title, nombre, name, tarea, task, actividad, activity, item, etc.)
 * - Array de strings simples: ["Tarea 1", "Tarea 2", ...]
 * - Objeto con clave envolvente: { tareas: [...] }, { tasks: [...] }, { data: [...] }, { output: ... }, { body: ... }
 * - Bloque de código Markdown con JSON: ```json [...] ```
 * - Texto plano con lista numerada (1. ..., 2. ...) o viñetas (- ..., * ...)
 */
function parseTasksFromN8nResponse(rawResponse: unknown): GeneratedTaskCandidate[] {
  if (!rawResponse) return [];

  // 1. Si es un array
  if (Array.isArray(rawResponse)) {
    if (rawResponse.length === 0) return [];

    // Caso A: Array de strings simples ["Tarea 1", "Tarea 2"]
    if (typeof rawResponse[0] === 'string') {
      return (rawResponse as string[])
        .map((str) => str.trim())
        .filter(Boolean)
        .map((titulo) => ({ titulo }));
    }

    // Caso B: Array de objetos
    if (typeof rawResponse[0] === 'object' && rawResponse[0] !== null) {
      // Buscar si el primer elemento o algún elemento tiene claves de tarea
      const candidates: GeneratedTaskCandidate[] = [];
      let isTaskArray = false;

      for (const item of rawResponse) {
        if (typeof item !== 'object' || item === null) continue;
        const record = item as Record<string, unknown>;

        const titulo =
          record.titulo ||
          record.title ||
          record.nombre ||
          record.name ||
          record.tarea ||
          record.task ||
          record.actividad ||
          record.activity ||
          record.item ||
          record.label;

        const extractedUrl = extractResourcesFromRecord(record);

        if (titulo && typeof titulo === 'string') {
          isTaskArray = true;
          candidates.push({
            titulo: String(titulo),
            descripcion: String(
              record.descripcion || record.description || record.detalle || record.details || '',
            ),
            duracion: (record.duracion ||
              record.duration ||
              record.tiempo ||
              record.minutos ||
              record.time ||
              record.minutes ||
              record.duration_minutes) as number | string | undefined,
            fecha_inicio: (record.fecha_inicio ||
              record.startDate ||
              record.fecha ||
              record.date ||
              record.due_date) as string | undefined,
            prioridad: (record.prioridad || record.priority) as string | undefined,
            url_recomendada: extractedUrl,
            resources: extractedUrl,
            resourceUrl: extractedUrl,
            resourceName: record.resourceName ? String(record.resourceName) : undefined,
            timeSlot: (record.timeSlot || record.time_slot) as string | undefined,
          });
        }
      }

      if (isTaskArray && candidates.length > 0) {
        return candidates;
      }

      // Si no era un array de tareas directamente, puede ser el formato de n8n [ { output: ... } ] o [ { json: ... } ]
      const first = rawResponse[0] as Record<string, unknown>;
      for (const nestedKey of [
        'tasks',
        'tareas',
        'items',
        'data',
        'plan',
        'output',
        'json',
        'reply',
        'text',
        'message',
        'response',
        'result',
        'body',
      ]) {
        if (first[nestedKey]) {
          const nestedResult = parseTasksFromN8nResponse(first[nestedKey]);
          if (nestedResult.length > 0) return nestedResult;
        }
      }
    }
  }

  // 2. Si es un string (puede ser texto o JSON serializado)
  if (typeof rawResponse === 'string') {
    const trimmed = rawResponse.trim();

    // Intentar buscar bloque markdown ```json ... ```
    const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const contentToParse = markdownMatch ? markdownMatch[1].trim() : trimmed;

    try {
      const parsed = JSON.parse(contentToParse);
      const res = parseTasksFromN8nResponse(parsed);
      if (res.length > 0) return res;
    } catch {
      // Buscar array JSON dentro del texto
      const arrayMatch = contentToParse.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          const res = parseTasksFromN8nResponse(parsed);
          if (res.length > 0) return res;
        } catch {
          // Ignorar error y probar con lista de texto
        }
      }
    }

    // Si no se pudo parsear como JSON, intentar parsear lista de texto con viñetas o números
    const lines = trimmed
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const textTasks: GeneratedTaskCandidate[] = [];

    for (const line of lines) {
      // Coincide con "1. Tarea", "1) Tarea", "- Tarea", "* Tarea", "• Tarea"
      const match = line.match(/^(?:(?:\d+[\.\)])|[-*•])\s*(.+)$/);
      if (match && match[1].trim().length > 2) {
        const fullContent = match[1].trim().replace(/^\*\*|\*\*$/g, '');
        const urlMatches = fullContent.match(/https?:\/\/[^\s),"'>]+/gi);
        const lineUrl = urlMatches && urlMatches.length > 0 ? urlMatches.join(' ') : undefined;

        // Si tiene formato "Título: Descripción"
        const parts = fullContent.split(/:\s+/);
        if (parts.length > 1) {
          textTasks.push({
            titulo: parts[0].trim(),
            descripcion: parts.slice(1).join(': ').trim(),
            resources: lineUrl,
            url_recomendada: lineUrl,
            resourceUrl: lineUrl,
          });
        } else {
          textTasks.push({
            titulo: fullContent,
            resources: lineUrl,
            url_recomendada: lineUrl,
            resourceUrl: lineUrl,
          });
        }
      }
    }

    if (textTasks.length > 0) {
      return textTasks;
    }
  }

  // 3. Si es un objeto genérico
  if (typeof rawResponse === 'object' && rawResponse !== null) {
    const obj = rawResponse as Record<string, unknown>;

    for (const key of [
      'tasks',
      'tareas',
      'items',
      'data',
      'plan',
      'output',
      'rows',
      'result',
      'reply',
      'text',
      'response',
      'message',
      'body',
    ]) {
      if (key in obj && obj[key]) {
        const candidate = parseTasksFromN8nResponse(obj[key]);
        if (candidate.length > 0) return candidate;
      }
    }
  }

  return [];
}

/**
 * Genera tareas para un proyecto llamando al webhook configurado en n8n
 * e insertándolas en la tabla 'tareas' de Supabase.
 */
export async function generateProjectTasksFromN8n(project: ProjectForTaskGeneration) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.split(',')[0].trim();

  if (!webhookUrl) {
    console.warn('generateProjectTasksFromN8n: N8N_WEBHOOK_URL no está definida.');
    return {
      success: false,
      error: 'La URL del webhook de n8n no está configurada en las variables de entorno.',
    };
  }

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

    // Determinar fecha de inicio y ranuras de estudio autorizadas
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

    // 1. Preparar mensaje explicito para el Agente/Chatbot de n8n
    const hasExisting = existingTasks.length > 0;

    let existingTasksPrompt = '';
    if (hasExisting) {
      existingTasksPrompt =
        `\n\nTAREAS ACTUALES YA CREADAS EN ESTE PROYECTO (${existingTasks.length} tareas existentes que el usuario YA TIENE):\n` +
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
        `Genera ÚNICAMENTE un conjunto de tareas NUEVAS y DIFERENTES que continúen la progresión a partir de la última tarea existente, ` +
        `avanzando hacia los siguientes pasos, conceptos o prácticas para cumplir el objetivo del proyecto.`;
    }

    const materialPart = project.material_url
      ? ` Recurso o enlace de referencia suministrado: ${project.material_url}.`
      : '';
    const filePart = project.file_content
      ? ` Documento de referencia adjunto ("${project.file_name || 'archivo'}"):\n--- INICIO DEL DOCUMENTO ---\n${project.file_content}\n--- FIN DEL DOCUMENTO ---\nPor favor toma en cuenta este documento para extraer o estructurar las tareas del proyecto.`
      : '';

    const minutosDiarios = project.minutos_diarios || 30;

    // Obtener contexto de perfil de aprendizaje y biblioteca de temas/fuentes autorizadas
    const userAiContext = await getUserAiContext({
      userId: project.user_id,
      projectId: project.id,
    });

    const contextExtraText = [userAiContext.perfilTexto, userAiContext.temasTexto]
      .filter(Boolean)
      .join('\n\n');
    const contextPart = contextExtraText ? `\n\n${contextExtraText}` : '';

    const promptMessage = hasExisting
      ? `Genera las SIGUIENTES tareas de continuidad para el proyecto: "${project.titulo}". Objetivo: ${project.objetivo || 'Avanzar en el aprendizaje'}. Nivel de conocimiento actual: ${project.nivel_conocimiento || 'Principiante'}. Minutos diarios disponibles: ${minutosDiarios}. Fecha límite: ${effectiveDeadlineStr}.\n\n🚨 LÍMITE ESTRICTO DE TAREAS Y FECHAS:\n- Quedan exactamente ${maxTasks} fecha(s) autorizada(s) para este proyecto antes de la fecha límite (${effectiveDeadlineStr}):\n${datesListFormatted}\n- Debes generar ${maxTasks <= 3 ? `EXACTAMENTE ${maxTasks}` : `como máximo ${maxTasks}`} tareas en total (¡PROHIBIDO generar más de ${maxTasks} tareas!).\n- ¡BAJO NINGUNA CIRCUNSTANCIA generes tareas con fechas posteriores al ${effectiveDeadlineStr}!${materialPart}${filePart}${contextPart}${existingTasksPrompt}\n\nPor favor genera tareas estructuradas completamente NUEVAS sin duplicar nada anterior. Para cada tarea, incluye una URL o enlace recomendado en el campo "resourceUrl" o "resources". Adapta el ritmo y temas a las preferencias y fuentes del usuario.`
      : `Genera un plan de tareas detallado para el proyecto: "${project.titulo}". Objetivo: ${project.objetivo || 'Avanzar en el aprendizaje'}. Nivel de conocimiento actual: ${project.nivel_conocimiento || 'Principiante'}. Minutos diarios disponibles: ${minutosDiarios}. Fecha límite: ${effectiveDeadlineStr}.\n\n🚨 LÍMITE ESTRICTO DE TAREAS Y FECHAS:\n- Quedan exactamente ${maxTasks} fecha(s) autorizada(s) para este proyecto antes de la fecha límite (${effectiveDeadlineStr}):\n${datesListFormatted}\n- Debes generar ${maxTasks <= 3 ? `EXACTAMENTE ${maxTasks}` : `como máximo ${maxTasks}`} tareas en total (¡PROHIBIDO generar más de ${maxTasks} tareas!).\n- ¡BAJO NINGUNA CIRCUNSTANCIA generes tareas con fechas posteriores al ${effectiveDeadlineStr}!${materialPart}${filePart}${contextPart} Por favor genera el listado de tareas estructurado acorde al plazo calculado. Para cada tarea, incluye obligatoriamente una URL o enlace recomendado (documentación oficial, tutorial o recurso web) en el campo "resourceUrl" o "resources". Adapta el enfoque a su perfil de aprendizaje y biblioteca de temas.`;

    // 2. Preparar payload completo con compatibilidad para nodos de Supabase (userId, user_id) y agentes de chat (chatInput, message)
    const payload = {
      // Identificadores de usuario
      userId: project.user_id,
      user_id: project.user_id,
      sessionId: project.user_id,

      // Identificadores de proyecto
      projectId: project.id,
      id: project.id,
      id_proyecto: project.id,

      // Datos directos de la tabla 'projects'
      titulo: project.titulo,
      objetivo: project.objetivo || '',
      fecha_limite: effectiveDeadlineStr,
      prioridad: project.prioridad || 'Prioritario',
      nivel_conocimiento: project.nivel_conocimiento || '',
      material_url: project.material_url || null,
      archivo_nombre: project.file_name || null,
      archivo_contenido: project.file_content || null,
      minutos_diarios: minutosDiarios,

      // Contexto pedagógico del perfil y temas autorizados
      perfil_usuario: userAiContext.perfilRaw,
      temas_y_fuentes: userAiContext.temasRaw,
      fuentes_activas_contexto_count: userAiContext.fuentesActivasCount,

      // Datos calculados de plazo y carga
      dias_restantes: maxTasks,
      semanas_restantes: Math.max(1, Math.round((maxTasks / 7) * 10) / 10),
      horas_totales_estimadas: Math.round((maxTasks * minutosDiarios) / 60),
      fechas_autorizadas: targetDates,

      // Tareas ya existentes para prevenir duplicación
      tareas_existentes: existingTasks.map((t) => ({
        titulo: t.titulo,
        descripcion: t.descripcion,
        completado: Boolean(t.completado),
      })),
      cantidad_tareas_existentes: existingTasks.length,

      // Mensaje de entrada para Agentes de n8n (Chat Trigger / AI Agent)
      chatInput: promptMessage,
      message: promptMessage,
      prompt: promptMessage,
      input: promptMessage,

      // Claves de Gemini para que el servidor de n8n las utilice o rote si tiene cuota agotada
      geminiApiKey: process.env.GEMINI_API_KEY || null,
      geminiApiKey2: process.env.GEMINI_API_KEY_2 || null,
      geminiApiKey3: process.env.GEMINI_API_KEY_3 || null,
      geminiApiKeys: Array.from({ length: 10 }, (_, i) =>
        i === 0 ? process.env.GEMINI_API_KEY : process.env[`GEMINI_API_KEY_${i + 1}`],
      ).filter(Boolean) as string[],
    };

    // 2. Llamada HTTP al Webhook de n8n con timeout de 60 segundos (permite procesar videos y temarios extensos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`n8n webhook respondió con código ${response.status}:`, errorText);
      return {
        success: false,
        error: `El servicio de n8n respondió con error (${response.status}). Verifica que el workflow esté activo.`,
      };
    }

    // 3. Procesar cuerpo de la respuesta de n8n
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    console.log(
      '[n8n] HTTP Status:',
      response.status,
      '| Content-Type:',
      contentType,
      '| Raw Body:',
      rawText,
    );

    let responseBody: unknown = rawText;
    if (rawText && rawText.trim().length > 0) {
      try {
        responseBody = JSON.parse(rawText);
      } catch {
        responseBody = rawText;
      }
    }

    // 4. Parsear las tareas candidatas
    const taskCandidates = parseTasksFromN8nResponse(responseBody);

    const supabase = await createClient();
    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    if (!taskCandidates || taskCandidates.length === 0) {
      // Si n8n no devolvió las tareas en el JSON, verificar si su nodo de Supabase las insertó directamente en la BD
      const { data: dbTasks } = await db.from('tareas').select('*').eq('id_proyecto', project.id);

      if (dbTasks && dbTasks.length > 0) {
        return {
          success: true,
          count: dbTasks.length,
          tasks: dbTasks,
          progreso: 0,
        };
      }

      console.warn('Respuesta recibida de n8n sin tareas estructuradas:', responseBody);
      const rawPreview =
        typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
      const snippet =
        rawPreview && rawPreview.length > 250
          ? `${rawPreview.slice(0, 250)}...`
          : rawPreview || 'vacía';

      return {
        success: false,
        error: `La IA de n8n no devolvió tareas en un formato interpretable. Respuesta de n8n: ${snippet}`,
      };
    }

    // 5. Normalizar y desduplicar datos para la tabla 'tareas' de Supabase
    const existingTitlesSet = new Set(
      existingTasks.map((t) =>
        t.titulo
          .toLowerCase()
          .trim()
          .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ''),
      ),
    );

    // Filtrar candidatos cuyo título sea idéntico o muy similar a una tarea existente
    let candidatesToUse = taskCandidates.filter((c) => {
      const norm = (c.titulo || c.title || '')
        .toLowerCase()
        .trim()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
      return norm.length > 0 && !existingTitlesSet.has(norm);
    });

    // Si todas las candidatas devueltas eran duplicadas, diferenciarlas con sufijo de fase
    if (candidatesToUse.length === 0 && taskCandidates.length > 0) {
      candidatesToUse = taskCandidates.map((c, i) => ({
        ...c,
        titulo: `${c.titulo || c.title || 'Tarea'} (Continuación ${existingTasks.length + i + 1})`,
      }));
    }

    // Truncar estrictamente al número máximo de ranuras de estudio autorizadas
    if (candidatesToUse.length > targetDates.length) {
      candidatesToUse = candidatesToUse.slice(0, targetDates.length);
    }

    const defaultDuration = Math.max(10, Number(project.minutos_diarios) || 30);

    const tasksToInsert = candidatesToUse.map((candidate, index) => {
      const titulo = (candidate.titulo || candidate.title || `Tarea ${index + 1}`).trim();
      const descripcion = (candidate.descripcion || candidate.description || '').trim() || null;
      const duracion = parseDurationMinutes(
        candidate.duracion || candidate.duration,
        defaultDuration,
      );

      // Asignar determinísticamente la fecha autorizada correspondiente a esta ranura
      const assignedDate = targetDates[index] || targetDates[targetDates.length - 1];
      let hours = 9;
      let minutes = 0;

      if (candidate.timeSlot) {
        const timeMatch = candidate.timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (timeMatch) {
          let h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3]?.toUpperCase();
          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          hours = h;
          minutes = m;
        }
      } else if (candidate.fecha_inicio || candidate.startDate) {
        const rawDate = candidate.fecha_inicio || candidate.startDate;
        const d = new Date(rawDate!);
        if (!isNaN(d.getTime())) {
          hours = d.getHours() || 9;
          minutes = d.getMinutes() || 0;
        }
      }

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const fechaInicio = new Date(`${assignedDate}T${hStr}:${mStr}:00`).toISOString();

      const resources =
        (
          candidate.resources ||
          candidate.resourceUrl ||
          candidate.resource_url ||
          candidate.url_recomendada ||
          ''
        ).trim() ||
        (project.material_url?.trim() ?? null) ||
        null;
      const prioridad =
        candidate.prioridad || candidate.priority || project.prioridad || 'Prioritario';

      return {
        id: crypto.randomUUID(),
        id_proyecto: project.id,
        titulo,
        descripcion,
        duracion,
        completado: false,
        fecha_inicio: fechaInicio,
        prioridad,
        resources,
      };
    });

    // 6. Conectar a Supabase e insertar en lote
    const { data: insertedTasks, error: insertError } = await db
      .from('tareas')
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      console.error('Error insertando tareas en Supabase:', insertError);
      return {
        success: false,
        error: `Error al guardar tareas generadas en Supabase: ${insertError.message}`,
      };
    }

    // Sincronizar en eventos_calendario para que aparezcan en el calendario del usuario
    const tasksForCalendar = insertedTasks || tasksToInsert;
    const eventsToInsert = tasksForCalendar
      .filter((t) => t.fecha_inicio)
      .map((t) => {
        const startIso = new Date(t.fecha_inicio!).toISOString();
        const durMin = Math.max(15, Number(t.duracion) || defaultDuration);
        const endIso = new Date(
          new Date(t.fecha_inicio!).getTime() + durMin * 60 * 1000,
        ).toISOString();
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

    if (eventsToInsert.length > 0) {
      try {
        await db.from('eventos_calendario').insert(eventsToInsert);
      } catch (calErr) {
        console.warn('Aviso: no se pudieron registrar eventos en calendario desde n8n:', calErr);
      }
    }

    // 7. Recalcular el progreso del proyecto
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

    return {
      success: true,
      count: insertedTasks?.length || tasksToInsert.length,
      tasks: insertedTasks || tasksToInsert,
      progreso: newProgreso,
    };
  } catch (error: unknown) {
    console.error('Error en generateProjectTasksFromN8n:', error);
    const msg = error instanceof Error ? error.message : 'Error de conexión con el webhook de n8n';
    return { success: false, error: msg };
  }
}

function normalizeDayOfWeek(dia: unknown): number {
  if (typeof dia === 'number' && Number.isInteger(dia) && dia >= 0 && dia <= 6) {
    return dia;
  }
  const str = String(dia || '')
    .toLowerCase()
    .trim();
  if (str.includes('dom') || str === '0') return 0;
  if (str.includes('lun') || str === '1') return 1;
  if (str.includes('mar') || str === '2') return 2;
  if (str.includes('mie') || str.includes('mié') || str === '3') return 3;
  if (str.includes('jue') || str === '4') return 4;
  if (str.includes('vie') || str === '5') return 5;
  if (str.includes('sab') || str.includes('sáb') || str === '6') return 6;
  return 1;
}

function normalizeTimeSlot(time: unknown): string {
  const str = String(time || '').trim();
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2];
    return `${h}:${m}`;
  }
  return '08:00';
}

function normalizeType(
  tipo: unknown,
): 'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad' {
  const str = String(tipo || '')
    .toLowerCase()
    .trim();
  if (
    str.includes('estud') ||
    str.includes('clase') ||
    str.includes('materia') ||
    str.includes('universidad')
  ) {
    return 'estudio';
  }
  if (str.includes('trabaj') || str.includes('laboral')) {
    return 'trabajo';
  }
  if (str.includes('tarea') || str.includes('libre')) {
    return 'tareas';
  }
  if (str.includes('ocupad')) {
    return 'ocupado';
  }
  return 'otra_actividad';
}

function parseScheduleFromN8nResponse(rawResponse: unknown): ExtractedScheduleBlock[] {
  if (!rawResponse) return [];

  // 1. Si es un array
  if (Array.isArray(rawResponse)) {
    if (rawResponse.length === 0) return [];

    const blocks: ExtractedScheduleBlock[] = [];
    for (const item of rawResponse) {
      if (typeof item !== 'object' || item === null) continue;
      const rec = item as Record<string, unknown>;
      if (
        rec.hora_inicio ||
        rec.horaInicio ||
        rec.start ||
        rec.inicio ||
        rec.hora_fin ||
        rec.horaFin ||
        rec.end ||
        rec.fin
      ) {
        blocks.push({
          dia_semana: normalizeDayOfWeek(rec.dia_semana ?? rec.diaSemana ?? rec.dia ?? rec.day),
          hora_inicio: normalizeTimeSlot(
            rec.hora_inicio ?? rec.horaInicio ?? rec.start ?? rec.inicio,
          ),
          hora_fin: normalizeTimeSlot(rec.hora_fin ?? rec.horaFin ?? rec.end ?? rec.fin),
          tipo: normalizeType(rec.tipo ?? rec.type),
          etiqueta: String(
            rec.etiqueta ??
              rec.label ??
              rec.materia ??
              rec.titulo ??
              rec.nombre ??
              'Clase/Actividad',
          ),
        });
      }
    }

    if (blocks.length > 0) return blocks;

    // Si es un formato envoltorio de n8n [ { json: ... } ] o [ { output: ... } ]
    const first = rawResponse[0] as Record<string, unknown>;
    for (const key of [
      'bloques',
      'schedule',
      'horario',
      'output',
      'json',
      'data',
      'reply',
      'text',
      'message',
      'response',
    ]) {
      if (first[key]) {
        const nested = parseScheduleFromN8nResponse(first[key]);
        if (nested.length > 0) return nested;
      }
    }
  }

  // 2. Si es un string (JSON serializado o Markdown)
  if (typeof rawResponse === 'string') {
    const trimmed = rawResponse.trim();
    const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const contentToParse = markdownMatch ? markdownMatch[1].trim() : trimmed;

    try {
      const parsed = JSON.parse(contentToParse);
      const res = parseScheduleFromN8nResponse(parsed);
      if (res.length > 0) return res;
    } catch {
      const jsonMatch = contentToParse.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const res = parseScheduleFromN8nResponse(parsed);
          if (res.length > 0) return res;
        } catch {
          // Ignorar y continuar
        }
      }
    }
  }

  // 3. Si es un objeto directo
  if (typeof rawResponse === 'object' && rawResponse !== null) {
    const rec = rawResponse as Record<string, unknown>;
    for (const key of [
      'bloques',
      'schedule',
      'horario',
      'clases',
      'output',
      'json',
      'data',
      'result',
      'body',
    ]) {
      if (rec[key]) {
        const nested = parseScheduleFromN8nResponse(rec[key]);
        if (nested.length > 0) return nested;
      }
    }
  }

  return [];
}

/**
 * Extrae bloques de horario enviando el archivo al webhook de n8n cuando Gemini
 * tarda más de 5-10 segundos o experimenta problemas de lectura.
 */
export async function extractScheduleFromN8n(params: {
  base64Data: string;
  mimeType: string;
  usuarioId?: string;
  nombreArchivo?: string;
}): Promise<ExtractedScheduleResponse> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.split(',')[0].trim();

  if (!webhookUrl) {
    throw new Error('N8N_WEBHOOK_URL no está configurada en las variables de entorno.');
  }

  const promptMessage = `Analiza la imagen o documento adjunto correspondiente a un horario laboral, académico, universitario o escolar.
Extrae minuciosamente todos los bloques de clases, materias, asignaturas, turnos o actividades con su día de la semana y horas de inicio y fin.
Instrucciones clave:
1. Mapea el día a un número: 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado.
2. Cada bloque debe tener hora_inicio y hora_fin en formato militar HH:MM (ejemplo "08:00", "10:30", "14:00").
3. Clasifica el campo "tipo" exactamente como una de estas opciones: "ocupado", "estudio", "trabajo" o "otra_actividad" (usa "estudio" u "ocupado" para materias de clase).
4. En "etiqueta" coloca el nombre de la materia o actividad (ej. "Cálculo I", "Física", "Laboratorio", "Programación").
Devuelve un JSON con la estructura:
{
  "bloques": [
    {
      "dia_semana": 1,
      "hora_inicio": "08:00",
      "hora_fin": "10:00",
      "tipo": "estudio",
      "etiqueta": "Matemáticas"
    }
  ],
  "observaciones": "Horario extraído con IA vía n8n"
}`;

  const payload = {
    sessionId: params.usuarioId || 'calendar-schedule',
    userId: params.usuarioId || 'calendar-schedule',
    user_id: params.usuarioId || 'calendar-schedule',
    chatInput: promptMessage,
    message: promptMessage,
    mensaje: promptMessage,
    input: promptMessage,
    prompt: promptMessage,
    tipo_evento: 'extraccion_horario',
    archivo_nombre: params.nombreArchivo || 'horario',
    archivo: {
      nombre: params.nombreArchivo || 'horario',
      tipo: params.mimeType,
      contenido: params.base64Data,
    },
    archivo_base64: params.base64Data,
    base64Data: params.base64Data,
    mimeType: params.mimeType,

    // Claves de Gemini para que el servidor de n8n las utilice o rote si tiene cuota agotada
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiApiKey2: process.env.GEMINI_API_KEY_2 || null,
    geminiApiKey3: process.env.GEMINI_API_KEY_3 || null,
    geminiApiKeys: Array.from({ length: 10 }, (_, i) =>
      i === 0 ? process.env.GEMINI_API_KEY : process.env[`GEMINI_API_KEY_${i + 1}`],
    ).filter(Boolean) as string[],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`n8n webhook respondió con código ${response.status}: ${errorText}`);
    }

    const rawText = await response.text();
    let parsedJson: unknown = null;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      parsedJson = rawText;
    }

    const extractedBlocks = parseScheduleFromN8nResponse(parsedJson);

    if (extractedBlocks.length === 0) {
      throw new Error('La IA de n8n no devolvió bloques de horario interpretables.');
    }

    return {
      bloques: extractedBlocks,
      observaciones: 'Horario extraído exitosamente con n8n tras timeout de Gemini.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface TaskCompletedNotificationPayload {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectTitle?: string;
  userId: string;
  userName?: string;
  telegramChatId?: number | null;
  completedAt: string;
  rachaActiva?: number;
}

/**
 * Notifica a n8n cuando un usuario completa una tarea para enviar
 * una alerta de confirmación / felicitación por Telegram.
 */
export async function notifyTaskCompletedToN8n(
  payload: TaskCompletedNotificationPayload,
): Promise<{ success: boolean; message?: string }> {
  const webhookUrl =
    process.env.N8N_TASK_COMPLETED_WEBHOOK_URL?.trim() ||
    process.env.N8N_WEBHOOK_URL?.split(',')[0].trim();

  if (!webhookUrl) {
    return {
      success: false,
      message: 'Ni N8N_TASK_COMPLETED_WEBHOOK_URL ni N8N_WEBHOOK_URL están configuradas.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const formattedMessage =
      `🎉 ¡Felicidades${payload.userName ? ` ${payload.userName}` : ''}! ` +
      `Has completado la tarea "${payload.taskTitle}"` +
      `${payload.projectTitle ? ` del proyecto "${payload.projectTitle}"` : ''}.` +
      (payload.rachaActiva ? ` Tu racha actual es de ${payload.rachaActiva} 🔥.` : '');

    const body = {
      tipo_evento: 'task_completed',
      event: 'task_completed',
      taskId: payload.taskId,
      taskTitle: payload.taskTitle,
      projectId: payload.projectId,
      projectTitle: payload.projectTitle,
      userId: payload.userId,
      userName: payload.userName,
      telegramChatId: payload.telegramChatId,
      chat_id: payload.telegramChatId,
      completedAt: payload.completedAt,
      rachaActiva: payload.rachaActiva,
      mensaje: formattedMessage,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`[notifyTaskCompletedToN8n] Fallo webhook n8n (${response.status}):`, errText);
      return { success: false, message: `Status ${response.status}` };
    }

    try {
      const adminDb = getAdminClient();
      if (adminDb && payload.telegramChatId) {
        await adminDb.from('notificaciones_enviadas').insert({
          usuario_id: payload.userId,
          tipo_evento: 'task_completed',
          referencia_id: payload.taskId,
          fecha_envio: payload.completedAt,
        });
      }
    } catch (auditErr) {
      console.warn(
        '[notifyTaskCompletedToN8n] Error registrando auditoría en notificaciones_enviadas:',
        auditErr,
      );
    }

    return { success: true };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.warn('[notifyTaskCompletedToN8n] Error conectando con n8n:', errMessage);
    return { success: false, message: errMessage };
  } finally {
    clearTimeout(timeoutId);
  }
}
