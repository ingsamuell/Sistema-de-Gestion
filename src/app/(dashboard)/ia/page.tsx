'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AssistantChat } from '@/components/ia/AssistantChat';
import {
  GENERAL_ASSISTANT_CONTEXT,
  type AssistantMessage,
  type AssistantContext,
  type ConversationItem,
  type FileAttachment,
  type GeneratedTaskItem,
  type UserProjectItem,
} from '@/components/ia/types';
import type { AnalyticsMetricId } from '@/features/analytics/data/types';
import {
  getConversationsAction,
  getConversationMessagesAction,
  createConversationAction,
  saveMessageAction,
  updateConversationTitleAction,
  deleteConversationAction,
  addTasksToExistingProjectAction,
  getUserProjectsForChatAction,
} from '@/features/ai-assistant/actions/chatActions';
import { markTaskQuizPassedAction } from '@/features/certifications/actions/generateQuizAction';
import { extractAssistantResponseAndTitle } from '@/features/ai-assistant/utils/responseParser';
import {
  detectMessageIntent,
  extractTopicFromText,
} from '@/features/ai-assistant/utils/intentDetector';

export default function IAPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isGeneralMode, setIsGeneralMode] = useState(false);
  const context = isGeneralMode
    ? GENERAL_ASSISTANT_CONTEXT
    : (getAnalyticsContext(searchParams) ??
      getQuizContext(searchParams) ??
      GENERAL_ASSISTANT_CONTEXT);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [userProjects, setUserProjects] = useState<UserProjectItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Cargar lista de conversaciones y proyectos del usuario al montar
  useEffect(() => {
    async function loadInitialData() {
      setIsLoadingHistory(true);
      try {
        const [convRes, projRes] = await Promise.all([
          getConversationsAction(),
          getUserProjectsForChatAction(),
        ]);

        if (convRes.success && convRes.data) {
          setConversations(convRes.data);
        }
        if (projRes.success && projRes.data) {
          setUserProjects(projRes.data);
        }
      } catch (error) {
        console.error('Error al cargar datos iniciales del asistente:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadInitialData();
  }, []);

  // Seleccionar una conversación y cargar sus mensajes
  const handleSelectConversation = async (conversationId: string) => {
    setActiveConversationId(conversationId);
    try {
      const res = await getConversationMessagesAction(conversationId);
      if (res.success && res.data) {
        setMessages(res.data);
      }
    } catch (error) {
      console.error('Error al cargar mensajes de la conversación:', error);
    }
  };

  // Iniciar una nueva conversación en blanco
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  // Eliminar una conversación
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversationAction(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error al eliminar conversación:', error);
    }
  };

  // Crear proyecto real en Supabase a partir de tareas sugeridas por la IA
  // Redirigir al formulario de proyectos en lugar de crear directamente sin preguntas
  const handleCreateProject = async (_tasks?: GeneratedTaskItem[], title?: string) => {
    const params = new URLSearchParams();
    if (title) params.set('titulo', title);
    router.push(`/proyectos/nuevo${params.toString() ? `?${params.toString()}` : ''}`);
  };

  // Agregar tareas generadas a un proyecto existente del usuario
  const handleUpdateProject = async (projectId: string, tasks: GeneratedTaskItem[]) => {
    const res = await addTasksToExistingProjectAction({
      projectId,
      tasks: tasks.map((t) => ({
        title: t.title || t.titulo,
        description: t.description || t.descripcion,
        duration: t.duration || t.duracion,
        resourceUrl: t.resourceUrl || t.resource_url,
      })),
    });

    if (!res.success) {
      throw new Error(res.error || 'No se pudo actualizar el proyecto');
    }

    // Refrescar proyectos del usuario
    const projRes = await getUserProjectsForChatAction();
    if (projRes.success && projRes.data) {
      setUserProjects(projRes.data);
    }

    return res.projectTitle || 'Proyecto';
  };

  // Enviar mensaje al asistente y guardar en Supabase
  const handleSend = async (params: {
    content: string;
    context: AssistantContext;
    fileAttachment?: FileAttachment;
    conversationId?: string | null;
    history?: AssistantMessage[];
    lastAssistantMessage?: AssistantMessage | null;
  }): Promise<{
    message: AssistantMessage;
    conversationId: string;
    conversationTitle?: string;
  }> => {
    let convId = params.conversationId;

    // Obtener historial completo y mensajes del asistente para contexto multi-turno
    const conversationHistory =
      params.history && params.history.length > 0 ? params.history : messages;
    const lastAssistantMsg =
      params.lastAssistantMessage ||
      [...conversationHistory].reverse().find((m) => m.role === 'assistant') ||
      null;

    const lastRecommendationMsg =
      [...conversationHistory]
        .reverse()
        .find(
          (m) =>
            m.role === 'assistant' &&
            (m.intent === 'recommend_topics' ||
              m.contextData?.isTopicRecommendation ||
              m.suggestedTopicTitle ||
              m.contextData?.suggestedTopicTitle ||
              (m.content &&
                (m.content.toLowerCase().includes('recomiend') ||
                  m.content.toLowerCase().includes('propuesta')))),
        ) || null;

    // Detectar intención del usuario (informativa, actualización, recomendación de temas, confirmación o creación)
    const intentResult = detectMessageIntent(
      params.content,
      userProjects,
      lastAssistantMsg || lastRecommendationMsg,
    );

    // 1. Si no hay conversación activa, crear una nueva en Supabase
    if (!convId) {
      const initialTitle = (
        params.content ||
        params.fileAttachment?.name ||
        'Nueva conversación'
      ).slice(0, 45);
      const convRes = await createConversationAction(initialTitle);
      if (!convRes.success || !convRes.data) {
        throw new Error(convRes.error || 'No se pudo iniciar la conversación');
      }
      convId = convRes.data.id;
      setActiveConversationId(convId);
      setConversations((prev) => [convRes.data!, ...prev]);
    }

    // 2. Guardar mensaje del usuario en la tabla messages
    await saveMessageAction({
      conversationId: convId,
      sender: 'user',
      content: params.content,
      contextData: params.fileAttachment ? { file: params.fileAttachment } : {},
    });

    // 3. Preparar mensaje para n8n con el texto completo del documento si fue extraído
    let mensajeToSend = params.content;
    if (params.fileAttachment?.content) {
      mensajeToSend =
        `El usuario ha adjuntado el documento "${params.fileAttachment.name}" para su análisis:\n` +
        `--- INICIO DEL DOCUMENTO ---\n${params.fileAttachment.content}\n--- FIN DEL DOCUMENTO ---\n\n` +
        `Instrucción del usuario:\n${params.content || 'Por favor analiza este documento en detalle.'}`;
    }

    // 4. Llamar al webhook de n8n
    const response = await fetch('/api/webhooks/n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: mensajeToSend,
        tipo_evento: 'chat',
        archivo: params.fileAttachment
          ? {
              nombre: params.fileAttachment.name,
              tipo: params.fileAttachment.type,
              tamano: params.fileAttachment.size,
            }
          : undefined,
        contexto: params.context.analyticsContext
          ? { origen: 'analytics' as const, ...params.context.analyticsContext }
          : params.context.quizContext
            ? { origen: 'quiz' as const, ...params.context.quizContext }
            : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error('Error de conexión con el asistente');
    }

    const json = await response.json();
    const responseData = json.data;

    // 5. Parsear y limpiar respuesta
    // Solo anexar tareas estructuradas en markdown si es actualización de proyecto existente
    const shouldIncludeTasksInMarkdown = intentResult.intent === 'update_project';
    const parsed = extractAssistantResponseAndTitle(responseData, {
      includeTasksInMarkdown: shouldIncludeTasksInMarkdown,
    });

    let cleanReply = parsed.reply;
    const aiTitle = parsed.title;

    // Detectar si el quiz fue aprobado por la palabra secreta [QUIZ_APROBADO_taskId]
    const quizMatch = cleanReply.match(/\[QUIZ_APROBADO_([a-zA-Z0-9-]+)\]/);
    if (quizMatch) {
      const passedTaskId = quizMatch[1];
      try {
        await markTaskQuizPassedAction(passedTaskId);
        // Ocultar la palabra clave de la respuesta
        cleanReply = cleanReply.replace(quizMatch[0], '').trim();
      } catch (err) {
        console.error('Error al intentar aprobar el quiz desde IA:', err);
      }
    }

    // Solo preservar tareas si la intención era expresamente actualizar un proyecto existente
    const aiTasks =
      intentResult.intent === 'update_project'
        ? (parsed.tasks as GeneratedTaskItem[] | undefined)
        : undefined;

    let projectLink: string | undefined = undefined;
    let skipQuestions: number | undefined = undefined;
    let suggestedTopicTitle: string | undefined = undefined;
    let suggestedTopicObjective: string | undefined = undefined;

    // 5a. Si el usuario pide crear proyecto: proporcionar enlace al formulario y NO crear sin preguntas
    if (intentResult.intent === 'create_project') {
      projectLink = '/proyectos/nuevo';
      // Limpiar posibles enlaces en texto para que SOLO quede el botón interactivo abajo
      cleanReply = cleanReply
        .replace(/(?:👉\s*)?\[[^\]]+\]\(\/proyectos\/nuevo[^\)]*\)/gi, '')
        .replace(/https?:\/\/[^\s]+\/proyectos\/nuevo[^\s]*/gi, '')
        .trim();
      cleanReply +=
        '\n\nPara personalizar la fecha límite, tu tiempo de estudio diario y tus materiales, configura tu proyecto en el formulario interactivo pulsando el botón a continuación:';
    }

    // 5b. Si el usuario pide recomendaciones de temas: dar recomendación y preguntar si está de acuerdo
    if (intentResult.intent === 'recommend_topics') {
      const extracted = extractTopicFromText(cleanReply);
      suggestedTopicTitle = extracted.titulo;
      suggestedTopicObjective = extracted.objetivo;

      const mentionsAgreement =
        cleanReply.toLowerCase().includes('acuerdo') ||
        cleanReply.toLowerCase().includes('te parece') ||
        cleanReply.toLowerCase().includes('te gusta') ||
        cleanReply.toLowerCase().includes('opción') ||
        cleanReply.toLowerCase().includes('opcion');

      if (!mentionsAgreement) {
        cleanReply +=
          '\n\n¿Estás de acuerdo con este tema para tu proyecto o prefieres explorar otra opción?';
      }
    }

    // 5c. Si el usuario confirma/acepta una recomendación: enviar al formulario obviando las 2 primeras preguntas
    if (intentResult.intent === 'confirm_recommendation') {
      const topicTitle =
        intentResult.suggestedTopic?.titulo ||
        lastAssistantMsg?.suggestedTopicTitle ||
        (lastAssistantMsg?.contextData?.suggestedTopicTitle as string | undefined) ||
        lastRecommendationMsg?.suggestedTopicTitle ||
        (lastRecommendationMsg?.contextData?.suggestedTopicTitle as string | undefined) ||
        'Proyecto de Estudio';
      const topicObjective =
        intentResult.suggestedTopic?.objetivo ||
        lastAssistantMsg?.suggestedTopicObjective ||
        (lastAssistantMsg?.contextData?.suggestedTopicObjective as string | undefined) ||
        lastRecommendationMsg?.suggestedTopicObjective ||
        (lastRecommendationMsg?.contextData?.suggestedTopicObjective as string | undefined) ||
        'Plan de estudio propuesto por Komo IA';

      suggestedTopicTitle = topicTitle;
      suggestedTopicObjective = topicObjective;
      skipQuestions = 2;
      projectLink = `/proyectos/nuevo?step=2&titulo=${encodeURIComponent(topicTitle)}&objetivo=${encodeURIComponent(topicObjective)}`;

      cleanReply =
        `¡Excelente elección! Vamos a configurar tu proyecto **"${topicTitle}"**.\n\n` +
        `Para que ahorres tiempo, **hemos omitido las 2 primeras preguntas** del formulario (el nombre y el objetivo ya quedaron prellenados).\n\n` +
        `Pasa directamente a definir tu fecha límite, prioridad, materiales y horario en el formulario interactivo pulsando el botón a continuación:`;
    }

    // 6. Si la IA proporcionó un título para la conversación, actualizar la tabla conversations
    if (aiTitle && convId) {
      void updateConversationTitleAction(convId, aiTitle);
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: aiTitle } : c)));
    }

    // 7. Guardar mensaje del asistente en la tabla messages con metadatos de intención y enlaces
    const assistantMsgRes = await saveMessageAction({
      conversationId: convId,
      sender: 'assistant',
      content: cleanReply,
      contextData: {
        tasks: aiTasks && aiTasks.length > 0 ? aiTasks : undefined,
        planTitle: aiTitle || undefined,
        intent: intentResult.intent,
        targetProjectId: intentResult.targetProject?.id,
        targetProjectTitle: intentResult.targetProject?.titulo,
        projectLink,
        skipQuestions,
        suggestedTopicTitle,
        suggestedTopicObjective,
        isTopicRecommendation: intentResult.intent === 'recommend_topics',
      },
    });

    const assistantMsg: AssistantMessage = assistantMsgRes.data || {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: cleanReply,
      conversationId: convId,
      createdAt: new Date().toISOString(),
      tasks: aiTasks,
      planTitle: aiTitle,
      intent: intentResult.intent,
      targetProjectId: intentResult.targetProject?.id,
      targetProjectTitle: intentResult.targetProject?.titulo,
      projectLink,
      skipQuestions,
      suggestedTopicTitle,
      suggestedTopicObjective,
    };

    const finalMsg: AssistantMessage = {
      ...assistantMsg,
      tasks: aiTasks,
      planTitle: aiTitle,
      intent: intentResult.intent,
      targetProjectId: intentResult.targetProject?.id,
      targetProjectTitle: intentResult.targetProject?.titulo,
      projectLink,
      skipQuestions,
      suggestedTopicTitle,
      suggestedTopicObjective,
    };

    setMessages((prev) => {
      const base = params.history && params.history.length > 0 ? params.history : prev;
      return [...base, finalMsg];
    });

    return {
      message: finalMsg,
      conversationId: convId,
      conversationTitle: aiTitle,
    };
  };

  return (
    <AssistantChat
      context={context}
      messages={messages}
      conversations={conversations}
      userProjects={userProjects}
      activeConversationId={activeConversationId}
      isLoadingHistory={isLoadingHistory}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onDeleteConversation={handleDeleteConversation}
      onCreateProject={handleCreateProject}
      onUpdateProject={handleUpdateProject}
      onSend={handleSend}
      onClearContext={
        context.scope === 'analytics'
          ? () => {
              setIsGeneralMode(true);
              router.replace('/ia');
            }
          : undefined
      }
      initialDraft={searchParams.get('prompt') || undefined}
    />
  );
}

function getAnalyticsContext(params: URLSearchParams): AssistantContext | null {
  const view = params.get('view') as AnalyticsMetricId | null;
  const period = params.get('period');
  const question = params.get('question');
  const labels: Record<AnalyticsMetricId, string> = {
    workload: 'Horas planificadas',
    progress: 'Progreso de proyectos',
    priorities: 'Prioridades',
    deadlines: 'Entregas próximas',
  };

  if (params.get('source') !== 'analytics' || !view || !labels[view] || period !== 'week') {
    return null;
  }

  return {
    scope: 'analytics',
    title: 'Consulta de analítica',
    label: `${labels[view]} · Esta semana`,
    description: 'Komo responderá usando el contexto de la vista que abriste desde Analítica.',
    suggestions: question
      ? [question.slice(0, 240), 'Explícame esta vista']
      : ['Explícame esta vista'],
    analyticsContext: { view, period: 'week' },
  };
}

function getQuizContext(params: URLSearchParams): AssistantContext | null {
  const taskId = params.get('quizTaskId');
  if (!taskId) return null;

  return {
    scope: 'project',
    title: 'Evaluación de Conocimiento',
    label: 'Quiz de Certificación',
    description:
      'Komo actuará como tu evaluador para asegurar que dominas el tema de la tarea y te otorgará progreso en tu certificación.',
    quizContext: { taskId },
  };
}
