'use client';

import React from 'react';
import { OnboardingSurvey } from '@/features/onboarding/components/OnboardingSurvey';

export default function OnboardingDevPreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl font-bold text-red-600">Esta ruta sólo está disponible en modo desarrollo.</p>
      </div>
    );
  }

  const handleDevSubmit = async (answers: Record<number, string>) => {
    console.log('--- MODO DEV: Onboarding Completado ---');
    console.log('Respuestas simuladas a enviar:', answers);
    alert('Guardado en modo dev. Revisa la consola para ver las respuestas simuladas.');
    // No redirigimos ni guardamos en Supabase para poder seguir probando el UI
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center py-6 sm:py-12 animate-in fade-in duration-500 relative"
      style={{ background: 'linear-gradient(135deg, #FFF8F3 0%, #FBE6DD 50%, #F5E8E0 100%)' }}
    >
      <div className="absolute top-4 left-4 bg-amber-200 border-2 border-amber-600 text-amber-900 px-4 py-2 rounded-lg font-bold shadow-md z-50">
        🛠️ Sandbox Mode: Onboarding Preview
      </div>
      <OnboardingSurvey devModeOverride={handleDevSubmit} />
    </main>
  );
}
