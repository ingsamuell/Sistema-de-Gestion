export type NotificationEventType =
  'tarea_completada' | 'racha_3h' | 'racha_expirada' | 'proyecto_proximo' | 'proyecto_expirado';

export interface JobExecutionResult {
  enviados: number;
  omitidos: number;
  errores: number;
  detalles?: Array<{
    usuario_id: string;
    tipo_evento: NotificationEventType;
    referencia_id?: string | null;
    resultado: 'enviado' | 'omitido' | 'error';
    motivo?: string;
  }>;
}

export interface TelegramSendResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  retryCount?: number;
}
