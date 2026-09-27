import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import type { Locale } from '@/lib/i18n/locale';

const landingContent = {
  es: {
    eyebrow: 'Tu espacio de estudio, a tu ritmo',
    navFeatures: 'Funciones',
    navHowItWorks: 'Cómo funciona',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    heroTitle: 'Estudia con claridad. Avanza con intención.',
    heroDescription:
      'Komorebi reúne tus proyectos, calendario y sesiones de enfoque en un solo espacio pensado para acompañar tu aprendizaje.',
    heroPrimary: 'Comenzar a organizarme',
    heroSecondary: 'Explorar funciones',
    heroNote: 'Diseñado para estudiantes que quieren avanzar sin sentirse abrumados.',
    featureEyebrow: 'Todo lo que necesitas para avanzar',
    featureTitle: 'Una rutina de estudio que se adapta a ti',
    featureDescription:
      'Planifica lo importante, protege tu tiempo y entiende tu progreso con herramientas conectadas entre sí.',
    features: [
      {
        title: 'Proyectos en orden',
        description: 'Convierte materias, objetivos y entregas en pasos claros y manejables.',
      },
      {
        title: 'Calendario con propósito',
        description:
          'Organiza tus sesiones de estudio y visualiza lo que viene sin perder contexto.',
      },
      {
        title: 'Enfoque realista',
        description: 'Reserva tiempo para concentrarte y construye una rutina que puedas sostener.',
      },
      {
        title: 'Progreso visible',
        description: 'Revisa tu avance y toma mejores decisiones sobre tu carga de estudio.',
      },
    ],
    assistantTitle: 'Una ayuda cuando la necesitas',
    assistantDescription:
      'Komo complementa tu planificación con orientación contextual para ayudarte a decidir el siguiente paso.',
    howEyebrow: 'Una forma simple de empezar',
    howTitle: 'De la intención a la acción',
    steps: [
      ['Crea tu espacio', 'Reúne tus materias, metas y proyectos en un mismo lugar.'],
      [
        'Planifica tu semana',
        'Ordena tareas y sesiones alrededor del tiempo que realmente tienes.',
      ],
      ['Enfócate y revisa', 'Estudia con intención y usa tu avance para ajustar el próximo paso.'],
    ],
    finalTitle: 'Haz espacio para aprender mejor.',
    finalDescription: 'Empieza a construir una forma de estudiar más clara, personal y constante.',
    footer: 'Komorebi · Un espacio de estudio para avanzar con calma.',
  },
  en: {
    eyebrow: 'Your study space, at your own pace',
    navFeatures: 'Features',
    navHowItWorks: 'How it works',
    login: 'Log in',
    register: 'Create account',
    heroTitle: 'Study with clarity. Move forward with intention.',
    heroDescription:
      'Komorebi brings your projects, calendar, and focus sessions together in one space designed to support your learning.',
    heroPrimary: 'Start organising',
    heroSecondary: 'Explore features',
    heroNote: 'Made for students who want to move forward without feeling overwhelmed.',
    featureEyebrow: 'Everything you need to move forward',
    featureTitle: 'A study routine that adapts to you',
    featureDescription:
      'Plan what matters, protect your time, and understand your progress with tools that work together.',
    features: [
      {
        title: 'Projects in order',
        description: 'Turn subjects, goals, and deadlines into clear and manageable steps.',
      },
      {
        title: 'A purposeful calendar',
        description: 'Organise study sessions and see what is coming without losing context.',
      },
      {
        title: 'Realistic focus',
        description: 'Set aside time to focus and build a routine you can sustain.',
      },
      {
        title: 'Visible progress',
        description: 'Review your progress and make better decisions about your study workload.',
      },
    ],
    assistantTitle: 'Support when you need it',
    assistantDescription:
      'Komo complements your planning with contextual guidance to help you decide what to do next.',
    howEyebrow: 'A simple way to start',
    howTitle: 'From intention to action',
    steps: [
      ['Create your space', 'Bring your subjects, goals, and projects together in one place.'],
      ['Plan your week', 'Arrange tasks and sessions around the time you actually have.'],
      ['Focus and review', 'Study with intention and use your progress to adjust what comes next.'],
    ],
    finalTitle: 'Make room to learn better.',
    finalDescription: 'Start building a clearer, more personal, and more consistent way to study.',
    footer: 'Komorebi · A study space to move forward calmly.',
  },
} as const;

const featureIcons = [FolderKanban, CalendarDays, Clock3, BarChart3];

function localizedPath(locale: Locale, path: string) {
  return `/${locale}${path}`;
}

export function LandingPage({ locale }: { locale: Locale }) {
  const content = landingContent[locale];
  const alternateLocale: Locale = locale === 'es' ? 'en' : 'es';
  const registerPath = localizedPath(locale, locale === 'es' ? '/registro' : '/register');

  return (
    <main id="contenido" className="overflow-hidden bg-surface text-on-surface">
      <section className="relative isolate overflow-hidden border-b border-outline-variant/30">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_color-mix(in_srgb,var(--color-secondary)_18%,transparent),transparent_48%),radial-gradient(circle_at_bottom_left,_color-mix(in_srgb,var(--color-accent-amber)_18%,transparent),transparent_42%)]" />
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href={localizedPath(locale, '')}
            className="flex items-center gap-2.5 font-bold text-primary"
          >
            <Image
              src="/images/mascot/chigui-focus.png"
              alt=""
              width={40}
              height={40}
              className="size-9 object-contain"
              priority
            />
            <span className="tracking-tight">Komorebi</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-on-surface-variant md:flex">
            <a href="#funciones" className="transition-colors hover:text-primary">
              {content.navFeatures}
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-primary">
              {content.navHowItWorks}
            </a>
          </nav>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link
              href={localizedPath(alternateLocale, '')}
              lang={alternateLocale}
              aria-label={locale === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish'}
              className="inline-flex min-h-10 items-center rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3 text-xs font-bold text-primary transition-colors hover:bg-surface-container-low"
            >
              {alternateLocale.toUpperCase()}
            </Link>
            <Link
              className="hidden rounded-lg px-3 py-2 text-on-surface-variant hover:text-primary sm:inline-flex"
              href={localizedPath(locale, '/login')}
            >
              {content.login}
            </Link>
            <Link
              className="inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-on-primary shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary-container"
              href={registerPath}
            >
              {content.register}
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-surface-container-low px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-secondary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {content.eyebrow}
            </p>
            <h1 className="max-w-xl text-4xl font-bold tracking-[-0.045em] text-primary sm:text-5xl lg:text-6xl">
              {content.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-on-surface-variant sm:text-lg">
              {content.heroDescription}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary shadow-md transition-transform hover:-translate-y-0.5 hover:bg-primary-container"
                href={registerPath}
              >
                {content.heroPrimary}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-5 text-sm font-bold text-primary transition-colors hover:bg-surface-container-low"
                href="#funciones"
              >
                {content.heroSecondary}
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-on-surface-variant">
              <CheckCircle2 className="size-4 text-status-success" aria-hidden="true" />
              {content.heroNote}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-8 -z-10 rounded-full bg-secondary/20 blur-3xl" />
            <div className="rounded-[2rem] border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-[0_24px_70px_rgba(50,32,17,0.16)] sm:p-7">
              <div className="flex items-center justify-between border-b border-outline-variant/40 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-accent-amber">
                    Komorebi
                  </p>
                  <p className="mt-1 text-lg font-bold text-primary">Study flow</p>
                </div>
                <Image
                  src="/images/mascot/chigui-welcome.png"
                  alt=""
                  width={72}
                  height={72}
                  className="size-14 object-contain"
                />
              </div>
              <div className="mt-5 space-y-3">
                {content.features.slice(0, 3).map((feature, index) => {
                  const Icon = featureIcons[index];
                  return (
                    <div
                      key={feature.title}
                      className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3.5"
                    >
                      <div className="rounded-xl bg-primary p-2 text-on-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">{feature.title}</p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="funciones" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-secondary">
            {content.featureEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {content.featureTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">
            {content.featureDescription}
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {content.features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <article
                key={feature.title}
                className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-6 shadow-sm"
              >
                <div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-primary">{feature.title}</h3>
                <p className="mt-2 leading-7 text-on-surface-variant">{feature.description}</p>
              </article>
            );
          })}
        </div>
        <aside className="mt-5 rounded-3xl bg-primary p-6 text-on-primary sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div>
            <h3 className="text-xl font-bold">{content.assistantTitle}</h3>
            <p className="mt-2 max-w-2xl leading-7 text-on-primary/75">
              {content.assistantDescription}
            </p>
          </div>
          <Sparkles className="mt-5 size-8 shrink-0 text-accent-amber sm:mt-0" aria-hidden="true" />
        </aside>
      </section>

      <section
        id="como-funciona"
        className="border-y border-outline-variant/30 bg-surface-container-low"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-secondary">
            {content.howEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {content.howTitle}
          </h2>
          <ol className="mt-10 grid gap-5 lg:grid-cols-3">
            {content.steps.map(([title, description], index) => (
              <li key={title} className="rounded-3xl bg-surface-container-lowest p-6">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-on-secondary">
                  0{index + 1}
                </span>
                <h3 className="mt-5 text-lg font-bold text-primary">{title}</h3>
                <p className="mt-2 leading-7 text-on-surface-variant">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 lg:py-28">
        <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          {content.finalTitle}
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-on-surface-variant">
          {content.finalDescription}
        </p>
        <Link
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary shadow-md transition-transform hover:-translate-y-0.5 hover:bg-primary-container"
          href={registerPath}
        >
          {content.register}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <footer className="border-t border-outline-variant/30 px-5 py-8 text-center text-sm text-on-surface-variant">
        {content.footer}
      </footer>
    </main>
  );
}
