'use client';

import React, { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderPlus,
  History,
  Lightbulb,
  MessageSquare,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  GENERAL_ASSISTANT_CONTEXT,
  type AssistantContext,
  type AssistantMessage,
  type ConversationItem,
  type FileAttachment,
  type GeneratedTaskItem,
  type SendAssistantMessage,
  type UserProjectItem,
} from '@/components/ia/types';
import { extractTextFromFile } from '@/features/ai-assistant/utils/fileTextExtractor';
import { cn } from '@/lib/utils';
import { useIATour } from '@/hooks/useIATour';

type AssistantChatProps = {
  context?: AssistantContext;
  messages?: AssistantMessage[];
  conversations?: ConversationItem[];
  userProjects?: UserProjectItem[];
  activeConversationId?: string | null;
  isLoadingHistory?: boolean;
  onSelectConversation?: (conversationId: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (conversationId: string) => void;
  onCreateProject?: (tasks: GeneratedTaskItem[], title?: string) => Promise<void> | void;
  onUpdateProject?: (
    projectId: string,
    tasks: GeneratedTaskItem[],
    title?: string,
  ) => Promise<string | void> | void;
  onSend?: SendAssistantMessage;
  onClearContext?: () => void;
  initialDraft?: string;
};

export function AssistantChat({
  context = GENERAL_ASSISTANT_CONTEXT,
  messages = [],
  conversations = [],
  userProjects = [],
  activeConversationId = null,
  isLoadingHistory = false,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onCreateProject,
  onUpdateProject,
  onSend,
  onClearContext,
  initialDraft = '',
}: AssistantChatProps) {
  const [conversation, setConversation] = useState(messages);
  const [draft, setDraft] = useState(initialDraft);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [pendingContent, setPendingContent] = useState('');
  const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
  const [fileExtractionStatus, setFileExtractionStatus] = useState<{
    wordCount: number;
    isSupported: boolean;
  } | null>(null);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | null>(activeConversationId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useIATour();

  const isConnected = Boolean(onSend);

  const hasAutoSent = useRef(false);
  useEffect(() => {
    if (initialDraft && initialDraft.trim() && isConnected && !hasAutoSent.current) {
      hasAutoSent.current = true;
      // Use setTimeout to avoid state updates during render or immediately after mount issues
      setTimeout(() => {
        sendMessage(initialDraft);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft, isConnected]);

  // Sincronizar estado cuando cambian las props desde el padre
  const [prevMessages, setPrevMessages] = useState(messages);
  if (messages !== prevMessages) {
    setPrevMessages(messages);
    setConversation(messages);
  }

  const [prevActiveConvId, setPrevActiveConvId] = useState(activeConversationId);
  if (activeConversationId !== prevActiveConvId) {
    setPrevActiveConvId(activeConversationId);
    setCurrentConvId(activeConversationId);
  }

  // Scroll automático hacia el final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, status]);

  function handleFileClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Extracción de texto enriquecida (TXT, MD, CSV, PDF, etc.)
    const extraction = await extractTextFromFile(file);

    setAttachedFile({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      content: extraction.text || undefined,
    });

    setFileExtractionStatus({
      wordCount: extraction.wordCount,
      isSupported: extraction.isSupported,
    });

    event.target.value = '';
  }

  function handleRemoveFile() {
    setAttachedFile(null);
    setFileExtractionStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function sendMessage(content: string, isRetry = false) {
    if (!onSend || (!content.trim() && !attachedFile)) return;
    setStatus('loading');
    setPendingContent(content);

    const fileToSend = attachedFile;

    if (!isRetry) {
      setConversation((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: content.trim() || (fileToSend ? `Archivo: ${fileToSend.name}` : ''),
          fileAttachment: fileToSend || undefined,
        },
      ]);
      setDraft('');
      setAttachedFile(null);
      setFileExtractionStatus(null);
    }

    const lastAssistantMsg =
      [...conversation].reverse().find((m) => m.role === 'assistant') || null;

    try {
      const response = await onSend({
        content:
          content.trim() || (fileToSend ? `Analiza el documento adjunto: ${fileToSend.name}` : ''),
        context,
        fileAttachment: fileToSend || undefined,
        conversationId: currentConvId,
        history: conversation,
        lastAssistantMessage: lastAssistantMsg,
      });

      setConversation((current) => [...current, response.message]);
      setCurrentConvId(response.conversationId);
      setPendingContent('');
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if ((!content && !attachedFile) || status === 'loading' || !isConnected) return;
    await sendMessage(content);
  }

  function handleStartNewChat() {
    setConversation([]);
    setStatus('idle');
    setPendingContent('');
    setAttachedFile(null);
    setFileExtractionStatus(null);
    setDraft('');
    setCurrentConvId(null);
    if (onNewConversation) {
      onNewConversation();
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary">
              <Sparkles className="size-4" />
            </span>
            Asistente IA
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{context.title}</h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">{context.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {conversations.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowMobileHistory((prev) => !prev)}
              className="lg:hidden gap-1.5 text-xs"
            >
              <History className="size-3.5" />
              Historial ({conversations.length})
            </Button>
          )}
          <span
            className={cn(
              'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
              isConnected
                ? 'bg-status-success-bg text-status-success'
                : 'bg-status-attention-bg text-status-attention',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isConnected ? 'bg-status-success' : 'bg-status-attention',
              )}
            />
            {isConnected ? 'Listo para conversar' : 'Conexión pendiente'}
          </span>
        </div>
      </header>

      {context.scope === 'analytics' && context.analyticsContext && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs text-on-surface-variant">
          <span className="rounded-full bg-primary px-2.5 py-1 font-bold text-on-primary">
            Contexto: Analítica · {context.label}
          </span>
          <span>Se enviará solo la vista y el período, no tus títulos ni notas.</span>
          {onClearContext && (
            <button
              type="button"
              onClick={onClearContext}
              className="ml-auto rounded-lg px-2 py-1 font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Modo general
            </button>
          )}
        </div>
      )}

      {/* Panel móvil para historial de chats */}
      {showMobileHistory && (
        <div className="mb-5 block lg:hidden">
          <ChatHistoryCard
            conversations={conversations}
            activeId={currentConvId}
            isLoading={isLoadingHistory}
            onSelect={(id) => {
              setShowMobileHistory(false);
              onSelectConversation?.(id);
            }}
            onDelete={onDeleteConversation}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Ventana de chat principal: altura fija y scroll interno estricto */}
        <Card className="flex h-[calc(100vh-13.5rem)] min-h-[32rem] max-h-[46rem] flex-col overflow-hidden p-0 shadow-sm border-outline-variant/40">
          <div className="flex items-center justify-between border-b border-outline-variant/30 px-5 py-3.5 bg-surface shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
                <Bot className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-on-surface">Komo</h2>
                <p className="text-xs text-on-surface-variant">{context.label}</p>
              </div>
            </div>
            <button
              id="tour-ia-new-chat"
              type="button"
              onClick={handleStartNewChat}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
              aria-label="Nueva conversación"
              title="Nueva conversación"
            >
              <MessageSquarePlus className="size-4" />
              <span className="hidden sm:inline">Nuevo chat</span>
            </button>
          </div>

          {/* Lista de mensajes con scroll interno independiente */}
          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto bg-surface-container-low/35 px-4 py-5 sm:px-6">
            {conversation.length === 0 && status !== 'loading' ? (
              <EmptyConversation context={context} isConnected={isConnected} />
            ) : (
              conversation.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  userProjects={userProjects}
                  onCreateProject={onCreateProject}
                  onUpdateProject={onUpdateProject}
                />
              ))
            )}
            {status === 'loading' && <TypingIndicator />}
            {status === 'error' && (
              <div className="flex items-start gap-3 rounded-2xl border border-error/20 bg-error-container/50 p-4 text-sm">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-error" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-on-error-container">
                    No se pudo obtener una respuesta
                  </p>
                  <p className="mt-1 text-on-surface-variant">
                    Tu mensaje se conserva para que puedas intentarlo de nuevo.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 -ml-3 gap-2"
                    onClick={() => void sendMessage(pendingContent, true)}
                  >
                    <RefreshCw className="size-3.5" />
                    Reintentar
                  </Button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de entrada */}
          <form
            id="tour-ia-input"
            onSubmit={submitMessage}
            className="shrink-0 border-t border-outline-variant/30 bg-surface-container-lowest p-3 sm:p-4"
          >
            {/* Input de archivo oculto */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.pdf,.doc,.docx,.csv,.json,.md,.png,.jpg,.jpeg"
            />

            {/* Vista previa de archivo adjunto con estado de extracción */}
            {attachedFile && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs text-primary max-w-full">
                <Paperclip className="size-3.5 shrink-0 text-primary" />
                <span className="font-medium truncate max-w-[170px] sm:max-w-md">
                  {attachedFile.name}
                </span>
                <span className="shrink-0 text-[11px] text-on-surface-variant">
                  ({formatBytes(attachedFile.size)})
                </span>

                {fileExtractionStatus && fileExtractionStatus.isSupported ? (
                  <span className="hidden sm:inline shrink-0 rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-semibold text-status-success">
                    ✓ {fileExtractionStatus.wordCount} palabras extraídas
                  </span>
                ) : (
                  <span className="hidden sm:inline shrink-0 rounded-full bg-status-attention-bg px-2 py-0.5 text-[10px] font-semibold text-status-attention">
                    ⚠️ Sin texto legible (adjuntando nombre)
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="ml-auto flex size-5 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/15 hover:text-error"
                  aria-label="Remover archivo"
                  title="Remover archivo"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-outline-variant bg-surface px-2.5 py-2 transition-shadow focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
              <button
                type="button"
                disabled={!isConnected}
                onClick={handleFileClick}
                className={cn(
                  'mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  attachedFile
                    ? 'bg-primary text-on-primary'
                    : 'text-outline hover:bg-surface-container hover:text-primary',
                )}
                aria-label="Adjuntar archivo"
                title="Adjuntar archivo"
              >
                <Paperclip className="size-4" />
              </button>

              <label className="sr-only" htmlFor="assistant-message">
                Escribe tu mensaje
              </label>

              {/* Textarea con contención estricta y límite de caracteres */}
              <div className="min-w-0 flex-1 overflow-hidden">
                <textarea
                  id="assistant-message"
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const content = draft.trim();
                      if ((content || attachedFile) && status !== 'loading' && isConnected) {
                        void sendMessage(content);
                      }
                    }
                  }}
                  maxLength={4000}
                  placeholder={
                    isConnected
                      ? attachedFile
                        ? 'Indica qué deseas que Komo analice sobre este archivo...'
                        : 'Escribe lo que necesitas...'
                      : 'El asistente se habilitará cuando esté conectado'
                  }
                  rows={1}
                  className="max-h-28 min-h-9 w-full resize-none overflow-y-auto break-words whitespace-pre-wrap bg-transparent px-1 py-2 text-sm outline-none placeholder:text-outline disabled:cursor-not-allowed"
                  disabled={!isConnected || status === 'loading'}
                />
              </div>

              <button
                type="submit"
                disabled={(!draft.trim() && !attachedFile) || status === 'loading' || !isConnected}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar mensaje"
              >
                <ArrowUp className="size-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-2 pt-2 text-[11px] text-outline">
              <span>Komo propone; tú revisas antes de aplicar cualquier cambio.</span>
              {draft.length > 500 && (
                <span className="shrink-0 text-on-surface-variant font-mono">
                  {draft.length}/4000
                </span>
              )}
            </div>
          </form>
        </Card>

        {/* Columna lateral con scroll interno adaptado */}
        <aside
          id="tour-ia-history"
          className="space-y-4 lg:h-[calc(100vh-13.5rem)] lg:min-h-[32rem] lg:max-h-[46rem] lg:overflow-y-auto lg:pr-1"
        >
          {/* Card de Historial de Chats (sin botón de nuevo a la derecha) */}
          <div className="hidden lg:block">
            <ChatHistoryCard
              conversations={conversations}
              activeId={currentConvId}
              isLoading={isLoadingHistory}
              onSelect={onSelectConversation}
              onDelete={onDeleteConversation}
            />
          </div>

          {context.suggestions && context.suggestions.length > 0 && (
            <Card className="p-4 shadow-sm border-outline-variant/40">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-on-surface">
                <Lightbulb className="size-4 text-accent-amber" />
                Consultas frecuentes
              </div>
              <div className="space-y-2">
                {context.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={!isConnected}
                    onClick={() => setDraft(suggestion)}
                    className="w-full rounded-xl border border-outline-variant/50 bg-surface px-3 py-2 text-left text-xs leading-relaxed text-on-surface-variant transition-colors hover:border-primary/30 hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className="bg-surface-container p-4 shadow-none border-none">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
              <Check className="size-4" />
              Contexto controlado
            </div>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Este chat tiene acceso a tus proyectos actuales y a la información de{' '}
              {context.label.toLowerCase()} para responder de forma personalizada.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/**
 * Tarjeta de Historial de Conversaciones: muestra únicamente los títulos y permite recargar cada chat al hacer click.
 * El botón 'Nuevo' a la derecha fue removido a solicitud del usuario.
 */
function ChatHistoryCard({
  conversations,
  activeId,
  isLoading,
  onSelect,
  onDelete,
}: {
  conversations: ConversationItem[];
  activeId?: string | null;
  isLoading?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <Card className="p-3.5 shadow-sm border-outline-variant/40">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <History className="size-4 text-primary" />
          <span>Historial de chats</span>
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-on-surface-variant animate-pulse">
            Cargando historial...
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-6 text-center text-xs text-on-surface-variant">
            No tienes conversaciones guardadas.
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeId === conv.id;
            return (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-colors',
                  isActive
                    ? 'bg-primary/15 font-semibold text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(conv.id)}
                  className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                  title={conv.title}
                >
                  <MessageSquare
                    className={cn('size-3.5 shrink-0', isActive ? 'text-primary' : 'text-outline')}
                  />
                  <span className="truncate max-w-[190px]">{conv.title}</span>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-outline hover:text-error rounded"
                    title="Eliminar conversación"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function EmptyConversation({
  context,
  isConnected,
}: {
  context: AssistantContext;
  isConnected: boolean;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-container text-primary">
        <Sparkles className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">
        {isConnected ? 'Inicia una conversación' : 'Este espacio está preparado para Komo'}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-on-surface-variant">
        {isConnected
          ? `Escribe una consulta para trabajar desde ${context.label.toLowerCase()} o pide consejos sobre tus proyectos.`
          : `Cuando se conecte el servicio, podrás conversar desde ${context.label.toLowerCase()} sin salir de esta sección.`}
      </p>
    </div>
  );
}

function extractProjectLinkFromContent(content: string): string | null {
  if (!content) return null;
  const match = content.match(/\(((\/proyectos\/nuevo[^\)]*))\)/);
  if (match && match[1]) return match[1];
  if (content.includes('/proyectos/nuevo')) {
    const rawMatch = content.match(/(\/proyectos\/nuevo[^\s\)]*)/);
    if (rawMatch && rawMatch[1]) return rawMatch[1];
    return '/proyectos/nuevo';
  }
  return null;
}

function RenderMessageContent({
  content,
  isAssistant,
  hasButton,
}: {
  content: string;
  isAssistant: boolean;
  hasButton?: boolean;
}) {
  if (!content) return null;

  // Si ya tiene botón interactivo dedicado abajo, eliminar cualquier enlace redundante a /proyectos/nuevo del texto
  let textToRender = content;
  if (isAssistant && hasButton) {
    textToRender = textToRender
      .replace(/(?:👉\s*)?\[[^\]]+\]\(\/proyectos\/nuevo[^\)]*\)/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const lines = textToRender.split('\n');

  return (
    <div className="space-y-1.5 [overflow-wrap:anywhere] break-words">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-2" />;
        }

        return (
          <div key={lineIdx} className="leading-relaxed">
            {renderFormattedLine(line, isAssistant)}
          </div>
        );
      })}
    </div>
  );
}

function renderFormattedLine(line: string, isAssistant: boolean): React.ReactNode[] {
  // Separa tokens [Texto](url) y **texto**
  const tokenRegex = /(\[[^\]]+\]\([^\)]+\)|\*\*[^*]+\*\*)/g;
  const parts = line.split(tokenRegex);

  return parts.map((part, idx) => {
    // 1. Enlace Markdown [Texto](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      const isInternal = linkUrl.startsWith('/');

      if (isInternal) {
        return (
          <Link
            key={idx}
            href={linkUrl}
            className={cn(
              'inline-flex items-center gap-1 font-semibold underline underline-offset-2 transition-colors cursor-pointer',
              isAssistant
                ? 'text-primary hover:text-primary/80'
                : 'text-on-primary hover:text-on-primary/90',
            )}
          >
            <span>{linkText}</span>
            <ArrowRight className="size-3 shrink-0 inline" />
          </Link>
        );
      }

      return (
        <a
          key={idx}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1 font-semibold underline underline-offset-2 transition-colors',
            isAssistant
              ? 'text-primary hover:text-primary/80'
              : 'text-on-primary hover:text-on-primary/90',
          )}
        >
          <span>{linkText}</span>
          <ExternalLink className="size-3 shrink-0 inline" />
        </a>
      );
    }

    // 2. Negrita **texto**
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <strong key={idx} className="font-bold text-inherit">
          {boldMatch[1]}
        </strong>
      );
    }

    // 3. Texto plano
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function ChatMessage({
  message,
  userProjects = [],
  onCreateProject,
  onUpdateProject,
}: {
  message: AssistantMessage;
  userProjects?: UserProjectItem[];
  onCreateProject?: (tasks: GeneratedTaskItem[], title?: string) => Promise<void> | void;
  onUpdateProject?: (
    projectId: string,
    tasks: GeneratedTaskItem[],
    title?: string,
  ) => Promise<string | void> | void;
}) {
  const isAssistant = message.role === 'assistant';
  const file = message.fileAttachment || (message.contextData?.file as FileAttachment | undefined);
  const tasks = message.tasks || (message.contextData?.tasks as GeneratedTaskItem[] | undefined);
  const planTitle = message.planTitle || (message.contextData?.planTitle as string | undefined);

  // Detección de si la consulta fue meramente informativa
  const resolvedIntent = message.intent || (message.contextData?.intent as string | undefined);
  const isInformational = resolvedIntent === 'informational' || (!resolvedIntent && !tasks);

  // Enlace y lógica de salto de preguntas para creación de proyectos
  let effectiveProjectLink =
    message.projectLink ||
    (message.contextData?.projectLink as string | undefined) ||
    extractProjectLinkFromContent(message.content);

  const isConfirmedRecommendation =
    resolvedIntent === 'confirm_recommendation' ||
    Boolean(effectiveProjectLink && effectiveProjectLink.includes('step=2'));

  if (!effectiveProjectLink && isConfirmedRecommendation) {
    const topicTitle =
      message.suggestedTopicTitle ||
      (message.contextData?.suggestedTopicTitle as string | undefined) ||
      'Proyecto Recomendado';
    const topicObj =
      message.suggestedTopicObjective ||
      (message.contextData?.suggestedTopicObjective as string | undefined) ||
      'Plan de estudio propuesto por Komo IA';
    effectiveProjectLink = `/proyectos/nuevo?step=2&titulo=${encodeURIComponent(topicTitle)}&objetivo=${encodeURIComponent(topicObj)}`;
  } else if (!effectiveProjectLink && resolvedIntent === 'create_project') {
    effectiveProjectLink = '/proyectos/nuevo';
  }

  const isSkipQuestions =
    message.skipQuestions === 2 ||
    message.contextData?.skipQuestions === 2 ||
    Boolean(effectiveProjectLink && effectiveProjectLink.includes('step=2'));

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (message.targetProjectId) return message.targetProjectId;
    if (userProjects && userProjects.length > 0) return userProjects[0].id;
    return '';
  });

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectCreated, setProjectCreated] = useState(false);
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [updatedProjectName, setUpdatedProjectName] = useState<string | null>(null);

  const handleCreateProject = async () => {
    if (!onCreateProject || isCreatingProject) return;
    setIsCreatingProject(true);
    try {
      await onCreateProject(tasks || [], planTitle);
      setProjectCreated(true);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleUpdateExisting = async () => {
    if (!tasks || tasks.length === 0 || !onUpdateProject || !selectedProjectId || isUpdatingProject)
      return;
    setIsUpdatingProject(true);
    try {
      const res = await onUpdateProject(selectedProjectId, tasks, planTitle);
      const projName =
        typeof res === 'string'
          ? res
          : userProjects.find((p) => p.id === selectedProjectId)?.titulo || 'Proyecto';
      setUpdatedProjectName(projName);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  return (
    <div className={cn('flex gap-3', !isAssistant && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          isAssistant ? 'bg-primary text-on-primary' : 'bg-accent-amber/20 text-primary',
        )}
      >
        {isAssistant ? <Bot className="size-4" /> : <span className="text-xs font-bold">SO</span>}
      </div>

      <div className={cn('min-w-0 max-w-[85%] sm:max-w-[75%]', !isAssistant && 'text-right')}>
        <p className="mb-1 px-1 text-[11px] font-semibold text-on-surface-variant">
          {isAssistant ? 'Komo' : 'Tú'}
        </p>

        <div
          className={cn(
            'overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere] break-words shadow-sm',
            isAssistant
              ? 'rounded-tl-md bg-surface-container-lowest text-on-surface'
              : 'rounded-tr-md bg-primary text-on-primary',
          )}
        >
          {file && (
            <div
              className={cn(
                'mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs border max-w-full',
                isAssistant
                  ? 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
                  : 'bg-primary-container/20 border-white/20 text-on-primary',
              )}
            >
              <Paperclip className="size-3 shrink-0" />
              <span className="truncate max-w-[180px] sm:max-w-xs font-medium">{file.name}</span>
              {file.size && (
                <span className="shrink-0 text-[10px] opacity-80">({formatBytes(file.size)})</span>
              )}
            </div>
          )}

          {/* Contenido con soporte para enlaces markdown e interactividad */}
          <RenderMessageContent
            content={message.content}
            isAssistant={isAssistant}
            hasButton={Boolean(effectiveProjectLink)}
          />

          {/* Tarjeta de acción interactiva destacada si hay enlace hacia el formulario de creación */}
          {isAssistant && effectiveProjectLink && (
            <div className="mt-3.5 rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 sm:p-3.5 text-left transition-all">
              <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-primary">
                <Sparkles className="size-3.5 shrink-0 text-[#845326]" />
                <span>
                  {isSkipQuestions ? 'Configuración de Proyecto Lista' : 'Formulario de Proyectos'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mb-2.5 leading-relaxed">
                {isSkipQuestions
                  ? 'Hemos omitido y prellenado las 2 primeras preguntas (Nombre y Objetivo). Ahora define tu fecha límite, prioridad y horario en el formulario.'
                  : 'Define tu fecha límite, prioridad, dedicación diaria y materiales en el formulario interactivo para organizar tus metas.'}
              </p>
              <Link
                href={effectiveProjectLink}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-xs hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
              >
                <FolderPlus className="size-3.5" />
                <span>
                  {isSkipQuestions
                    ? 'Continuar en el formulario (Paso 3 de 7)'
                    : 'Ir al formulario de proyectos'}
                </span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}

          {/* Bloque de plan de tareas: SOLO cuando la consulta NO es meramente informativa */}
          {tasks && tasks.length > 0 && isAssistant && !isInformational && (
            <div className="mt-4 space-y-2.5 border-t border-outline-variant/30 pt-3 text-left">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <CheckCircle2 className="size-4 text-primary" />
                  {planTitle || 'Plan de tareas estructurado'}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </div>

              <div className="grid gap-2">
                {tasks.map((task, idx) => {
                  const title = task.title || task.titulo || `Tarea ${idx + 1}`;
                  const desc = task.description || task.descripcion;
                  const dur = task.duration || task.duracion;
                  const res = task.resourceUrl || task.resource_url;
                  const resName = task.resourceName || 'Ver recurso';

                  return (
                    <div
                      key={task.id || idx}
                      className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2.5 text-xs transition-colors hover:border-primary/40 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-on-surface leading-tight">{title}</span>
                        {dur && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                            <Clock className="size-2.5 text-primary" />
                            {dur}
                          </span>
                        )}
                      </div>

                      {desc && (
                        <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed">
                          {desc}
                        </p>
                      )}

                      {res && (
                        <a
                          href={res}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          <span>{resName}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Acciones de proyecto: Actualizar proyecto existente vs Ir al formulario */}
              <div className="pt-2">
                {updatedProjectName ? (
                  <div className="flex items-center gap-2 rounded-xl bg-status-success-bg p-2.5 text-xs font-semibold text-status-success">
                    <Check className="size-4" />
                    <span>
                      ¡Proyecto &quot;{updatedProjectName}&quot; actualizado con {tasks.length}{' '}
                      nuevas tareas!
                    </span>
                  </div>
                ) : projectCreated ? (
                  <div className="flex items-center gap-2 rounded-xl bg-status-success-bg p-2.5 text-xs font-semibold text-status-success">
                    <Check className="size-4" />
                    <span>¡Redirigiendo al formulario de proyectos!</span>
                  </div>
                ) : userProjects.length > 0 && onUpdateProject ? (
                  <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/[0.03] p-3">
                    <div className="text-xs font-semibold text-on-surface">
                      ¿Deseas agregar estas tareas a uno de tus proyectos existentes?
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 flex-1 min-w-0"
                      >
                        {userProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            Proyecto: {p.titulo} ({p.progreso}%)
                          </option>
                        ))}
                      </select>

                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={handleUpdateExisting}
                        disabled={isUpdatingProject || isCreatingProject || !selectedProjectId}
                        className="gap-1.5 text-xs whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FolderPlus className="size-3.5" />
                        <span>{isUpdatingProject ? 'Actualizando...' : 'Actualizar proyecto'}</span>
                      </Button>
                    </div>

                    {onCreateProject && (
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={isCreatingProject || isUpdatingProject}
                        className="text-[11px] font-semibold text-primary hover:underline transition-colors block text-left pt-1 cursor-pointer"
                      >
                        O configurar como nuevo proyecto en el formulario
                      </button>
                    )}
                  </div>
                ) : onCreateProject ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleCreateProject}
                    disabled={isCreatingProject}
                    className="w-full gap-2 text-xs cursor-pointer"
                  >
                    <FolderPlus className="size-3.5 text-primary" />
                    <span>Configurar proyecto en el formulario</span>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3" role="status" aria-label="Komo está escribiendo">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
        <Bot className="size-4" />
      </div>
      <div className="rounded-2xl rounded-tl-md bg-surface-container-lowest px-4 py-3 shadow-sm">
        <div className="flex gap-1.5">
          <span className="size-1.5 animate-bounce rounded-full bg-outline [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-outline [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-outline" />
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
