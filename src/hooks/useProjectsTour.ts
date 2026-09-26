'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';

export function useProjectsTour(isEmpty: boolean) {
  const { registerTour } = useTourContext();

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;

    const stepsEmpty: DriveStep[] = [
      {
        element: '#tour-empty-create',
        popover: {
          title: 'Crea tu primer proyecto',
          description:
            'Los proyectos son como carpetas o espacios de trabajo donde organizarás tus tareas. Haz clic aquí para crear el primero.',
          side: 'bottom',
          align: 'center',
        },
      },
    ];

    const stepsGrid: DriveStep[] = [
      {
        element: '#tour-project-card',
        popover: {
          title: 'Tus Proyectos',
          description:
            'Aquí verás todos tus proyectos activos. Cada tarjeta te muestra el progreso y la cantidad de tareas pendientes. Haz clic en una para ver sus detalles.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-project-create',
        popover: {
          title: 'Nuevo Proyecto',
          description:
            'Usa esta tarjeta para agregar rápidamente un nuevo proyecto en cualquier momento.',
          side: 'top',
          align: 'center',
        },
      },
    ];

    const driverObj = driver({
      showProgress: true,
      steps: isEmpty ? stepsEmpty : stepsGrid,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendido',
      progressText: '{{current}} de {{total}}',
    });

    driverObj.drive();
  }, [isEmpty]);

  // Register the tour with the global context whenever it changes
  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
