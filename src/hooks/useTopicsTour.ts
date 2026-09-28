'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

export function useTopicsTour(isEmpty: boolean) {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

    const stepsEmpty: DriveStep[] = [
      {
        element: '#tour-topics-empty',
        popover: {
          title: t('Tu biblioteca de temas', 'Your topic library'),
          description: t(
            'Aquí puedes organizar toda la información que necesitas estudiar. Empieza creando tu primer tema para agrupar tus apuntes, PDFs y enlaces.',
            'Organize everything you need to study here. Start by creating a topic to group your notes, PDFs, and links.',
          ),
          side: 'bottom',
          align: 'center',
        },
      },
    ];

    const stepsTopics: DriveStep[] = [
      {
        element: '#tour-topics-sidebar',
        popover: {
          title: t('Lista de temas', 'Topic list'),
          description: t(
            'Navega rápidamente entre todos tus temas de estudio o busca uno en específico.',
            'Quickly browse all your study topics or search for a specific one.',
          ),
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '#tour-topics-note',
        popover: {
          title: t('Nota principal y contexto', 'Main note and context'),
          description: t(
            'Usa este espacio para escribir resúmenes o ideas clave. A la derecha podrás ver cuántas fuentes están alimentando a la IA.',
            'Use this space for summaries or key ideas. On the right, you can see how many sources are informing the AI.',
          ),
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tour-topics-sources',
        popover: {
          title: t('Tus fuentes de información', 'Your information sources'),
          description: t(
            'Sube PDFs, añade enlaces web o crea notas sueltas. Actívalas para que la IA las tome en cuenta al generar tareas o responder preguntas.',
            'Upload PDFs, add web links, or create notes. Enable them so the AI can use them when generating tasks or answering questions.',
          ),
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#tour-topics-projects',
        popover: {
          title: t('Vincular a proyectos', 'Link to projects'),
          description: t(
            'Puedes conectar este tema a uno o más proyectos para que su asistente de IA utilice toda esta información automáticamente.',
            'Link this topic to one or more projects so their AI assistant can automatically use this information.',
          ),
          side: 'top',
          align: 'start',
        },
      },
    ];

    const driverObj = driver({
      popoverClass: 'komorebi-tour-popover',
      showProgress: true,
      steps: isEmpty ? stepsEmpty : stepsTopics,
      nextBtnText: t('Siguiente', 'Next'),
      prevBtnText: t('Anterior', 'Previous'),
      doneBtnText: t('Entendido', 'Done'),
      progressText: locale === 'es' ? '{{current}} de {{total}}' : '{{current}} of {{total}}',
    });

    driverObj.drive();
  }, [isEmpty, locale]);

  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
