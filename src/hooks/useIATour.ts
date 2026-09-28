'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

export function useIATour() {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

    const steps: DriveStep[] = [
      {
        element: '#tour-ia-input',
        popover: {
          title: t('Asistente IA Komo', 'Komo AI assistant'),
          description: t(
            'Escribe aquí tus consultas. Puedes pedirle que cree tareas por ti o darle clic al clip de papel para subir PDFs o documentos que necesites que analice.',
            'Write your questions here. You can ask Komo to create tasks for you or use the paperclip to upload PDFs and documents for analysis.',
          ),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-ia-history',
        popover: {
          title: t('Tus conversaciones', 'Your conversations'),
          description: t(
            'Komo guarda el historial de todo lo que han hablado para que puedas continuar cualquier tema pendiente.',
            'Komo saves your conversation history so you can continue any unfinished topic.',
          ),
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '#tour-ia-new-chat',
        popover: {
          title: t('Nuevo chat', 'New chat'),
          description: t(
            'Si necesitas empezar un tema nuevo sin arrastrar el contexto anterior, presiona este botón.',
            'Use this button to start a new topic without carrying over the previous context.',
          ),
          side: 'bottom',
          align: 'end',
        },
      },
    ];

    const driverObj = driver({
      popoverClass: 'komorebi-tour-popover',
      showProgress: true,
      steps: steps,
      nextBtnText: t('Siguiente', 'Next'),
      prevBtnText: t('Anterior', 'Previous'),
      doneBtnText: t('Entendido', 'Done'),
      progressText: locale === 'es' ? '{{current}} de {{total}}' : '{{current}} of {{total}}',
    });

    driverObj.drive();
  }, [locale]);

  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
