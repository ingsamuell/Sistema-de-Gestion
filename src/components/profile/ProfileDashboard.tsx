'use client';

import Link from 'next/link';
import React, { useRef, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Bot,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Check,
  ChevronDown,
  Edit3,
  FileText,
  Flame,
  GraduationCap,
  ImagePlus,
  Images,
  KeyRound,
  Layers,
  Loader2,
  Mail,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Award,
} from 'lucide-react';
import { ChangePasswordModal } from '@/components/profile/ChangePasswordModal';
import { AddPasswordModal } from '@/components/profile/AddPasswordModal';
import { Button } from '@/components/ui/Button';
import { onboardingQuestions } from '@/features/onboarding/data/questions';
import type { OnboardingAnswersInput } from '@/features/onboarding/actions/saveOnboardingAction';
import {
  OBJETIVOS_OPTIONS,
  RITMOS_OPTIONS,
  DIFICULTADES_OPTIONS,
  AREAS_PRIORITARIAS_OPTIONS,
} from '@/features/profile/data/learningOptions';
import { updateProfileIdentity } from '@/features/profile/actions/updateProfileIdentityAction';
import { updateLearningPreferences } from '@/features/profile/actions/updateLearningPreferencesAction';
import { useProfileTour } from '@/hooks/useProfileTour';

export type ProfileDashboardData = {
  userId?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  username: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  uploadedAvatars?: string[];
  role?: string | null;
  age?: string | null;
  workSituation?: string | null;
  availability?: string | null;
  schedule?: string | null;
  methodology?: string | null;
  experience?: string | null;
  personalContext?: string | null;
  description?: string | null;
  objective?: string | null;
  pace?: string | null;
  difficulties?: string[];
  priorityAreas?: string[];
  currentStreak?: number | null;
  bestStreak?: number | null;
  lastSignInAt?: string | null;
  hasPassword?: boolean;
  isGoogleUser?: boolean;
};

type EditableSection = 'identity' | 'learning' | null;

export function ProfileDashboard({ profile }: { profile: ProfileDashboardData }) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<EditableSection>(null);

  useProfileTour();

  // Estados de Contraseña y Seguridad
  const [hasPassword, setHasPassword] = useState(profile.hasPassword ?? true);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isAddPasswordModalOpen, setIsAddPasswordModalOpen] = useState(false);

  // Estados de Identidad
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [username, setUsername] = useState(profile.username);
  const [description, setDescription] = useState(profile.description || '');

  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl || '');
  const [uploadedAvatars, setUploadedAvatars] = useState<string[]>(
    profile.uploadedAvatars && profile.uploadedAvatars.length > 0
      ? profile.uploadedAvatars
      : profile.avatarUrl
        ? [profile.avatarUrl]
        : [],
  );
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Estados de Respuestas Onboarding
  const [answers, setAnswers] = useState<OnboardingAnswersInput>({
    rol_condicion: profile.role ?? '',
    edad: profile.age ?? '',
    situacion_laboral: profile.workSituation ?? '',
    jornada_horarios: profile.schedule ?? '',
    tiempo_diario_min: profile.availability ?? '',
    metodologia: profile.methodology ?? '',
    experiencia: profile.experience ?? '',
  });

  // Estados de Información Complementaria
  const [objective, setObjective] = useState(profile.objective || '');
  const [pace, setPace] = useState(profile.pace || '');
  const [difficulties, setDifficulties] = useState<string[]>(profile.difficulties || []);
  const [priorityAreas, setPriorityAreas] = useState<string[]>(profile.priorityAreas || []);

  // Estados de Guardado
  const [isSavingIdentity, startSavingIdentity] = useTransition();
  const [identityMessage, setIdentityMessage] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [isSavingLearning, startSavingLearning] = useTransition();
  const [learningMessage, setLearningMessage] = useState<string | null>(null);
  const [learningError, setLearningError] = useState<string | null>(null);

  const unknown = 'Aún no definido';

  function toggleEditing(section: Exclude<EditableSection, null>) {
    setIdentityMessage(null);
    setIdentityError(null);
    setLearningMessage(null);
    setLearningError(null);
    setEditingSection((current) => (current === section ? null : section));
  }

  function updateAnswer(field: keyof OnboardingAnswersInput, value: string) {
    setAnswers((current) => ({ ...current, [field]: value }));
  }

  function toggleDifficulty(option: string) {
    setDifficulties((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );
  }

  function togglePriorityArea(area: string) {
    setPriorityAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    );
  }

  async function handleAvatarFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('La imagen debe pesar menos de 5 MB.');
      return;
    }

    try {
      setAvatarError(null);
      const compressedDataUrl = await compressImage(file, 128);
      setAvatarPreview(compressedDataUrl);

      setUploadedAvatars((prev) => {
        const filtered = prev.filter((u) => u !== compressedDataUrl);
        return [compressedDataUrl, ...filtered].slice(0, 5);
      });

      setIsLibraryOpen(true);
    } catch {
      setAvatarError('Ocurrió un error al procesar la imagen seleccionada.');
    } finally {
      event.target.value = '';
    }
  }

  function handleSaveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityMessage(null);
    setIdentityError(null);
    const displayName = `${firstName} ${lastName}`.trim() || username;

    startSavingIdentity(async () => {
      const res = await updateProfileIdentity({
        firstName,
        lastName,
        username,
        description,
        avatarUrl: avatarPreview || undefined,
        uploadedAvatars,
        role: answers.rol_condicion,
        age: answers.edad,
        workSituation: answers.situacion_laboral,
      });

      if (!res.success) {
        setIdentityError(res.error || 'No se pudo guardar la información.');
        return;
      }

      setIdentityMessage('¡Información de perfil actualizada exitosamente!');

      // Sincronizar en tiempo real el botón de perfil
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('komorebi:profile-updated', {
            detail: {
              fullName: displayName,
              username: username.trim().replace(/^@+/, ''),
              avatarUrl: avatarPreview,
            },
          }),
        );
      }

      setTimeout(() => {
        setEditingSection(null);
        router.refresh();
      }, 700);
    });
  }

  function handleSaveLearning(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLearningMessage(null);
    setLearningError(null);

    startSavingLearning(async () => {
      const res = await updateLearningPreferences({
        schedule: answers.jornada_horarios,
        availability: answers.tiempo_diario_min,
        methodology: answers.metodologia,
        experience: answers.experiencia,
        objective,
        pace,
        difficulties,
        priorityAreas,
      });

      if (!res.success) {
        setLearningError(res.error || 'No se pudo guardar la información de aprendizaje.');
        return;
      }

      setLearningMessage('¡Preferencias de aprendizaje guardadas correctamente!');
      setTimeout(() => {
        setEditingSection(null);
        router.refresh();
      }, 700);
    });
  }

  const currentDisplayName = [firstName, lastName].filter(Boolean).join(' ') || profile.name;

  return (
    <div className="relative isolate min-w-0 overflow-hidden py-1">
      <div className="pointer-events-none absolute -left-24 top-20 -z-10 size-64 rounded-full bg-accent-amber/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-[30rem] -z-10 size-72 rounded-full bg-primary/5 blur-3xl" />

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-amber">
          Espacio personal
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Perfil</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Tu información de identidad y preferencias de aprendizaje, organizadas para que puedas
          ajustarlas cuando lo requieras.
        </p>
      </header>

      <div className="space-y-6">
        {/* SECCIÓN 1: Identidad y presencia */}
        <WideSection
          id="tour-profile-identity"
          title="Identidad y presencia"
          description="La información con la que te reconocemos dentro de Komorebi y los datos principales de tu cuenta."
          icon={<Edit3 className="size-5" />}
          actionLabel={editingSection === 'identity' ? 'Cerrar edición' : 'Editar'}
          onAction={() => toggleEditing('identity')}
        >
          <AnimatePresence mode="wait">
            {editingSection === 'identity' ? (
              <motion.form
                key="edit-identity"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                onSubmit={handleSaveIdentity}
                className="space-y-6"
              >
                {/* Bloque Avatar y subida */}
                <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4 sm:p-5">
                  <p className="text-sm font-semibold text-on-surface">Foto de perfil y avatar</p>
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-primary/30 bg-surface-container-lowest text-2xl font-bold text-primary shadow-[0_10px_24px_-12px_rgba(74,53,37,0.35)]">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarPreview}
                          alt="Vista previa de perfil"
                          className="size-full object-cover"
                        />
                      ) : (
                        profile.initials
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleAvatarFile}
                        className="sr-only"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-h-10 gap-2 cursor-pointer"
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          <ImagePlus className="size-4" />
                          Subir nueva imagen
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-h-10 gap-2 cursor-pointer"
                          onClick={() => setIsLibraryOpen((prev) => !prev)}
                        >
                          <Images className="size-4" />
                          {isLibraryOpen ? 'Ocultar biblioteca' : 'Biblioteca de avatares'}
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Formatos aceptados: PNG, JPG o WebP (máx. 5 MB). La imagen se optimiza
                        automáticamente.
                      </p>
                      {avatarError && (
                        <p role="alert" className="mt-2 text-xs font-medium text-status-error">
                          {avatarError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Panel Biblioteca de Avatares (Sólo fotos subidas por el usuario) */}
                  {isLibraryOpen && (
                    <div className="mt-5 rounded-2xl border border-primary/20 bg-surface-container-lowest p-4 sm:p-5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Images className="size-4 text-primary" />
                        <h4 className="text-sm font-bold text-on-surface">
                          Biblioteca de avatares
                        </h4>
                      </div>

                      {uploadedAvatars.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-2.5">
                            Tus fotos subidas
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {uploadedAvatars.map((url, idx) => {
                              const isSelected = avatarPreview === url;
                              return (
                                <button
                                  key={`uploaded-${idx}`}
                                  type="button"
                                  onClick={() => setAvatarPreview(url)}
                                  className={`group relative size-16 overflow-hidden rounded-2xl border-2 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-primary shadow-md ring-2 ring-primary/30'
                                      : 'border-outline-variant hover:border-primary/50'
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`Avatar subido ${idx + 1}`}
                                    className="size-full object-cover"
                                  />
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                      <div className="rounded-full bg-primary p-0.5 text-surface">
                                        <Check className="size-3.5 stroke-[3]" />
                                      </div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-outline-variant p-4 text-center">
                          <p className="text-xs text-on-surface-variant">
                            Aún no has subido fotos de perfil. Puedes subir una usando el botón
                            «Subir nueva imagen».
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Nombre y Apellido divididos en 2 recuadros diferentes */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="nombre_input"
                      className="block text-xs font-semibold uppercase tracking-wide text-outline"
                    >
                      Nombre
                    </label>
                    <input
                      id="nombre_input"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      maxLength={50}
                      placeholder="Tu nombre"
                      className="mt-2 block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="apellido_input"
                      className="block text-xs font-semibold uppercase tracking-wide text-outline"
                    >
                      Apellido
                    </label>
                    <input
                      id="apellido_input"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      maxLength={50}
                      placeholder="Tu apellido"
                      className="mt-2 block w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Nombre de usuario */}
                <div>
                  <label
                    htmlFor="nombre_usuario_input"
                    className="block text-xs font-semibold uppercase tracking-wide text-outline"
                  >
                    Nombre de usuario
                  </label>
                  <div className="relative mt-2 flex items-center">
                    <span className="pointer-events-none absolute left-3 text-sm font-semibold text-outline">
                      @
                    </span>
                    <input
                      id="nombre_usuario_input"
                      type="text"
                      value={username.replace(/^@+/, '')}
                      onChange={(e) => setUsername(e.target.value.replace(/^@+/, ''))}
                      required
                      minLength={3}
                      maxLength={30}
                      placeholder="usuario"
                      className="block w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-8 pr-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <span className="mt-1 block text-xs text-on-surface-variant">
                    Letras, números, guiones y puntos.
                  </span>
                </div>

                {/* Descripción de perfil con límites de resize mínimo y máximo */}
                <div>
                  <label
                    htmlFor="descripcion_input"
                    className="block text-xs font-semibold uppercase tracking-wide text-outline"
                  >
                    Descripción de perfil
                  </label>
                  <textarea
                    id="descripcion_input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={200}
                    rows={4}
                    placeholder="Escribe una breve descripción sobre ti, tus intereses o tu enfoque de estudio."
                    className="mt-2 block w-full resize-y min-h-[88px] max-h-[220px] rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm leading-relaxed text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-outline">
                    <span>Información guardada en tu perfil para orientar tu experiencia.</span>
                    <span>{description.length}/200</span>
                  </div>
                </div>

                {/* Preguntas de identidad (Rol, Edad, Situación laboral) */}
                <div className="border-t border-outline-variant/40 pt-5">
                  <h3 className="text-sm font-bold text-on-surface">Datos de partida</h3>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Condición académica y ocupacional inicial.
                  </p>
                  <div className="mt-3 grid gap-3">
                    {onboardingFields.slice(0, 3).map(({ field, questionId }) => {
                      const item = onboardingQuestions.find((q) => q.id === questionId);
                      if (!item) return null;
                      return (
                        <div
                          key={field}
                          className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-3.5"
                        >
                          <p className="text-xs font-semibold">{item.question}</p>
                          <AnswerPicker
                            value={answers[field]}
                            options={item.options}
                            onChange={(value) => updateAnswer(field, value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Seguridad y acceso de la cuenta en edición */}
                <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <KeyRound className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-on-surface">
                            {hasPassword ? 'Contraseña y seguridad' : 'Contraseña no configurada'}
                          </h4>
                          {hasPassword ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-2.5 py-0.5 text-[11px] font-semibold text-status-success">
                              <CheckCircle2 className="size-3" />
                              Configurada
                            </span>
                          ) : profile.isGoogleUser ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent-amber/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-amber">
                              Acceso con Google
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant max-w-md">
                          {hasPassword
                            ? 'Tu cuenta tiene una contraseña activa. Puedes solicitar un enlace a tu correo para cambiarla cuando lo necesites.'
                            : 'Iniciaste sesión con Google y aún no tienes una contraseña asignada. Puedes agregar una para acceder también con tu correo y contraseña.'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 self-end sm:self-center">
                      {hasPassword ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsChangePasswordModalOpen(true)}
                          className="min-h-10 gap-2 cursor-pointer font-medium"
                        >
                          <KeyRound className="size-4" />
                          Cambiar contraseña
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setIsAddPasswordModalOpen(true)}
                          className="min-h-10 gap-2 cursor-pointer font-semibold shadow-sm"
                        >
                          <PlusCircle className="size-4" />
                          Agregar contraseña
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {identityError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-status-error/30 bg-status-error-bg px-4 py-3 text-sm text-status-error"
                  >
                    {identityError}
                  </p>
                )}

                {identityMessage && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-xl border border-status-success/30 bg-status-success-bg px-4 py-3 text-sm text-status-success"
                  >
                    <CheckCircle2 className="size-4 shrink-0" />
                    {identityMessage}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-outline-variant/40 pt-4">
                  <p className="text-xs text-on-surface-variant">
                    Los cambios se aplicarán inmediatamente a tu cuenta.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingSection(null)}
                      disabled={isSavingIdentity}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSavingIdentity} className="min-h-11 gap-2">
                      {isSavingIdentity ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {isSavingIdentity ? 'Guardando...' : 'Guardar identidad'}
                    </Button>
                  </div>
                </div>
              </motion.form>
            ) : (
              /* Vista de lectura de Identidad y Presencia */
              <motion.div
                key="view-identity"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                className="space-y-6"
              >
                <div className="grid min-w-0 gap-6 lg:grid-cols-[auto_minmax(0,1fr)_15rem] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest text-2xl font-bold text-primary shadow-[0_10px_24px_-12px_rgba(74,53,37,0.35)]">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarPreview}
                          alt={`Foto de perfil de ${currentDisplayName}`}
                          className="size-full object-cover"
                        />
                      ) : (
                        profile.initials
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold tracking-tight">
                      {currentDisplayName}
                    </h2>
                    <p className="mt-1 truncate text-sm text-on-surface-variant">@{username}</p>
                    {description ? (
                      <div className="mt-4 rounded-xl border border-primary/15 bg-surface-container-low px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                          Descripción de perfil
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-on-surface-variant">
                          {description}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-2 border-t border-outline-variant/40 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <CompactDetail label="Usuario" value={`@${username}`} />
                    <CompactDetail label="Rol actual" value={answers.rol_condicion || unknown} />
                  </div>
                </div>

                {/* Respuestas de partida */}
                <div className="border-t border-outline-variant/40 pt-5">
                  <h3 className="text-sm font-bold text-on-surface">Información de partida</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {onboardingFields.slice(0, 3).map(({ field, questionId }) => {
                      const item = onboardingQuestions.find((q) => q.id === questionId);
                      if (!item) return null;
                      return (
                        <div
                          key={field}
                          className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/75 p-3.5"
                        >
                          <p className="text-[11px] font-semibold uppercase text-on-surface-variant">
                            {item.question}
                          </p>
                          <p className="mt-1 text-sm font-bold text-on-surface">
                            {answers[field] || unknown}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </WideSection>

        {/* SECCIÓN 2: Perfil de aprendizaje e Información complementaria */}
        <WideSection
          id="tour-profile-learning"
          title="Perfil de aprendizaje"
          description="Tus preferencias de estudio y la información complementaria para adaptar la planificación y tus ritmos."
          icon={<GraduationCap className="size-5" />}
          actionLabel={editingSection === 'learning' ? 'Cerrar edición' : 'Editar'}
          onAction={() => toggleEditing('learning')}
        >
          <AnimatePresence mode="wait">
            {editingSection === 'learning' ? (
              <motion.form
                key="edit-learning"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                onSubmit={handleSaveLearning}
                className="space-y-6"
              >
                {/* Bloque: Preferencias de disponibilidad y metodología */}
                <div>
                  <h3 className="text-base font-bold text-on-surface">
                    Preferencias de aprendizaje
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Estas respuestas adaptan la estructuración de tus proyectos a tu disponibilidad
                    y experiencia previa.
                  </p>
                  <div className="mt-4 grid min-w-0 gap-3">
                    {onboardingFields.slice(3).map(({ field, questionId }) => {
                      const item = onboardingQuestions.find((q) => q.id === questionId);
                      if (!item) return null;
                      return (
                        <div
                          key={field}
                          className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4"
                        >
                          <p className="text-sm font-semibold leading-snug">{item.question}</p>
                          <AnswerPicker
                            value={answers[field]}
                            options={item.options}
                            onChange={(value) => updateAnswer(field, value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bloque: Información complementaria */}
                <div className="border-t border-outline-variant/40 pt-5">
                  <h3 className="text-base font-bold text-on-surface">
                    Información complementaria
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Ajustes adicionales sobre tus objetivos, ritmo, dificultades y áreas
                    prioritarias de estudio.
                  </p>

                  <div className="mt-4 grid gap-4">
                    {/* Objetivo principal */}
                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
                      <div className="flex items-center gap-2">
                        <Target className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Objetivo principal</p>
                      </div>
                      <AnswerPicker
                        value={objective}
                        options={[...OBJETIVOS_OPTIONS]}
                        onChange={(val) => setObjective(val)}
                      />
                    </div>

                    {/* Ritmo preferido */}
                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Ritmo preferido</p>
                      </div>
                      <AnswerPicker
                        value={pace}
                        options={[...RITMOS_OPTIONS]}
                        onChange={(val) => setPace(val)}
                      />
                    </div>

                    {/* Dificultades habituales (Opción múltiple) */}
                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Dificultades habituales</p>
                      </div>
                      <p className="text-xs text-on-surface-variant mb-3">
                        Puedes elegir una o varias opciones que identifiquen tus retos.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {DIFICULTADES_OPTIONS.map((diff) => {
                          const isSelected = difficulties.includes(diff);
                          return (
                            <button
                              key={diff}
                              type="button"
                              onClick={() => toggleDifficulty(diff)}
                              className={`flex min-h-12 items-center justify-between gap-2.5 rounded-xl border p-3 text-left text-sm transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary/10 font-semibold text-primary shadow-sm'
                                  : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/40'
                              }`}
                            >
                              <span className="leading-snug">{diff}</span>
                              <div
                                className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                  isSelected
                                    ? 'border-primary bg-primary text-surface'
                                    : 'border-outline-variant'
                                }`}
                              >
                                {isSelected && <Check className="size-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Áreas prioritarias (Opción múltiple) */}
                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="size-4 text-primary" />
                        <p className="text-sm font-semibold">Áreas prioritarias</p>
                      </div>
                      <p className="text-xs text-on-surface-variant mb-3">
                        Puedes seleccionar una o más áreas en las que centras tu aprendizaje.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {AREAS_PRIORITARIAS_OPTIONS.map((area) => {
                          const isSelected = priorityAreas.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => togglePriorityArea(area)}
                              className={`flex min-h-12 items-center justify-between gap-2.5 rounded-xl border p-3 text-left text-sm transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary/10 font-semibold text-primary shadow-sm'
                                  : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary/40'
                              }`}
                            >
                              <span className="leading-snug">{area}</span>
                              <div
                                className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                  isSelected
                                    ? 'border-primary bg-primary text-surface'
                                    : 'border-outline-variant'
                                }`}
                              >
                                {isSelected && <Check className="size-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {learningError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-status-error/30 bg-status-error-bg px-4 py-3 text-sm text-status-error"
                  >
                    {learningError}
                  </p>
                )}

                {learningMessage && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-xl border border-status-success/30 bg-status-success-bg px-4 py-3 text-sm text-status-success"
                  >
                    <CheckCircle2 className="size-4 shrink-0" />
                    {learningMessage}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-outline-variant/40 pt-4">
                  <p className="text-xs text-on-surface-variant">
                    Guarda las preferencias para adaptar tus recomendaciones.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingSection(null)}
                      disabled={isSavingLearning}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSavingLearning} className="min-h-11 gap-2">
                      {isSavingLearning ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {isSavingLearning ? 'Guardando...' : 'Guardar preferencias'}
                    </Button>
                  </div>
                </div>
              </motion.form>
            ) : (
              /* Vista de lectura de Perfil de Aprendizaje */
              <motion.div
                key="view-learning"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Preferencias de aprendizaje</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {onboardingFields.slice(3).map(({ field, questionId }) => {
                      const item = onboardingQuestions.find((q) => q.id === questionId);
                      if (!item) return null;
                      return (
                        <div
                          key={field}
                          className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/75 p-3.5"
                        >
                          <p className="text-[11px] font-semibold uppercase text-on-surface-variant">
                            {item.question}
                          </p>
                          <p className="mt-1 text-sm font-bold text-on-surface">
                            {answers[field] || unknown}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Información complementaria en modo lectura */}
                <div className="border-t border-outline-variant/40 pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="size-4 text-primary" />
                    <h3 className="text-sm font-bold text-on-surface">
                      Información complementaria
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/75 p-3.5">
                      <div className="flex items-center gap-1.5 text-outline">
                        <Target className="size-3.5" />
                        <p className="text-[11px] font-semibold uppercase">Objetivo principal</p>
                      </div>
                      <p className="mt-1 text-sm font-bold text-on-surface">
                        {objective || unknown}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/75 p-3.5">
                      <div className="flex items-center gap-1.5 text-outline">
                        <CalendarClock className="size-3.5" />
                        <p className="text-[11px] font-semibold uppercase">Ritmo preferido</p>
                      </div>
                      <p className="mt-1 text-sm font-bold text-on-surface">{pace || unknown}</p>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/75 p-3.5 sm:col-span-2">
                      <div className="flex items-center gap-1.5 text-outline">
                        <ShieldAlert className="size-3.5" />
                        <p className="text-[11px] font-semibold uppercase">
                          Dificultades habituales
                        </p>
                      </div>
                      {difficulties.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {difficulties.map((diff) => (
                            <span
                              key={diff}
                              className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                            >
                              <Check className="size-3" />
                              {diff}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm font-bold text-on-surface">{unknown}</p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/75 p-3.5 sm:col-span-2">
                      <div className="flex items-center gap-1.5 text-outline">
                        <Layers className="size-3.5" />
                        <p className="text-[11px] font-semibold uppercase">Áreas prioritarias</p>
                      </div>
                      {priorityAreas.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {priorityAreas.map((area) => (
                            <span
                              key={area}
                              className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                            >
                              <Check className="size-3" />
                              {area}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm font-bold text-on-surface">{unknown}</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </WideSection>

        {/* SECCIÓN 3: Términos y privacidad */}
        <WideSection
          id="tour-profile-privacy"
          title="Términos y privacidad"
          description="Consulta las condiciones de uso de Komorebi y cómo cuidamos tu información."
          icon={<FileText className="size-5" />}
        >
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-outline-variant/40 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">
                    Información clara, siempre disponible
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                    Revisa los documentos vigentes cuando lo necesites. Te avisaremos si alguna
                    actualización requiere una nueva revisión.
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface-variant">
                Versión vigente
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href="/terms"
                className="group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 p-4 transition-colors hover:border-primary/35 hover:bg-surface-container-low"
              >
                <div className="flex items-start justify-between gap-3">
                  <FileText className="size-5 text-primary" />
                  <ArrowUpRight className="size-4 text-outline transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <h4 className="mt-5 text-sm font-bold text-on-surface">Términos y condiciones</h4>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                  Conoce las reglas de uso, convivencia e integridad académica.
                </p>
                <span className="mt-3 inline-flex text-xs font-semibold text-primary">
                  Ver términos →
                </span>
              </Link>

              <Link
                href="/privacy"
                className="group rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 p-4 transition-colors hover:border-primary/35 hover:bg-surface-container-low"
              >
                <div className="flex items-start justify-between gap-3">
                  <ShieldCheck className="size-5 text-primary" />
                  <ArrowUpRight className="size-4 text-outline transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <h4 className="mt-5 text-sm font-bold text-on-surface">Política de privacidad</h4>
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                  Entiende qué información usamos y las decisiones que puedes tomar sobre ella.
                </p>
                <span className="mt-3 inline-flex text-xs font-semibold text-primary">
                  Ver privacidad →
                </span>
              </Link>
            </div>
          </div>
        </WideSection>

        {/* SECCIÓN 4: Guía rápida del bot */}
        <WideSection
          id="tour-profile-bot-guide"
          title="Cómo usar el bot Komo"
          description="Una guía breve para consultar tu organización desde Telegram."
          icon={<Bot className="size-5" />}
        >
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 sm:p-5">
            <div className="flex items-start gap-3 border-b border-outline-variant/40 pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                <Bot className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Guía rápida</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                  Komo te ayuda a consultar proyectos y vencimientos sin salir de Telegram.
                </p>
              </div>
            </div>

            <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: 'Abre el bot',
                  description:
                    'Usa el acceso de Komo disponible en la plataforma para iniciar Telegram.',
                },
                {
                  title: 'Vinculación automática',
                  description: 'El enlace identifica tu cuenta para que el bot pueda reconocerte.',
                },
                {
                  title: 'Consulta tu organización',
                  description: 'Revisa tus proyectos activos y sus fechas de vencimiento.',
                },
                {
                  title: 'Navega con botones',
                  description: 'No necesitas memorizar comandos: selecciona los botones del bot.',
                },
              ].map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest/80 p-4"
                >
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <h4 className="mt-4 text-sm font-bold text-on-surface">{step.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mt-4 rounded-xl bg-surface-container-low px-3 py-2.5 text-xs leading-relaxed text-on-surface-variant">
              Si el bot no reconoce tu cuenta, vuelve a abrirlo desde la plataforma para generar el
              enlace correcto.
            </p>
          </div>
        </WideSection>

        {/* SECCIÓN 5: Mi espacio de aprendizaje y Rachas */}
        <WideSection
          id="tour-profile-stats"
          title="Mi espacio de aprendizaje"
          description="La conexión entre tu perfil, tus temas, proyectos y el contexto que autorizas para la IA."
          icon={<Sparkles className="size-5" />}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_15rem]">
            <Link
              href="/temas"
              className="group rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/80 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-surface-container-low"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </div>
                <ArrowUpRight className="size-4 text-outline transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </div>
              <h3 className="mt-5 font-bold">Temas</h3>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                Organiza notas y fuentes para reutilizarlas en tus proyectos.
              </p>
            </Link>

            <Link
              href="/proyectos"
              className="group rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/80 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-surface-container-low"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Target className="size-5" />
                </div>
                <ArrowUpRight className="size-4 text-outline transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </div>
              <h3 className="mt-5 font-bold">Proyectos</h3>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                Mantén una vista clara de lo que estás construyendo.
              </p>
            </Link>

            <Link
              href="/certificaciones"
              className="group rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/80 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-surface-container-low"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Award className="size-5" />
                </div>
                <ArrowUpRight className="size-4 text-outline transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </div>
              <h3 className="mt-5 font-bold">Certificaciones</h3>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                Tus logros e inversión de tiempo validados.
              </p>
            </Link>

            {/* Tarjeta de Constancia / Rachas vinculadas a profiles */}
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Flame className="size-4 text-accent-amber" />
                Constancia
              </div>
              <div className="mt-5 space-y-3">
                <Streak value={`${profile.currentStreak ?? 0} días`} label="Racha actual" />
                <Streak value={`${profile.bestStreak ?? 0} días`} label="Mejor racha" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary/15 bg-surface-container-low px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold">Contexto bajo tu control</p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  La IA solo usará fuentes de Temas y Proyectos que decidas incluir.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-on-surface-variant">
              <Mail className="size-3.5" />
              {formatDate(profile.lastSignInAt)}
            </span>
          </div>
        </WideSection>
      </div>

      {/* Modal para cambiar contraseña */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        email={profile.email}
        isGoogleUser={profile.isGoogleUser}
      />

      {/* Modal para agregar contraseña (usuarios de Google sin contraseña) */}
      <AddPasswordModal
        isOpen={isAddPasswordModalOpen}
        onClose={() => setIsAddPasswordModalOpen(false)}
        email={profile.email}
        onPasswordAdded={() => {
          setHasPassword(true);
        }}
      />
    </div>
  );
}

const onboardingFields: Array<{ field: keyof OnboardingAnswersInput; questionId: number }> = [
  { field: 'rol_condicion', questionId: 1 },
  { field: 'edad', questionId: 2 },
  { field: 'situacion_laboral', questionId: 3 },
  { field: 'jornada_horarios', questionId: 4 },
  { field: 'tiempo_diario_min', questionId: 5 },
  { field: 'metodologia', questionId: 6 },
  { field: 'experiencia', questionId: 7 },
];

function AnswerPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = value || 'Selecciona una opción';

  return (
    <div className="relative mt-2">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-left text-sm font-medium transition-colors hover:border-primary/45 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        <span className={value ? 'min-w-0 break-words text-on-surface' : 'text-on-surface-variant'}>
          {selected}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Opciones de respuesta"
          className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-primary/20 bg-surface-container-lowest p-1.5 shadow-[0_16px_34px_-18px_rgba(74,53,37,0.45)]"
        >
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-outline">
            Elige una opción
          </p>
          {options.map((option) => {
            const isSelected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`flex w-full min-h-10 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs leading-snug transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-on-surface hover:bg-surface-container-low'
                }`}
              >
                <span>{option}</span>
                {isSelected && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WideSection({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  children,
  id,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <motion.div
      id={id}
      layout
      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
      className="max-w-full rounded-2xl border border-outline-variant/60 bg-surface-container-lowest/75 p-5 shadow-[0_10px_30px_-18px_rgba(74,53,37,0.3)] backdrop-blur-sm sm:p-6"
    >
      <motion.div
        layout="position"
        className="mb-6 flex flex-col gap-3 border-b border-outline-variant/40 pb-5 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
              {description}
            </p>
          </div>
        </div>
        {actionLabel && onAction && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-10 w-fit gap-2 self-start cursor-pointer"
            onClick={onAction}
          >
            <Edit3 className="size-3.5" />
            {actionLabel}
          </Button>
        )}
      </motion.div>
      <motion.div layout="position">{children}</motion.div>
    </motion.div>
  );
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-outline">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function Streak({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Aún sin actividad';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Aún sin actividad';
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short' }).format(date);
}

function compressImage(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize);
        const dataUrl = canvas.toDataURL('image/webp', 0.75);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen para optimizarla.'));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}
