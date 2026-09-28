'use client';

import { useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTourContext } from '@/contexts/TourContext';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

export function useAnalyticsTour() {
  const { registerTour } = useTourContext();
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;

  const startTour = useCallback(() => {
    if (typeof window === 'undefined') return;
    const t = (spanish: string, english: string) => (locale === 'es' ? spanish : english);

    const steps: DriveStep[] = [
      {
        element: '#tour-analytics-tabs',
        popover: {
          title: t('Métricas disponibles', 'Available metrics'),
          description: t(
            'Navega entre diferentes vistas para analizar tu progreso, carga de trabajo, prioridades y fechas de entrega.',
            'Switch views to analyze your progress, workload, priorities, and deadlines.',
          ),
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#exportable-chart-area',
        popover: {
          title: t('Tus datos visualizados', 'Your data visualized'),
          description: t(
            'Aquí verás el detalle gráfico de la métrica seleccionada. Pasa el cursor sobre los elementos para obtener más información puntual.',
            'See a visual breakdown of the selected metric here. Hover over elements for more details.',
          ),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-analytics-ai',
        popover: {
          title: t('Consultar a la IA', 'Ask the AI'),
          description: t(
            'Si tienes dudas sobre tus números o no sabes qué priorizar, puedes iniciar un chat con Komo pasándole exactamente el contexto de esta gráfica.',
            'If you have questions about your data or what to prioritize, start a chat with Komo using this chart’s context.',
          ),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#tour-analytics-actions',
        popover: {
          title: t('Exportar reporte', 'Export report'),
          description: t(
            'Usa este menú para descargar tu gráfica como imagen o exportar los datos en formato CSV para un registro externo.',
            'Use this menu to download your chart as an image or export data as a CSV file.',
          ),
          side: 'left',
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
