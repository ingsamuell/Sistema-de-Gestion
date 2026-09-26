'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';

export function useIATour() {
  const { registerTour } = useTourContext();

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;

    const steps: DriveStep[] = [
      {
        element: '#tour-ia-input',
        popover: {
          title: 'Asistente IA Komo',
          description:
            'Escribe aquí tus consultas. Puedes pedirle que cree tareas por ti o darle clic al clip de papel para subir PDFs o documentos que necesites que analice.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-ia-history',
        popover: {
          title: 'Tus Conversaciones',
          description:
            'Komo guarda el historial de todo lo que han hablado para que puedas continuar cualquier tema pendiente.',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '#tour-ia-new-chat',
        popover: {
          title: 'Nuevo Chat',
          description:
            'Si necesitas empezar un tema nuevo sin arrastrar el contexto anterior, presiona este botón.',
          side: 'bottom',
          align: 'end',
        },
      },
    ];

    const driverObj = driver({
      showProgress: true,
      steps: steps,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendido',
      progressText: '{{current}} de {{total}}',
    });

    driverObj.drive();
  }, []);

  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
