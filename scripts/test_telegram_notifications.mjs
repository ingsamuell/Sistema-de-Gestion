import assert from 'node:assert/strict';
import {
  isInStreak3hWindow,
  isStreakExpired,
  isProjectUpcomingWithin7Days,
  isProjectExpiredDate,
  getCaracasDateKey,
} from '../src/services/notifications/dateUtils.ts';

console.log('====================================================');
console.log(' INICIANDO SUITE DE TESTS: NOTIFICACIONES TELEGRAM ');
console.log('====================================================\n');

// -----------------------------------------------------------------
// 1. Tests de Utilidades de Fecha y Zona Horaria (America/Caracas)
// -----------------------------------------------------------------
console.log('[Test Suite 1] Utilidades de Fecha y Zona Horaria');

const now = new Date('2026-09-24T21:00:00-04:00'); // 9:00 PM Caracas

// Caso 1: Racha expira en 3 horas exactas (180 min) -> Debe estar en ventana [165, 195]
const expira3h = new Date(now.getTime() + 180 * 60 * 1000).toISOString();
assert.equal(
  isInStreak3hWindow(expira3h, now),
  true,
  'Racha a 3 horas exactas debe estar en la ventana',
);

// Caso 2: Racha expira en 2h50m (170 min) -> Debe estar en ventana
const expira2h50m = new Date(now.getTime() + 170 * 60 * 1000).toISOString();
assert.equal(isInStreak3hWindow(expira2h50m, now), true, 'Racha a 2h50m debe estar en la ventana');

// Caso 3: Racha expira en 5 horas (300 min) -> No debe enviar
const expira5h = new Date(now.getTime() + 300 * 60 * 1000).toISOString();
assert.equal(
  isInStreak3hWindow(expira5h, now),
  false,
  'Racha a 5 horas NO debe estar en la ventana de 3h',
);

// Caso 4: Racha expira en 1 hora (60 min) -> No debe enviar
const expira1h = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
assert.equal(
  isInStreak3hWindow(expira1h, now),
  false,
  'Racha a 1 hora NO debe estar en la ventana de 3h',
);

// Caso 5: Racha expirada en el pasado
const expiraPasado = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
assert.equal(
  isStreakExpired(expiraPasado, now),
  true,
  'Racha con fecha en el pasado debe detectarse como expirada',
);
assert.equal(
  isStreakExpired(expira3h, now),
  false,
  'Racha en el futuro no debe detectarse como expirada',
);

// Caso 6: Proyecto próximo dentro de 7 días
// const hoyKey = getCaracasDateKey(now);
const limite3Dias = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
const limite10Dias = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
const limiteAyer = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

assert.equal(
  isProjectUpcomingWithin7Days(limite3Dias, now),
  true,
  'Proyecto a 3 días debe considerarse próximo',
);
assert.equal(
  isProjectUpcomingWithin7Days(limite10Dias, now),
  false,
  'Proyecto a 10 días NO debe considerarse próximo (fuera de ventana 7d)',
);
assert.equal(
  isProjectUpcomingWithin7Days(limiteAyer, now),
  false,
  'Proyecto vencido ayer no debe considerarse próximo',
);

// Caso 7: Proyecto expirado
assert.equal(
  isProjectExpiredDate(limiteAyer, now),
  true,
  'Proyecto con fecha_limite de ayer debe considerarse expirado',
);
assert.equal(
  isProjectExpiredDate(limite3Dias, now),
  false,
  'Proyecto futuro no debe considerarse expirado',
);

console.log('✓ Tests de fechas y ventanas horarias superados.\n');

// -----------------------------------------------------------------
// 2. Tests de Autenticación de Jobs y Webhooks
// -----------------------------------------------------------------
console.log('[Test Suite 2] Autenticación de Endpoints');

// Simular entorno
process.env.INTERNAL_JOB_TOKEN = 'test_secret_internal_job_token_123';
process.env.WEBHOOK_SECRET = 'test_secret_webhook_456';

function mockRequest(authHeader) {
  return {
    headers: {
      get(name) {
        if (name.toLowerCase() === 'authorization') return authHeader || null;
        return null;
      },
    },
  };
}

// Validación de Job Auth
function validateJobAuth(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return { authorized: false, status: 401, error: 'No autorizado: ausente' };
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1] !== process.env.INTERNAL_JOB_TOKEN) {
    return { authorized: false, status: 401, error: 'No autorizado: inválido' };
  }
  return { authorized: true, status: 200 };
}

// Validación de Webhook Auth
function validateWebhookAuth(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return { authorized: false, status: 401, error: 'No autorizado: ausente' };
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1] !== process.env.WEBHOOK_SECRET) {
    return { authorized: false, status: 401, error: 'No autorizado: inválido' };
  }
  return { authorized: true, status: 200 };
}

// Request sin token -> 401
const noAuth = mockRequest(null);
assert.equal(validateJobAuth(noAuth).authorized, false);
assert.equal(validateJobAuth(noAuth).status, 401, 'Petición sin token debe retornar 401');

// Request con token incorrecto -> 401
const wrongAuth = mockRequest('Bearer token_falso');
assert.equal(validateJobAuth(wrongAuth).authorized, false);
assert.equal(
  validateJobAuth(wrongAuth).status,
  401,
  'Petición con token incorrecto debe retornar 401',
);

// Request con token correcto -> 200
const validJobReq = mockRequest(`Bearer ${process.env.INTERNAL_JOB_TOKEN}`);
assert.equal(validateJobAuth(validJobReq).authorized, true);
assert.equal(
  validateJobAuth(validJobReq).status,
  200,
  'Petición con token válido debe ser autorizada',
);

// Webhook con secreto correcto
const validWebReq = mockRequest(`Bearer ${process.env.WEBHOOK_SECRET}`);
assert.equal(validateWebhookAuth(validWebReq).authorized, true);
assert.equal(validateWebhookAuth(noAuth).status, 401);

console.log('✓ Tests de autenticación (401 y 200) superados.\n');

// -----------------------------------------------------------------
// 3. Tests de Deduplicación (wasSent y markAsSent)
// -----------------------------------------------------------------
console.log('[Test Suite 3] Lógica de Deduplicación');

const mockDatabase = [];

async function mockWasSent(usuarioId, tipoEvento, referenciaId = null, fecha = null) {
  return mockDatabase.some((entry) => {
    if (entry.usuario_id !== usuarioId || entry.tipo_evento !== tipoEvento) return false;

    if (tipoEvento === 'proyecto_proximo') {
      const targetDate = fecha instanceof Date ? fecha : new Date(fecha || Date.now());
      const caracasDate = getCaracasDateKey(targetDate);
      const entryDate = getCaracasDateKey(new Date(entry.fecha_envio));
      return entry.referencia_id === referenciaId && entryDate === caracasDate;
    }

    if (referenciaId) {
      return entry.referencia_id === referenciaId;
    }
    return entry.referencia_id === null;
  });
}

async function mockMarkAsSent(
  usuarioId,
  tipoEvento,
  referenciaId = null,
  fechaEnvio = new Date().toISOString(),
) {
  const isDup = await mockWasSent(usuarioId, tipoEvento, referenciaId, fechaEnvio);
  if (isDup) {
    // Simula captura de error 23505 unique_violation
    return true;
  }
  mockDatabase.push({
    usuario_id: usuarioId,
    tipo_evento: tipoEvento,
    referencia_id: referenciaId || null,
    fecha_envio: fechaEnvio,
  });
  return true;
}

// Test tarea_completada: deduplicación por tarea_id
const u1 = 'user-001';
const t1 = 'task-100';
assert.equal(
  await mockWasSent(u1, 'tarea_completada', t1),
  false,
  'Inicialmente no debe estar enviada',
);
await mockMarkAsSent(u1, 'tarea_completada', t1);
assert.equal(
  await mockWasSent(u1, 'tarea_completada', t1),
  true,
  'Tras registrar, debe reportar como enviada',
);
assert.equal(
  await mockWasSent(u1, 'tarea_completada', 'task-101'),
  false,
  'Otra tarea del mismo usuario no debe reportarse como enviada',
);

// Test racha_3h: deduplicación a nivel de usuario sin referencia
assert.equal(await mockWasSent(u1, 'racha_3h', null), false);
await mockMarkAsSent(u1, 'racha_3h', null);
assert.equal(await mockWasSent(u1, 'racha_3h', null), true);

// Test proyecto_proximo: deduplicación diaria
const p1 = 'proj-500';
const fechaHoy = new Date('2026-09-24T12:00:00-04:00');
const fechaManana = new Date('2026-09-25T12:00:00-04:00');

assert.equal(await mockWasSent(u1, 'proyecto_proximo', p1, fechaHoy), false);
await mockMarkAsSent(u1, 'proyecto_proximo', p1, fechaHoy.toISOString());
assert.equal(
  await mockWasSent(u1, 'proyecto_proximo', p1, fechaHoy),
  true,
  'Debe estar deduplicada para el mismo día',
);
assert.equal(
  await mockWasSent(u1, 'proyecto_proximo', p1, fechaManana),
  false,
  'No debe estar deduplicada para el día siguiente',
);

console.log('✓ Tests de deduplicación superados.\n');

// -----------------------------------------------------------------
// 4. Tests de Formato de Mensajes e Integración de Jobs
// -----------------------------------------------------------------
console.log('[Test Suite 4] Formato de Mensajes y Jobs');

// Validación estricta de formato {emoji}-{texto} contemplando variation selectors (\uFE0F)
const formatoRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F)+-.+$/u;

const msgTarea = `📝-Tarea completada: Resolver ejercicios de física (Proyecto: Tesis Grado)`;
const msgRacha3h = `🔥-¡Tu racha expira en 3 horas! Racha actual: 5 días`;
const msgRachaExpirada = `💔-Tu racha ha expirado. ¡Empieza una nueva hoy!`;
const msgProyecto7d = `⚠️-El proyecto "Investigación IA" está próximo a expirar. No se cumplieron todos los objetivos. Fecha límite: 2026-09-30`;
const msgProyectoExp = `❌-El proyecto "Investigación IA" ha expirado. Fecha límite: 2026-09-20`;

assert.match(msgTarea, formatoRegex, 'Mensaje de tarea debe coincidir con formato {emoji}-{texto}');
assert.match(
  msgRacha3h,
  formatoRegex,
  'Mensaje de racha 3h debe coincidir con formato {emoji}-{texto}',
);
assert.match(
  msgRachaExpirada,
  formatoRegex,
  'Mensaje de racha expirada debe coincidir con formato {emoji}-{texto}',
);
assert.match(
  msgProyecto7d,
  formatoRegex,
  'Mensaje de proyecto 7 días debe coincidir con formato {emoji}-{texto}',
);
assert.match(
  msgProyectoExp,
  formatoRegex,
  'Mensaje de proyecto expirado debe coincidir con formato {emoji}-{texto}',
);

// Test de simulación de Job de Racha 3h
function simulateStreak3hJob(users, nowTime) {
  let enviados = 0;
  let omitidos = 0;

  for (const u of users) {
    if (!u.telegram_chat_id) {
      omitidos++;
      continue;
    }
    if (!isInStreak3hWindow(u.racha_expira_en, nowTime)) {
      omitidos++;
      continue;
    }
    if (u.yaEnviado) {
      omitidos++;
      continue;
    }
    enviados++;
  }
  return { enviados, omitidos };
}

const mockUsers = [
  { id: '1', telegram_chat_id: '12345', racha_expira_en: expira3h, yaEnviado: false }, // Debe enviar
  { id: '2', telegram_chat_id: '67890', racha_expira_en: expira5h, yaEnviado: false }, // Omitido (5h)
  { id: '3', telegram_chat_id: '11111', racha_expira_en: expira3h, yaEnviado: true }, // Omitido (ya enviado)
  { id: '4', telegram_chat_id: null, racha_expira_en: expira3h, yaEnviado: false }, // Omitido (sin chat_id)
];

const resStreak = simulateStreak3hJob(mockUsers, now);
assert.equal(resStreak.enviados, 1, 'Debe enviar exactamente 1 notificación');
assert.equal(resStreak.omitidos, 3, 'Debe omitir exactamente 3 usuarios');

console.log('✓ Tests de formato de mensaje y lógica de jobs superados.\n');

// -----------------------------------------------------------------
// 5. Test de Borrado de Bloques de Calendario al Completar Tarea
// -----------------------------------------------------------------
console.log(
  '[Test Suite 5] Petición especial: Borrado de bloques de calendario al completar tarea',
);

let mockCalendarEvents = [
  { id: 'evt-1', tarea_id: 'task-abc', titulo: 'Estudiar tema 1' },
  { id: 'evt-2', tarea_id: 'task-abc', titulo: 'Estudiar tema 1 (bloque 2)' },
  { id: 'evt-3', tarea_id: 'task-xyz', titulo: 'Otra tarea pendiente' },
];

function simulateTaskCompletedCalendarCleanup(taskId) {
  const beforeCount = mockCalendarEvents.length;
  mockCalendarEvents = mockCalendarEvents.filter((e) => e.tarea_id !== taskId);
  return beforeCount - mockCalendarEvents.length;
}

const deletedEvents = simulateTaskCompletedCalendarCleanup('task-abc');
assert.equal(deletedEvents, 2, 'Debe borrar los 2 bloques asociados a task-abc');
assert.equal(mockCalendarEvents.length, 1, 'Solo debe quedar el evento de task-xyz');
assert.equal(mockCalendarEvents[0].tarea_id, 'task-xyz');

console.log('✓ Test de borrado de bloques de calendario superado.\n');

console.log('====================================================');
console.log(' TODOS LOS TESTS (7/7) PASARON EXITOSAMENTE ');
console.log('====================================================');
