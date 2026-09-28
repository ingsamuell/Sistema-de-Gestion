import { NextResponse } from 'next/server';
import { runProjects7DaysJob } from '@/services/notifications/jobs/projects7DaysJob';

export async function POST() {
  try {
    const summary = await runProjects7DaysJob();
    return NextResponse.json({
      success: true,
      enviados: summary.enviados,
      omitidos: summary.omitidos,
      errores: summary.errores,
      detalles: summary.detalles,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error inesperado';
    console.error('[route:notify-projects-7days] Error ejecutando job:', error);
    return NextResponse.json(
      { success: false, error: msg, enviados: 0, omitidos: 0, errores: 1 },
      { status: 500 },
    );
  }
}
