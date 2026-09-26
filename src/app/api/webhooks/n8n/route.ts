import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUserAiContext } from '@/services/ai/contextBuilderService';

const requestSchema = z.object({
  mensaje: z.string().trim().min(1).max(20000),
  tipo_evento: z.literal('chat'),
  archivo: z
    .object({
      nombre: z.string(),
      tipo: z.string(),
      tamano: z.number(),
      contenido: z.string().optional(),
    })
    .optional(),
  contexto: z
    .union([
      z.object({
        origen: z.literal('analytics'),
        view: z.enum(['workload', 'progress', 'priorities', 'deadlines']),
        period: z.literal('week'),
      }),
      z.object({
        origen: z.literal('quiz'),
        taskId: z.string(),
      }),
    ])
    .optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Solicitud de chat inválida.' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json(
      { success: false, error: 'Debes iniciar sesión para usar Komo.' },
      { status: 401 },
    );
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL?.split(',')[0].trim();
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: 'Komo no está configurado todavía. Inténtalo más tarde.' },
      { status: 503 },
    );
  }

  // Consultar proyectos y tareas del usuario en Supabase para darle acceso a la IA
  let proyectosContextText = '';
  let userProjects: unknown[] = [];
  try {
    const { data: projects } = await supabase
      .from('projects')
      .select(
        'id, titulo, objetivo, fecha_limite, prioridad, nivel_conocimiento, progreso, completado, tareas(id, titulo, duracion, completado, resources)',
      )
      .eq('user_id', auth.user.id)
      .order('progreso', { ascending: true });

    if (projects && projects.length > 0) {
      userProjects = projects;
      proyectosContextText =
        `[Información de los proyectos actuales del usuario en Komorebi:\n` +
        projects
          .map((p) => {
            const tareasList =
              p.tareas && p.tareas.length > 0
                ? p.tareas
                    .map(
                      (t: { titulo: string; duracion: number | null; completado: boolean }) =>
                        `- Tarea: "${t.titulo}" (${t.completado ? 'Completada' : 'Pendiente'}, ${t.duracion || 30} min)`,
                    )
                    .join('\n  ')
                : 'Sin tareas registradas aún';
            return `• Proyecto: "${p.titulo}" | Progreso: ${p.progreso}% | Prioridad: ${p.prioridad || 'Media'} | Objetivo: "${p.objetivo || 'Sin objetivo'}"\n  Tareas:\n  ${tareasList}`;
          })
          .join('\n\n') +
        `\n]\n\n`;
    }
  } catch (err) {
    console.warn('Error al cargar proyectos para contexto de Komo:', err);
  }

  // Consultar perfil de aprendizaje y temas/fuentes autorizadas del usuario
  let userAiContextText = '';
  let perfilUsuarioData: unknown = null;
  let temasContextData: unknown = [];
  try {
    const userAiContext = await getUserAiContext({ userId: auth.user.id });
    userAiContextText = [userAiContext.perfilTexto, userAiContext.temasTexto]
      .filter(Boolean)
      .join('\n\n');
    perfilUsuarioData = userAiContext.perfilRaw;
    temasContextData = userAiContext.temasRaw;
  } catch (err) {
    console.warn('Error al cargar perfil y temas para contexto de Komo:', err);
  }

  const systemRulesText =
    `[REGLAS DE CONDUCTA DE KOMO IA]:\n` +
    `1. SI EL USUARIO PIDE CREAR UN PROYECTO (ej. "crear proyecto", "crea un proyecto", "iniciar proyecto"):\n` +
    `   - NO crees el proyecto directamente ni generes tareas automáticas sin hacer preguntas al usuario.\n` +
    `   - Explica cordialmente que para personalizar su fecha límite, nivel, materiales y horas diarias, debe configurar su proyecto en el formulario.\n` +
    `   - Proporciona OBLIGATORIAMENTE el enlace: [Crear Proyecto en el Formulario](/proyectos/nuevo)\n` +
    `2. SI EL USUARIO PIDE RECOMENDACIONES DE TEMAS PARA PROYECTOS (ej. "recomiéndame temas", "ideas de proyectos"):\n` +
    `   - Brinda tu recomendación de temas con su nombre sugerido y objetivo principal.\n` +
    `   - Pregúntale explícitamente si está de acuerdo con la propuesta antes de avanzar (ej. "¿Estás de acuerdo con este tema para tu proyecto o prefieres explorar otra opción?").\n` +
    `3. SI EL USUARIO CONFIRMA O ACEPTA UN TEMA RECOMENDADO PREVIAMENTE (ej. "sí", "de acuerdo", "me parece bien", "vamos con esa"):\n` +
    `   - Felicítalo por la elección.\n` +
    `   - Explica que para ahorrarle tiempo se han obviado las 2 primeras preguntas (nombre y objetivo) en el formulario.\n` +
    `   - Proporciona el enlace al formulario con los datos acordados en la URL: [Completar configuración en el formulario](/proyectos/nuevo?step=2&titulo=TITULO_AQUI&objetivo=OBJETIVO_AQUI)\n\n`;

  let quizRules = '';
  if (parsed.data.contexto?.origen === 'quiz') {
    quizRules =
      `\n[REGLAS MUY IMPORTANTES DE EVALUACIÓN (QUIZ)]:\n` +
      `Estás evaluando el conocimiento del usuario sobre una tarea específica. Hazle 2 a 4 preguntas sobre el tema de la tarea.\n` +
      `Si el usuario demuestra que domina el tema y sus respuestas son correctas, felicítalo y DEBES agregar EXACTAMENTE la siguiente etiqueta oculta al final de tu mensaje: [QUIZ_APROBADO_${parsed.data.contexto.taskId}]\n` +
      `¡NUNCA olvides escribir esa etiqueta si el usuario aprueba, ya que es el comando interno del sistema para actualizar la base de datos y otorgarle el certificado!\n\n`;
  }

  const promptConContexto = `${systemRulesText}${quizRules}${proyectosContextText}${
    userAiContextText ? `${userAiContextText}\n\n` : ''
  }Instrucción o consulta del usuario:\n${parsed.data.mensaje}`;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: auth.user.id,
        userId: auth.user.id,
        user_id: auth.user.id,
        chatInput: promptConContexto,
        message: promptConContexto,
        mensaje: promptConContexto,
        input: promptConContexto,
        tipo_evento: 'chat',
        proyectos: userProjects,
        perfil_usuario: perfilUsuarioData,
        temas_y_fuentes: temasContextData,
        archivo: parsed.data.archivo,
        contexto: parsed.data.contexto,
        geminiApiKey: process.env.GEMINI_API_KEY || null,
        geminiApiKey2: process.env.GEMINI_API_KEY_2 || null,
        geminiApiKey3: process.env.GEMINI_API_KEY_3 || null,
        geminiApiKeys: Array.from({ length: 10 }, (_, i) =>
          i === 0 ? process.env.GEMINI_API_KEY : process.env[`GEMINI_API_KEY_${i + 1}`],
        ).filter(Boolean) as string[],
      }),
    });

    if (!response.ok) {
      console.error('Fallo en el servidor de n8n:', response.status, response.statusText);
      return NextResponse.json(
        { success: false, error: 'Komo no pudo responder en este momento. Puedes reintentar.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, data: await response.text() });
  } catch (error) {
    console.error('Error al conectar el webhook de n8n:', error);
    return NextResponse.json(
      { success: false, error: 'No fue posible conectar con Komo. Puedes reintentar.' },
      { status: 502 },
    );
  }
}
