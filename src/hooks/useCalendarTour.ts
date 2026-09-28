'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

export function useCalendarTour(view: 'month' | 'week') {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

    const stepsMonth: DriveStep[] = [
      {
        element: '#tour-calendar-integrations',
        popover: {
          title: t('Sincronización', 'Synchronization'),
          description: t(
            'Puedes conectar tu cuenta de Google Calendar para importar tus eventos automáticamente.',
            'Connect your Google Calendar account to import events automatically.',
          ),
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-calendar-month-grid',
        popover: {
          title: t('Selecciona un mes', 'Choose a month'),
          description: t(
            'Haz clic en cualquier mes disponible para entrar a la vista semanal y configurar tus bloques de estudio o trabajo.',
            'Click any available month to open the weekly view and set up study or work blocks.',
          ),
          side: 'top',
          align: 'center',
        },
      },
    ];

    const stepsWeek: DriveStep[] = [
      {
        element: '#tour-calendar-ai-upload',
        popover: {
          title: t('Horario mágico (IA)', 'Smart schedule (AI)'),
          description: t(
            'Sube una foto o PDF de tu horario de clases o trabajo. La IA extraerá los bloques y los colocará en tu calendario por ti.',
            'Upload a photo or PDF of your class or work schedule. The AI will extract the blocks and add them to your calendar.',
          ),
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-calendar-replicate',
        popover: {
          title: t('Replicar horario', 'Copy schedule'),
          description: t(
            'Una vez que armes una semana ideal, usa este botón para copiarla al resto del mes o año. ¡No tienes que hacer todo manualmente!',
            'Once you create an ideal week, use this button to copy it to the rest of the month or year.',
          ),
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#tour-calendar-week-grid',
        popover: {
          title: t('Crear bloques', 'Create blocks'),
          description: t(
            'Haz un clic para indicar la hora de inicio y otro clic para indicar el fin de tu bloque. Al cerrar el bloque, aparecerá un menú flotante para elegir el color.',
            'Click once for the start time and again for the end of a block. When you close it, a menu appears to choose its color.',
          ),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-calendar-legend',
        popover: {
          title: t('Tipos de actividad', 'Activity types'),
          description: t(
            'Estas son las categorías disponibles. Puedes colorear tu horario según el tipo de actividad para tener una vista rápida.',
            'These are the available categories. You can color your schedule by activity type for a quick visual overview.',
          ),
          side: 'top',
          align: 'center',
        },
      },
    ];

    const driverObj = driver({
      popoverClass: 'komorebi-tour-popover',
      showProgress: true,
      steps: view === 'month' ? stepsMonth : stepsWeek,
      nextBtnText: t('Siguiente', 'Next'),
      prevBtnText: t('Anterior', 'Previous'),
      doneBtnText: t('Entendido', 'Done'),
      progressText: locale === 'es' ? '{{current}} de {{total}}' : '{{current}} of {{total}}',
    });

    driverObj.drive();
  }, [view, locale]);

  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
