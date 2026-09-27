import { RegisterForm } from '@/features/auth/components/RegisterForm';
import { AuthMascotVideo } from '@/components/mascot/AuthMascotVideo';
import { Rocket, Timer, BarChart3 } from 'lucide-react';
import Image from 'next/image';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthLanguageSwitch } from '@/components/i18n/AuthLanguageSwitch';
import { headers } from 'next/headers';
import { defaultLocale, isLocale } from '@/lib/i18n/locale';

export const metadata: Metadata = {
  title: 'Crear una cuenta | Komorebi Study Studio',
  description:
    'Regístrate en Komorebi Study Studio para gestionar tus proyectos académicos y hábitos de estudio.',
};

export default async function RegisterPage() {
  const requestLocale = (await headers()).get('x-komorebi-locale');
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale;
  const copy =
    locale === 'en'
      ? {
          title: 'Build a study routine that works for you.',
          description:
            'Join Komorebi and bring your projects, study time, and progress together in one calmer space.',
          productivity: 'Move forward with clarity',
          productivityDescription: 'Tools made for everyday study goals',
          time: 'Make time for focus',
          timeDescription: 'Plan sessions you can realistically keep',
          progress: 'See your progress',
          progressDescription: 'Review your effort and celebrate each step',
          rights: 'All rights reserved.',
        }
      : {
          title: 'Construye una rutina de estudio para ti.',
          description:
            'Únete a Komorebi y reúne tus proyectos, tiempo de estudio y progreso en un mismo espacio más tranquilo.',
          productivity: 'Avanza con claridad',
          productivityDescription: 'Herramientas para tus metas de estudio diarias',
          time: 'Haz espacio para enfocarte',
          timeDescription: 'Planifica sesiones que realmente puedas mantener',
          progress: 'Observa tu progreso',
          progressDescription: 'Revisa tu esfuerzo y celebra cada paso',
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

          <h2 className="text-3xl font-bold mb-4 tracking-tight">{copy.title}</h2>
          <p className="text-primary-container-lowest/80 text-on-primary/80 max-w-sm mb-10 leading-relaxed font-medium">
            {copy.description}
          </p>

          <div className="grid grid-cols-1 gap-6 w-full max-w-sm text-left">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-accent-amber/20 p-2.5 rounded-xl">
                <Rocket className="size-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{copy.productivity}</h3>
                <p className="text-xs text-white/60 font-medium">{copy.productivityDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-accent-umber/20 p-2.5 rounded-xl">
                <Timer className="size-5 text-accent-umber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{copy.time}</h3>
                <p className="text-xs text-white/60 font-medium">{copy.timeDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-secondary/30 p-2.5 rounded-xl">
                <BarChart3 className="size-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{copy.progress}</h3>
                <p className="text-xs text-white/60 font-medium">{copy.progressDescription}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del panel izquierdo */}
        <div className="relative z-10 text-xs text-white/50 font-medium mt-8 text-center">
          © {new Date().getFullYear()} Komorebi. {copy.rights}
        </div>
      </div>

      {/* Lado Derecho: Formulario de Registro */}
      <div className="relative flex w-full items-center justify-center p-6 py-12 lg:w-1/2 xl:w-[55%] animate-in fade-in slide-in-from-right-8 duration-700">
        <AuthLanguageSwitch route="register" />
        <div className="w-full max-w-lg">
          <RegisterForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
