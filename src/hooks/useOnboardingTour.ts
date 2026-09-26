'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';

const HAS_SEEN_HOME_TOUR_KEY = 'komorebi_has_seen_home_tour';

export function useOnboardingTour() {
  const { registerTour } = useTourContext();

  const startTour = useCallback((force = false) => {
    if (typeof window === 'undefined') return;

    if (!force) {
      const hasSeenTour = localStorage.getItem(HAS_SEEN_HOME_TOUR_KEY);
      if (hasSeenTour) return;
    }

    const steps: DriveStep[] = [
      {
        element: '#tour-greeting',
        popover: {
          title: '¡Bienvenido a Komorebi!',
          description:
            'Este es tu centro de operaciones. Aquí verás un resumen rápido de tu día, incluyendo cuántas tareas pendientes tienes, para que te organices mejor.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#tour-calendar',
        popover: {
          title: 'Sincronización Inteligente',
          description:
            'Conecta tu Google Calendar desde aquí. Sincronizaremos tus bloques de estudio en tiempo real para mantener tu agenda al día.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-metrics',
        popover: {
          title: 'Métricas y Gamificación',
          description:
            'Mantén tu racha activa y monitorea tu rendimiento. Entre más estudies, mejores estadísticas tendrás.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-tasks',
        popover: {
          title: 'Tareas y Modo Enfoque',
          description:
            'Tus tareas para hoy aparecerán aquí. Haz clic en el botón de "Enfocar" al lado de cualquier tarea para iniciar una sesión de estudio profunda (ej. Pomodoro).',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-bot',
        popover: {
          title: 'Asistente de IA (Komorebi Bot)',
          description:
            'Comunícate con nuestro bot de Telegram directamente desde aquí. Por ahora puedes usarlo para crear nuevos Temas y Proyectos con IA. ¡Lo estamos mejorando continuamente para darte una experiencia increíble!',
          side: 'left',
          align: 'end',
        },
      },
      {
        element: window.innerWidth < 768 ? '#tour-mobile-nav' : '#tour-sidebar',
        popover: {
          title: 'Explora más',
          description:
            'Desde aquí puedes crear nuevos Proyectos, organizar tus Temas, o revisar la Analítica de tu estudio. ¡Estás listo para empezar!',
          side: window.innerWidth < 768 ? 'top' : 'right',
          align: 'start',
        },
      },
    ];

    const driverObj = driver({
      showProgress: true,
      steps,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendido',
      progressText: '{{current}} de {{total}}',
      onDestroyStarted: () => {
        if (!driverObj.hasNextStep() || confirm('¿Seguro que quieres salir del tutorial?')) {
          localStorage.setItem(HAS_SEEN_HOME_TOUR_KEY, 'true');
          driverObj.destroy();
        }
      },
    });

    driverObj.drive();
  }, []);

  // Register the tour with the global context whenever it changes
  useEffect(() => {
    registerTour(startTour);
  }, [registerTour, startTour]);

  return { startTour };
}
