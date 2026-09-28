import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { UserProfileButton } from '@/components/layout/UserProfileButton';
import { TelegramBotWidget } from '@/components/layout/TelegramBotWidget';
import { FolderKanban } from 'lucide-react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

import { ToastProvider } from '@/components/ui/Toast';
import { FocusSessionProvider } from '@/contexts/FocusSessionContext';
import { TourProvider } from '@/contexts/TourContext';
import { GlobalFocusBar } from '@/components/study/GlobalFocusBar';
import { headers } from 'next/headers';
import { defaultLocale, isLocale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';
import { DashboardLanguageSwitch } from '@/components/i18n/DashboardLanguageSwitch';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const headerLocale = headersList.get('x-komorebi-locale');
  const locale = isLocale(headerLocale) ? headerLocale : defaultLocale;
  let user = null;
  let username = 'estudiante';
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nombre_usuario')
        .eq('id', user.id)
        .maybeSingle();

      username =
        profile?.nombre_usuario ||
        user.user_metadata?.username ||
        user.user_metadata?.nombre_usuario ||
        user.email?.split('@')[0] ||
        'estudiante';
    }
  } catch {
    user = null;
  }

  if (!user) {
    redirect(localizedHref(locale, 'login'));
  }

  return (
    <TourProvider>
      <ToastProvider>
        <FocusSessionProvider>
          <div className="flex min-h-screen">
            <Sidebar initialUser={user} />

            <div className="flex-1 flex flex-col min-w-0">
              {/* Barra superior visible únicamente en móviles */}
              <header className="md:hidden flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/30 bg-surface sticky top-0 z-40">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                    <FolderKanban className="size-4" />
                  </div>
                  <h2 className="font-bold text-primary tracking-tight text-sm leading-none">
                    Komorebi
                  </h2>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <DashboardLanguageSwitch compact />
                  <UserProfileButton initialUser={user} minimal showLogout />
                </div>
              </header>

              {/* Barra Global de Modo Enfoque en la parte superior */}
              <div className="sticky top-0 z-40">
                <GlobalFocusBar />
              </div>

              <main id="contenido" className="flex-1 pb-20 md:pb-0 max-w-full overflow-x-hidden">
                <div className="mx-auto max-w-5xl px-4 md:px-8 py-6 md:py-10">{children}</div>
              </main>
            </div>

            <MobileNav />

            {/* Asistente de Telegram disponible en todas las vistas */}
            <TelegramBotWidget username={username} />

          </div>
        </FocusSessionProvider>
      </ToastProvider>
    </TourProvider>
  );
}
