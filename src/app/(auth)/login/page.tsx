import { LoginForm } from '@/features/auth/components/LoginForm';
import { AuthMascotVideo } from '@/components/mascot/AuthMascotVideo';
import { Calendar, Flame, Leaf } from 'lucide-react';
import Image from 'next/image';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { AuthLanguageSwitch } from '@/components/i18n/AuthLanguageSwitch';
import { defaultLocale, isLocale } from '@/lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Iniciar Sesión | Komorebi - Sistema de Gestión de Calendarios con Google OAuth',
  description:
    'Inicia sesión en Komorebi, el sistema de gestión de calendarios con Google OAuth para organizar tus sesiones de estudio y sincronizar tus eventos en tiempo real.',
};

export default async function LoginPage() {
  const requestLocale = (await headers()).get('x-komorebi-locale');
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale;
  const copy =
    locale === 'en'
      ? {
          description:
            'A study space to organise your sessions, keep your academic events in view, and move forward with intention.',
          calendar: 'Calendar planning',
          calendarDescription: 'Keep your study sessions in one clear view',
          streak: 'Build your rhythm',
          streakDescription: 'Every focused day supports your goals',
          focus: 'Study with fewer distractions',
          focusDescription: 'A space made for concentration',
          rights: 'All rights reserved.',
        }
      : {
          description:
            'Un espacio de estudio para organizar tus sesiones, mantener visibles tus eventos académicos y avanzar con intención.',
          calendar: 'Planificación de calendario',
          calendarDescription: 'Mantén tus sesiones de estudio en una vista clara',
          streak: 'Construye tu ritmo',
          streakDescription: 'Cada día de enfoque apoya tus metas',
          focus: 'Estudia con menos distracciones',
          focusDescription: 'Un espacio pensado para concentrarte',
          rights: 'Todos los derechos reservados.',
        };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }
  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* Lado Izquierdo: Marca, Mascota y Propuesta de Valor */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-on-primary lg:flex xl:w-[45%]">
        {/* Fondo Animado de Aurora Exclusivo del Panel Izquierdo */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-noise mix-blend-overlay opacity-30" />
        <div className="pointer-events-none absolute -left-[20%] -top-[10%] h-[40vw] w-[40vw] rounded-full bg-accent-amber/30 blur-[120px] animate-blob" />
        <div className="pointer-events-none absolute -bottom-[10%] -right-[10%] h-[50vw] w-[50vw] rounded-full bg-secondary/40 blur-[120px] animate-blob animation-delay-2000" />
        <div className="pointer-events-none absolute top-[40%] left-[20%] h-[30vw] w-[30vw] rounded-full bg-accent-umber/20 blur-[100px] animate-blob animation-delay-4000" />

        {/* Logo superior */}
        <div className="relative z-10 flex items-center gap-3">
          <Image
            src="/images/mascot/chigui-focus.png"
            alt="Logo Komorebi"
            width={36}
            height={36}
            className="w-auto h-auto object-contain drop-shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight">Komorebi</span>
        </div>

        {/* Contenido Central: Mascota y Features */}
        <div className="relative z-10 flex flex-col items-center text-center mt-8">
          <AuthMascotVideo className="mb-8 h-64 w-64" />

          <h2 className="text-3xl font-bold mb-3 tracking-tight">Komorebi</h2>
          <p className="text-primary-container-lowest/80 text-on-primary/80 max-w-sm mb-8 leading-relaxed font-medium text-sm">
            {copy.description}
          </p>

          <div className="grid grid-cols-1 gap-4 w-full max-w-sm text-left">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-accent-amber/20 p-2.5 rounded-xl">
                <Calendar className="size-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{copy.calendar}</h3>
                <p className="text-xs text-white/60 font-medium">{copy.calendarDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-accent-umber/20 p-2.5 rounded-xl">
                <Flame className="size-5 text-accent-umber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{copy.streak}</h3>
                <p className="text-xs text-white/60 font-medium">{copy.streakDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-secondary/30 p-2.5 rounded-xl">
                <Leaf className="size-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{copy.focus}</h3>
                <p className="text-xs text-white/60 font-medium">{copy.focusDescription}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del panel izquierdo */}
        <div className="relative z-10 text-xs text-white/50 font-medium mt-8 text-center">
          © {new Date().getFullYear()} Komorebi. {copy.rights}
        </div>
      </div>

      {/* Lado Derecho: Formulario de Login */}
      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2 xl:w-[55%] animate-in fade-in slide-in-from-right-8 duration-700">
        <AuthLanguageSwitch route="login" />
        <div className="w-full max-w-md">
          <Suspense fallback={null}>
            <LoginForm locale={locale} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
