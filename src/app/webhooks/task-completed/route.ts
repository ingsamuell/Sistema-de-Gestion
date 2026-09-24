import { NextResponse } from 'next/server';
import { validateWebhookAuth } from '@/services/notifications/auth';
import { runTaskCompletedJob, TaskCompletedPayload } from '@/services/notifications/jobs/taskCompletedJob';

export async function POST(request: Request) {
  const authCheck = validateWebhookAuth(request);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: authCheck.status },
    );
  }

  let body: TaskCompletedPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Cuerpo de la petición JSON inválido.' },
      { status: 400 },
    );
  }

  try {
    const summary = await runTaskCompletedJob(body);
    return NextResponse.json({
      success: true,
      enviados: summary.enviados,
      omitidos: summary.omitidos,
      errores: summary.errores,
      detalles: summary.detalles,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[route:webhooks/task-completed] Error procesando tarea completada:', error);
    return NextResponse.json(
      { success: false, error: msg, enviados: 0, omitidos: 0, errores: 1 },
      { status: 500 },
    );
  }
}
