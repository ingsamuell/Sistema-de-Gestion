'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { resendVerificationEmail } from '@/features/auth/actions/resendVerificationAction';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

interface VerifyEmailCardProps {
  initialEmail?: string;
  locale: Locale;
}

const verifyCopy = {
  es: {
    missingEmail: 'No se encontró un correo para reenviar el enlace.',
    resendSuccess: '¡Correo reenviado con éxito! Revisa tu bandeja de entrada o spam.',
    resendError: 'No se pudo reenviar el correo en este momento.',
    unexpected: 'Ocurrió un error inesperado al intentar reenviar el correo.',
    notConfirmed:
      'Aún no registramos la confirmación. Por favor haz clic en el enlace que enviamos a tu correo.',
    checkError: 'No se pudo verificar el estado en este momento. Intenta de nuevo.',
    title: '¡Verifica tu correo electrónico!',
    description: 'Hemos enviado un enlace de confirmación a:',
    stepOne: 'Abre tu bandeja de entrada y busca el correo de Komorebi.',
    stepTwo: 'Haz clic en el botón o enlace de verificación.',
    note: 'Hasta que confirmes tu correo no podrás acceder al onboarding ni a tus herramientas de estudio. Revisa también tu carpeta de Spam o Promociones.',
    checking: 'Verificando...',
    checked: 'Ya verifiqué mi correo',
    resending: 'Reenviando correo...',
    resendIn: 'Reenviar en',
    resend: 'Reenviar correo de confirmación',
    wrongEmail: '¿Ingresaste un correo equivocado?',
    register: 'Regístrate de nuevo',
    back: 'Volver a iniciar sesión',
  },
  en: {
    missingEmail: 'We could not find an email address to resend the link.',
    resendSuccess: 'Email resent successfully! Check your inbox or spam folder.',
    resendError: 'We could not resend the email right now.',
    unexpected: 'An unexpected error occurred while resending the email.',
    notConfirmed:
      'We have not registered the confirmation yet. Please click the link we sent to your email.',
    checkError: 'We could not check the status right now. Please try again.',
    title: 'Verify your email address!',
    description: 'We sent a confirmation link to:',
    stepOne: 'Open your inbox and find the email from Komorebi.',
    stepTwo: 'Click the verification button or link.',
    note: 'Until you confirm your email, you will not be able to access onboarding or your study tools. Also check your Spam or Promotions folder.',
    checking: 'Checking...',
    checked: 'I verified my email',
    resending: 'Resending email...',
    resendIn: 'Resend in',
    resend: 'Resend confirmation email',
    wrongEmail: 'Did you enter the wrong email?',
    register: 'Register again',
    back: 'Back to sign in',
  },
} as const;

export function VerifyEmailCard({ initialEmail, locale }: VerifyEmailCardProps) {
  const router = useRouter();
  const copy = verifyCopy[locale];
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || initialEmail || '';

  const [email, setEmail] = useState(() => {
    if (emailParam) return emailParam;
    if (typeof window !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)just_registered_email=([^;]+)/);
      if (match && match[1]) {
        try {
          return decodeURIComponent(match[1]);
        } catch {
          return match[1];
        }
      }
    }
    return '';
  });

  const [resendStatus, setResendStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Intentar obtener el correo de la sesión si aún no está disponible
  useEffect(() => {
    if (!email) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.email) {
          setEmail(data.user.email);
        }
      });
    }
  }, [email]);

  // Manejar el temporizador de cuenta regresiva para el reenvío
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email) {
      setResendStatus({
        type: 'error',
        message: copy.missingEmail,
      });
      return;
    }

    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setResendStatus({ type: null, message: null });

    try {
      const response = await resendVerificationEmail(email, locale);

      if (response.success) {
        setResendStatus({
          type: 'success',
          message: copy.resendSuccess,
        });
        setCooldown(60);
      } else {
        setResendStatus({
          type: 'error',
          message: response.error || copy.resendError,
        });
      }
    } catch {
      setResendStatus({
        type: 'error',
        message: copy.unexpected,
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsChecking(true);
    setResendStatus({ type: null, message: null });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email_confirmed_at) {
        // Borrar cookie temporal de registro
        document.cookie =
          'just_registered_email=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
        // Correo confirmado -> proceder a onboarding
        router.push(localizedHref(locale, 'onboarding'));
        router.refresh();
      } else {
        setResendStatus({
          type: 'error',
          message: copy.notConfirmed,
        });
        setIsChecking(false);
      }
    } catch {
      setResendStatus({
        type: 'error',
        message: copy.checkError,
      });
      setIsChecking(false);
    }
  };

  return (
    <Card className="w-full p-8 sm:p-10 bg-surface-container-lowest border-outline-variant/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
      {/* Icono de Correo / Mascota */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative mb-4 h-20 w-20 flex items-center justify-center rounded-3xl bg-primary/10 border border-primary/20 text-primary shadow-inner">
          <Mail className="size-10 animate-bounce motion-reduce:animate-none" />
          <div className="absolute -bottom-1 -right-1 bg-accent-amber text-on-primary rounded-full p-1.5 shadow-md">
            <ShieldCheck className="size-4" />
          </div>
        </div>

        <div className="lg:hidden mb-2 relative h-12 w-12">
          <Image
            src="/images/mascot/chigui-focus.png"
            alt="Chigüi Focus"
            fill
            sizes="48px"
            className="object-contain drop-shadow-sm"
          />
        </div>

        <h1 className="text-2xl font-bold text-primary mb-2 tracking-tight">{copy.title}</h1>
        <p className="text-sm text-on-surface-variant font-medium max-w-sm leading-relaxed">
          {copy.description}
        </p>

        {/* Chip con el correo del usuario */}
        {email && (
          <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-semibold text-xs sm:text-sm tracking-tight break-all max-w-full">
            <Inbox className="size-3.5 text-primary shrink-0" />
            <span>{email}</span>
          </div>
        )}
      </div>

      {/* Alertas de Estado */}
      {resendStatus.message && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-xl p-3.5 text-xs sm:text-sm text-left animate-in fade-in ${
            resendStatus.type === 'success'
              ? 'bg-status-success-bg text-status-success border border-status-success/25'
              : 'bg-error-container text-on-error-container'
          }`}
        >
          {resendStatus.type === 'success' ? (
            <CheckCircle2 className="size-5 shrink-0 text-status-success mt-0.5" />
          ) : (
            <AlertCircle className="size-5 shrink-0 text-error mt-0.5" />
          )}
          <p className="leading-snug font-medium">{resendStatus.message}</p>
        </div>
      )}

      {/* Caja de instrucciones */}
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low/50 p-4 text-xs sm:text-sm text-on-surface-variant text-left space-y-2 mb-6">
        <p className="font-semibold text-on-surface flex items-center gap-2">
          <span className="flex size-5 rounded-full bg-primary/10 text-primary items-center justify-center text-xs font-bold">
            1
          </span>
          {copy.stepOne}
        </p>
        <p className="font-semibold text-on-surface flex items-center gap-2">
          <span className="flex size-5 rounded-full bg-primary/10 text-primary items-center justify-center text-xs font-bold">
            2
          </span>
          {copy.stepTwo}
        </p>
        <p className="text-xs text-outline pt-1">
          💡 <strong>{locale === 'es' ? 'Nota:' : 'Note:'}</strong> {copy.note}
        </p>
      </div>

      {/* Botones de Acción */}
      <div className="space-y-3">
        {/* Botón principal: Comprobar estado */}
        <Button
          type="button"
          variant="primary"
          disabled={isChecking}
          onClick={handleCheckVerification}
          className="w-full h-11 rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-sm flex items-center justify-center gap-2"
        >
          {isChecking ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{copy.checking}</span>
            </>
          ) : (
            <>
              <span>{copy.checked}</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        {/* Botón secundario: Reenviar correo */}
        <Button
          type="button"
          variant="secondary"
          disabled={isResending || cooldown > 0 || !email}
          onClick={handleResend}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-surface hover:bg-surface-dim border border-outline-variant/60 shadow-sm transition-all text-on-surface font-semibold text-sm"
        >
          {isResending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{copy.resending}</span>
            </>
          ) : cooldown > 0 ? (
            <>
              <RefreshCw className="size-4 opacity-50" />
              <span>
                {copy.resendIn} {cooldown}s
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              <span>{copy.resend}</span>
            </>
          )}
        </Button>
      </div>

      {/* Enlaces inferiores */}
      <div className="mt-8 text-center text-xs sm:text-sm text-on-surface-variant font-medium space-y-2">
        <div>
          {copy.wrongEmail}{' '}
          <Link
            href={localizedHref(locale, 'register')}
            className="text-primary font-bold hover:text-primary/80 transition-colors"
          >
            {copy.register}
          </Link>
        </div>
        <div>
          <Link
            href={localizedHref(locale, 'login')}
            className="text-outline hover:text-on-surface transition-colors"
          >
            ← {copy.back}
          </Link>
        </div>
      </div>
    </Card>
  );
}
