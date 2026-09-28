'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

export function useProjectsTour(isEmpty: boolean) {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

    const stepsEmpty: DriveStep[] = [
      {
        element: '#tour-empty-create',
        popover: {
          title: t('Crea tu primer proyecto', 'Create your first project'),
          description: t(
            'Los proyectos son como carpetas o espacios de trabajo donde organizarás tus tareas. Haz clic aquí para crear el primero.',
            'Projects are workspaces where you organize your tasks. Click here to create your first one.',
          ),
          side: 'bottom',
          align: 'center',
        },
      },
    ];

    const stepsGrid: DriveStep[] = [
      {
        element: '#tour-project-card',
        popover: {
          title: t('Tus proyectos', 'Your projects'),
          description: t(
            'Aquí verás todos tus proyectos activos. Cada tarjeta te muestra el progreso y la cantidad de tareas pendientes. Haz clic en una para ver sus detalles.',
            'Here you can see all your active projects. Each card shows progress and pending tasks; open one to see its details.',
          ),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-project-create',
        popover: {
          title: t('Nuevo proyecto', 'New project'),
          description: t(
            'Usa esta tarjeta para agregar rápidamente un nuevo proyecto en cualquier momento.',
            'Use this card to quickly add a new project whenever you need one.',
          ),
          side: 'top',
          align: 'center',
        },
      },
    ];

    const driverObj = driver({
      popoverClass: 'komorebi-tour-popover',
      showProgress: true,
      steps: isEmpty ? stepsEmpty : stepsGrid,
      nextBtnText: t('Siguiente', 'Next'),
      prevBtnText: t('Anterior', 'Previous'),
      doneBtnText: t('Entendido', 'Done'),
      progressText: locale === 'es' ? '{{current}} de {{total}}' : '{{current}} of {{total}}',
    });

    driverObj.drive();
  }, [isEmpty, locale]);

  // Register the tour with the global context whenever it changes
  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
