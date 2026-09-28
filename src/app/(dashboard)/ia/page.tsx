'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AssistantChat } from '@/components/ia/AssistantChat';
import {
  getGeneralAssistantContext,
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
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export default function IAPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const generalAssistantContext = getGeneralAssistantContext(locale);
  const copy = getIAPageCopy(locale);
  const searchParams = useSearchParams();
  const [isGeneralMode, setIsGeneralMode] = useState(false);
  const context = isGeneralMode
    ? generalAssistantContext
    : (getAnalyticsContext(searchParams, locale) ??
      getQuizContext(searchParams, locale) ??
      generalAssistantContext);

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
    router.push(
      `${localizedHref(locale, 'newProject')}${params.toString() ? `?${params.toString()}` : ''}`,
    );
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
      throw new Error(res.error || copy.updateProjectError);
    }

    // Refrescar proyectos del usuario
    const projRes = await getUserProjectsForChatAction();
    if (projRes.success && projRes.data) {
      setUserProjects(projRes.data);
    }

    return res.projectTitle || copy.project;
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
        copy.newConversation
      ).slice(0, 45);
      const convRes = await createConversationAction(initialTitle);
      if (!convRes.success || !convRes.data) {
        throw new Error(convRes.error || copy.startConversationError);
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
      mensajeToSend = copy.documentContext(
        params.fileAttachment.name,
        params.fileAttachment.content,
        params.content || copy.analyzeDocument,
      );
    }

    // 4. Llamar al webhook de n8n
    const response = await fetch('/api/webhooks/n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: mensajeToSend,
        tipo_evento: 'chat',
        locale,
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
      throw new Error(copy.connectionError);
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
      projectLink = localizedHref(locale, 'newProject');
      // Limpiar posibles enlaces en texto para que SOLO quede el botón interactivo abajo
      cleanReply = cleanReply
        .replace(/(?:👉\s*)?\[[^\]]+\]\(\/proyectos\/nuevo[^\)]*\)/gi, '')
        .replace(/https?:\/\/[^\s]+\/proyectos\/nuevo[^\s]*/gi, '')
        .trim();
      cleanReply += `\n\n${copy.createProjectNextStep}`;
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
        cleanReply += `\n\n${copy.agreementQuestion}`;
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
        copy.studyProject;
      const topicObjective =
        intentResult.suggestedTopic?.objetivo ||
        lastAssistantMsg?.suggestedTopicObjective ||
        (lastAssistantMsg?.contextData?.suggestedTopicObjective as string | undefined) ||
        lastRecommendationMsg?.suggestedTopicObjective ||
        (lastRecommendationMsg?.contextData?.suggestedTopicObjective as string | undefined) ||
        copy.studyPlanByKomo;

      suggestedTopicTitle = topicTitle;
      suggestedTopicObjective = topicObjective;
      skipQuestions = 2;
      projectLink = `${localizedHref(locale, 'newProject')}?step=2&titulo=${encodeURIComponent(topicTitle)}&objetivo=${encodeURIComponent(topicObjective)}`;

      cleanReply = copy.confirmedRecommendation(topicTitle);
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
      locale={locale}
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
              router.replace(localizedHref(locale, 'assistant'));
            }
          : undefined
      }
      initialDraft={searchParams.get('prompt') || undefined}
    />
  );
}

function getAnalyticsContext(
  params: URLSearchParams,
  locale: 'es' | 'en',
): AssistantContext | null {
  const view = params.get('view') as AnalyticsMetricId | null;
  const period = params.get('period');
  const question = params.get('question');
  const labels: Record<AnalyticsMetricId, string> =
    locale === 'es'
      ? {
          workload: 'Horas planificadas',
          progress: 'Progreso de proyectos',
          priorities: 'Prioridades',
          deadlines: 'Entregas próximas',
        }
      : {
          workload: 'Planned hours',
          progress: 'Project progress',
          priorities: 'Priorities',
          deadlines: 'Upcoming deadlines',
        };

  if (params.get('source') !== 'analytics' || !view || !labels[view] || period !== 'week') {
    return null;
  }

  return {
    scope: 'analytics',
    title: locale === 'es' ? 'Consulta de analítica' : 'Analytics question',
    label: `${labels[view]} · ${locale === 'es' ? 'Esta semana' : 'This week'}`,
    description:
      locale === 'es'
        ? 'Komo responderá usando el contexto de la vista que abriste desde Analítica.'
        : 'Komo will answer using the context from the Analytics view you opened.',
    suggestions: question
      ? [question.slice(0, 240), locale === 'es' ? 'Explícame esta vista' : 'Explain this view']
      : [locale === 'es' ? 'Explícame esta vista' : 'Explain this view'],
    analyticsContext: { view, period: 'week' },
  };
}

function getQuizContext(params: URLSearchParams, locale: 'es' | 'en'): AssistantContext | null {
  const taskId = params.get('quizTaskId');
  if (!taskId) return null;

  return {
    scope: 'project',
    title: locale === 'es' ? 'Evaluación de Conocimiento' : 'Knowledge assessment',
    label: locale === 'es' ? 'Quiz de Certificación' : 'Certification quiz',
    description:
      locale === 'es'
        ? 'Komo actuará como tu evaluador para asegurar que dominas el tema de la tarea y te otorgará progreso en tu certificación.'
        : 'Komo will assess your task knowledge and grant progress toward your certification.',
    quizContext: { taskId },
  };
}

function getIAPageCopy(locale: 'es' | 'en') {
  return locale === 'es'
    ? {
        newConversation: 'Nueva conversación',
        updateProjectError: 'No se pudo actualizar el proyecto',
        project: 'Proyecto',
        startConversationError: 'No se pudo iniciar la conversación',
        analyzeDocument: 'Por favor analiza este documento en detalle.',
        documentContext: (name: string, content: string, instruction: string) =>
          `El usuario ha adjuntado el documento "${name}" para su análisis:\n--- INICIO DEL DOCUMENTO ---\n${content}\n--- FIN DEL DOCUMENTO ---\n\nInstrucción del usuario:\n${instruction}`,
        connectionError: 'Error de conexión con el asistente',
        createProjectNextStep:
          'Para personalizar la fecha límite, tu tiempo de estudio diario y tus materiales, configura tu proyecto en el formulario interactivo pulsando el botón a continuación:',
        agreementQuestion:
          '¿Estás de acuerdo con este tema para tu proyecto o prefieres explorar otra opción?',
        studyProject: 'Proyecto de Estudio',
        studyPlanByKomo: 'Plan de estudio propuesto por Komo IA',
        confirmedRecommendation: (title: string) =>
          `¡Excelente elección! Vamos a configurar tu proyecto **"${title}"**.\n\nPara que ahorres tiempo, **hemos omitido las 2 primeras preguntas** del formulario (el nombre y el objetivo ya quedaron prellenados).\n\nPasa directamente a definir tu fecha límite, prioridad, materiales y horario en el formulario interactivo pulsando el botón a continuación:`,
      }
    : {
        newConversation: 'New conversation',
        updateProjectError: 'Could not update the project',
        project: 'Project',
        startConversationError: 'Could not start the conversation',
        analyzeDocument: 'Please analyze this document in detail.',
        documentContext: (name: string, content: string, instruction: string) =>
          `The user attached the document "${name}" for analysis:\n--- START OF DOCUMENT ---\n${content}\n--- END OF DOCUMENT ---\n\nUser instruction:\n${instruction}`,
        connectionError: 'Assistant connection error',
        createProjectNextStep:
          'To personalize your deadline, daily study time, and materials, set up your project in the interactive form using the button below:',
        agreementQuestion:
          'Do you agree with this topic for your project, or would you prefer to explore another option?',
        studyProject: 'Study project',
        studyPlanByKomo: 'Study plan proposed by Komo AI',
        confirmedRecommendation: (title: string) =>
          `Excellent choice! Let’s set up your **"${title}"** project.\n\nTo save you time, **we skipped the first two questions** in the form (the name and goal are already prefilled).\n\nGo straight to setting your deadline, priority, materials, and schedule in the interactive form using the button below:`,
      };
}
