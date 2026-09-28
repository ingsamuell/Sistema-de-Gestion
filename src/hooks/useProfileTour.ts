'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

export function useProfileTour() {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

    const steps: DriveStep[] = [
      {
        element: '#tour-profile-identity',
        popover: {
          title: t('Tu identidad en Komorebi', 'Your identity in Komorebi'),
          description: t(
            'Aquí puedes personalizar tu nombre, nombre de usuario y foto de perfil. Toca “Editar” para ajustar esta información y tus ajustes de seguridad de la cuenta.',
            'Personalize your name, username, and profile photo here. Select “Edit” to update this information and your account security settings.',
          ),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#tour-profile-learning',
        popover: {
          title: t('Preferencias de aprendizaje', 'Learning preferences'),
          description: t(
            'Ajusta tu metodología, ritmo, áreas prioritarias y disponibilidad. Usamos esta información para adaptar las sugerencias de Komo a tu estilo de estudio.',
            'Adjust your method, pace, priority areas, and availability. Komo uses this information to adapt suggestions to your study style.',
          ),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-profile-privacy',
        popover: {
          title: t('Términos y privacidad', 'Terms and privacy'),
          description: t(
            'Aquí puedes consultar las condiciones de uso de Komorebi y nuestra política de privacidad.',
            'Read Komorebi’s terms of use and privacy policy here.',
          ),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-profile-stats',
        popover: {
          title: t('Tu espacio de aprendizaje', 'Your learning space'),
          description: t(
            'Accesos directos a tus temas y proyectos, además de tu nivel actual, rachas de estudio e hitos desbloqueados.',
            'Shortcuts to your topics and projects, plus your current level, study streaks, and unlocked milestones.',
          ),
          side: 'top',
          align: 'center',
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
