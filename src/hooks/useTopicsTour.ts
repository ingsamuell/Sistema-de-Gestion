'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';

export function useTopicsTour(isEmpty: boolean) {
  const { registerTour } = useTourContext();

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;

    const stepsEmpty: DriveStep[] = [
      {
        element: '#tour-topics-empty',
        popover: {
          title: 'Tu Biblioteca de Temas',
          description:
            'Aquí puedes organizar toda la información que necesitas estudiar. Empieza creando tu primer tema para agrupar tus apuntes, PDFs y enlaces.',
          side: 'bottom',
          align: 'center',
        },
      },
    ];

    const stepsTopics: DriveStep[] = [
      {
        element: '#tour-topics-sidebar',
        popover: {
          title: 'Lista de Temas',
          description:
            'Navega rápidamente entre todos tus temas de estudio o busca uno en específico.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '#tour-topics-note',
        popover: {
          title: 'Nota Principal y Contexto',
          description:
            'Usa este espacio para escribir resúmenes o ideas clave. A la derecha podrás ver cuántas fuentes están alimentando a la IA.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tour-topics-sources',
        popover: {
          title: 'Tus Fuentes de Información',
          description:
            'Sube PDFs, añade enlaces web o crea notas sueltas. Actívalas para que la IA las tome en cuenta al generar tareas o responder preguntas.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tour-topics-projects',
        popover: {
          title: 'Vincular a Proyectos',
          description:
            'Puedes conectar este tema a uno o más proyectos para que su asistente de IA utilice toda esta información automáticamente.',
          side: 'top',
          align: 'start',
        },
      },
    ];

    const driverObj = driver({
      showProgress: true,
      steps: isEmpty ? stepsEmpty : stepsTopics,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendido',
      progressText: '{{current}} de {{total}}',
    });

    driverObj.drive();
  }, [isEmpty]);

  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
