'use server';

import { createClient } from '@/lib/supabase/server';
import {
  getGeminiClient,
  GEMINI_DEFAULT_MODEL,
  markActiveKeyExhaustedAndRotate,
  getGeminiKeyCount,
} from '@/lib/gemini/geminiClient';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface GenerateQuizInput {
  taskId: string;
  taskTitle?: string;
  taskDescription?: string;
  forceFallback?: boolean;
}

export interface GenerateQuizResponse {
  success: boolean;
  questions?: QuizQuestion[];
  error?: string;
  provider?: 'gemini' | 'n8n' | 'fallback';
  isFallback?: boolean;
}

/**
 * Normaliza y valida una lista de preguntas para asegurar exactamente 4 preguntas
 * con 4 opciones cada una y un índice de respuesta correcta de 0 a 3.
 */
function normalizeQuestions(rawList: unknown[]): QuizQuestion[] | null {
  if (!Array.isArray(rawList) || rawList.length < 4) return null;

  const result: QuizQuestion[] = [];

  for (let i = 0; i < Math.min(4, rawList.length); i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') return null;

    const record = item as Record<string, unknown>;
    const questionText = typeof record.question === 'string' ? record.question.trim() : '';
    if (!questionText) return null;

    const rawOptions = Array.isArray(record.options) ? record.options : [];
    const options = rawOptions
      .map((opt) => (typeof opt === 'string' ? opt.trim() : String(opt || '')))
      .filter((opt) => opt.length > 0);

    if (options.length < 4) return null;
    const finalOptions = options.slice(0, 4);

    let correctIdx = 0;
    const rawCorrect = record.correctAnswerIndex ?? record.correctIndex ?? record.correctAnswer;
    if (typeof rawCorrect === 'number') {
      correctIdx = Math.max(0, Math.min(3, Math.floor(rawCorrect)));
    } else if (typeof rawCorrect === 'string') {
      const trimmed = rawCorrect.trim().toUpperCase();
      if (trimmed === 'A') correctIdx = 0;
      else if (trimmed === 'B') correctIdx = 1;
      else if (trimmed === 'C') correctIdx = 2;
      else if (trimmed === 'D') correctIdx = 3;
      else {
        const parsedNum = parseInt(trimmed, 10);
        if (!isNaN(parsedNum)) {
          correctIdx = Math.max(0, Math.min(3, parsedNum));
        }
      }
    }

    result.push({
      question: questionText,
      options: finalOptions,
      correctAnswerIndex: correctIdx,
    });
  }

  return result.length === 4 ? result : null;
}

/**
 * Extrae y parsea preguntas en formato JSON desde cualquier texto o respuesta de IA
 * (soporta bloques de markdown, JSON directo o estructuras anidadas de n8n).
 */
function parseQuizFromText(rawInput: unknown): QuizQuestion[] | null {
  if (!rawInput) return null;

  let textToParse = '';

  if (typeof rawInput === 'object') {
    const obj = rawInput as Record<string, unknown>;
    if (Array.isArray(obj.questions)) {
      return normalizeQuestions(obj.questions);
    }

    if (Array.isArray(rawInput) && rawInput.length > 0) {
      const first = rawInput[0];
      if (typeof first === 'object' && first !== null) {
        const rec = first as Record<string, unknown>;
        if ('questions' in rec && Array.isArray(rec.questions)) {
          return normalizeQuestions(rec.questions);
        }
        const inner = rec.output || rec.text || rec.message || rec.data || rec.json;
        if (typeof inner === 'string') textToParse = inner;
        else if (typeof inner === 'object') return parseQuizFromText(inner);
      }
    }

    if (!textToParse) {
      const inner = obj.output || obj.text || obj.message || obj.data || obj.json;
      if (typeof inner === 'string') textToParse = inner;
      else textToParse = JSON.stringify(rawInput);
    }
  } else if (typeof rawInput === 'string') {
    textToParse = rawInput.trim();
  }

  // Eliminar delimitadores de bloque de código Markdown si existen (```json ... ```)
  const markdownMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch) {
    textToParse = markdownMatch[1].trim();
  }

  // Intento 1: Parseo directo de JSON
  try {
    const parsed = JSON.parse(textToParse);
    if (parsed && typeof parsed === 'object') {
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed as Record<string, unknown>).questions || (parsed as Record<string, unknown>).quiz;
      if (Array.isArray(list)) {
        const normalized = normalizeQuestions(list);
        if (normalized) return normalized;
      }
    }
  } catch {
    // Si falla el parseo directo, intentar extraer el fragmento que contiene "questions"
    const jsonMatch = textToParse.match(/\{[\s\S]*"questions"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === 'object') {
          const qList = (parsed as Record<string, unknown>).questions;
          if (Array.isArray(qList)) {
            const normalized = normalizeQuestions(qList);
            if (normalized) return normalized;
          }
        }
      } catch {
        // Continuar
      }
    }
  }

  return null;
}

/**
 * Generador de evaluación de contingencia académica.
 * Se activa si tanto Gemini como n8n experimentan saturación o problemas de conexión,
 * garantizando que el estudiante nunca quede bloqueado para validar sus conocimientos.
 */
function generateFallbackQuiz(taskTitle: string, taskDescription?: string): QuizQuestion[] {
  const cleanTitle = taskTitle.trim() || 'Estudio del tema';
  const cleanDesc = (taskDescription || '').trim();
  const descSnippet = cleanDesc.length > 10 ? cleanDesc.slice(0, 110) : '';

  const rawQuestions = [
    {
      question: `¿Cuál es el objetivo principal y propósito formativo al trabajar en "${cleanTitle}"?`,
      options: [
        `Comprender los conceptos clave y aplicar de manera metódica los fundamentos de ${cleanTitle}.`,
        `Completar la tarea rápidamente omitiendo la revisión de conceptos teóricos.`,
        `Memorizar definiciones superficiales sin comprobar su aplicación práctica.`,
        `Reemplazar la planificación estructurada por modificaciones no documentadas.`,
      ],
      correctAnswerIndex: 0,
    },
    {
      question: descSnippet
        ? `Considerando el alcance "${descSnippet}...", ¿cuál es la mejor estrategia para validar su cumplimiento?`
        : `Para asegurar un resultado riguroso y de alta calidad en "${cleanTitle}", ¿qué enfoque es el más recomendable?`,
      options: [
        `Descomponer los requisitos en etapas verificables y contrastar los resultados con los criterios de éxito.`,
        `Finalizar sin contrastar los entregables contra los objetivos planteados.`,
        `Ignorar los estándares y metodologías recomendadas para la materia.`,
        `Asumir que el resultado es correcto sin realizar pruebas ni comprobaciones.`,
      ],
      correctAnswerIndex: 0,
    },
    {
      question: `Durante la resolución de problemas o desafíos técnicos en "${cleanTitle}", ¿cuál es la conducta más rigurosa?`,
      options: [
        `Identificar la causa raíz mediante observación analítica, documentación y pruebas controladas.`,
        `Aplicar cambios al azar hasta que el error deje de ser visible superficialmente.`,
        `Reiniciar todo el trabajo desde cero ante la primera dificultad encontrada.`,
        `Ignorar las advertencias y errores menores para agilizar la entrega.`,
      ],
      correctAnswerIndex: 0,
    },
    {
      question: `¿Qué evidencia confirma que has adquirido un dominio efectivo sobre "${cleanTitle}"?`,
      options: [
        `Capacidad para explicar los conceptos con criterio técnico y aplicarlos a nuevos escenarios del proyecto.`,
        `Recordar términos de memoria sin comprender su funcionamiento ni su utilidad real.`,
        `Haber concluido el tiempo asignado sin haber completado los entregables definidos.`,
        `Delegar la justificación técnica en herramientas externas sin entender los fundamentos.`,
      ],
      correctAnswerIndex: 0,
    },
  ];

  // Aleatorizar el orden de las opciones para cada pregunta
  return rawQuestions.map((q) => {
    const correctText = q.options[q.correctAnswerIndex];
    const shuffled = [...q.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return {
      question: q.question,
      options: shuffled,
      correctAnswerIndex: shuffled.indexOf(correctText),
    };
  });
}

/**
 * Genera el quiz usando la IA Principal: Google Gemini.
 * Optimizado para máxima velocidad utilizando el modelo Flash más rápido y un timeout estricto.
 */
async function generateQuizWithGemini(
  taskTitle: string,
  taskDescription?: string,
): Promise<QuizQuestion[] | null> {
  // Modelos ordenados por velocidad y disponibilidad
  const modelsToTry = [
    'gemini-3.5-flash-lite',
    GEMINI_DEFAULT_MODEL,
    'gemini-3.6-flash',
  ];

  const prompt = `Actúa como profesor evaluador riguroso. Genera un cuestionario de opción múltiple de EXACTAMENTE 4 preguntas sobre esta tarea:
Título: "${taskTitle}"
Descripción: "${taskDescription || 'Sin descripción adicional'}"

Evalúa la comprensión de los conceptos clave y aplicaciones prácticas de este tema.
Cada pregunta debe tener EXACTAMENTE 4 opciones y una única respuesta correcta (correctAnswerIndex de 0 a 3).
Devuelve estrictamente un JSON con esta estructura:
{
  "questions": [
    {
      "question": "texto de la pregunta",
      "options": ["opcion 1", "opcion 2", "opcion 3", "opcion 4"],
      "correctAnswerIndex": 0
    }
  ]
}`;

  for (const model of modelsToTry) {
    let attempts = 0;
    const maxAttempts = Math.min(2, Math.max(1, getGeminiKeyCount()));

    while (attempts < maxAttempts) {
      try {
        const gemini = getGeminiClient();

        // Timeout estricto de 6 segundos para priorizar la rapidez y dar paso al fallback si Gemini tarda o se cuelga
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de Gemini excedido (6s)')), 6000),
        );

        const generatePromise = gemini.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        const text = response.text;
        if (text) {
          const parsed = parseQuizFromText(text);
          if (parsed && parsed.length === 4) {
            return parsed;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[generateQuizWithGemini] Error con modelo ${model} (intento ${attempts + 1}):`, msg);

        if (msg.includes('429') || msg.includes('503') || msg.includes('RESOURCE_EXHAUSTED')) {
          markActiveKeyExhaustedAndRotate(5000);
          attempts++;
        } else {
          // Si el modelo no existe o dio 404, pasar al siguiente modelo de inmediato
          break;
        }
      }
    }
  }

  return null;
}

/**
 * Genera el quiz usando la IA de Contingencia / Fallback: n8n AI Webhook.
 */
async function generateQuizWithN8n(params: {
  userId: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
}): Promise<QuizQuestion[] | null> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.split(',')[0].trim();
  if (!webhookUrl) {
    console.warn('[generateQuizWithN8n] N8N_WEBHOOK_URL no configurada.');
    return null;
  }

  const prompt = `Actúa como profesor evaluador educativo. Genera un cuestionario de opción múltiple de EXACTAMENTE 4 preguntas sobre la siguiente tarea de estudio:
Título: "${params.taskTitle}"
Descripción: "${params.taskDescription || 'Sin descripción adicional'}"

Cada pregunta debe evaluar la comprensión de este tema. Cada pregunta debe tener 4 opciones y solo una opción correcta.
IMPORTANTE: Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta:
{
  "questions": [
    {
      "question": "texto de la pregunta",
      "options": ["opcion 1", "opcion 2", "opcion 3", "opcion 4"],
      "correctAnswerIndex": 0
    }
  ]
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({
        sessionId: params.userId,
        userId: params.userId,
        user_id: params.userId,
        chatInput: prompt,
        message: prompt,
        mensaje: prompt,
        input: prompt,
        tipo_evento: 'chat',
        geminiApiKey: process.env.GEMINI_API_KEY || null,
        geminiApiKeys: Array.from({ length: 10 }, (_, i) =>
          i === 0 ? process.env.GEMINI_API_KEY : process.env[`GEMINI_API_KEY_${i + 1}`],
        ).filter(Boolean) as string[],
        contexto: {
          origen: 'quiz',
          taskId: params.taskId,
          taskTitle: params.taskTitle,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[generateQuizWithN8n] n8n respondió con error HTTP ${response.status}`);
      return null;
    }

    const rawText = await response.text();
    return parseQuizFromText(rawText);
  } catch (err) {
    console.warn('[generateQuizWithN8n] Error conectando con webhook de n8n:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateQuizAction(input: GenerateQuizInput): Promise<GenerateQuizResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No autorizado. Debes iniciar sesión.' };
    }

    // Validar que la tarea exista y esté completada antes de permitir el quiz
    const { data: task, error: taskError } = await supabase
      .from('tareas')
      .select('titulo, descripcion, completado')
      .eq('id', input.taskId)
      .maybeSingle();

    if (taskError || !task) {
      return { success: false, error: 'Error al obtener la tarea o no existe.' };
    }

    if (!task.completado) {
      return {
        success: false,
        error: 'Debes completar la tarea antes de poder realizar el quiz.',
      };
    }

    const finalTitle: string = (input.taskTitle?.trim() || task.titulo || 'Estudio del tema').trim();
    const finalDescription: string = (input.taskDescription?.trim() || task.descripcion || '').trim();

    // Si el usuario forzó la evaluación de contingencia
    if (input.forceFallback) {
      return {
        success: true,
        questions: generateFallbackQuiz(finalTitle, finalDescription),
        provider: 'fallback',
        isFallback: true,
      };
    }

    // =========================================================================
    // 1. IA PRINCIPAL: Google Gemini (Optimizado para ultra velocidad)
    // =========================================================================
    console.log(`[generateQuizAction] Iniciando generación con Gemini (IA Principal) para: "${finalTitle}"`);
    const geminiQuestions = await generateQuizWithGemini(finalTitle, finalDescription);

    if (geminiQuestions && geminiQuestions.length === 4) {
      console.log(`[generateQuizAction] Quiz generado exitosamente con Gemini.`);
      return {
        success: true,
        questions: geminiQuestions,
        provider: 'gemini',
        isFallback: false,
      };
    }

    // =========================================================================
    // 2. IA FALLBACK: n8n Webhook
    // =========================================================================
    console.warn(
      `[generateQuizAction] Gemini no disponible o tardó demasiado. Activando Fallback con n8n...`,
    );
    const n8nQuestions = await generateQuizWithN8n({
      userId: user.id,
      taskId: input.taskId,
      taskTitle: finalTitle,
      taskDescription: finalDescription,
    });

    if (n8nQuestions && n8nQuestions.length === 4) {
      console.log(`[generateQuizAction] Quiz generado exitosamente con IA n8n (Fallback).`);
      return {
        success: true,
        questions: n8nQuestions,
        provider: 'n8n',
        isFallback: false,
      };
    }

    // =========================================================================
    // 3. CONTINGENCIA FINAL: Generador Académico
    // =========================================================================
    console.warn(
      `[generateQuizAction] Ni Gemini ni n8n respondieron a tiempo. Activando evaluación de contingencia académica.`,
    );
    const fallbackQuestions = generateFallbackQuiz(finalTitle, finalDescription);

    return {
      success: true,
      questions: fallbackQuestions,
      provider: 'fallback',
      isFallback: true,
    };
  } catch (error) {
    console.error('Error in generateQuizAction:', error);
    return {
      success: false,
      error: 'Hubo un error inesperado al generar el cuestionario.',
    };
  }
}

export async function markTaskQuizPassedAction(taskId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No autorizado.' };
    }

    // Validar que la tarea exista
    const { data: task, error: taskError } = await supabase
      .from('tareas')
      .select('id, completado')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError || !task) {
      return { success: false, error: 'Tarea no encontrada.' };
    }

    // Al aprobar el quiz, aseguramos que tanto quiz_aprobado como completado queden en true en la BD
    const { error } = await supabase
      .from('tareas')
      .update({ quiz_aprobado: true, completado: true })
      .eq('id', taskId);

    if (error) {
      return {
        success: false,
        error: 'No se pudo actualizar el estado de la tarea en la base de datos.',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking quiz as passed:', error);
    return { success: false, error: 'Error interno del servidor.' };
  }
}
