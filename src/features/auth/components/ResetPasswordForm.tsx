'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChiguiGreeting } from '@/components/mascot/ChiguiGreeting';
import { updatePassword } from '@/features/auth/actions/updatePasswordAction';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

const resetCopy = {
  es: {
    checking: 'Verificando enlace de recuperación...',
    invalidTitle: 'Enlace inválido o expirado',
    invalidDescription:
      'El enlace de recuperación no es válido o ha expirado. Por motivos de seguridad, los enlaces tienen un tiempo limitado de uso.',
    login: 'Volver al inicio de sesión',
    title: 'Crea tu nueva contraseña',
    description: 'Ingresa tu nueva contraseña para restaurar el acceso seguro a tu cuenta',
    success: '¡Contraseña actualizada!',
    successDescription:
      'Tu contraseña ha sido modificada con éxito. Tu sesión se mantendrá abierta y te redirigiremos a tu perfil en unos instantes...',
    profile: 'Continuar a mi perfil',
    password: 'Nueva contraseña',
    confirm: 'Confirmar nueva contraseña',
    hide: 'Ocultar contraseña',
    show: 'Ver contraseña',
    mismatch: 'Las contraseñas no coinciden',
    min: 'Mínimo 6 caracteres',
    uppercase: 'Al menos 1 mayúscula',
    number: 'Al menos 1 número',
    special: '1 carácter especial',
    saving: 'Guardando contraseña...',
    submit: 'Guardar nueva contraseña',
    back: 'Regresar al inicio de sesión',
    unexpected: 'Ocurrió un error inesperado al actualizar la contraseña.',
    updateError: 'No se pudo actualizar la contraseña.',
  },
  en: {
    checking: 'Checking your recovery link...',
    invalidTitle: 'Invalid or expired link',
    invalidDescription:
      'This recovery link is invalid or has expired. For security reasons, links can only be used for a limited time.',
    login: 'Back to sign in',
    title: 'Create your new password',
    description: 'Enter a new password to restore secure access to your account',
    success: 'Password updated!',
    successDescription:
      'Your password has been updated successfully. Your session will stay open and we will redirect you to your profile shortly...',
    profile: 'Continue to my profile',
    password: 'New password',
    confirm: 'Confirm new password',
    hide: 'Hide password',
    show: 'Show password',
    mismatch: 'Passwords do not match',
    min: 'At least 6 characters',
    uppercase: 'At least 1 uppercase letter',
    number: 'At least 1 number',
    special: '1 special character',
    saving: 'Saving password...',
    submit: 'Save new password',
    back: 'Back to sign in',
    unexpected: 'An unexpected error occurred while updating your password.',
    updateError: 'We could not update your password.',
  },
} as const;

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const copy = resetCopy[locale];

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Verificación de estado de sesión/enlace
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          if (isMounted) {
            setHasValidSession(true);
            setIsCheckingSession(false);
          }
          return;
        }

        // Si hay hash en la URL (flujo de recuperación implícito)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const type = hashParams.get('type');
          if (type === 'recovery' || hashParams.has('access_token')) {
            if (isMounted) {
              setHasValidSession(true);
              setIsCheckingSession(false);
            }
            return;
          }
        }

        if (isMounted) {
          setHasValidSession(false);
          setIsCheckingSession(false);
        }
      } catch {
        if (isMounted) {
          setHasValidSession(false);
          setIsCheckingSession(false);
        }
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        if (isMounted) {
          setHasValidSession(true);
          setIsCheckingSession(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Validaciones en tiempo real
  const hasMinLength = password.length >= 6;
  const hasUpperCase = /[A-Z\p{Lu}]/u.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^a-zA-Z0-9\s\p{L}]/u.test(password);
  const isPasswordValid = hasMinLength && hasUpperCase && hasNumber && hasSpecialChar;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      // 1. Intentar actualizar mediante la Server Action
      const response = await updatePassword({ password, confirmPassword });

      if (!response.success) {
        // Si la Server Action falló por cookies en servidor, intentar fallback directo con el cliente Supabase
        const supabase = createClient();
        const { error: clientError } = await supabase.auth.updateUser({ password });

        if (clientError) {
          setGeneralError(clientError.message || response.error || copy.updateError);
          setIsSubmitting(false);
          return;
        }
      }

      // Mantener la sesión activa sin cerrar sesión
      setIsSuccess(true);
      setIsSubmitting(false);

      // Redirigir al perfil después de 2 segundos con confirmación
      setTimeout(() => {
        router.push(localizedHref(locale, 'profile'));
      }, 2000);
    } catch {
      setGeneralError(copy.unexpected);
      setIsSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <Card className="w-full p-8 sm:p-10 bg-surface-container-lowest border-outline-variant/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary mb-4" />
          <p className="text-sm font-medium text-on-surface-variant">{copy.checking}</p>
        </div>
      </Card>
    );
  }

  if (!hasValidSession) {
    return (
      <Card className="w-full p-8 sm:p-10 bg-surface-container-lowest border-outline-variant/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
        <div className="flex flex-col items-center py-6">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-error-container text-error">
            <AlertCircle className="size-8" />
          </div>

          <h1 className="text-2xl font-bold text-primary mb-2 tracking-tight">
            {copy.invalidTitle}
          </h1>

          <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
            {copy.invalidDescription}
          </p>

          <div className="w-full max-w-xs space-y-3">
            <Link href={localizedHref(locale, 'login')} className="w-full block">
              <Button variant="primary" className="w-full h-11 rounded-xl font-semibold text-sm">
                {copy.login}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full p-8 sm:p-10 bg-surface-container-lowest border-outline-variant/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex flex-col items-center text-center mb-8">
        <ChiguiGreeting
          priority
          className="mb-4 h-20 w-20 object-contain motion-safe:animate-[chigui-float_4s_ease-in-out_infinite] lg:hidden"
        />
        <div className="hidden lg:flex size-12 items-center justify-center rounded-2xl bg-accent-amber/15 text-accent-amber mb-4">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-1.5 tracking-tight">{copy.title}</h1>
        <p className="text-sm text-on-surface-variant font-medium max-w-sm">{copy.description}</p>
      </div>

      {isSuccess ? (
        <div className="flex flex-col items-center text-center py-6 animate-in fade-in">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-status-success-bg text-status-success shadow-inner">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">{copy.success}</h2>
          <p className="text-sm text-on-surface-variant mb-6 max-w-sm">{copy.successDescription}</p>
          <Link href={localizedHref(locale, 'profile')} className="w-full">
            <Button variant="primary" className="w-full h-11 rounded-xl font-semibold text-sm">
              {copy.profile}
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {generalError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-error-container p-3.5 text-on-error-container text-xs sm:text-sm animate-in fade-in">
              <AlertCircle className="size-5 shrink-0 text-error mt-0.5" />
              <p className="leading-snug">{generalError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
            {/* Nueva contraseña */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-on-surface ml-1" htmlFor="new-password">
                {copy.password}
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  required
                  className="w-full rounded-xl border border-outline-variant/50 bg-surface px-4 py-2.5 pr-11 text-sm text-on-surface placeholder:text-outline/60 focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label={showPassword ? copy.hide : copy.show}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1.5">
              <label
                className="text-sm font-semibold text-on-surface ml-1"
                htmlFor="confirm-new-password"
              >
                {copy.confirm}
              </label>
              <div className="relative">
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (generalError) setGeneralError(null);
                  }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  required
                  className={`w-full rounded-xl border bg-surface px-4 py-2.5 pr-11 text-sm text-on-surface placeholder:text-outline/60 focus:bg-surface-container-lowest focus:outline-none transition-all shadow-sm ${
                    confirmPassword && !passwordsMatch
                      ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
                      : 'border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label={showConfirmPassword ? copy.hide : copy.show}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-error mt-1 ml-1">{copy.mismatch}</p>
              )}
            </div>

            {/* Requisitos de seguridad interactivos */}
            <div className="rounded-xl bg-surface p-4 border border-outline-variant/40 space-y-2 text-xs">
              <p className="font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                <Lock className="size-3.5 text-accent-amber" />
                <span>Requisitos de seguridad:</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-on-surface-variant">
                <div
                  className={`flex items-center gap-2 transition-colors ${
                    hasMinLength ? 'text-status-success font-medium' : ''
                  }`}
                >
                  <div
                    className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                      hasMinLength
                        ? 'border-status-success bg-status-success text-white'
                        : 'border-outline-variant/60'
                    }`}
                  >
                    {hasMinLength && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                  <span>{copy.min}</span>
                </div>

                <div
                  className={`flex items-center gap-2 transition-colors ${
                    hasUpperCase ? 'text-status-success font-medium' : ''
                  }`}
                >
                  <div
                    className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                      hasUpperCase
                        ? 'border-status-success bg-status-success text-white'
                        : 'border-outline-variant/60'
                    }`}
                  >
                    {hasUpperCase && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                  <span>{copy.uppercase}</span>
                </div>

                <div
                  className={`flex items-center gap-2 transition-colors ${
                    hasNumber ? 'text-status-success font-medium' : ''
                  }`}
                >
                  <div
                    className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                      hasNumber
                        ? 'border-status-success bg-status-success text-white'
                        : 'border-outline-variant/60'
                    }`}
                  >
                    {hasNumber && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                  <span>{copy.number}</span>
                </div>

                <div
                  className={`flex items-center gap-2 transition-colors ${
                    hasSpecialChar ? 'text-status-success font-medium' : ''
                  }`}
                >
                  <div
                    className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                      hasSpecialChar
                        ? 'border-status-success bg-status-success text-white'
                        : 'border-outline-variant/60'
                    }`}
                  >
                    {hasSpecialChar && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                  <span>{copy.special}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !isPasswordValid || !passwordsMatch}
                className="w-full h-11 rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>{copy.saving}</span>
                  </>
                ) : (
                  copy.submit
                )}
              </Button>
            </div>
          </form>

          <div className="relative z-10 mt-6 text-center">
            <Link
              href={localizedHref(locale, 'login')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>{copy.back}</span>
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
