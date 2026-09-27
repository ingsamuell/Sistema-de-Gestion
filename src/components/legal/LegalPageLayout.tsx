import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { ArrowLeft, ExternalLink, GraduationCap, ShieldCheck, FileText } from 'lucide-react';
import { defaultLocale, isLocale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export interface LegalHighlightItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface LegalSectionItem {
  id: string;
  title: string;
  number: string;
}

export interface LegalPageLayoutProps {
  currentPage: 'privacy' | 'terms';
  badgeText: string;
  badgeIcon: React.ReactNode;
  title: string;
  subtitle: string;
  lastUpdated: string;
  readingTime: string;
  highlights: LegalHighlightItem[];
  sections: LegalSectionItem[];
  children: React.ReactNode;
}

export async function LegalPageLayout({
  currentPage,
  badgeText,
  badgeIcon,
  title,
  subtitle,
  lastUpdated,
  readingTime,
  highlights,
  sections,
  children,
}: LegalPageLayoutProps) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get('x-komorebi-locale');
  const locale = requestedLocale && isLocale(requestedLocale) ? requestedLocale : defaultLocale;
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col selection:bg-accent-amber/20 selection:text-primary">
      {/* Barra de Navegación Superior */}
      <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Logo y Marca */}
          <Link
            href="/"
            className="group flex items-center gap-3 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber rounded-lg"
          >
            <div className="relative size-9 overflow-hidden rounded-xl bg-surface-container-low p-1 border border-outline-variant/30 shadow-xs">
              <Image
                src="/images/mascot/chigui-focus.png"
                alt="Logo Komorebi Study Studio"
                width={36}
                height={36}
                className="size-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base leading-tight tracking-tight text-primary">
                Komorebi
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-amber">
                Study Studio
              </span>
            </div>
          </Link>

          {/* Selector de Pestañas Legales */}
          <nav
            aria-label="Información del proyecto"
            className="hidden sm:flex items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-container-low p-1"
          >
            <Link
              href={localizedHref(locale, 'privacy')}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                currentPage === 'privacy'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>Privacidad</span>
            </Link>
            <Link
              href={localizedHref(locale, 'terms')}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                currentPage === 'terms'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
              }`}
            >
              <FileText className="size-3.5" />
              <span>Uso académico</span>
            </Link>
          </nav>

          {/* Acciones Rápidas */}
          <div className="flex items-center gap-3">
            <Link
              href={localizedHref(locale, 'login')}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3.5 py-1.5 text-xs font-bold text-primary shadow-xs transition-all hover:bg-surface-container-low hover:border-outline-variant"
            >
              <span>Volver al acceso</span>
              <ExternalLink className="size-3 text-accent-amber" />
            </Link>
          </div>
        </div>

        {/* Barra Móvil de Pestañas */}
        <div className="sm:hidden border-t border-outline-variant/20 bg-surface-container-low/50 px-4 py-2 flex items-center justify-center gap-2">
          <Link
            href={localizedHref(locale, 'privacy')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              currentPage === 'privacy'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <ShieldCheck className="size-3.5" />
            <span>Privacidad</span>
          </Link>
          <Link
            href={localizedHref(locale, 'terms')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              currentPage === 'terms'
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <FileText className="size-3.5" />
            <span>Uso académico</span>
          </Link>
        </div>
      </header>

      {/* Contenido Principal */}
      <main id="contenido" className="flex-1">
        {/* Encabezado Hero */}
        <section className="border-b border-outline-variant/20 bg-linear-to-b from-surface-container-low/60 to-surface py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start gap-4">
              {/* Botón de Retorno */}
              <Link
                href={localizedHref(locale, 'login')}
                className="group inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
              >
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                <span>Volver al inicio de sesión</span>
              </Link>

              {/* Badge de Categoría */}
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-3.5 py-1 text-xs font-bold text-accent-amber uppercase tracking-wider">
                {badgeIcon}
                <span>{badgeText}</span>
              </div>

              {/* Título Principal */}
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-primary max-w-3xl">
                {title}
              </h1>

              {/* Subtítulo Descriptivo */}
              <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl leading-relaxed">
                {subtitle}
              </p>

              {/* Metadatos de Publicación */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-2 text-xs text-on-surface-variant/80">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-status-success inline-block" />
                  <strong>Vigente:</strong> {lastUpdated}
                </span>
                <span>•</span>
                <span>
                  <strong>Ámbito:</strong> Prototipo académico
                </span>
                <span>•</span>
                <span>
                  <strong>Tiempo estimado:</strong> {readingTime}
                </span>
              </div>
            </div>

            {/* Tarjetas de Resumen Ejecutivo / Puntos Clave */}
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {highlights.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-center size-10 rounded-xl bg-accent-amber/10 text-accent-amber mb-3">
                    {item.icon}
                  </div>
                  <h2 className="text-sm font-bold text-primary mb-1">{item.title}</h2>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cuerpo del Documento (2 Columnas en pantallas amplias) */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Navegación de Contenidos (Sticky en Desktop) */}
            <aside className="lg:col-span-4">
              <div className="sticky top-24 space-y-6">
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent-amber mb-4">
                    Índice de Contenido
                  </h3>
                  <nav className="space-y-1.5" aria-label="Secciones del documento">
                    {sections.map((section) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
                      >
                        <span className="font-bold text-accent-amber shrink-0">
                          {section.number}.
                        </span>
                        <span className="line-clamp-2 group-hover:underline">{section.title}</span>
                      </a>
                    ))}
                  </nav>
                </div>

                {/* Tarjeta de contexto académico */}
                <div className="rounded-2xl border border-outline-variant/20 bg-primary p-5 text-on-primary shadow-xs">
                  <div className="flex items-center gap-2 text-accent-amber mb-2">
                    <GraduationCap className="size-4" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-accent-amber">
                      Proyecto académico
                    </span>
                  </div>
                  <p className="text-xs text-on-primary/85 leading-relaxed mb-4">
                    Este documento describe el alcance de la demostración. Evita introducir
                    información sensible o archivos que no puedas respaldar por tu cuenta.
                  </p>
                </div>
              </div>
            </aside>

            {/* Artículo Detallado */}
            <article className="lg:col-span-8">
              <div className="prose-clean space-y-12">{children}</div>

              {/* Bloque Final de Compromiso */}
              <div className="mt-14 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="size-11 rounded-xl bg-status-success-bg text-status-success flex items-center justify-center shrink-0">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-primary mb-1">
                      Uso académico y transparente
                    </h3>
                    <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                      Komorebi Study Studio es un prototipo para pruebas y demostraciones. Utiliza
                      únicamente información necesaria para sus funciones y evita incluir datos
                      sensibles o contenido que no puedas respaldar fuera de la Plataforma.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </main>

      {/* Pie de Página Institucional */}
      <footer className="mt-auto border-t border-outline-variant/30 bg-surface-container-lowest py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/mascot/chigui-focus.png"
              alt="Logo Komorebi"
              width={24}
              height={24}
              className="size-6 object-contain"
            />
            <p className="text-xs text-on-surface-variant">
              © {new Date().getFullYear()} Komorebi Study Studio · Prototipo académico.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-on-surface-variant">
            <Link
              href={localizedHref(locale, 'privacy')}
              className={`hover:text-primary transition-colors ${
                currentPage === 'privacy' ? 'text-primary underline font-bold' : ''
              }`}
            >
              Política de Privacidad
            </Link>
            <span>•</span>
            <Link
              href={localizedHref(locale, 'terms')}
              className={`hover:text-primary transition-colors ${
                currentPage === 'terms' ? 'text-primary underline font-bold' : ''
              }`}
            >
              Términos de uso académico
            </Link>
            <span>•</span>
            <Link
              href={localizedHref(locale, 'login')}
              className="hover:text-primary transition-colors"
            >
              Iniciar Sesión
            </Link>
            <span>•</span>
            <Link
              href={localizedHref(locale, 'register')}
              className="hover:text-primary transition-colors"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
