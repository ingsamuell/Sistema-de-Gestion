import { NextResponse } from 'next/server';
import { runStreakExpiredJob } from '@/services/notifications/jobs/streakExpiredJob';

export async function POST() {
  try {
    const summary = await runStreakExpiredJob();
    return NextResponse.json({
      success: true,
      enviados: summary.enviados,
      omitidos: summary.omitidos,
      errores: summary.errores,
      detalles: summary.detalles,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[route:notify-streak-expired] Error ejecutando job:', error);
    return NextResponse.json(
      { success: false, error: msg, enviados: 0, omitidos: 0, errores: 1 },
      { status: 500 },
    );
  }
}
