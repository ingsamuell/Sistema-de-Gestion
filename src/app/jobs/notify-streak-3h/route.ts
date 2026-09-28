import { NextResponse } from 'next/server';
import { runStreak3hJob } from '@/services/notifications/jobs/streak3hJob';

export async function POST() {
  try {
    const summary = await runStreak3hJob();
    return NextResponse.json({
      success: true,
      enviados: summary.enviados,
      omitidos: summary.omitidos,
      errores: summary.errores,
      detalles: summary.detalles,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[route:notify-streak-3h] Error ejecutando job:', error);
    return NextResponse.json(
      { success: false, error: msg, enviados: 0, omitidos: 0, errores: 1 },
      { status: 500 },
    );
  }
}
