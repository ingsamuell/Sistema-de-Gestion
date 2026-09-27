import { notFound } from 'next/navigation';
import { LandingPage } from '@/components/marketing/LandingPage';
import { isLocale } from '@/lib/i18n/locale';

export default async function LocalizedLandingPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;

  if (!isLocale(locale)) notFound();

  return <LandingPage locale={locale} />;
}
