import crypto from 'crypto';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  htmlLink: string | null;
  status: string | null;
}

export interface GoogleCalendarTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
  expires_in?: number;
}

export const GCAL_COOKIE_NAME = 'gcal_tokens';

/**
 * Obtiene la URL base de la aplicación (producción en Vercel o entorno local).
 * Prioriza el origen real del usuario para no forzar saltos de dominio en Vercel.
 */
export function getAppBaseUrl(requestOrigin?: string): string {
  if (
    requestOrigin &&
    !requestOrigin.includes('localhost') &&
    !requestOrigin.includes('127.0.0.1')
  ) {
    return requestOrigin.replace(/\/$/, '');
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, '')}`;
  }
  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  return 'http://localhost:3000';
}

/**
 * Obtiene de forma confiable el origen canónico de la petición HTTP actual,
 * respetando encabezados de proxy inverso como 'x-forwarded-host' y 'x-forwarded-proto'
 * para evitar que las cookies de sesión se pierdan al redirigir entre dominios.
 */
export function getBaseUrlFromRequest(request: Request | { headers: Headers; url?: string }): string {
  try {
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    if (forwardedHost) {
      const isLocal = forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1');
      const proto = isLocal ? 'http' : forwardedProto;
      return `${proto}://${forwardedHost}`.replace(/\/$/, '');
    }
    if (request.url) {
      return new URL(request.url).origin.replace(/\/$/, '');
    }
  } catch {}
  return getAppBaseUrl();
}

/**
 * Obtiene la URL de redirección configurada para OAuth2.
 */
export function getRedirectUri(customRedirectUri?: string, requestOrigin?: string): string {
  if (customRedirectUri) {
    return customRedirectUri;
  }
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const appUrl = getAppBaseUrl(requestOrigin);
  return `${appUrl}/api/calendar/callback`;
}

/**
 * Genera la URL de consentimiento para que el usuario autorice el acceso a Google Calendar.
 */
export function getGoogleAuthUrl(
  state?: string,
  customRedirectUri?: string,
  requestOrigin?: string,
): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Falta la variable de entorno GOOGLE_CLIENT_ID.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(customRedirectUri, requestOrigin),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  if (state) {
    params.set('state', state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Intercambia el código temporal de autorización de Google por tokens de acceso y actualización.
 */
export async function exchangeCodeForTokens(
  code: string,
  customRedirectUri?: string,
  requestOrigin?: string,
): Promise<GoogleCalendarTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Faltan las variables de entorno GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(customRedirectUri, requestOrigin),
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description || data.error || 'Error al intercambiar código por tokens.',
    );
  }

  const expiry_date = data.expires_in ? Date.now() + data.expires_in * 1000 : null;

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope,
    token_type: data.token_type,
    expiry_date,
    expires_in: data.expires_in,
  };
}

/**
 * Refresca el access_token usando el refresh_token guardado.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleCalendarTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Faltan las variables de entorno GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description || data.error || 'Error al refrescar el token de acceso.',
    );
  }

  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    scope: data.scope,
    token_type: data.token_type,
    expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };
}

/**
 * Consulta los próximos eventos del calendario principal del usuario autenticado.
 */
export async function getUpcomingCalendarEvents(
  tokens: GoogleCalendarTokens,
  options: {
    timeMin?: string;
    maxResults?: number;
  } = {},
): Promise<{ events: GoogleCalendarEvent[]; refreshedTokens?: GoogleCalendarTokens }> {
  let activeAccessToken = tokens.access_token;
  let refreshedTokens: GoogleCalendarTokens | undefined;

  // Si el token expiró y hay un refresh_token, renovarlo automáticamente
  const isExpired = tokens.expiry_date ? Date.now() >= tokens.expiry_date - 60000 : false;
  if ((!activeAccessToken || isExpired) && tokens.refresh_token) {
    refreshedTokens = await refreshAccessToken(tokens.refresh_token);
    activeAccessToken = refreshedTokens.access_token;
  }

  if (!activeAccessToken) {
    throw new Error('No hay access_token disponible para consultar los eventos.');
  }

  const timeMin = options.timeMin || new Date().toISOString();
  const maxResults = options.maxResults ?? 50;

  const params = new URLSearchParams({
    timeMin,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${activeAccessToken}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data.error?.message || 'Error al consultar eventos en Google Calendar.';
    throw new Error(message);
  }

  interface RawGoogleEventItem {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
    status?: string;
  }

  const rawEvents: RawGoogleEventItem[] = data.items || [];

  const events: GoogleCalendarEvent[] = rawEvents.map((item) => {
    const isAllDay = !item.start?.dateTime && !!item.start?.date;
    const start = item.start?.dateTime || item.start?.date || '';
    const end = item.end?.dateTime || item.end?.date || '';

    return {
      id: item.id || '',
      summary: item.summary || '(Sin título)',
      description: item.description || null,
      location: item.location || null,
      start,
      end,
      isAllDay,
      htmlLink: item.htmlLink || null,
      status: item.status || null,
    };
  });

  return { events, refreshedTokens };
}

/**
 * Cifrado AES-256-GCM para almacenamiento seguro de tokens en cookies (Zero-Trust).
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'fallback-encryption-secret-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptTokens(tokens: GoogleCalendarTokens): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonStr = JSON.stringify(tokens);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Formato: iv:authTag:encrypted (en base64url)
  const combined = `${iv.toString('hex')}:${authTag}:${encrypted}`;
  return Buffer.from(combined, 'utf8').toString('base64url');
}

export function decryptTokens(cipherText: string): GoogleCalendarTokens | null {
  try {
    const combined = Buffer.from(cipherText, 'base64url').toString('utf8');
    const [ivHex, authTagHex, encryptedHex] = combined.split(':');

    if (!ivHex || !authTagHex || !encryptedHex) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as GoogleCalendarTokens;
  } catch {
    return null;
  }
}
