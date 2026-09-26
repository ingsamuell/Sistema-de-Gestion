import type { AnalyticsMetricId } from '@/features/analytics/data/types';

export type AssistantScope = 'general' | 'project' | 'topic' | 'calendar' | 'analytics';

export type FileAttachment = {
  name: string;
  size: number;
  type: string;
  content?: string;
};

export type GeneratedTaskItem = {
  id?: string;
  title?: string;
  titulo?: string;
  description?: string;
  descripcion?: string;
  duration?: string | number;
  duracion?: string | number;
  timeSlot?: string;
  resourceUrl?: string;
  resource_url?: string;
  resourceName?: string;
  isCompleted?: boolean;
};

export type UserProjectItem = {
  id: string;
  titulo: string;
  progreso: number;
};

export type MessageIntent =
  | 'informational'
  | 'update_project'
  | 'create_project'
  | 'recommend_topics'
  | 'confirm_recommendation';

export type AssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt?: string;
  conversationId?: string;
  contextData?: Record<string, unknown>;
  fileAttachment?: FileAttachment;
  tasks?: GeneratedTaskItem[];
  planTitle?: string;
  intent?: MessageIntent;
  targetProjectId?: string;
  targetProjectTitle?: string;
  projectLink?: string;
  skipQuestions?: number;
  suggestedTopicTitle?: string;
  suggestedTopicObjective?: string;
};

export type ConversationItem = {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
};

export type AssistantContext = {
  scope: AssistantScope;
  title: string;
  description: string;
  label: string;
  suggestions?: string[];
  analyticsContext?: {
    view: AnalyticsMetricId;
    period: 'week';
  };
  quizContext?: {
    taskId: string;
  };
};

export const GENERAL_ASSISTANT_CONTEXT: AssistantContext = {
  scope: 'general',
  title: 'Asistente general',
  label: 'tu espacio de aprendizaje',
  description:
    'Un espacio para consultar, organizar ideas y recibir acompañamiento en tu recorrido de aprendizaje.',
  suggestions: [
    '¿Qué debería priorizar esta semana?',
    'Ayúdame a preparar una sesión de estudio',
    '¿Cómo puedo mantener un ritmo sostenible?',
  ],
};

export type SendAssistantMessage = (input: {
  content: string;
  context: AssistantContext;
  fileAttachment?: FileAttachment;
  conversationId?: string | null;
  history?: AssistantMessage[];
  lastAssistantMessage?: AssistantMessage | null;
}) => Promise<{
  message: AssistantMessage;
  conversationId: string;
  conversationTitle?: string;
}>;
