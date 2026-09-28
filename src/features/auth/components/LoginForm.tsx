'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AuthMascotVideo } from '@/components/mascot/AuthMascotVideo';
import { loginUser } from '@/features/auth/actions/loginAction';
import { createClient } from '@/lib/supabase/client';
import { ForgotPasswordModal } from '@/features/auth/components/ForgotPasswordModal';
import type { LoginFormData } from '@/features/auth/types/auth.types';
import type { Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

const loginCopy = {
  es: {
    welcome: 'Bienvenido de vuelta',
    subtitle: 'Inicia sesión para continuar en Komorebi',
    email: 'Correo electrónico',
    password: 'Contraseña',
    forgot: '¿Olvidaste tu contraseña?',
    hide: 'Ocultar contraseña',
    show: 'Ver contraseña',
    loading: 'Iniciando sesión...',
    submit: 'Iniciar sesión',
    or: 'o',
    googleLoading: 'Conectando con Google...',
    google: 'Continuar con Google',
    noAccount: '¿No tienes una cuenta?',
    register: 'Regístrate',
    unexpected: 'Ocurrió un error inesperado al iniciar sesión.',
  },
  en: {
    welcome: 'Welcome back',
    subtitle: 'Log in to continue to Komorebi',
    email: 'Email address',
    password: 'Password',
    forgot: 'Forgot your password?',
    hide: 'Hide password',
    show: 'Show password',
    loading: 'Logging in...',
    submit: 'Log in',
    or: 'or',
    googleLoading: 'Connecting to Google...',
    google: 'Continue with Google',
    noAccount: "Don't have an account?",
    register: 'Create an account',
    unexpected: 'An unexpected error occurred while signing in.',
  },
} as const;

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = loginCopy[locale];

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isUrlErrorDismissed, setIsUrlErrorDismissed] = useState(false);
  const [isSuccessDismissed, setIsSuccessDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const urlError = !isUrlErrorDismissed ? searchParams.get('error') : null;
  const urlReset = !isSuccessDismissed ? searchParams.get('reset') : null;

  const displayError =
    generalError ||
    (urlError === 'oauth_error'
      ? 'No se pudo iniciar sesión con Google. Por favor intenta nuevamente.'
      : urlError === 'reset_link_expired'
        ? 'El enlace de recuperación es inválido o ha expirado. Por favor solicita uno nuevo.'
        : urlError === 'verification_link_expired'
          ? 'El enlace de verificación ha expirado o es inválido. Por favor solicita uno nuevo.'
          : null);

  const displaySuccess =
    urlReset === 'success'
      ? '¡Tu contraseña ha sido restablecida exitosamente! Ya puedes iniciar sesión.'
      : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name as keyof LoginFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (generalError) {
      setGeneralError(null);
    }
    if (!isUrlErrorDismissed) {
      setIsUrlErrorDismissed(true);
    }
    if (!isSuccessDismissed) {
      setIsSuccessDismissed(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setIsUrlErrorDismissed(true);
    setIsSuccessDismissed(true);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const response = await loginUser(formData);

      if (!response.success) {
        if (response.fieldErrors) {
          const mappedErrors: Partial<Record<keyof LoginFormData, string>> = {};
          for (const [field, messages] of Object.entries(response.fieldErrors)) {
            if (messages && messages.length > 0) {
              mappedErrors[field as keyof LoginFormData] = messages[0];
            }
          }
          setFieldErrors(mappedErrors);
        }

        if (response.error) {
          setGeneralError(response.error);
        }
        setIsLoading(false);
        return;
      }

      // Inicio de sesión exitoso -> Redirigir a la página principal con sesión fresca
      router.push('/');
      router.refresh();
    } catch {
      setGeneralError(copy.unexpected);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGeneralError(null);
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setGeneralError(error.message || 'Error al conectar con Google.');
        setIsGoogleLoading(false);
      }
    } catch {
      setGeneralError('Ocurrió un error al intentar iniciar sesión con Google.');
      setIsGoogleLoading(false);
    }
  };

  const isAnyLoading = isLoading || isGoogleLoading;

  return (
    <Card className="w-full p-8 sm:p-10 bg-surface-container-lowest border-outline-variant/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex flex-col items-center text-center mb-8">
        <AuthMascotVideo framed={false} objectFit="contain" className="mb-4 h-40 w-40 lg:hidden" />
        <h1 className="text-2xl font-bold text-primary mb-1.5 tracking-tight">{copy.welcome}</h1>
        <p className="text-sm text-on-surface-variant font-medium">{copy.subtitle}</p>
      </div>

      {displaySuccess && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-status-success-bg p-3.5 text-status-success text-xs sm:text-sm animate-in fade-in border border-status-success/25">
          <CheckCircle2 className="size-5 shrink-0 text-status-success mt-0.5" />
          <p className="leading-snug font-medium">{displaySuccess}</p>
        </div>
      )}

      {displayError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-error-container p-3.5 text-on-error-container text-xs sm:text-sm animate-in fade-in">
          <AlertCircle className="size-5 shrink-0 text-error mt-0.5" />
          <p className="leading-snug">{displayError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-on-surface ml-1" htmlFor="email">
            {copy.email}
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="tu@correo.universidad.edu"
            value={formData.email}
            onChange={handleChange}
            disabled={isAnyLoading}
            required
            className={`w-full rounded-xl border bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-outline/60 focus:bg-surface-container-lowest focus:outline-none transition-all shadow-sm ${
              fieldErrors.email
                ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
                : 'border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20'
            }`}
          />
          {fieldErrors.email && <p className="text-xs text-error mt-1 ml-1">{fieldErrors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between ml-1">
            <label className="text-sm font-semibold text-on-surface" htmlFor="password">
              {copy.password}
            </label>
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-xs text-accent-amber font-semibold hover:underline focus:outline-none focus:ring-1 focus:ring-accent-amber/40 rounded transition-all"
            >
              {copy.forgot}
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={isAnyLoading}
              required
              className={`w-full rounded-xl border bg-surface px-4 py-2.5 pr-11 text-sm text-on-surface placeholder:text-outline/60 focus:bg-surface-container-lowest focus:outline-none transition-all shadow-sm ${
                fieldErrors.password
                  ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20'
                  : 'border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none"
              aria-label={showPassword ? copy.hide : copy.show}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-error mt-1 ml-1">{fieldErrors.password}</p>
          )}
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={isAnyLoading}
            className="w-full h-11 rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-sm flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{copy.loading}</span>
              </>
            ) : (
              copy.submit
            )}
          </Button>
        </div>

        <div className="relative my-6 flex items-center justify-center">
          <div className="border-t border-outline-variant/30 w-full" />
          <span className="bg-surface/80 backdrop-blur-sm px-3 text-xs text-on-surface-variant uppercase tracking-wider absolute font-medium rounded-full">
            {copy.or}
          </span>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={isAnyLoading}
          onClick={handleGoogleSignIn}
          className="w-full h-11 flex items-center justify-center gap-2.5 rounded-xl bg-surface hover:bg-surface-dim border border-outline-variant/60 shadow-sm transition-all text-on-surface font-bold text-sm"
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>{copy.googleLoading}</span>
            </>
          ) : (
            <>
              <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{copy.google}</span>
            </>
          )}
        </Button>
      </form>

      <div className="relative z-10 mt-8 text-center text-sm text-on-surface-variant font-medium">
        {copy.noAccount}{' '}
        <Link
          href={localizedHref(locale, 'register')}
          className="text-primary font-bold hover:text-primary/80 transition-colors"
        >
          {copy.register}
        </Link>
      </div>

      {isForgotPasswordOpen && (
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          defaultEmail={formData.email}
        />
      )}
    </Card>
  );
}
