'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

const HAS_SEEN_HOME_TOUR_KEY = 'komorebi_has_seen_home_tour';

export function useOnboardingTour() {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(
    (force = false) => {
      if (typeof window === 'undefined') return;
      const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

      if (!force) {
        const hasSeenTour = localStorage.getItem(HAS_SEEN_HOME_TOUR_KEY);
        if (hasSeenTour) return;
      }

      const steps: DriveStep[] = [
        {
          element: '#tour-greeting',
          popover: {
            title: t('¡Bienvenido a Komorebi!', 'Welcome to Komorebi!'),
            description: t(
              'Este es tu centro de operaciones. Aquí verás un resumen rápido de tu día, incluyendo cuántas tareas pendientes tienes, para que te organices mejor.',
              'This is your operations center. See a quick summary of your day, including pending tasks, to organize yourself better.',
            ),
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '#tour-calendar',
          popover: {
            title: t('Sincronización inteligente', 'Smart synchronization'),
            description: t(
              'Conecta tu Google Calendar desde aquí. Sincronizaremos tus bloques de estudio en tiempo real para mantener tu agenda al día.',
              'Connect Google Calendar here. We will synchronize your study blocks in real time to keep your schedule current.',
            ),
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: '#tour-metrics',
          popover: {
            title: t('Métricas y gamificación', 'Metrics and gamification'),
            description: t(
              'Mantén tu racha activa y monitorea tu rendimiento. Entre más estudies, mejores estadísticas tendrás.',
              'Keep your streak active and monitor your performance. The more you study, the better your stats become.',
            ),
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '#tour-tasks',
          popover: {
            title: t('Tareas y modo enfoque', 'Tasks and focus mode'),
            description: t(
              'Tus tareas para hoy aparecerán aquí. Haz clic en el botón de “Enfocar” al lado de cualquier tarea para iniciar una sesión de estudio profunda (por ejemplo, Pomodoro).',
              'Your tasks for today appear here. Select “Focus” beside any task to start a deep study session, such as Pomodoro.',
            ),
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '#tour-bot',
          popover: {
            title: t('Asistente de IA (bot de Komorebi)', 'AI assistant (Komorebi bot)'),
            description: t(
              'Comunícate con nuestro bot de Telegram directamente desde aquí. Por ahora puedes usarlo para crear nuevos Temas y Proyectos con IA. ¡Lo estamos mejorando continuamente para darte una experiencia increíble!',
              'Message our Telegram bot directly from here. You can currently use it to create new AI-assisted topics and projects.',
            ),
            side: 'left',
            align: 'end',
          },
        },
        {
          element: window.innerWidth < 768 ? '#tour-mobile-nav' : '#tour-sidebar',
          popover: {
            title: t('Explora más', 'Explore more'),
            description: t(
              'Desde aquí puedes crear nuevos Proyectos, organizar tus Temas, o revisar la Analítica de tu estudio. ¡Estás listo para empezar!',
              'From here you can create projects, organize topics, or review your study analytics. You are ready to begin!',
            ),
            side: window.innerWidth < 768 ? 'top' : 'right',
            align: 'start',
          },
        },
      ];

      const driverObj = driver({
        popoverClass: 'komorebi-tour-popover',
        showProgress: true,
        steps,
        nextBtnText: t('Siguiente', 'Next'),
        prevBtnText: t('Anterior', 'Previous'),
        doneBtnText: t('Entendido', 'Done'),
        progressText: locale === 'es' ? '{{current}} de {{total}}' : '{{current}} of {{total}}',
        onDestroyStarted: () => {
          if (
            !driverObj.hasNextStep() ||
            confirm(
              t(
                '¿Seguro que quieres salir del tutorial?',
                'Are you sure you want to leave the tutorial?',
              ),
            )
          ) {
            localStorage.setItem(HAS_SEEN_HOME_TOUR_KEY, 'true');
            driverObj.destroy();
          }
        },
      });

      driverObj.drive();
    },
    [locale],
  );

  // Register the tour with the global context whenever it changes
  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
