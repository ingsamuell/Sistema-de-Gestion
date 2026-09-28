'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

export function useProjectDetailTour(isEmpty: boolean) {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

    const stepsEmpty: DriveStep[] = [
      {
        element: '#tour-project-header',
        popover: {
          title: t('Detalles del proyecto', 'Project details'),
          description: t(
            'Aquí puedes ver el progreso de tu proyecto, editar sus detalles o modificar la fecha límite en cualquier momento.',
            'View project progress, edit its details, or update the deadline at any time.',
          ),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-project-add-task-empty',
        popover: {
          title: t('Plan de acción', 'Action plan'),
          description: t(
            'Tu proyecto necesita tareas para avanzar. Puedes agregarlas manualmente o dejar que nuestra IA analice tus apuntes y cree las tareas por ti.',
            'Your project needs tasks to move forward. Add them manually or let the AI analyze your notes and create them for you.',
          ),
          side: 'top',
          align: 'center',
        },
      },
    ];

    const stepsTasks: DriveStep[] = [
      {
        element: '#tour-project-header',
        popover: {
          title: t('Detalles del proyecto', 'Project details'),
          description: t(
            'Aquí verás cómo la barra de progreso se llena automáticamente a medida que completas tus tareas.',
            'Watch the progress bar fill automatically as you complete tasks.',
          ),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-project-task-list',
        popover: {
          title: t('Tus tareas', 'Your tasks'),
          description: t(
            'Esta es tu lista de tareas activas. Puedes marcarlas como completadas, editarlas o eliminarlas.',
            'This is your active task list. You can mark tasks complete, edit, or delete them.',
          ),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-project-add-task',
        popover: {
          title: t('Más tareas', 'More tasks'),
          description: t(
            'Agrega nuevas tareas en cualquier momento o pide ayuda a la IA para expandir tu plan de estudio.',
            'Add tasks whenever you need them, or ask the AI to expand your study plan.',
          ),
          side: 'top',
          align: 'center',
        },
      },
    ];

    const driverObj = driver({
      popoverClass: 'komorebi-tour-popover',
      showProgress: true,
      steps: isEmpty ? stepsEmpty : stepsTasks,
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
