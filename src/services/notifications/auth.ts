/**
 * Extrae y valida el token Bearer del header Authorization.
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Valida autenticación para los endpoints de /jobs/* utilizando INTERNAL_JOB_TOKEN.
 */
export function validateJobAuth(request: Request): {
  authorized: boolean;
  status: number;
  error?: string;
} {
  const configuredToken = process.env.INTERNAL_JOB_TOKEN;

  if (!configuredToken || configuredToken.trim() === '') {
    console.error('[auth] INTERNAL_JOB_TOKEN no está configurado en el servidor.');
    return {
      authorized: false,
      status: 500,
      error: 'INTERNAL_JOB_TOKEN no configurado en el servidor.',
    };
  }

  const token = extractBearerToken(request);
  if (!token || token !== configuredToken.trim()) {
    return {
      authorized: false,
      status: 401,
      error: 'No autorizado: Bearer token inválido o ausente para job interno.',
    };
  }

  return { authorized: true, status: 200 };
}

/**
 * Valida autenticación para el endpoint de /webhooks/task-completed utilizando WEBHOOK_SECRET.
 */
export function validateWebhookAuth(request: Request): {
  authorized: boolean;
  status: number;
  error?: string;
} {
  const configuredSecret = process.env.WEBHOOK_SECRET;

  if (!configuredSecret || configuredSecret.trim() === '') {
    console.error('[auth] WEBHOOK_SECRET no está configurado en el servidor.');
    return {
      authorized: false,
      status: 500,
      error: 'WEBHOOK_SECRET no configurado en el servidor.',
    };
  }

  const token = extractBearerToken(request);
  if (!token || token !== configuredSecret.trim()) {
    return {
      authorized: false,
      status: 401,
      error: 'No autorizado: secreto de webhook inválido o ausente.',
    };
  }

  return { authorized: true, status: 200 };
}
