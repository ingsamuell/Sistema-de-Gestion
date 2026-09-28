import { Suspense } from 'react';
import { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { MailCheck, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ChiguiGreeting } from '@/components/mascot/ChiguiGreeting';
import { VerifyEmailCard } from '@/features/auth/components/VerifyEmailCard';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { AuthLanguageSwitch } from '@/components/i18n/AuthLanguageSwitch';
import { defaultLocale, isLocale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export const metadata: Metadata = {
  title: 'Verificar Correo | Komorebi Study Studio',
  description:
    'Por favor verifica tu correo electrónico para comenzar con tu onboarding en Komorebi Study Studio.',
};

export default async function VerifyEmailPage() {
  const headersList = await headers();
  const headerLocale = headersList.get('x-komorebi-locale');
  const locale = isLocale(headerLocale) ? headerLocale : defaultLocale;
  const cookieStore = await cookies();
  const justRegisteredEmail = cookieStore.get('just_registered_email')?.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La página de confirmación ÚNICAMENTE debe ser visible tras registrar un correo
  // (es decir, cuando existe la cookie just_registered_email o un usuario autenticado sin confirmar)
  const isPendingVerification = Boolean(justRegisteredEmail) || (user && !user.email_confirmed_at);

  if (!isPendingVerification) {
    redirect(localizedHref(locale, 'register'));
  }

  // Si el usuario ya está autenticado y tiene su correo verificado (y no es un registro recién realizado):
  if (user && user.email_confirmed_at && !justRegisteredEmail) {
    if (user.user_metadata?.onboarding_completed) {
      redirect(localizedHref(locale, 'app'));
    } else {
      redirect(localizedHref(locale, 'onboarding'));
    }
  }

  const initialEmail = justRegisteredEmail || user?.email || undefined;

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* Lado Izquierdo: Marca, Mascota y Propuesta de Valor */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-on-primary lg:flex xl:w-[45%]">
        {/* Fondo Animado de Aurora */}
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
          <span className="text-xl font-bold tracking-tight">Komorebi Studio</span>
        </div>

        {/* Contenido Central: Mascota y Features */}
        <div className="relative z-10 flex flex-col items-center text-center mt-8">
          <div className="relative mb-8 h-64 w-full max-w-xs">
            <ChiguiGreeting
              priority
              className="h-full w-full origin-bottom object-contain transition-transform duration-500 hover:scale-[1.05] motion-safe:animate-[chigui-float_4s_ease-in-out_infinite]"
            />
          </div>

          <h2 className="text-3xl font-bold mb-4 tracking-tight">¡Casi estamos listos!</h2>
          <p className="text-primary-container-lowest/80 text-on-primary/80 max-w-sm mb-10 leading-relaxed font-medium">
            Solo un paso más para proteger tu cuenta y personalizar tu experiencia de estudio con
            Chigüi.
          </p>

          <div className="grid grid-cols-1 gap-6 w-full max-w-sm text-left">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-accent-amber/20 p-2.5 rounded-xl">
                <MailCheck className="size-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Confirma tu correo</h3>
                <p className="text-xs text-white/60 font-medium">
                  Asegura el acceso a tus asignaturas y proyectos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-accent-umber/20 p-2.5 rounded-xl">
                <CheckCircle2 className="size-5 text-accent-umber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Desbloquea el Onboarding</h3>
                <p className="text-xs text-white/60 font-medium">
                  Configura tu perfil de estudio y técnicas favoritas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="bg-secondary/30 p-2.5 rounded-xl">
                <ShieldAlert className="size-5 text-accent-amber" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Espacio protegido</h3>
                <p className="text-xs text-white/60 font-medium">
                  Tu progreso y datos académicos siempre seguros
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del panel izquierdo */}
        <div className="relative z-10 text-xs text-white/50 font-medium mt-8 text-center">
          © {new Date().getFullYear()} Komorebi Study Studio. Todos los derechos reservados.
        </div>
      </div>

      {/* Lado Derecho: Tarjeta de Verificación */}
      <div className="relative flex w-full items-center justify-center p-6 py-12 lg:w-1/2 xl:w-[55%] animate-in fade-in slide-in-from-right-8 duration-700">
        <AuthLanguageSwitch route="verifyEmail" />
        <div className="w-full max-w-lg">
          <Suspense fallback={null}>
            <VerifyEmailCard initialEmail={initialEmail} locale={locale} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
