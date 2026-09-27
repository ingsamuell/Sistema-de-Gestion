import { redirect } from 'next/navigation';

export default function RootPage() {
  // El Proxy escoge el idioma con la preferencia guardada o Accept-Language.
  // Esta ruta conserva una salida segura si el Proxy no está disponible en desarrollo.
  redirect('/es');
}
