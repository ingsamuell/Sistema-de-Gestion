'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  format,
  addMonths,
  subMonths,
  startOfYear,
  eachMonthOfInterval,
  endOfYear,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  startOfDay,
  addDays,
  addYears,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { hasObsceneContent } from '@/lib/moderation/clientModeration';
import { enUS, es } from 'date-fns/locale';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  ArrowLeft,
  Copy,
  X,
  Check,
  Upload,
  Sparkles,
  Loader2,
  AlertCircle,
  FileText,
  GripVertical,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import {
  getCalendarDataAction,
  deleteCalendarEventAction,
  updateCalendarEventScheduleAction,
  syncAvailabilityBlocksAction,
  updateCalendarEventDetailsAction,
  replicateAvailabilitiesAction,
} from '@/features/schedule/actions/calendarActions';
import {
  getActiveProjectsSimpleAction,
  createTaskAction,
} from '@/features/proyectos/actions/proyectoActions';
import { createClient } from '@/lib/supabase/client';
import { useCalendarTour } from '@/hooks/useCalendarTour';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedProjectHref } from '@/lib/i18n/routes';

interface Availability {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  label: string;
  type?:
    'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' | 'estudio' | 'ocupado';
  source?: 'google' | 'local' | 'supabase' | 'supabase_ia';
  eventId?: string;
  blockId?: string;
}

const COLOR_MAP: Record<
  string,
  { bg: string; hover: string; text: string; border: string; bgPale: string }
> = {
  libre: {
    bg: 'bg-[#C8D6AF]',
    hover: 'hover:bg-[#B5C59A]',
    text: 'text-[#3A4A28]',
    border: 'border-[#3A4A28]/20',
    bgPale: 'bg-[#C8D6AF]/30',
  },
  tareas: {
    bg: 'bg-[#C8D6AF]',
    hover: 'hover:bg-[#B5C59A]',
    text: 'text-[#3A4A28]',
    border: 'border-[#3A4A28]/20',
    bgPale: 'bg-[#C8D6AF]/30',
  },
  estudiando: {
    bg: 'bg-[#BBD0F4]',
    hover: 'hover:bg-[#A4BFE6]',
    text: 'text-[#203D6B]',
    border: 'border-[#203D6B]/20',
    bgPale: 'bg-[#BBD0F4]/30',
  },
  estudio: {
    bg: 'bg-[#BBD0F4]',
    hover: 'hover:bg-[#A4BFE6]',
    text: 'text-[#203D6B]',
    border: 'border-[#203D6B]/20',
    bgPale: 'bg-[#BBD0F4]/30',
  },
  trabajo: {
    bg: 'bg-[#F4C2BA]',
    hover: 'hover:bg-[#E5B0A7]',
    text: 'text-[#6B3229]',
    border: 'border-[#6B3229]/20',
    bgPale: 'bg-[#F4C2BA]/30',
  },
  ocupado: {
    bg: 'bg-[#F4C2BA]',
    hover: 'hover:bg-[#E5B0A7]',
    text: 'text-[#6B3229]',
    border: 'border-[#6B3229]/20',
    bgPale: 'bg-[#F4C2BA]/30',
  },
  descanso: {
    bg: 'bg-[#F9EBB2]',
    hover: 'hover:bg-[#E8D9A0]',
    text: 'text-[#5C4F1A]',
    border: 'border-[#5C4F1A]/20',
    bgPale: 'bg-[#F9EBB2]/30',
  },
  otra_actividad: {
    bg: 'bg-[#E1C6F5]',
    hover: 'hover:bg-[#CFAEE8]',
    text: 'text-[#4A2D69]',
    border: 'border-[#4A2D69]/20',
    bgPale: 'bg-[#E1C6F5]/30',
  },
};

// ARREGLO GLOBAL MAESTRO (Para lógica de rangos)
const TIME_SLOTS: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (let m = 0; m < 60; m += 5) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}
TIME_SLOTS.push('24:00');

const TIME_SLOT_INDEX_MAP = new Map<string, number>(TIME_SLOTS.map((slot, index) => [slot, index]));
const getSlotIndex = (slot: string): number => TIME_SLOT_INDEX_MAP.get(slot) ?? -1;

const parseISODate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const endOfMonthFn = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

function consolidateAvailabilitySlots(slots: Availability[]) {
  const nonTasks = slots.filter(
    (a) => !a.eventId && a.source !== 'google' && a.source !== 'supabase_ia',
  );
  if (nonTasks.length === 0) return [];

  const byDate: Record<string, Availability[]> = {};
  nonTasks.forEach((s) => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  const consolidated: Array<{
    fecha_especifica: string;
    hora_inicio: string;
    hora_fin: string;
    tipo: 'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad' | 'descanso';
    label: string;
    color?: string | null;
    origen: string;
  }> = [];

  for (const date in byDate) {
    const sorted = [...byDate[date]].sort((a, b) => a.startTime.localeCompare(b.startTime));
    let current: {
      date: string;
      start: string;
      end: string;
      type: string;
      label: string;
    } | null = null;

    for (const slot of sorted) {
      if (
        current &&
        current.end === slot.startTime &&
        current.type === slot.type &&
        current.label === (slot.label || '')
      ) {
        current.end = slot.endTime;
      } else {
        if (current) {
          let normalizedType:
            'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad' | 'descanso' = 'tareas';
          if (current.type === 'estudio' || current.type === 'estudiando')
            normalizedType = 'estudio';
          else if (current.type === 'trabajo' || current.type === 'ocupado')
            normalizedType = 'trabajo';
          else if (current.type === 'otra_actividad') normalizedType = 'otra_actividad';
          else if (current.type === 'descanso') normalizedType = 'descanso';
          else normalizedType = 'tareas';

          consolidated.push({
            fecha_especifica: current.date,
            hora_inicio: current.start,
            hora_fin: current.end,
            tipo: normalizedType,
            label: current.label,
            origen: 'manual',
          });
        }
        current = {
          date: slot.date,
          start: slot.startTime,
          end: slot.endTime,
          type: slot.type || 'tareas',
          label: slot.label || '',
        };
      }
    }

    if (current) {
      let normalizedType:
        'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad' | 'descanso' = 'tareas';
      if (current.type === 'estudio' || current.type === 'estudiando') normalizedType = 'estudio';
      else if (current.type === 'trabajo' || current.type === 'ocupado') normalizedType = 'trabajo';
      else if (current.type === 'otra_actividad') normalizedType = 'otra_actividad';
      else if (current.type === 'descanso') normalizedType = 'descanso';
      else normalizedType = 'tareas';

      consolidated.push({
        fecha_especifica: current.date,
        hora_inicio: current.start,
        hora_fin: current.end,
        tipo: normalizedType,
        label: current.label,
        origen: 'manual',
      });
    }
  }

  return consolidated;
}

export default function CalendarioPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const dateLocale = locale === 'es' ? es : enUS;
  const copy = React.useMemo(
    () =>
      locale === 'es'
        ? {
            back: 'Volver',
            upload: 'Subir horario (IA)',
            replicate: 'Replicar horario',
            month: 'Replicar en un mes específico...',
            year: 'Replicar en todos los meses',
            specific: 'Replicar en semanas específicas...',
            weeks: 'Semanas específicas',
            selectWeeks:
              'Selecciona a qué semanas futuras quieres copiar tu disponibilidad actual:',
            weekOf: 'Semana del',
            noWeeks: 'No hay semanas futuras disponibles en este año.',
            yearLabel: 'Año',
            monthLabel: 'Mes',
            replicateMonthTitle: 'Replicar en un mes específico',
            replicateMonthDescription:
              'Selecciona el mes donde deseas replicar la disponibilidad de esta semana.',
            replicateConfirm: 'Replicar',
            scheduleReplication: '¿Dónde deseas replicar este horario?',
            allMonths: 'En todos los meses (predeterminado)',
            specificMonth: 'Solo en un mes específico',
            chooseWeeks: 'Selecciona las semanas:',
            fileFormats: 'PNG, JPG, WEBP o PDF (Hasta 20MB)',
            noActiveProjects: 'No tienes proyectos activos para crear una tarea.',
            selectProject: 'Selecciona un proyecto',
            creatingTask: 'Creando tarea...',
            newTask: 'Nueva tarea',
            createTaskError: 'Error al crear la tarea',
            cancel: 'Cancelar',
            apply: 'Aplicar horario',
            googleConnect: 'Conectar Google Calendar',
            googleConnected: 'Conectado a Google Calendar',
            googleDisconnect: 'Desconectar',
            googleSynced: 'Google Calendar sincronizado correctamente',
            googleDisconnected: 'Google Calendar desconectado',
            googleConnectionError: 'Error al conectar con Google Calendar',
            uploadTitle: 'Cargar horario con Gemini AI',
            uploadSubtitle: 'Extrae automáticamente tus materias o turnos',
            uploadDescription:
              'Sube una foto, captura de pantalla (.png, .jpg) o documento PDF de tu horario escolar, universitario o laboral. La IA extraerá los días y bloques horarios para que queden reflejados en tu calendario.',
            scheduleType: '¿Qué tipo de horario deseas agregar?',
            workSchedule: 'De trabajo',
            studySchedule: 'De estudio',
            workCategory: 'Categoría: Trabajo',
            studyCategory: 'Categoría: Estudio',
            dropFile: 'Haz clic o arrastra tu archivo aquí',
            remove: 'Quitar',
            processSchedule: 'Procesar y montar horario',
            optimizing: 'Optimizando documento/imagen...',
            analyzing: 'Analizando horario con IA Gemini...',
            selectFile: 'Por favor selecciona una imagen o documento PDF con tu horario.',
            processError: 'Error al procesar el horario',
            uploadSuccess: (count: number) =>
              `¡Se detectaron y agregaron ${count} bloques a tu calendario con éxito!`,
            uploadAndRescheduleSuccess: (count: number, rescheduledCount: number) =>
              `¡Se agregaron ${count} bloques a tu horario y la IA reagendó automáticamente ${rescheduledCount} tarea(s) para evitar colisiones!`,
            noBlocksDetected:
              'La IA no pudo detectar bloques de horario en el documento o imagen. Asegúrate de que las horas y días sean legibles.',
            unexpectedExtractionError: 'Error inesperado extrayendo el horario',
            taskUpdated: 'Tarea actualizada en la base de datos',
            changesSaved: 'Cambios guardados en la base de datos',
            deleted: 'Bloque y categoría eliminados del calendario',
            noAvailability: 'No hay disponibilidad marcada en esta semana para replicar.',
            replicated: '¡Horario replicado con éxito!',
            editTask: 'Editar tarea',
            editBlock: 'Editar bloque',
            newBlock: 'Nuevo bloque',
            taskName: 'Nombre de tarea...',
            blockName: 'Nombre / Nota...',
            save: 'Guardar',
            tasks: 'Tareas',
            studying: 'Estudiando',
            work: 'Trabajo',
            rest: 'Descanso',
            otherActivity: 'Otra actividad',
            availabilityIntro:
              'Si nos dices cuál es tu horario disponible podemos personalizar los planes de tu proyecto.',
            uploadHint: 'Subir imagen o PDF de tu horario para que la IA lo monte automáticamente',
            replicateHint: 'Copiar esta semana a otras fechas',
            cannotMoveToPast: 'No se pueden mover bloques a fechas pasadas.',
            conflict: (
              title: string,
              details?: {
                taskTitle?: string;
                duration?: number;
                startTime?: string;
                endTime?: string;
                collisionSlot?: string;
              },
            ) =>
              details?.taskTitle && details?.startTime && details?.endTime
                ? `⚠️ Conflicto de horario: La tarea "${details.taskTitle}" requiere ${details.duration} min (de ${details.startTime} a ${details.endTime}, ocupando bloques continuos de 5 en 5 minutos). No se puede mover aquí porque el tramo a las ${details.collisionSlot || details.startTime} ya está ocupado por "${title}". Por favor selecciona un bloque con suficiente espacio continuo disponible.`
                : `⚠️ Conflicto: El horario coincide con "${title}". Por favor intenta utilizar otra hora o bloque disponible.`,
            taskScheduleUpdated: (title: string, time: string, day: string) =>
              `¡Horario de "${title}" actualizado a ${time}${day}!`,
            blockMoved: (title: string, time: string, day: string) =>
              `¡${title} movido a ${time}${day}!`,
            saveScheduleError: 'Error al persistir el nuevo horario en el servidor',
          }
        : {
            back: 'Back',
            upload: 'Upload schedule (AI)',
            replicate: 'Copy schedule',
            month: 'Copy to a specific month...',
            year: 'Copy to every month',
            specific: 'Copy to specific weeks...',
            weeks: 'Specific weeks',
            selectWeeks:
              'Select the future weeks where you want to copy your current availability:',
            weekOf: 'Week of',
            noWeeks: 'There are no future weeks available this year.',
            yearLabel: 'Year',
            monthLabel: 'Month',
            replicateMonthTitle: 'Copy to a specific month',
            replicateMonthDescription:
              'Choose the month where you want to copy this week’s availability.',
            replicateConfirm: 'Copy',
            scheduleReplication: 'Where would you like to copy this schedule?',
            allMonths: 'Every month (default)',
            specificMonth: 'Only in a specific month',
            chooseWeeks: 'Select the weeks:',
            fileFormats: 'PNG, JPG, WEBP, or PDF (up to 20 MB)',
            noActiveProjects: 'You do not have active projects to create a task.',
            selectProject: 'Select a project',
            creatingTask: 'Creating task...',
            newTask: 'New task',
            createTaskError: 'Could not create the task',
            cancel: 'Cancel',
            apply: 'Apply schedule',
            googleConnect: 'Connect Google Calendar',
            googleConnected: 'Connected to Google Calendar',
            googleDisconnect: 'Disconnect',
            googleSynced: 'Google Calendar synced successfully',
            googleDisconnected: 'Google Calendar disconnected',
            googleConnectionError: 'Could not connect to Google Calendar',
            uploadTitle: 'Upload schedule with Gemini AI',
            uploadSubtitle: 'Automatically extract your classes or shifts',
            uploadDescription:
              'Upload a photo, screenshot (.png, .jpg), or PDF of your school, university, or work schedule. AI will extract its days and time blocks so they appear in your calendar.',
            scheduleType: 'What kind of schedule would you like to add?',
            workSchedule: 'Work schedule',
            studySchedule: 'Study schedule',
            workCategory: 'Category: Work',
            studyCategory: 'Category: Study',
            dropFile: 'Click or drag your file here',
            remove: 'Remove',
            processSchedule: 'Process and add schedule',
            optimizing: 'Optimizing document/image...',
            analyzing: 'Analyzing schedule with Gemini AI...',
            selectFile: 'Please select an image or PDF document with your schedule.',
            processError: 'Could not process the schedule',
            uploadSuccess: (count: number) =>
              `${count} time blocks were detected and added to your calendar successfully!`,
            uploadAndRescheduleSuccess: (count: number, rescheduledCount: number) =>
              `${count} time blocks were added and AI automatically rescheduled ${rescheduledCount} task(s) to avoid conflicts!`,
            noBlocksDetected:
              'AI could not detect schedule blocks in the document or image. Make sure the days and times are readable.',
            unexpectedExtractionError: 'Unexpected error while extracting the schedule',
            taskUpdated: 'Task updated in the database',
            changesSaved: 'Changes saved in the database',
            deleted: 'Block and category removed from the calendar',
            noAvailability: 'There is no availability marked this week to copy.',
            replicated: 'Schedule copied successfully!',
            editTask: 'Edit task',
            editBlock: 'Edit block',
            newBlock: 'New block',
            taskName: 'Task name...',
            blockName: 'Name / note...',
            save: 'Save',
            tasks: 'Tasks',
            studying: 'Studying',
            work: 'Work',
            rest: 'Rest',
            otherActivity: 'Other activity',
            availabilityIntro:
              'Tell us when you are available so we can personalize your project plans.',
            uploadHint: 'Upload an image or PDF of your schedule so AI can add it automatically',
            replicateHint: 'Copy this week to other dates',
            cannotMoveToPast: 'Blocks cannot be moved to past dates.',
            conflict: (
              title: string,
              details?: {
                taskTitle?: string;
                duration?: number;
                startTime?: string;
                endTime?: string;
                collisionSlot?: string;
              },
            ) =>
              details?.taskTitle && details?.startTime && details?.endTime
                ? `⚠️ Schedule conflict: The task "${details.taskTitle}" requires ${details.duration} min (from ${details.startTime} to ${details.endTime}, occupying continuous 5-minute blocks). It cannot be placed here because the slot at ${details.collisionSlot || details.startTime} is occupied by "${title}". Please choose a block with enough continuous free time.`
                : `⚠️ Conflict: This time overlaps with "${title}". Please choose another time or available block.`,
            taskScheduleUpdated: (title: string, time: string, day: string) =>
              `"${title}" was rescheduled to ${time}${day}.`,
            blockMoved: (title: string, time: string, day: string) =>
              `${title} was moved to ${time}${day}.`,
            saveScheduleError: 'Could not save the new schedule to the server',
          },
    [locale],
  );
  const router = useRouter();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  useCalendarTour(view);

  const [availabilities, setAvailabilities] = useState<Availability[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('komorebi_availabilities');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.map((a: Partial<Availability>) => {
              let t = a.type || 'tareas';
              if (t === 'estudio') t = 'estudiando';
              if (t === 'ocupado') t = 'trabajo';
              if ((t as string) === 'libre') t = 'tareas'; // backward compatibility
              if (a.source === 'supabase' || a.eventId || a.label?.startsWith('📌')) {
                t = 'tareas';
              }
              return { ...a, type: t } as Availability;
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [editingCell, setEditingCell] = useState<{ date: string; time: string } | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<
    'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad'
  >('tareas');

  const [projectSelectorState, setProjectSelectorState] = useState<{
    visible: boolean;
    date: string;
    startTime: string;
    endTime: string;
    projects: { id: string; titulo: string }[];
  } | null>(null);

  // Bloque seleccionado (para resaltado con borde negro)
  const [selectedBlock, setSelectedBlock] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    eventId?: string;
    blockId?: string;
  } | null>(null);

  // Drag and Drop de tareas y bloques dentro de la columna o entre días
  const [draggedTask, setDraggedTask] = useState<{
    eventId?: string;
    blockId?: string;
    sourceDate: string;
    originalStartTime: string;
    originalEndTime: string;
    durationMinutes: number;
    title: string;
    type?: Availability['type'];
    isManual?: boolean;
  } | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ date: string; time: string } | null>(null);

  const [expandedHours, setExpandedHours] = useState<number[]>([]);

  const [showReplicateMenu, setShowReplicateMenu] = useState(false);
  const [showSpecificWeeksModal, setShowSpecificWeeksModal] = useState(false);
  const [showSpecificMonthModal, setShowSpecificMonthModal] = useState(false);
  const [selectedReplicateMonth, setSelectedReplicateMonth] = useState<number>(
    new Date().getMonth(),
  );
  const [selectedReplicateYear, setSelectedReplicateYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedWeeksYear, setSelectedWeeksYear] = useState<number>(new Date().getFullYear());
  const [futureWeeksList, setFutureWeeksList] = useState<
    { start: Date; end: Date; label: string }[]
  >([]);

  // Estado para la subida y procesamiento de horario con IA
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [scheduleCategory, setScheduleCategory] = useState<'estudio' | 'trabajo'>('estudio');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>(copy.analyzing);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadReplicateOption, setUploadReplicateOption] = useState<'mes' | 'todos' | 'semanas'>(
    'todos',
  );
  const [uploadSelectedMonth, setUploadSelectedMonth] = useState<number>(new Date().getMonth());
  const [uploadSelectedYear, setUploadSelectedYear] = useState<number>(new Date().getFullYear());
  const [uploadSelectedWeeks, setUploadSelectedWeeks] = useState<string[]>([]);

  const [isMounted, setIsMounted] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const availMap = React.useMemo(() => {
    const map = new Map<string, Availability>();
    for (let i = 0; i < availabilities.length; i++) {
      const a = availabilities[i];
      map.set(`${a.date}_${a.startTime}`, a);
    }
    return map;
  }, [availabilities]);

  const activeTimes = React.useMemo(
    () => new Set(availabilities.map((a) => a.startTime)),
    [availabilities],
  );

  const visibleTimeSlots = React.useMemo(() => {
    const slots: string[] = [];
    for (let h = 0; h <= 23; h++) {
      const hourStr = h.toString().padStart(2, '0');
      slots.push(`${hourStr}:00`);
      if (expandedHours.includes(h)) {
        for (let m = 5; m < 60; m += 5) {
          slots.push(`${hourStr}:${m.toString().padStart(2, '0')}`);
        }
      }
    }
    return slots;
  }, [expandedHours]);

  const loadCalendarEventsFromSupabase = React.useCallback(async () => {
    try {
      const res = await getCalendarDataAction();
      if (res.success) {
        const dbEvents: Availability[] = [];
        const dbEventKeys = new Set<string>();

        if (res.events && res.events.length > 0) {
          res.events.forEach((ev) => {
            const startD = new Date(ev.inicio);
            const endD = new Date(ev.fin);
            if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return;

            const dateStr = format(startD, 'yyyy-MM-dd');
            const dayOfWeekName = format(startD, 'EEEE', { locale: dateLocale });
            const startSlot = format(startD, 'HH:mm');
            const endSlot = format(endD, 'HH:mm');

            const startIdx = getSlotIndex(startSlot);
            const endIdx = getSlotIndex(endSlot);
            const fromIdx = startIdx !== -1 ? startIdx : 0;
            const toIdx =
              endIdx !== -1 && endIdx > fromIdx
                ? endIdx
                : fromIdx +
                  Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (5 * 60 * 1000)));

            for (let i = fromIdx; i < toIdx; i++) {
              const slot = TIME_SLOTS[i];
              if (slot && slot !== '24:00') {
                dbEvents.push({
                  date: dateStr,
                  dayOfWeek: dayOfWeekName,
                  startTime: slot,
                  endTime: TIME_SLOTS[i + 1] || '24:00',
                  label: `📌 ${ev.titulo}`,
                  type: 'tareas',
                  source: 'supabase',
                  eventId: ev.id,
                });
                dbEventKeys.add(`${dateStr}_${slot}`);
              }
            }
          });
        }

        // Cargar bloques de disponibilidad guardados en Supabase
        if (res.customBlocks && res.customBlocks.length > 0) {
          res.customBlocks.forEach((b) => {
            if (b.type === 'tareas') return;
            if (!b.date) return;

            const startSlot = b.startTime.slice(0, 5);
            const endSlot = b.endTime.slice(0, 5);
            const startIdx = getSlotIndex(startSlot);
            const endIdx = getSlotIndex(endSlot);
            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return;

            let normalizedType:
              'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' = 'trabajo';
            if (b.type === 'estudio' || b.type === 'estudiando') normalizedType = 'estudiando';
            else if (b.type === 'trabajo' || b.type === 'ocupado') normalizedType = 'trabajo';
            else if (b.type === 'descanso') normalizedType = 'descanso';
            else if (b.type === 'otra_actividad') normalizedType = 'otra_actividad';

            const dayOfWeekName = format(parseISODate(b.date), 'EEEE', { locale: dateLocale });
            const blockId = `block_${b.date}_${startIdx}_${endIdx}`;

            for (let i = startIdx; i < endIdx; i++) {
              const slot = TIME_SLOTS[i];
              if (slot && slot !== '24:00') {
                dbEvents.push({
                  date: b.date,
                  dayOfWeek: dayOfWeekName,
                  startTime: slot,
                  endTime: TIME_SLOTS[i + 1] || '24:00',
                  label: b.label || (normalizedType === 'estudiando' ? copy.studying : copy.work),
                  type: normalizedType,
                  source: 'supabase',
                  blockId,
                });
                dbEventKeys.add(`${b.date}_${slot}`);
              }
            }
          });
        }

        if (res.availabilities && res.availabilities.length > 0) {
          const today = new Date();
          const startRange = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const endRange = new Date(today.getFullYear(), today.getMonth() + 6, 0);
          const activeDays = eachDayOfInterval({ start: startRange, end: endRange });

          res.availabilities.forEach((b) => {
            if (b.tipo === 'tareas') return; // 'tareas' representan slots libres

            const startSlot = b.hora_inicio.slice(0, 5);
            const endSlot = b.hora_fin.slice(0, 5);
            const startIdx = getSlotIndex(startSlot);
            const endIdx = getSlotIndex(endSlot);
            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return;

            let normalizedType:
              'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' = 'trabajo';
            if (b.tipo === 'estudio') normalizedType = 'estudiando';
            else if (b.tipo === 'trabajo') normalizedType = 'trabajo';
            else if (b.tipo === 'otra_actividad') normalizedType = 'otra_actividad';
            else if (b.tipo === 'descanso') normalizedType = 'descanso';
            else if (b.tipo === 'ocupado') normalizedType = 'trabajo';

            const labelVal =
              b.tipo === 'estudio'
                ? copy.studying
                : b.tipo === 'trabajo'
                  ? copy.work
                  : b.tipo === 'descanso'
                    ? copy.rest
                    : b.tipo === 'otra_actividad'
                      ? copy.otherActivity
                      : copy.work;

            if (b.fecha_especifica) {
              const dayOfWeekName = format(parseISODate(b.fecha_especifica), 'EEEE', {
                locale: dateLocale,
              });
              const blockId = `block_${b.fecha_especifica}_${startIdx}_${endIdx}`;

              for (let i = startIdx; i < endIdx; i++) {
                const slot = TIME_SLOTS[i];
                if (slot && slot !== '24:00') {
                  const key = `${b.fecha_especifica}_${slot}`;
                  if (!dbEventKeys.has(key)) {
                    dbEventKeys.add(key);
                    dbEvents.push({
                      date: b.fecha_especifica,
                      dayOfWeek: dayOfWeekName,
                      startTime: slot,
                      endTime: TIME_SLOTS[i + 1] || '24:00',
                      label: labelVal,
                      type: normalizedType,
                      source: b.origen === 'extraido_ia' ? 'supabase_ia' : 'supabase',
                      blockId,
                    });
                  }
                }
              }
            } else if (b.dia_semana !== null && b.dia_semana !== undefined) {
              const matchingDays = activeDays.filter((d) => d.getDay() === b.dia_semana);
              matchingDays.forEach((d) => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const dayOfWeekName = format(d, 'EEEE', { locale: dateLocale });
                const blockId = `block_rec_${dateStr}_${startIdx}_${endIdx}`;

                for (let i = startIdx; i < endIdx; i++) {
                  const slot = TIME_SLOTS[i];
                  if (slot && slot !== '24:00') {
                    // Evitar duplicados si hay un bloque manual superpuesto (priorizamos el manual si ya está en dbEvents)
                    const key = `${dateStr}_${slot}`;
                    if (!dbEventKeys.has(key)) {
                      dbEventKeys.add(key);
                      dbEvents.push({
                        date: dateStr,
                        dayOfWeek: dayOfWeekName,
                        startTime: slot,
                        endTime: TIME_SLOTS[i + 1] || '24:00',
                        label: labelVal,
                        type: normalizedType,
                        source: b.origen === 'extraido_ia' ? 'supabase_ia' : 'supabase',
                        blockId,
                      });
                    }
                  }
                }
              });
            }
          });
        }

        setAvailabilities((prev) => {
          const googleEvents = prev.filter((p) => p.source === 'google');
          return [...googleEvents, ...dbEvents];
        });
      }
    } catch (err) {
      console.warn('Aviso cargando eventos de calendario:', err);
    }
  }, [copy, dateLocale]);

  const loadGoogleCalendarEvents = React.useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/events');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !Array.isArray(data.events) || data.events.length === 0) return;

      const googleEvents: Availability[] = [];
      data.events.forEach(
        (ev: { id: string; summary: string; start: string; end: string; isAllDay: boolean }) => {
          if (ev.isAllDay) return; // skip all-day events (no time slot to paint)
          const startD = new Date(ev.start);
          const endD = new Date(ev.end);
          if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return;

          const dateStr = format(startD, 'yyyy-MM-dd');
          const dayOfWeekName = format(startD, 'EEEE', { locale: dateLocale });
          const startSlot = format(startD, 'HH:mm');
          const endSlot = format(endD, 'HH:mm');

          const startIdx = getSlotIndex(startSlot);
          const endIdx = getSlotIndex(endSlot);
          const fromIdx = startIdx !== -1 ? startIdx : 0;
          const toIdx =
            endIdx !== -1 && endIdx > fromIdx
              ? endIdx
              : fromIdx +
                Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (5 * 60 * 1000)));

          for (let i = fromIdx; i < toIdx; i++) {
            const slot = TIME_SLOTS[i];
            if (slot && slot !== '24:00') {
              googleEvents.push({
                date: dateStr,
                dayOfWeek: dayOfWeekName,
                startTime: slot,
                endTime: TIME_SLOTS[i + 1] || '24:00',

                label: ev.summary || '(Sin título)',
                type: 'otra_actividad',
                source: 'google',
                eventId: ev.id,
              });
            }
          }
        },
      );

      if (googleEvents.length > 0) {
        setAvailabilities((prev) => {
          const nonGoogle = prev.filter((p) => p.source !== 'google');
          const keys = new Set(googleEvents.map((g) => `${g.date}_${g.startTime}`));
          const filtered = nonGoogle.filter((p) => !keys.has(`${p.date}_${p.startTime}`));
          return [...filtered, ...googleEvents];
        });
      }
    } catch (err) {
      console.warn('Error al cargar eventos de Google Calendar:', err);
    }
  }, [dateLocale]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('komorebi_availabilities');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.some((a: Availability) => a.source === 'google')) {
            setIsGoogleConnected(true);
          }
        }
      } catch (e) {
        console.error(e);
      }

      // Sincronizar estado real con la sesión / cookie segura de Google Calendar
      fetch('/api/auth/google?action=status')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.connected) {
            setIsGoogleConnected(true);
            // Cargar eventos reales si ya hay una sesión activa
            loadGoogleCalendarEvents();
          }
        })
        .catch(() => {});

      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('gcal_success');
      const error = urlParams.get('gcal_error');

      if (success === 'true') {
        setIsGoogleConnected(true);
        setToastMessage({ type: 'success', text: copy.googleSynced });
        window.history.replaceState({}, document.title, window.location.pathname);

        // Cargar eventos reales desde Google Calendar
        loadGoogleCalendarEvents();
      } else if (error === 'true') {
        const errorDetail = urlParams.get('calendar_error');
        const decodedDetail = errorDetail ? decodeURIComponent(errorDetail) : null;
        setToastMessage({
          type: 'error',
          text: decodedDetail || copy.googleConnectionError,
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Cargar eventos del calendario y tareas programadas desde Supabase
      loadCalendarEventsFromSupabase();

      // Sincronización en tiempo real ante eventos de proyecto y retorno a pestaña
      const onRefresh = () => {
        loadCalendarEventsFromSupabase();
      };

      window.addEventListener('projects_updated', onRefresh);
      window.addEventListener('tasks_updated', onRefresh);
      window.addEventListener('focus', onRefresh);

      // Suscripción Realtime a Supabase
      let supabaseChannel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
      try {
        const supabase = createClient();
        supabaseChannel = supabase
          .channel('calendar_realtime_sync')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'eventos_calendario' },
            () => {
              loadCalendarEventsFromSupabase();
            },
          )
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => {
            loadCalendarEventsFromSupabase();
          })
          .subscribe();
      } catch (rtErr) {
        console.warn('Aviso canal Realtime en Calendario:', rtErr);
      }

      return () => {
        window.removeEventListener('projects_updated', onRefresh);
        window.removeEventListener('tasks_updated', onRefresh);
        window.removeEventListener('focus', onRefresh);
        if (supabaseChannel) {
          try {
            const supabase = createClient();
            supabase.removeChannel(supabaseChannel);
          } catch {}
        }
      };
    }
  }, [
    copy.googleConnectionError,
    copy.googleSynced,
    loadCalendarEventsFromSupabase,
    loadGoogleCalendarEvents,
  ]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Limpiar selección de bloque con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBlock(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleConnectGoogle = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/api/auth/google';
  };

  const handleDisconnectGoogle = async () => {
    setIsGoogleConnected(false);
    setAvailabilities((prev) => prev.filter((a) => a.source !== 'google'));
    setToastMessage({ type: 'success', text: copy.googleDisconnected });
    // Limpiar la cookie segura del servidor para invalidar la sesión
    try {
      await fetch('/api/auth/google', { method: 'DELETE' });
    } catch {
      // Si falla, la cookie expirará sola; el estado local ya está limpio
    }
  };
  useEffect(() => {
    try {
      localStorage.setItem('komorebi_availabilities', JSON.stringify(availabilities));
    } catch (e) {
      console.warn('Aviso guardando en localStorage:', e);
    }
  }, [availabilities]);

  const toggleHour = (h: number) => {
    setExpandedHours((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  };

  const renderMonthlyGrid = () => {
    const startY = startOfYear(currentDate);
    const endY = endOfYear(currentDate);
    const months = eachMonthOfInterval({ start: startY, end: endY });

    const maxAllowedYear = new Date().getFullYear() + 1;
    const canGoPreviousYear = currentDate.getFullYear() > new Date().getFullYear();
    const canGoNextYear = currentDate.getFullYear() < maxAllowedYear;

    return (
      <div className="flex flex-col animate-in fade-in duration-500 w-full max-w-5xl mx-auto pb-12">
        <div className="bg-[#FBE6DD] rounded-[24px] p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-[#F7D6BF] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F7D6BF] rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4"></div>
          <div className="bg-white p-3 rounded-full shadow-sm relative z-10 text-[#845326] shrink-0">
            <Calendar className="size-6 sm:size-8" />
          </div>
          <div className="relative z-10 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#845326] leading-tight">
              {copy.availabilityIntro}
            </h2>
            <p className="text-[#A57855] text-sm mt-1 font-semibold">
              {locale === 'es'
                ? 'Selecciona un mes para configurar tus horas de estudio o trabajo.'
                : 'Select a month to plan your study or work hours.'}
            </p>
          </div>

          <div
            id="tour-calendar-integrations"
            className="relative z-10 sm:ml-auto mt-4 sm:mt-0 w-full sm:w-auto min-h-[42px] flex items-center justify-end"
          >
            {!isMounted ? null : !isGoogleConnected ? (
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-[#5F6368] hover:bg-gray-50 border border-gray-200 rounded-xl font-semibold shadow-sm transition-all w-full sm:w-auto"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="truncate">{copy.googleConnect}</span>
              </button>
            ) : (
              <div
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium shadow-sm cursor-default select-none"
              >
                <Check className="size-4" />
                <span>{copy.googleConnected}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-on-surface">{format(currentDate, 'yyyy')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 12))}
              disabled={!canGoPreviousYear}
              className={`p-2 rounded-full transition-colors ${!canGoPreviousYear ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => {
                if (canGoNextYear) setCurrentDate(addMonths(currentDate, 12));
              }}
              disabled={!canGoNextYear}
              className={`p-2 rounded-full transition-colors ${!canGoNextYear ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div
          id="tour-calendar-month-grid"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {months.map((month) => {
            const isCurrentMonth = isSameMonth(new Date(), month);
            const isPastMonth =
              month.getFullYear() < new Date().getFullYear() ||
              (month.getFullYear() === new Date().getFullYear() &&
                month.getMonth() < new Date().getMonth());
            const oneYearFromNow = addYears(new Date(), 1);
            const isBeyondOneYear = isAfter(startOfMonth(month), endOfMonth(oneYearFromNow));
            const isMonthDisabled = isPastMonth || isBeyondOneYear;

            return (
              <button
                key={month.toISOString()}
                disabled={isMonthDisabled}
                onClick={() => {
                  setCurrentDate(isCurrentMonth ? new Date() : month);
                  setView('week');
                }}
                className={`
                  flex flex-col items-center justify-center p-4 rounded-[16px] transition-all aspect-square border-2
                  ${isMonthDisabled ? 'opacity-40 cursor-not-allowed hover:bg-surface-container-lowest bg-surface-container-lowest text-on-surface-variant' : 'hover:-translate-y-1 hover:shadow-sm cursor-pointer'}
                  ${
                    isCurrentMonth
                      ? 'bg-[#f5e5d9] border-[#845326] text-[#845326]'
                      : !isMonthDisabled
                        ? 'bg-white border-[#EAE3DC] text-on-surface hover:border-[#F7D6BF]'
                        : 'border-[#EAE3DC]'
                  }
                `}
              >
                <span className="text-sm sm:text-base font-bold capitalize">
                  {format(month, 'MMMM', { locale: dateLocale })}
                </span>
                {isCurrentMonth && (
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">
                    {locale === 'es' ? 'Actual' : 'Current'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const compressImageForUpload = async (
    file: File,
  ): Promise<{ base64Data: string; mimeType: string }> => {
    if (file.type === 'application/pdf') {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const commaIdx = result.indexOf(',');
          resolve(commaIdx !== -1 ? result.substring(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo PDF'));
        reader.readAsDataURL(file);
      });
      return { base64Data, mimeType: 'application/pdf' };
    }

    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const idx = res.indexOf(',');
            resolve({
              base64Data: idx !== -1 ? res.substring(idx + 1) : res,
              mimeType: file.type || 'image/jpeg',
            });
          };
          reader.readAsDataURL(file);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const commaIdx = jpegDataUrl.indexOf(',');
        const base64Data = commaIdx !== -1 ? jpegDataUrl.substring(commaIdx + 1) : jpegDataUrl;

        resolve({ base64Data, mimeType: 'image/jpeg' });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo abrir la imagen para optimizarla'));
      };

      img.src = objectUrl;
    });
  };

  const handleProcessScheduleFile = async () => {
    if (!uploadFile) {
      setUploadError(copy.selectFile);
      return;
    }

    if (hasObsceneContent(uploadFile.name)) {
      setUploadError('No se permiten contenidos obscenos.');
      return;
    }

    setUploadLoading(true);
    setUploadStatusText(copy.optimizing);
    setUploadError(null);
    setUploadSuccessMsg(null);

    try {
      const { base64Data, mimeType } = await compressImageForUpload(uploadFile);
      setUploadStatusText(copy.analyzing);

      const selectedWeekStarts = futureWeeksList
        .filter((w) => uploadSelectedWeeks.includes(w.label))
        .map((w) => w.start.toISOString());

      const res = await fetch('/api/calendar/extract-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType,
          guardarEnDisponibilidad: true,
          categoria: scheduleCategory,
          replicarOpcion: uploadReplicateOption,
          semanasEspecificas: uploadReplicateOption === 'semanas' ? selectedWeekStarts : undefined,
          mesEspecifico: uploadReplicateOption === 'mes' ? uploadSelectedMonth : undefined,
          anoEspecifico: uploadReplicateOption === 'mes' ? uploadSelectedYear : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || copy.processError);
      }

      if (data.bloques && data.bloques.length > 0) {
        // Recargar eventos de Supabase para reflejar de inmediato tareas reagendadas por IA
        await loadCalendarEventsFromSupabase();

        const reagendadasCount = data.reagendamiento?.reagendadas || 0;
        if (reagendadasCount > 0) {
          setUploadSuccessMsg(
            copy.uploadAndRescheduleSuccess(data.bloques.length, reagendadasCount),
          );
        } else {
          setUploadSuccessMsg(copy.uploadSuccess(data.bloques.length));
        }
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadSuccessMsg(null);
          setView('week');
        }, 2200);
      } else {
        setUploadError(copy.noBlocksDetected);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : copy.unexpectedExtractionError);
    } finally {
      setUploadLoading(false);
    }
  };

  // Helper para identificar el bloque completo de una celda
  const getBlockForCell = (dateStr: string, timeStr: string, isCollapsedHour: boolean) => {
    let targetAvail: Availability | undefined;
    if (isCollapsedHour) {
      const startIdx = getSlotIndex(timeStr);
      for (let i = startIdx; i < startIdx + 12; i++) {
        const slot = TIME_SLOTS[i];
        if (slot) {
          const found = availMap.get(`${dateStr}_${slot}`);
          if (found) {
            targetAvail = found;
            break;
          }
        }
      }
    } else {
      targetAvail = availMap.get(`${dateStr}_${timeStr}`);
    }

    if (!targetAvail) return null;

    // Si tiene eventId (tarea de Supabase)
    if (targetAvail.eventId) {
      const eventSlots = availabilities
        .filter((a) => a.date === dateStr && a.eventId === targetAvail.eventId)
        .sort((a, b) => getSlotIndex(a.startTime) - getSlotIndex(b.startTime));

      const startTime = eventSlots[0]?.startTime || targetAvail.startTime;
      const endTime = eventSlots[eventSlots.length - 1]?.endTime || targetAvail.endTime;
      return {
        date: dateStr,
        startTime,
        endTime,
        eventId: targetAvail.eventId,
        blockId: targetAvail.blockId,
        label: targetAvail.label,
        type: targetAvail.type,
        source: targetAvail.source,
      };
    }

    // Si tiene blockId asignado
    if (targetAvail.blockId) {
      const blockSlots = availabilities
        .filter((a) => a.date === dateStr && a.blockId === targetAvail.blockId)
        .sort((a, b) => getSlotIndex(a.startTime) - getSlotIndex(b.startTime));

      const startTime = blockSlots[0]?.startTime || targetAvail.startTime;
      const endTime = blockSlots[blockSlots.length - 1]?.endTime || targetAvail.endTime;
      return {
        date: dateStr,
        startTime,
        endTime,
        blockId: targetAvail.blockId,
        label: targetAvail.label,
        type: targetAvail.type,
        source: targetAvail.source,
      };
    }

    // Bloque manual sin blockId (buscar slots contiguos con mismo label y tipo)
    const currentIdx = getSlotIndex(targetAvail.startTime);
    let minIdx = currentIdx;
    let maxIdx = currentIdx;

    while (minIdx > 0) {
      const prevSlot = TIME_SLOTS[minIdx - 1];
      const prevAvail = availMap.get(`${dateStr}_${prevSlot}`);
      if (
        prevAvail &&
        !prevAvail.eventId &&
        prevAvail.source !== 'google' &&
        prevAvail.label === targetAvail.label &&
        prevAvail.type === targetAvail.type
      ) {
        minIdx--;
      } else {
        break;
      }
    }

    while (maxIdx < TIME_SLOTS.length - 1) {
      const nextSlot = TIME_SLOTS[maxIdx + 1];
      const nextAvail = availMap.get(`${dateStr}_${nextSlot}`);
      if (
        nextAvail &&
        !nextAvail.eventId &&
        nextAvail.source !== 'google' &&
        nextAvail.label === targetAvail.label &&
        nextAvail.type === targetAvail.type
      ) {
        maxIdx++;
      } else {
        break;
      }
    }

    const startTime = TIME_SLOTS[minIdx];
    const endTime = TIME_SLOTS[maxIdx + 1] || '24:00';

    return {
      date: dateStr,
      startTime,
      endTime,
      label: targetAvail.label,
      type: targetAvail.type,
      source: targetAvail.source,
    };
  };

  // Selección de celda o bloque asignado y apertura de edición
  const handleCellClick = (
    dateStr: string,
    dayOfWeek: string,
    timeStr: string,
    isPast: boolean,
  ) => {
    if (isPast) return;

    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const isCollapsedHour = mStr === '00' && !expandedHours.includes(h);

    const clickStartIdx = getSlotIndex(timeStr);
    const clickEndIdx = isCollapsedHour ? clickStartIdx + 11 : clickStartIdx;

    const block = getBlockForCell(dateStr, timeStr, isCollapsedHour);

    if (block) {
      // Si el bloque tiene algo asignado, alternar selección
      if (
        selectedBlock &&
        selectedBlock.date === block.date &&
        selectedBlock.startTime === block.startTime &&
        selectedBlock.endTime === block.endTime &&
        (selectedBlock.eventId ? selectedBlock.eventId === block.eventId : true) &&
        (selectedBlock.blockId ? selectedBlock.blockId === block.blockId : true)
      ) {
        setSelectedBlock(null);
        setEditingCell(null);
      } else {
        setSelectedBlock({
          date: block.date,
          startTime: block.startTime,
          endTime: block.endTime,
          eventId: block.eventId,
          blockId: block.blockId,
        });

        // Si no es de google, abrir edición (permite editar bloques y también tareas)
        if (block.source !== 'google') {
          setEditingCell({ date: dateStr, time: timeStr });
          const rawLabel = block.label || '';
          setEditLabel(
            rawLabel === 'Tareas' || rawLabel === 'Libre' ? '' : rawLabel.replace(/^📌\s*/, ''),
          );
          let normalized: 'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' =
            'tareas';
          if (block.type === 'estudio' || block.type === 'estudiando') normalized = 'estudiando';
          else if (block.type === 'trabajo' || block.type === 'ocupado') normalized = 'trabajo';
          else if (block.type === 'descanso') normalized = 'descanso';
          else if (block.type === 'otra_actividad') normalized = 'otra_actividad';
          setEditType(normalized);
        } else {
          setEditingCell(null);
        }
      }
      return;
    }

    // Celda en blanco: NO crear bloque ocupado automáticamente.
    // Solo seleccionar ese recuadro y abrir la opción de editar.
    const endSlot = TIME_SLOTS[clickEndIdx + 1] || '24:00';
    setSelectedBlock({
      date: dateStr,
      startTime: timeStr,
      endTime: endSlot,
    });
    setEditingCell({ date: dateStr, time: timeStr });
    setEditLabel('');
    setEditType('tareas');
  };

  // Manejo de Drag and Drop para reordenamiento de tareas y bloques manuales
  const handleDragStart = (
    e: React.DragEvent,
    dateStr: string,
    avail: Availability,
    timeStr: string,
    isCollapsedHour: boolean,
  ) => {
    e.stopPropagation();
    if (avail.source === 'google') return;

    const block = getBlockForCell(dateStr, timeStr, isCollapsedHour);
    if (!block) return;

    const sIdx = getSlotIndex(block.startTime);
    const eIdx = getSlotIndex(block.endTime);
    const durationMin = Math.max(5, (eIdx - sIdx) * 5);

    setDraggedTask({
      eventId: block.eventId,
      blockId:
        block.blockId ||
        (!block.eventId ? `manual_${dateStr}_${block.startTime}_${block.endTime}` : undefined),
      sourceDate: dateStr,
      originalStartTime: block.startTime,
      originalEndTime: block.endTime,
      durationMinutes: durationMin,
      title: block.label || (block.eventId ? 'Tarea' : 'Bloque'),
      type: block.type || 'tareas',
      isManual: !block.eventId,
    });

    // Seleccionar automáticamente al comenzar el arrastre
    setSelectedBlock({
      date: dateStr,
      startTime: block.startTime,
      endTime: block.endTime,
      eventId: block.eventId,
      blockId: block.blockId,
    });

    e.dataTransfer.setData('text/plain', block.eventId || block.blockId || 'dragged_block');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string, timeStr: string) => {
    if (draggedTask) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragOverCell || dragOverCell.date !== dateStr || dragOverCell.time !== timeStr) {
        setDragOverCell({ date: dateStr, time: timeStr });
      }
    }
  };

  const handleDragLeave = () => {
    // Al salir de la celda
  };

  const handleTaskDrop = async (e: React.DragEvent, dateStr: string, targetTimeStr: string) => {
    e.preventDefault();
    if (!draggedTask) return;

    const isPastDate = isBefore(parseISODate(dateStr), startOfDay(new Date()));
    if (isPastDate) {
      setToastMessage({
        type: 'error',
        text: copy.cannotMoveToPast,
      });
      setDraggedTask(null);
      setDragOverCell(null);
      return;
    }

    if (draggedTask.sourceDate === dateStr && draggedTask.originalStartTime === targetTimeStr) {
      setDraggedTask(null);
      setDragOverCell(null);
      return;
    }

    const startSlotIdx = getSlotIndex(targetTimeStr);
    if (startSlotIdx === -1) {
      setDraggedTask(null);
      setDragOverCell(null);
      return;
    }

    const slotsCount = Math.max(1, Math.round(draggedTask.durationMinutes / 5));
    const endSlotIdx = Math.min(TIME_SLOTS.length - 1, startSlotIdx + slotsCount);
    const newEndTimeStr = TIME_SLOTS[endSlotIdx] || '24:00';

    const origStartIdx = getSlotIndex(draggedTask.originalStartTime);
    const origEndIdx = getSlotIndex(draggedTask.originalEndTime);

    // Verificar colisiones con otras tareas, Google o bloques ajenos
    const isOwnSlot = (a: Availability) => {
      if (draggedTask.eventId && a.eventId === draggedTask.eventId) return true;
      if (draggedTask.isManual) {
        if (draggedTask.blockId && a.blockId && a.blockId === draggedTask.blockId) return true;
        const aIdx = getSlotIndex(a.startTime);
        if (a.date === draggedTask.sourceDate && aIdx >= origStartIdx && aIdx < origEndIdx) {
          return true;
        }
      }
      return false;
    };

    let collisionTitle: string | null = null;
    let collisionSlot: string | null = null;
    for (let i = startSlotIdx; i < endSlotIdx; i++) {
      const slot = TIME_SLOTS[i];
      const conflictAvail = availMap.get(`${dateStr}_${slot}`);
      if (conflictAvail && !isOwnSlot(conflictAvail)) {
        collisionTitle = conflictAvail.label
          ? conflictAvail.label.replace('📌 ', '')
          : conflictAvail.source === 'google'
            ? 'Google Calendar'
            : 'otra actividad o bloque';
        collisionSlot = slot;
        break;
      }
    }

    if (collisionTitle) {
      setToastMessage({
        type: 'error',
        text: copy.conflict(collisionTitle, {
          taskTitle: draggedTask.title,
          duration: draggedTask.durationMinutes,
          startTime: targetTimeStr,
          endTime: newEndTimeStr,
          collisionSlot: collisionSlot || targetTimeStr,
        }),
      });
      setDraggedTask(null);
      setDragOverCell(null);
      return;
    }

    // Actualización optimista inmediata
    const newSlots: Availability[] = [];
    const dayOfWeekName = format(parseISODate(dateStr), 'EEEE', { locale: dateLocale });
    const newBlockId = draggedTask.blockId || `manual_${dateStr}_${targetTimeStr}`;

    for (let i = startSlotIdx; i < endSlotIdx; i++) {
      const slot = TIME_SLOTS[i];
      if (slot && slot !== '24:00') {
        newSlots.push({
          date: dateStr,
          dayOfWeek: dayOfWeekName,
          startTime: slot,
          endTime: TIME_SLOTS[i + 1] || '24:00',
          label: draggedTask.title,
          type: draggedTask.type || 'tareas',
          source: draggedTask.eventId ? 'supabase' : 'local',
          eventId: draggedTask.eventId,
          blockId: draggedTask.eventId ? undefined : newBlockId,
        });
      }
    }

    if (draggedTask.eventId) {
      // Tarea de Supabase
      setAvailabilities((prev) => {
        const withoutOld = prev.filter((a) => a.eventId !== draggedTask.eventId);
        return [...withoutOld, ...newSlots];
      });

      setSelectedBlock({
        date: dateStr,
        startTime: targetTimeStr,
        endTime: newEndTimeStr,
        eventId: draggedTask.eventId,
      });

      const cleanTitle = draggedTask.title.replace('📌 ', '');
      const daySuffix =
        draggedTask.sourceDate === dateStr
          ? ''
          : ` (${format(parseISODate(dateStr), locale === 'es' ? "EEE d 'de' MMM" : 'EEE, MMM d', { locale: dateLocale })})`;
      setToastMessage({
        type: 'success',
        text: copy.taskScheduleUpdated(
          cleanTitle,
          `${format12h(targetTimeStr)} - ${format12h(newEndTimeStr)}`,
          daySuffix,
        ),
      });

      const savedDragged = { ...draggedTask };
      setDraggedTask(null);
      setDragOverCell(null);

      // Persistir cambio en Supabase
      try {
        const startIso = new Date(`${dateStr}T${targetTimeStr}:00`).toISOString();
        const endIso = new Date(
          `${dateStr}T${newEndTimeStr === '24:00' ? '23:59:59' : newEndTimeStr + ':00'}`,
        ).toISOString();

        const res = await updateCalendarEventScheduleAction({
          eventId: savedDragged.eventId!,
          inicio: startIso,
          fin: endIso,
        });

        if (!res.success) {
          setToastMessage({
            type: 'error',
            text: res.error || copy.saveScheduleError,
          });
          await loadCalendarEventsFromSupabase();
        } else {
          window.dispatchEvent(new Event('projects_updated'));
          window.dispatchEvent(new Event('tasks_updated'));
        }
      } catch (err) {
        console.error('Error guardando horario por Drag & Drop:', err);
        await loadCalendarEventsFromSupabase();
      }
    } else {
      // Bloque manual creado por el usuario
      const origStartIdx = getSlotIndex(draggedTask.originalStartTime);
      const origEndIdx = getSlotIndex(draggedTask.originalEndTime);

      let updatedList: Availability[] = [];
      setAvailabilities((prev) => {
        const withoutOld = prev.filter((a) => {
          if (a.date !== draggedTask.sourceDate) return true;
          if (draggedTask.blockId && a.blockId === draggedTask.blockId) return false;
          const aIdx = getSlotIndex(a.startTime);
          return !(aIdx >= origStartIdx && aIdx < origEndIdx);
        });
        updatedList = [...withoutOld, ...newSlots];
        return updatedList;
      });

      // Persistir inmediatamente el bloque manual movido en Supabase
      const consolidated = consolidateAvailabilitySlots(updatedList);
      syncAvailabilityBlocksAction(consolidated).catch((err) =>
        console.warn('Error sincronizando bloque movido en Supabase:', err),
      );

      setSelectedBlock({
        date: dateStr,
        startTime: targetTimeStr,
        endTime: newEndTimeStr,
        blockId: newBlockId,
      });

      const displayTitle =
        draggedTask.title && draggedTask.title !== 'Bloque' ? `"${draggedTask.title}"` : 'Bloque';
      const daySuffix =
        draggedTask.sourceDate === dateStr
          ? ''
          : ` (${format(parseISODate(dateStr), locale === 'es' ? "EEE d 'de' MMM" : 'EEE, MMM d', { locale: dateLocale })})`;
      setToastMessage({
        type: 'success',
        text: copy.blockMoved(
          displayTitle,
          `${format12h(targetTimeStr)} - ${format12h(newEndTimeStr)}`,
          daySuffix,
        ),
      });

      setDraggedTask(null);
      setDragOverCell(null);
    }
  };

  const handleDeleteBlock = (dateStr: string, timeStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBlock(null);
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const isCollapsedHour = mStr === '00' && !expandedHours.includes(h);

    const startIdx = getSlotIndex(timeStr);
    const endIdx = isCollapsedHour ? startIdx + 11 : startIdx;

    const timesToRemove = new Set<string>();
    for (let i = startIdx; i <= endIdx; i++) {
      if (TIME_SLOTS[i] !== '24:00') {
        timesToRemove.add(TIME_SLOTS[i]);
      }
    }

    const removedEvents = availabilities.filter(
      (a) => a.date === dateStr && timesToRemove.has(a.startTime) && a.eventId,
    );

    const updatedAvails = availabilities.filter(
      (a) => !(a.date === dateStr && timesToRemove.has(a.startTime)),
    );
    setAvailabilities(updatedAvails);

    if (removedEvents.length > 0) {
      for (const ev of removedEvents) {
        if (ev.eventId) {
          deleteCalendarEventAction(ev.eventId).catch((err) =>
            console.warn('Error eliminando evento en Supabase:', err),
          );
        }
      }
    } else {
      // Si fue un bloque de disponibilidad, sincronizar inmediatamente para eliminarlo de Supabase
      const consolidated = consolidateAvailabilitySlots(updatedAvails);
      syncAvailabilityBlocksAction(consolidated).catch((err) =>
        console.warn('Error sincronizando eliminación en Supabase:', err),
      );
    }

    setToastMessage({ type: 'success', text: copy.deleted });
  };

  const handleEditLabel = (
    dateStr: string,
    timeStr: string,
    currentLabel: string,
    currentType: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setEditingCell({ date: dateStr, time: timeStr });
    const cleanLabel = currentLabel.replace(/^📌\s*/, '');
    setEditLabel(
      cleanLabel === 'Tareas' || cleanLabel === 'Libre' || cleanLabel === 'Tasks' ? '' : cleanLabel,
    );
    let normalized: 'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' = 'tareas';
    if (currentType === 'estudio' || currentType === 'estudiando') normalized = 'estudiando';
    else if (currentType === 'trabajo' || currentType === 'ocupado') normalized = 'trabajo';
    else if (currentType === 'descanso') normalized = 'descanso';
    else if (currentType === 'otra_actividad') normalized = 'otra_actividad';
    setEditType(normalized);
  };

  const saveEditedLabel = () => {
    if (!editingCell) return;

    const [hStr, mStr] = editingCell.time.split(':');
    const h = parseInt(hStr, 10);
    const isCollapsed = mStr === '00' && !expandedHours.includes(h);

    const startIdx = getSlotIndex(editingCell.time);
    const endIdx = isCollapsed ? startIdx + 11 : startIdx;
    const targetSlots: string[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (TIME_SLOTS[i] && TIME_SLOTS[i] !== '24:00') {
        targetSlots.push(TIME_SLOTS[i]);
      }
    }
    const targetSet = new Set(targetSlots);

    const labelClean = editLabel.trim().substring(0, 15);
    const displayLabel = labelClean || (editType === 'tareas' ? copy.tasks : '');
    const newBlockId = `block_${editingCell.date}_${startIdx}_${endIdx}`;

    // Verificar si el slot seleccionado pertenece a una tarea o evento de calendario
    const matchingEvent = availabilities.find(
      (a) => a.date === editingCell.date && targetSet.has(a.startTime) && a.eventId,
    );

    if (matchingEvent?.eventId) {
      const cleanTitle = labelClean.replace(/^📌\s*/, '') || 'Tarea';
      updateCalendarEventDetailsAction({
        eventId: matchingEvent.eventId,
        titulo: cleanTitle,
      }).catch((err) => console.warn('Error actualizando evento:', err));

      setAvailabilities((prev) =>
        prev.map((a) =>
          a.eventId === matchingEvent.eventId ? { ...a, label: `📌 ${cleanTitle}` } : a,
        ),
      );
      setToastMessage({ type: 'success', text: copy.taskUpdated });
      setEditingCell(null);
      return;
    }

    if (editType === 'tareas') {
      getActiveProjectsSimpleAction().then((res) => {
        if (res.success && res.projects && res.projects.length > 0) {
          setProjectSelectorState({
            visible: true,
            date: editingCell.date,
            startTime: editingCell.time,
            endTime: TIME_SLOTS[endIdx + 1] || '24:00',
            projects: res.projects,
          });
          setEditingCell(null);
        } else {
          setToastMessage({
            type: 'error',
            text: copy.noActiveProjects,
          });
        }
      });
      return;
    }

    const existingCount = availabilities.filter(
      (a) => a.date === editingCell.date && targetSet.has(a.startTime),
    ).length;

    let updatedList: Availability[] = [];

    if (existingCount > 0) {
      // Ya existían slots: actualizarlos
      updatedList = availabilities.map((a) =>
        a.date === editingCell.date && targetSet.has(a.startTime)
          ? { ...a, label: displayLabel, type: editType, source: 'local' as const }
          : a,
      );
    } else {
      // Bloque nuevo desde celda en blanco
      const dayOfWeekName = format(parseISODate(editingCell.date), 'EEEE', { locale: dateLocale });
      const newItems: Availability[] = targetSlots.map((slot, idx) => {
        const nextSlot = TIME_SLOTS[startIdx + idx + 1] || '24:00';
        return {
          date: editingCell.date,
          dayOfWeek: dayOfWeekName,
          startTime: slot,
          endTime: nextSlot,
          label: displayLabel,
          type: editType,
          source: 'local' as const,
          blockId: newBlockId,
        };
      });

      updatedList = [...availabilities, ...newItems];
    }

    setAvailabilities(updatedList);

    // Sincronizar inmediatamente con Supabase para persistir categorías, colores y nombres
    const consolidated = consolidateAvailabilitySlots(updatedList);
    syncAvailabilityBlocksAction(consolidated).catch((err) =>
      console.warn('Error sincronizando cambios en Supabase:', err),
    );

    // Mantener la selección en el bloque guardado
    setSelectedBlock({
      date: editingCell.date,
      startTime: editingCell.time,
      endTime: TIME_SLOTS[endIdx + 1] || '24:00',
      blockId: newBlockId,
    });

    setToastMessage({ type: 'success', text: copy.changesSaved });
    setEditingCell(null);
  };

  const format12h = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    if (h === 24) return '12:00 AM';
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const generateFutureWeeks = (currentWeekStart: Date, targetYear: number) => {
    const weeks = [];
    const maxYearLimit = addYears(new Date(), 1);

    let nextWeekStart: Date;
    const nowYear = currentWeekStart.getFullYear();

    if (targetYear > nowYear) {
      nextWeekStart = startOfWeek(new Date(targetYear, 0, 1), { weekStartsOn: 1 });
    } else if (targetYear === nowYear) {
      nextWeekStart = addDays(currentWeekStart, 7);
    } else {
      nextWeekStart = startOfWeek(new Date(targetYear, 0, 1), { weekStartsOn: 1 });
    }

    const endOfTargetYear = endOfYear(new Date(targetYear, 0, 1));
    const effectiveLimit = isBefore(maxYearLimit, endOfTargetYear) ? maxYearLimit : endOfTargetYear;

    while (nextWeekStart <= effectiveLimit) {
      if (
        nextWeekStart.getFullYear() === targetYear ||
        addDays(nextWeekStart, 6).getFullYear() === targetYear
      ) {
        const nextWeekEnd = addDays(nextWeekStart, 6);
        const label = `${format(nextWeekStart, 'd MMM', { locale: dateLocale })} - ${format(nextWeekEnd, 'd MMM', { locale: dateLocale })}`;
        weeks.push({ start: nextWeekStart, end: nextWeekEnd, label });
      }
      nextWeekStart = addDays(nextWeekStart, 7);
    }
    setFutureWeeksList(weeks);
  };

  const getWeeksUntil = (startNext: Date, limitDate: Date) => {
    const weeks = [];
    let current = startNext;
    while (current <= limitDate) {
      weeks.push(current);
      current = addDays(current, 7);
    }
    return weeks;
  };

  const replicateToWeeks = async (
    weekStarts: Date[],
    startOfCurrentWeek: Date,
    endOfCurrentWeek: Date,
    targetMonth?: number,
  ) => {
    const currentWeekDates = eachDayOfInterval({
      start: startOfCurrentWeek,
      end: endOfCurrentWeek,
    }).map((d) => format(d, 'yyyy-MM-dd'));

    // Solo replicar bloques de horario genéricos (no tareas específicas con eventId)
    const currentWeekAvails = availabilities.filter(
      (a) => currentWeekDates.includes(a.date) && !a.eventId,
    );

    if (currentWeekAvails.length === 0) {
      alert(copy.noAvailability);
      return;
    }

    const newAvails: Availability[] = [];

    weekStarts.forEach((ws) => {
      const targetWeekDates = eachDayOfInterval({ start: ws, end: addDays(ws, 6) }).map((d) =>
        format(d, 'yyyy-MM-dd'),
      );
      currentWeekAvails.forEach((avail) => {
        const dayIndex = currentWeekDates.indexOf(avail.date);
        if (dayIndex !== -1) {
          const targetDateStr = targetWeekDates[dayIndex];
          const targetDateObj = parseISODate(targetDateStr);

          // Si especificamos un mes objetivo, excluir los días que caen fuera de ese mes (ej. final de oct o inicio de dic)
          if (targetMonth !== undefined && targetDateObj.getMonth() !== targetMonth) {
            return;
          }

          if (!isBefore(targetDateObj, startOfDay(new Date()))) {
            newAvails.push({ ...avail, date: targetDateStr, source: 'local' });
          }
        }
      });
    });

    setAvailabilities((prev) => {
      const filtered = prev.filter(
        (p) => !newAvails.some((n) => n.date === p.date && n.startTime === p.startTime),
      );
      return [...filtered, ...newAvails];
    });

    // Guardar los bloques en la base de datos de manera persistente
    const blocksToSave = newAvails.map((avail) => ({
      fecha_especifica: avail.date,
      hora_inicio: avail.startTime.length === 5 ? `${avail.startTime}:00` : avail.startTime,
      hora_fin:
        avail.endTime === '24:00'
          ? '23:59:59'
          : avail.endTime.length === 5
            ? `${avail.endTime}:00`
            : avail.endTime,
      tipo:
        avail.type === 'estudiando'
          ? 'estudio'
          : avail.type === 'descanso'
            ? 'otra_actividad'
            : avail.type || 'trabajo',
    }));

    if (blocksToSave.length > 0) {
      const res = await replicateAvailabilitiesAction(blocksToSave);
      if (!res.success) {
        alert(
          'Ocurrió un error al guardar los bloques replicados de manera permanente. Detalles: ' +
            res.error,
        );
        return;
      } else {
        // Recargar datos desde supabase para que se consoliden en bdEvents
        await loadCalendarEventsFromSupabase();
      }
    }

    setShowReplicateMenu(false);
    setShowSpecificWeeksModal(false);
    setSelectedWeeks([]);
    alert(copy.replicated);
  };

  const renderWeeklyGrid = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    const oneYearFromNow = addYears(new Date(), 1);
    const maxAllowedWeek = endOfWeek(oneYearFromNow, { weekStartsOn: 1 });
    const minAllowedWeek = startOfWeek(new Date(), { weekStartsOn: 1 });

    const canGoPrevWeek = !isBefore(subWeeks(currentDate, 1), minAllowedWeek);
    const goToPrevWeek = () => {
      if (canGoPrevWeek) setCurrentDate(subWeeks(currentDate, 1));
    };
    const canGoNextWeek = !isAfter(addWeeks(currentDate, 1), maxAllowedWeek);
    const goToNextWeek = () => {
      if (canGoNextWeek) setCurrentDate(addWeeks(currentDate, 1));
    };

    const selectedStartIdx = selectedBlock?.startTime ? getSlotIndex(selectedBlock.startTime) : -1;
    const selectedEndIdx = selectedBlock?.endTime ? getSlotIndex(selectedBlock.endTime) : -1;
    const draggedStartIdx = draggedTask?.originalStartTime
      ? getSlotIndex(draggedTask.originalStartTime)
      : -1;
    const draggedEndIdx = draggedTask?.originalEndTime
      ? getSlotIndex(draggedTask.originalEndTime)
      : -1;

    return (
      <div className="flex flex-col h-full w-full max-w-6xl mx-auto animate-in fade-in duration-300">
        {/* 1. CONTENEDOR MAESTRO DE SCROLL */}
        <div
          className="flex-grow overflow-y-auto custom-scrollbar select-none bg-white border border-[#EAE3DC] rounded-[20px] shadow-sm relative flex flex-col"
          style={{ height: 'calc(100vh - 120px)' }}
        >
          {/* 2. ENVOLTORIO STICKY UNIFICADO */}
          <div className="sticky top-0 z-[50] bg-[#FDFBF9] border-b border-[#EAE3DC] shadow-sm flex flex-col pt-4 shrink-0">
            {/* BOTONERA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 px-4 shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setView('month');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-sm font-bold text-on-surface-variant"
                >
                  <ArrowLeft className="size-4" />
                  {copy.back}
                </button>
                <h2 className="text-xl sm:text-2xl font-bold capitalize text-on-surface hidden sm:block">
                  {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="tour-calendar-ai-upload"
                  onClick={() => {
                    generateFutureWeeks(start, selectedWeeksYear);
                    setUploadFile(null);
                    setUploadError(null);
                    setUploadSuccessMsg(null);
                    setUploadReplicateOption('todos');
                    setUploadSelectedWeeks([]);
                    setShowUploadModal(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#845326] hover:bg-[#6c421f] text-white rounded-xl text-sm font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                  title={copy.uploadHint}
                >
                  <Sparkles className="size-4 text-[#F7D6BF]" />
                  <span>{copy.upload}</span>
                </button>

                <div id="tour-calendar-replicate" className="relative">
                  <button
                    onClick={() => {
                      generateFutureWeeks(start, selectedWeeksYear);
                      setShowReplicateMenu(!showReplicateMenu);
                    }}
                    className="hidden md:flex items-center gap-2 px-3 py-2 bg-[#f5e5d9] hover:bg-[#E8DCD1] text-[#845326] rounded-xl text-sm font-bold transition-colors shadow-sm mr-2"
                    title={copy.replicateHint}
                  >
                    <Copy className="size-4" />
                    {copy.replicate}
                  </button>

                  {showReplicateMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowReplicateMenu(false)}
                      />
                      <div className="absolute top-full mt-2 right-2 w-64 bg-white border border-[#EAE3DC] rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={() => {
                            setShowReplicateMenu(false);
                            setShowSpecificMonthModal(true);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[#845326] hover:bg-[#FDFBF9] border-b border-[#EAE3DC] font-semibold transition-colors"
                        >
                          {copy.month}
                        </button>
                        <button
                          onClick={() => {
                            const endOfActiveYear = endOfYear(currentDate);
                            replicateToWeeks(
                              getWeeksUntil(addDays(start, 7), endOfActiveYear),
                              start,
                              end,
                            );
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[#845326] hover:bg-[#FDFBF9] border-b border-[#EAE3DC] font-semibold transition-colors"
                        >
                          {copy.year}
                        </button>
                        <button
                          onClick={() => {
                            setShowReplicateMenu(false);
                            setShowSpecificWeeksModal(true);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[#845326] hover:bg-[#FDFBF9] font-semibold transition-colors"
                        >
                          {copy.specific}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-white border border-[#EAE3DC] rounded-xl p-1 shadow-sm">
                  <button
                    onClick={goToPrevWeek}
                    disabled={!canGoPrevWeek}
                    className={`p-1.5 rounded-lg transition-colors text-on-surface ${!canGoPrevWeek ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-container'}`}
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <span className="px-2 text-xs sm:text-sm font-bold text-on-surface-variant capitalize">
                    {format(start, 'd MMM', { locale: dateLocale })} -{' '}
                    {format(end, 'd MMM', { locale: dateLocale })}
                  </span>
                  <button
                    onClick={goToNextWeek}
                    disabled={!canGoNextWeek}
                    className={`p-1.5 rounded-lg transition-colors text-on-surface ${!canGoNextWeek ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-container'}`}
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* CABECERA DE DÍAS (Fila de días agrupada con la botonera) */}
            <div className="flex bg-[#FDFBF9]">
              <div className="w-[100px] min-w-[100px] border-r border-[#EAE3DC] bg-[#FDFBF9]"></div>
              <div className="flex-1 grid grid-cols-7 min-w-[500px]">
                {days.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isPast = isBefore(day, startOfDay(new Date()));
                  return (
                    <div
                      key={dateStr}
                      className={`flex flex-col items-center justify-center py-2 border-r border-[#EAE3DC] last:border-r-0 ${isPast ? 'opacity-50' : ''}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 truncate px-1">
                        {format(day, 'EEE', { locale: dateLocale })}
                      </span>
                      <span
                        className={`text-base font-black ${isToday ? 'bg-[#845326] text-white size-7 flex items-center justify-center rounded-full' : 'text-on-surface'}`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Semanas Específicas */}
          {showSpecificWeeksModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-[#EAE3DC] flex items-center justify-between bg-[#FDFBF9]">
                  <h3 className="text-lg font-bold text-[#845326]">{copy.weeks}</h3>
                  <button
                    onClick={() => {
                      setShowSpecificWeeksModal(false);
                      setSelectedWeeks([]);
                    }}
                    className="p-2 hover:bg-[#EAE3DC] rounded-full text-on-surface-variant transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[50vh] custom-scrollbar">
                  <p className="text-sm text-on-surface-variant mb-4 font-medium">
                    {copy.selectWeeks}
                  </p>

                  <div className="mb-4">
                    <label className="text-sm font-bold text-[#845326] block mb-2">
                      {copy.yearLabel}
                    </label>
                    <select
                      value={selectedWeeksYear}
                      onChange={(e) => {
                        const year = Number(e.target.value);
                        setSelectedWeeksYear(year);
                        generateFutureWeeks(start, year);
                      }}
                      className="w-full p-2.5 border border-[#EAE3DC] rounded-xl bg-white text-[#2C1F14] outline-none focus:border-[#845326] shadow-sm font-medium"
                    >
                      {Array.from({ length: 5 }).map((_, i) => {
                        const y = new Date().getFullYear() + i;
                        return (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    {futureWeeksList.map((week) => (
                      <label
                        key={week.label}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedWeeks.includes(week.label) ? 'border-[#845326] bg-[#f5e5d9]' : 'border-[#EAE3DC] hover:bg-[#FDFBF9]'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedWeeks.includes(week.label)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedWeeks((prev) => [...prev, week.label]);
                            else setSelectedWeeks((prev) => prev.filter((l) => l !== week.label));
                          }}
                          className="w-5 h-5 accent-[#845326] rounded border-[#845326] focus:ring-[#845326] cursor-pointer"
                        />
                        <span className="text-sm font-bold text-[#845326]">
                          {copy.weekOf} {week.label}
                        </span>
                      </label>
                    ))}
                    {futureWeeksList.length === 0 && (
                      <div className="text-center py-4 text-sm font-semibold text-on-surface-variant">
                        {copy.noWeeks}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-6 border-t border-[#EAE3DC] bg-[#FDFBF9] flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowSpecificWeeksModal(false);
                      setSelectedWeeks([]);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-[#EAE3DC] transition-colors"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    disabled={selectedWeeks.length === 0}
                    onClick={() => {
                      const selectedWeekStarts = futureWeeksList
                        .filter((w) => selectedWeeks.includes(w.label))
                        .map((w) => w.start);
                      replicateToWeeks(selectedWeekStarts, start, end);
                    }}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-[#845326] text-white hover:bg-[#6c421f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="size-4" />
                    {copy.apply}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSpecificMonthModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C1F14]/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] border border-[#EAE3DC]">
                <div className="p-5 border-b border-[#EAE3DC] bg-[#FDFBF9]">
                  <h3 className="text-lg font-bold text-[#433022]">{copy.replicateMonthTitle}</h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {copy.replicateMonthDescription}
                  </p>
                </div>
                <div className="p-5 flex-1 overflow-y-auto space-y-4">
                  <div>
                    <label className="text-sm font-bold text-[#845326] block mb-2">
                      {copy.yearLabel}
                    </label>
                    <select
                      value={selectedReplicateYear}
                      onChange={(e) => setSelectedReplicateYear(Number(e.target.value))}
                      className="w-full p-2.5 border border-[#EAE3DC] rounded-xl bg-white text-[#2C1F14] outline-none focus:border-[#845326] shadow-sm font-medium"
                    >
                      {Array.from({ length: 5 }).map((_, i) => {
                        const y = new Date().getFullYear() + i;
                        return (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-[#845326] block mb-2">
                      {copy.monthLabel}
                    </label>
                    <select
                      value={selectedReplicateMonth}
                      onChange={(e) => setSelectedReplicateMonth(Number(e.target.value))}
                      className="w-full p-2.5 border border-[#EAE3DC] rounded-xl bg-white text-[#2C1F14] outline-none focus:border-[#845326] shadow-sm font-medium"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={i}>
                          {format(new Date(2024, i, 1), 'MMMM', { locale: dateLocale })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="p-4 border-t border-[#EAE3DC] bg-[#FDFBF9] flex justify-end gap-2">
                  <button
                    onClick={() => setShowSpecificMonthModal(false)}
                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const targetYear =
                        selectedReplicateMonth < today.getMonth()
                          ? today.getFullYear() + 1
                          : today.getFullYear();
                      const firstDayOfMonth = new Date(targetYear, selectedReplicateMonth, 1);
                      const lastDayOfMonth = endOfMonthFn(firstDayOfMonth);

                      let currentWeekStart = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
                      const targetWeeks: Date[] = [];

                      while (currentWeekStart <= lastDayOfMonth) {
                        // Solo agregar si la semana no es la misma semana origen (para no duplicar inútilmente)
                        if (currentWeekStart.getTime() !== start.getTime()) {
                          targetWeeks.push(currentWeekStart);
                        }
                        currentWeekStart = addDays(currentWeekStart, 7);
                      }

                      replicateToWeeks(targetWeeks, start, end, selectedReplicateMonth);
                      setShowSpecificMonthModal(false);
                    }}
                    className="px-5 py-2 text-sm font-bold bg-[#845326] text-white rounded-xl hover:bg-[#6c421e] shadow-md transition-all active:scale-95"
                  >
                    {copy.replicateConfirm}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Subida de Horario con IA */}
          {showUploadModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-[#EAE3DC]">
                <div className="px-6 py-4 border-b border-[#EAE3DC] flex items-center justify-between bg-[#FDFBF9]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#f5e5d9] rounded-xl text-[#845326]">
                      <Sparkles className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-[#845326]">
                        {copy.uploadTitle}
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium">
                        {copy.uploadSubtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!uploadLoading) {
                        setShowUploadModal(false);
                        setUploadFile(null);
                        setUploadError(null);
                      }
                    }}
                    disabled={uploadLoading}
                    className="p-2 hover:bg-[#EAE3DC] rounded-full text-on-surface-variant transition-colors disabled:opacity-40"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {uploadSuccessMsg && (
                    <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                      <Check className="size-4 shrink-0 text-green-600" />
                      <span>{uploadSuccessMsg}</span>
                    </div>
                  )}

                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {copy.uploadDescription}
                  </p>

                  {/* Selector de opciones: De trabajo vs De estudio */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#845326] block">
                      {copy.scheduleType}
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setScheduleCategory('trabajo')}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          scheduleCategory === 'trabajo'
                            ? 'border-[#845326] bg-[#F4C2BA]/25 ring-2 ring-[#F4C2BA]'
                            : 'border-[#EAE3DC] bg-[#FDFBF9] hover:bg-[#F7EFE9] text-gray-700'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            scheduleCategory === 'trabajo'
                              ? 'bg-[#F4C2BA] text-[#6B3229]'
                              : 'bg-[#EAE3DC]/60 text-gray-600'
                          }`}
                        >
                          <Briefcase className="size-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#2C1F14]">{copy.workSchedule}</p>
                          <p className="text-[10px] text-on-surface-variant font-medium">
                            {copy.workCategory}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScheduleCategory('estudio')}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          scheduleCategory === 'estudio'
                            ? 'border-[#845326] bg-[#BBD0F4]/25 ring-2 ring-[#BBD0F4]'
                            : 'border-[#EAE3DC] bg-[#FDFBF9] hover:bg-[#F7EFE9] text-gray-700'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            scheduleCategory === 'estudio'
                              ? 'bg-[#BBD0F4] text-[#203D6B]'
                              : 'bg-[#EAE3DC]/60 text-gray-600'
                          }`}
                        >
                          <GraduationCap className="size-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#2C1F14]">{copy.studySchedule}</p>
                          <p className="text-[10px] text-on-surface-variant font-medium">
                            {copy.studyCategory}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Selector de Replicación */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#845326] block">
                      {copy.scheduleReplication}
                    </label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          checked={uploadReplicateOption === 'todos'}
                          onChange={() => setUploadReplicateOption('todos')}
                          className="accent-[#845326]"
                        />
                        {copy.allMonths}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          checked={uploadReplicateOption === 'mes'}
                          onChange={() => setUploadReplicateOption('mes')}
                          className="accent-[#845326]"
                        />
                        {copy.specificMonth}
                      </label>
                      {uploadReplicateOption === 'mes' && (
                        <div className="pl-6 mb-1 flex gap-2">
                          <select
                            value={uploadSelectedYear}
                            onChange={(e) => setUploadSelectedYear(Number(e.target.value))}
                            className="text-sm p-1.5 border border-[#EAE3DC] rounded-lg bg-white text-[#2C1F14] outline-none focus:border-[#845326] min-w-[80px] shadow-sm"
                          >
                            {Array.from({ length: 5 }).map((_, i) => {
                              const y = new Date().getFullYear() + i;
                              return (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              );
                            })}
                          </select>
                          <select
                            value={uploadSelectedMonth}
                            onChange={(e) => setUploadSelectedMonth(Number(e.target.value))}
                            className="text-sm p-1.5 border border-[#EAE3DC] rounded-lg bg-white text-[#2C1F14] outline-none focus:border-[#845326] min-w-[150px] shadow-sm"
                          >
                            {Array.from({ length: 12 }).map((_, i) => (
                              <option key={i} value={i}>
                                {format(new Date(2024, i, 1), 'MMMM', { locale: dateLocale })}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          checked={uploadReplicateOption === 'semanas'}
                          onChange={() => setUploadReplicateOption('semanas')}
                          className="accent-[#845326]"
                        />
                        En semanas específicas...
                      </label>
                    </div>
                  </div>

                  {uploadReplicateOption === 'semanas' && (
                    <div className="border border-[#EAE3DC] rounded-xl p-3 bg-[#FDFBF9] max-h-56 overflow-y-auto custom-scrollbar">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs text-on-surface-variant font-semibold">
                          {copy.chooseWeeks}
                        </p>
                        <select
                          value={selectedWeeksYear}
                          onChange={(e) => {
                            const year = Number(e.target.value);
                            setSelectedWeeksYear(year);
                            generateFutureWeeks(start, year);
                          }}
                          className="text-xs p-1 border border-[#EAE3DC] rounded-md bg-white text-[#2C1F14] outline-none focus:border-[#845326] shadow-sm"
                        >
                          {Array.from({ length: 5 }).map((_, i) => {
                            const y = new Date().getFullYear() + i;
                            return (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {futureWeeksList.map((week) => (
                          <label
                            key={week.label}
                            className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={uploadSelectedWeeks.includes(week.label)}
                              onChange={(e) => {
                                if (e.target.checked)
                                  setUploadSelectedWeeks((prev) => [...prev, week.label]);
                                else
                                  setUploadSelectedWeeks((prev) =>
                                    prev.filter((l) => l !== week.label),
                                  );
                              }}
                              className="accent-[#845326]"
                            />
                            {copy.weekOf} {week.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-2 border-dashed border-[#E2D9D0] rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-[#FDFBF9] hover:bg-[#F5EFE9] transition-colors relative cursor-pointer">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.pdf,image/*,application/pdf"
                      disabled={uploadLoading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          setUploadError(null);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <Upload className="size-8 text-[#845326] mb-2" />
                    <p className="text-sm font-bold text-[#2C1F14]">
                      {uploadFile ? uploadFile.name : copy.dropFile}
                    </p>
                    <p className="text-xs text-[#845326] mt-1 font-medium">{copy.fileFormats}</p>
                  </div>

                  {uploadFile && (
                    <div className="flex items-center justify-between p-2.5 px-3 bg-surface-container rounded-xl text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="size-4 text-[#845326] shrink-0" />
                        <span className="truncate font-semibold text-on-surface">
                          {uploadFile.name}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-medium shrink-0">
                          ({(uploadFile.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      {!uploadLoading && (
                        <button
                          type="button"
                          onClick={() => setUploadFile(null)}
                          className="text-red-500 hover:text-red-700 p-1 text-xs font-semibold"
                        >
                          {copy.remove}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 px-6 border-t border-[#EAE3DC] bg-[#FDFBF9] flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={uploadLoading}
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setUploadError(null);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-[#EAE3DC] transition-colors disabled:opacity-40"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={!uploadFile || uploadLoading}
                    onClick={handleProcessScheduleFile}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-[#845326] text-white hover:bg-[#6c421f] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    {uploadLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-white" />
                        <span>{uploadStatusText}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 text-[#F7D6BF]" />
                        <span>{copy.processSchedule}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. GRID DE HORAS (Contenido Desplazable) */}
          <div id="tour-calendar-week-grid" className="flex relative pt-4 pb-4">
            <div className="sticky left-0 z-10 w-[100px] min-w-[100px] bg-white border-r border-[#EAE3DC] flex flex-col">
              {visibleTimeSlots.map((time) => {
                const isHourStart = time.endsWith(':00');
                const isHourEnd = time.endsWith(':55');
                const [, minuteStr] = time.split(':');
                const isActive = activeTimes.has(time);

                return (
                  <div
                    key={`time-${time}`}
                    className={`
                      ${isHourStart ? 'min-h-[48px]' : 'min-h-[32px]'} relative flex justify-end items-center pr-3 group transition-colors cursor-default
                      ${isHourStart ? 'border-b border-[#EAE3DC]' : ''}
                      ${isHourEnd ? 'mb-3' : ''}
                    `}
                  >
                    {isHourStart ? (
                      <div className="flex items-center gap-1.5 z-10 rounded">
                        <span
                          className={`text-[10px] ${isActive ? 'text-black font-extrabold' : 'text-[#845326] font-bold'}`}
                        >
                          {format12h(time)}
                        </span>
                        <button
                          onClick={() => toggleHour(parseInt(time.split(':')[0], 10))}
                          className="p-0.5 hover:bg-[#EAE3DC] rounded-full text-[#845326] transition-colors"
                        >
                          {expandedHours.includes(parseInt(time.split(':')[0], 10)) ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronRight className="size-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-[9px] leading-none z-10 ${isActive ? 'text-black font-extrabold' : 'text-[#845326]/60 font-medium'}`}
                      >
                        {minuteStr}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 grid grid-cols-7 min-w-[500px]">
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayOfWeek = format(day, 'EEEE', { locale: dateLocale });
                const isPast = isBefore(day, startOfDay(new Date()));

                return (
                  <div
                    key={`col-${dateStr}`}
                    className={`flex flex-col border-r border-[#EAE3DC] last:border-r-0 bg-[#FDFBF9] ${isPast ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {visibleTimeSlots.map((timeStr) => {
                      const slotIdx = getSlotIndex(timeStr);
                      const avail = availMap.get(`${dateStr}_${timeStr}`);
                      const isEditing =
                        editingCell?.date === dateStr && editingCell?.time === timeStr;
                      const isHourStart = timeStr.endsWith(':00');
                      const isHourEnd = timeStr.endsWith(':55');

                      const isCollapsedHour =
                        isHourStart && !expandedHours.includes(parseInt(timeStr.split(':')[0], 10));
                      let macroAvailCount = 0;
                      let macroFirstAvail: Availability | undefined;
                      if (isCollapsedHour) {
                        const startIdx = slotIdx;
                        for (let i = startIdx; i < startIdx + 12; i++) {
                          const slot = TIME_SLOTS[i];
                          if (slot) {
                            const found = availMap.get(`${dateStr}_${slot}`);
                            if (found) {
                              macroAvailCount++;
                              if (!macroFirstAvail) macroFirstAvail = found;
                            }
                          }
                        }
                      }

                      const effectiveAvail = isCollapsedHour ? macroFirstAvail : avail;
                      const isGoogleEvent = effectiveAvail?.source === 'google';
                      const isTask = Boolean(effectiveAvail?.eventId);
                      const currentType = effectiveAvail?.type || 'tareas';
                      const colorTheme = isGoogleEvent
                        ? {
                            bg: 'bg-[#F1F3F4]',
                            hover: 'hover:bg-[#E8EAED]',
                            text: 'text-[#5F6368]',
                            border: 'border-[#DADCE0]',
                            bgPale: 'bg-[#F1F3F4]/50',
                          }
                        : COLOR_MAP[currentType] || COLOR_MAP.tareas || COLOR_MAP.estudiando;
                      const isMacroPartiallyOccupied =
                        isCollapsedHour && macroAvailCount > 0 && macroAvailCount < 12 && !isTask;
                      const isOccupied = !!avail || (isCollapsedHour && macroAvailCount > 0);
                      const isDraggable = !isPast && (isTask || (isOccupied && !isGoogleEvent));

                      const isSelected = Boolean(
                        selectedBlock &&
                        selectedBlock.date === dateStr &&
                        ((selectedBlock.eventId &&
                          effectiveAvail?.eventId === selectedBlock.eventId) ||
                          (selectedBlock.blockId &&
                            effectiveAvail?.blockId === selectedBlock.blockId) ||
                          (selectedStartIdx !== -1 &&
                            selectedEndIdx !== -1 &&
                            slotIdx >= selectedStartIdx &&
                            slotIdx < selectedEndIdx)),
                      );

                      const isDropTarget =
                        dragOverCell?.date === dateStr && dragOverCell?.time === timeStr;
                      const isBeingDragged = Boolean(
                        draggedTask &&
                        draggedTask.sourceDate === dateStr &&
                        ((draggedTask.eventId && effectiveAvail?.eventId === draggedTask.eventId) ||
                          (!draggedTask.eventId &&
                            draggedStartIdx !== -1 &&
                            draggedEndIdx !== -1 &&
                            slotIdx >= draggedStartIdx &&
                            slotIdx < draggedEndIdx)),
                      );

                      const displayLabel = effectiveAvail?.label
                        ? effectiveAvail.label
                        : isGoogleEvent
                          ? 'Ocupado'
                          : effectiveAvail?.type === 'tareas'
                            ? copy.tasks
                            : '';
                      return (
                        <div
                          key={`cell-${dateStr}-${timeStr}`}
                          onClick={() => handleCellClick(dateStr, dayOfWeek, timeStr, isPast)}
                          onDragOver={(e) => handleDragOver(e, dateStr, timeStr)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleTaskDrop(e, dateStr, timeStr)}
                          draggable={isDraggable}
                          onDragStart={(e) => {
                            if (isDraggable && effectiveAvail) {
                              handleDragStart(e, dateStr, effectiveAvail, timeStr, isCollapsedHour);
                            }
                          }}
                          onDragEnd={() => {
                            setDraggedTask(null);
                            setDragOverCell(null);
                          }}
                          className={`
                            ${isHourStart ? 'min-h-[48px]' : 'min-h-[32px]'} relative group transition-colors box-border
                            ${isHourStart ? 'border-b border-[#EAE3DC]' : 'border-b border-dashed border-[#EAE3DC]/40'}
                            ${isHourEnd ? 'mb-3' : ''}
                            ${isPast ? '' : isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                            ${!isOccupied && !isDropTarget && !isPast ? 'hover:bg-[#f5e5d9]/50' : ''}
                            ${isOccupied ? `${colorTheme.bg}` : ''}
                            ${isMacroPartiallyOccupied ? `${colorTheme.bgPale} border-[1px] border-dashed ${colorTheme.border}` : ''}
                            ${isDropTarget ? 'ring-2 ring-[#845326] bg-[#845326]/20 scale-[0.98] z-20' : ''}
                            ${isBeingDragged ? 'opacity-35 scale-95' : ''}
                            ${isSelected ? 'ring-2 ring-black ring-inset z-30 shadow-sm' : ''}
                            ${isEditing ? 'z-[70]' : ''}
                          `}
                        >
                          {(isOccupied || isMacroPartiallyOccupied) && !isEditing && (
                            <div className="absolute inset-0 flex items-center justify-between px-1.5 overflow-hidden z-10 select-none">
                              <div className="flex items-center gap-1 overflow-hidden flex-1 min-w-0">
                                {isGoogleEvent && (
                                  <svg
                                    className="w-3 h-3 shrink-0 text-[#5F6368]"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      fill="currentColor"
                                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                      fill="currentColor"
                                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                      fill="currentColor"
                                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                      fill="currentColor"
                                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                  </svg>
                                )}
                                {isDraggable && (
                                  <GripVertical className="size-3 text-black/50 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                                )}
                                <span
                                  className={`text-[10px] font-bold truncate leading-none pt-[1px] ${isMacroPartiallyOccupied ? colorTheme.text + '/60' : colorTheme.text}`}
                                  title={displayLabel}
                                >
                                  {displayLabel}
                                </span>
                              </div>

                              {!isGoogleEvent && (
                                <div
                                  className={`flex items-center gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity shrink-0 ml-1`}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  {!isPast && (
                                    <>
                                      <button
                                        onClick={(e) => handleDeleteBlock(dateStr, timeStr, e)}
                                        className={`p-0.5 bg-white/80 rounded hover:bg-red-50 hover:text-red-600 ${colorTheme.text} transition-colors`}
                                        title={
                                          locale === 'es'
                                            ? 'Borrar bloque del calendario'
                                            : 'Delete calendar block'
                                        }
                                      >
                                        <Trash2 className="size-3" />
                                      </button>
                                      <button
                                        onClick={(e) =>
                                          handleEditLabel(
                                            dateStr,
                                            timeStr,
                                            effectiveAvail!.label,
                                            currentType,
                                            e,
                                          )
                                        }
                                        className={`p-0.5 bg-white/70 rounded hover:bg-white ${colorTheme.text} transition-colors`}
                                        title={
                                          isTask
                                            ? locale === 'es'
                                              ? 'Editar nombre de tarea'
                                              : 'Edit task name'
                                            : locale === 'es'
                                              ? 'Editar'
                                              : 'Edit'
                                        }
                                      >
                                        <Edit2 className="size-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {isEditing &&
                            !isPast &&
                            typeof document !== 'undefined' &&
                            createPortal(
                              <>
                                <div
                                  className="fixed inset-0 z-[110] bg-black/5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCell(null);
                                    if (!effectiveAvail) setSelectedBlock(null);
                                  }}
                                />
                                <div
                                  className="fixed left-1/2 top-1/2 z-[120] flex min-w-[170px] -translate-x-1/2 -translate-y-1/2 flex-col gap-2.5 rounded-xl border border-[#EAE3DC] bg-white p-3 shadow-xl"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-between pb-1 border-b border-[#EAE3DC]/60">
                                    <span className="text-[11px] font-bold text-[#845326]">
                                      {effectiveAvail
                                        ? effectiveAvail.eventId
                                          ? copy.editTask
                                          : copy.editBlock
                                        : copy.newBlock}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCell(null);
                                        if (!effectiveAvail) setSelectedBlock(null);
                                      }}
                                      className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </div>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={editLabel}
                                    onChange={(e) => setEditLabel(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditedLabel();
                                      if (e.key === 'Escape') {
                                        setEditingCell(null);
                                        if (!effectiveAvail) setSelectedBlock(null);
                                      }
                                    }}
                                    maxLength={15}
                                    className="w-full text-xs font-bold text-on-surface bg-[#FDFBF9] border border-[#EAE3DC] rounded-md p-1.5 focus:outline-none focus:border-[#845326]"
                                    placeholder={
                                      effectiveAvail?.eventId ? copy.taskName : copy.blockName
                                    }
                                  />
                                  <div className="flex gap-2 justify-center flex-wrap px-1">
                                    <button
                                      type="button"
                                      onClick={() => setEditType('tareas')}
                                      className={`w-6 h-6 rounded border ${editType === 'tareas' ? 'border-[#845326] ring-2 ring-[#C8D6AF]/50' : 'border-[#EAE3DC]'} bg-[#C8D6AF] transition-transform hover:scale-110`}
                                      title={copy.tasks}
                                    ></button>
                                    <button
                                      type="button"
                                      onClick={() => setEditType('estudiando')}
                                      className={`w-6 h-6 rounded border ${editType === 'estudiando' ? 'border-[#845326] ring-2 ring-[#BBD0F4]/50' : 'border-[#EAE3DC]'} bg-[#BBD0F4] transition-transform hover:scale-110`}
                                      title={copy.studying}
                                    ></button>
                                    <button
                                      type="button"
                                      onClick={() => setEditType('trabajo')}
                                      className={`w-6 h-6 rounded border ${editType === 'trabajo' ? 'border-[#845326] ring-2 ring-[#F4C2BA]/50' : 'border-[#EAE3DC]'} bg-[#F4C2BA] transition-transform hover:scale-110`}
                                      title={copy.work}
                                    ></button>
                                    <button
                                      type="button"
                                      onClick={() => setEditType('descanso')}
                                      className={`w-6 h-6 rounded border ${editType === 'descanso' ? 'border-[#845326] ring-2 ring-[#F9EBB2]/50' : 'border-[#EAE3DC]'} bg-[#F9EBB2] transition-transform hover:scale-110`}
                                      title={copy.rest}
                                    ></button>
                                    <button
                                      type="button"
                                      onClick={() => setEditType('otra_actividad')}
                                      className={`w-6 h-6 rounded border ${editType === 'otra_actividad' ? 'border-[#845326] ring-2 ring-[#E1C6F5]/50' : 'border-[#EAE3DC]'} bg-[#E1C6F5] transition-transform hover:scale-110`}
                                      title={copy.otherActivity}
                                    ></button>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCell(null);
                                        if (!effectiveAvail) setSelectedBlock(null);
                                      }}
                                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-1.5 rounded-lg transition-colors cursor-pointer"
                                    >
                                      {copy.cancel}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={saveEditedLabel}
                                      className="flex-1 bg-[#845326] text-white text-xs font-bold py-1.5 rounded-lg hover:bg-[#6c421f] transition-colors cursor-pointer"
                                    >
                                      {copy.save}
                                    </button>
                                  </div>
                                </div>
                              </>,
                              document.body,
                            )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* LEYENDA VISUAL DE COLORES */}
        <div
          id="tour-calendar-legend"
          className="flex-shrink-0 py-4 flex justify-center flex-wrap gap-x-6 gap-y-4 px-4"
        >
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#C8D6AF] border border-[#3A4A28]/20"></div>
            <span className="text-xs font-bold text-[#845326]">{copy.tasks}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#BBD0F4] border border-[#203D6B]/20"></div>
            <span className="text-xs font-bold text-[#845326]">{copy.studying}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#F4C2BA] border border-[#6B3229]/20"></div>
            <span className="text-xs font-bold text-[#845326]">{copy.work}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#F9EBB2] border border-[#5C4F1A]/20"></div>
            <span className="text-xs font-bold text-[#845326]">{copy.rest}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#E1C6F5] border border-[#4A2D69]/20"></div>
            <span className="text-xs font-bold text-[#845326]">{copy.otherActivity}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full relative">
      {view === 'month' ? renderMonthlyGrid() : renderWeeklyGrid()}

      {toastMessage && (
        <div
          className={`fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${
            toastMessage.type === 'success' ? 'bg-[#34A853] text-white' : 'bg-[#EA4335] text-white'
          }`}
        >
          <span className="font-bold text-sm">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {projectSelectorState?.visible && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#FDFBF9]">
              <h3 className="font-bold text-[#4A2D69]">{copy.selectProject}</h3>
              <button
                onClick={() => setProjectSelectorState(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {projectSelectorState.projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={async () => {
                    const sIso = new Date(
                      `${projectSelectorState.date}T${projectSelectorState.startTime}:00`,
                    ).toISOString();
                    const eSlot =
                      projectSelectorState.endTime === '24:00'
                        ? '23:59:59'
                        : `${projectSelectorState.endTime}:00`;
                    const eIso = new Date(`${projectSelectorState.date}T${eSlot}`).toISOString();
                    const durationMins = Math.round(
                      (new Date(eIso).getTime() - new Date(sIso).getTime()) / 60000,
                    );

                    setToastMessage({ type: 'success', text: copy.creatingTask });
                    setProjectSelectorState(null);

                    const res = await createTaskAction({
                      projectId: proj.id,
                      titulo: editLabel || copy.newTask,
                      duracion: durationMins,
                      fecha_inicio: sIso,
                    });

                    if (res.success && res.task?.id) {
                      router.push(
                        `${localizedProjectHref(locale, proj.id)}?editTask=${res.task.id}`,
                      );
                    } else if (res.success) {
                      router.push(localizedProjectHref(locale, proj.id));
                    } else {
                      setToastMessage({
                        type: 'error',
                        text: res.error || copy.createTaskError,
                      });
                    }
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-[#F4EFEA] rounded-xl transition-colors mb-2 font-medium text-gray-700 flex items-center gap-3 border border-transparent hover:border-[#EAE3DC]"
                >
                  <Briefcase className="size-4 text-[#845326]" />
                  {proj.titulo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
