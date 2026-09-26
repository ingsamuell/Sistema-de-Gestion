'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';

export function useCalendarTour(view: 'month' | 'week') {
  const { registerTour } = useTourContext();

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;

    const stepsMonth: DriveStep[] = [
      {
        element: '#tour-calendar-integrations',
        popover: {
          title: 'Sincronización',
          description:
            'Puedes conectar tu cuenta de Google Calendar para importar tus eventos automáticamente.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-calendar-month-grid',
        popover: {
          title: 'Selecciona un mes',
          description:
            'Haz clic en cualquier mes disponible para entrar a la vista semanal y configurar tus bloques de estudio o trabajo.',
          side: 'top',
          align: 'center',
        },
      },
    ];

    const stepsWeek: DriveStep[] = [
      {
        element: '#tour-calendar-ai-upload',
        popover: {
          title: 'Horario Mágico (IA)',
          description:
            'Sube una foto o PDF de tu horario de clases o trabajo. La IA extraerá los bloques y los colocará en tu calendario por ti.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-calendar-replicate',
        popover: {
          title: 'Replicar Horario',
          description:
            'Una vez que armes una semana ideal, usa este botón para copiarla al resto del mes o año. ¡No tienes que hacer todo manualmente!',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-calendar-week-grid',
        popover: {
          title: 'Crear Bloques',
          description:
            'Haz un clic para indicar la hora de inicio y otro clic para indicar el fin de tu bloque. Al cerrar el bloque, aparecerá un menú flotante para elegir el color.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-calendar-legend',
        popover: {
          title: 'Tipos de Actividad',
          description:
            'Estas son las categorías disponibles. Puedes colorear tu horario según el tipo de actividad para tener un control visual rápido.',
          side: 'top',
          align: 'center',
        },
      },
    ];

    const driverObj = driver({
      showProgress: true,
      steps: view === 'month' ? stepsMonth : stepsWeek,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendido',
      progressText: '{{current}} de {{total}}',
    });

    driverObj.drive();
  }, [view]);

  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
