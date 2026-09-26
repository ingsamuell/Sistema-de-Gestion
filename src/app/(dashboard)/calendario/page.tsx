'use client';

import React, { useState, useEffect } from 'react';
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
  startOfDay,
  addDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
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
} from '@/features/schedule/actions/calendarActions';
import { createClient } from '@/lib/supabase/client';
import { useCalendarTour } from '@/hooks/useCalendarTour';

interface Availability {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  label: string;
  type?:
    'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' | 'estudio' | 'ocupado';
  source?: 'google' | 'local' | 'supabase';
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

const parseISODate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const endOfMonthFn = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

function consolidateAvailabilitySlots(slots: Availability[]) {
  const nonTasks = slots.filter((a) => !a.eventId && a.source !== 'google');
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
    tipo: 'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad';
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
          let normalizedType: 'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad' =
            'tareas';
          if (current.type === 'estudio' || current.type === 'estudiando')
            normalizedType = 'estudio';
          else if (current.type === 'trabajo' || current.type === 'ocupado')
            normalizedType = 'trabajo';
          else if (current.type === 'otra_actividad' || current.type === 'descanso')
            normalizedType = 'otra_actividad';
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
      let normalizedType: 'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad' =
        'tareas';
      if (current.type === 'estudio' || current.type === 'estudiando') normalizedType = 'estudio';
      else if (current.type === 'trabajo' || current.type === 'ocupado') normalizedType = 'trabajo';
      else if (current.type === 'otra_actividad' || current.type === 'descanso')
        normalizedType = 'otra_actividad';
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
  const [hoveredTimeStr, setHoveredTimeStr] = useState<string | null>(null);

  const [showReplicateMenu, setShowReplicateMenu] = useState(false);
  const [showSpecificWeeksModal, setShowSpecificWeeksModal] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [futureWeeksList, setFutureWeeksList] = useState<
    { start: Date; end: Date; label: string }[]
  >([]);

  // Estado para la subida y procesamiento de horario con IA
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [scheduleCategory, setScheduleCategory] = useState<'estudio' | 'trabajo'>('estudio');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('Analizando con Gemini...');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadCalendarEventsFromSupabase = React.useCallback(async () => {
    try {
      const res = await getCalendarDataAction();
      if (res.success) {
        const dbEvents: Availability[] = [];
        if (res.events && res.events.length > 0) {
          res.events.forEach((ev) => {
            const startD = new Date(ev.inicio);
            const endD = new Date(ev.fin);
            if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return;

            const dateStr = format(startD, 'yyyy-MM-dd');
            const dayOfWeekName = format(startD, 'EEEE', { locale: es });
            const startSlot = format(startD, 'HH:mm');
            const endSlot = format(endD, 'HH:mm');

            const startIdx = TIME_SLOTS.indexOf(startSlot);
            const endIdx = TIME_SLOTS.indexOf(endSlot);
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
            const startIdx = TIME_SLOTS.indexOf(startSlot);
            const endIdx = TIME_SLOTS.indexOf(endSlot);
            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return;

            let normalizedType:
              'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' = 'trabajo';
            if (b.type === 'estudio' || b.type === 'estudiando') normalizedType = 'estudiando';
            else if (b.type === 'trabajo' || b.type === 'ocupado') normalizedType = 'trabajo';
            else if (b.type === 'descanso') normalizedType = 'descanso';
            else if (b.type === 'otra_actividad') normalizedType = 'otra_actividad';

            const dayOfWeekName = format(parseISODate(b.date), 'EEEE', { locale: es });
            const blockId = `block_${b.date}_${startIdx}_${endIdx}`;

            for (let i = startIdx; i < endIdx; i++) {
              const slot = TIME_SLOTS[i];
              if (slot && slot !== '24:00') {
                dbEvents.push({
                  date: b.date,
                  dayOfWeek: dayOfWeekName,
                  startTime: slot,
                  endTime: TIME_SLOTS[i + 1] || '24:00',
                  label: b.label || (normalizedType === 'estudiando' ? 'Estudio' : 'Trabajo'),
                  type: normalizedType,
                  source: 'supabase',
                  blockId,
                });
              }
            }
          });
        } else if (res.availabilities && res.availabilities.length > 0) {
          res.availabilities.forEach((b) => {
            if (b.tipo === 'tareas') return; // 'tareas' representan slots libres
            if (!b.fecha_especifica) return;

            const startSlot = b.hora_inicio.slice(0, 5);
            const endSlot = b.hora_fin.slice(0, 5);
            const startIdx = TIME_SLOTS.indexOf(startSlot);
            const endIdx = TIME_SLOTS.indexOf(endSlot);
            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return;

            let normalizedType:
              'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' = 'trabajo';
            if (b.tipo === 'estudio') normalizedType = 'estudiando';
            else if (b.tipo === 'trabajo') normalizedType = 'trabajo';
            else if (b.tipo === 'otra_actividad') normalizedType = 'otra_actividad';
            else if (b.tipo === 'ocupado') normalizedType = 'trabajo';

            const dayOfWeekName = format(parseISODate(b.fecha_especifica), 'EEEE', { locale: es });
            const blockId = `block_${b.fecha_especifica}_${startIdx}_${endIdx}`;

            for (let i = startIdx; i < endIdx; i++) {
              const slot = TIME_SLOTS[i];
              if (slot && slot !== '24:00') {
                dbEvents.push({
                  date: b.fecha_especifica,
                  dayOfWeek: dayOfWeekName,
                  startTime: slot,
                  endTime: TIME_SLOTS[i + 1] || '24:00',
                  label:
                    b.tipo === 'estudio' ? 'Estudio' : b.tipo === 'trabajo' ? 'Trabajo' : 'Ocupado',
                  type: normalizedType,
                  source: 'supabase',
                  blockId,
                });
              }
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
  }, []);

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
          const dayOfWeekName = format(startD, 'EEEE', { locale: es });
          const startSlot = format(startD, 'HH:mm');
          const endSlot = format(endD, 'HH:mm');

          const startIdx = TIME_SLOTS.indexOf(startSlot);
          const endIdx = TIME_SLOTS.indexOf(endSlot);
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
  }, []);

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
        setToastMessage({ type: 'success', text: 'Google Calendar sincronizado correctamente' });
        window.history.replaceState({}, document.title, window.location.pathname);

        // Cargar eventos reales desde Google Calendar
        loadGoogleCalendarEvents();
      } else if (error === 'true') {
        const errorDetail = urlParams.get('calendar_error');
        const decodedDetail = errorDetail ? decodeURIComponent(errorDetail) : null;
        setToastMessage({
          type: 'error',
          text: decodedDetail || 'Error al conectar con Google Calendar',
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
  }, [loadCalendarEventsFromSupabase, loadGoogleCalendarEvents]);

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
    setToastMessage({ type: 'success', text: 'Google Calendar desconectado' });
    // Limpiar la cookie segura del servidor para invalidar la sesión
    try {
      await fetch('/api/auth/google', { method: 'DELETE' });
    } catch {
      // Si falla, la cookie expirará sola; el estado local ya está limpio
    }
  };

  const activeTimes = new Set(availabilities.map((a) => a.startTime));

  useEffect(() => {
    localStorage.setItem('komorebi_availabilities', JSON.stringify(availabilities));

    // Sincronizar bloques de disponibilidad con Supabase (consolidando franjas en bloques limpios)
    const timer = setTimeout(() => {
      const consolidated = consolidateAvailabilitySlots(availabilities);
      syncAvailabilityBlocksAction(consolidated).catch((err) =>
        console.warn('Aviso sincronizando bloques en Supabase:', err),
      );
    }, 800);

    return () => clearTimeout(timer);
  }, [availabilities]);

  const visibleTimeSlots: string[] = [];
  for (let h = 0; h <= 23; h++) {
    const hourStr = h.toString().padStart(2, '0');
    visibleTimeSlots.push(`${hourStr}:00`);
    if (expandedHours.includes(h)) {
      for (let m = 5; m < 60; m += 5) {
        visibleTimeSlots.push(`${hourStr}:${m.toString().padStart(2, '0')}`);
      }
    }
  }

  const toggleHour = (h: number) => {
    setExpandedHours((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  };

  const renderMonthlyGrid = () => {
    const startY = startOfYear(currentDate);
    const endY = endOfYear(currentDate);
    const months = eachMonthOfInterval({ start: startY, end: endY });

    const canGoPreviousYear = currentDate.getFullYear() > new Date().getFullYear();
    const canGoNextYear = currentDate.getFullYear() < 2036;

    return (
      <div className="flex flex-col animate-in fade-in duration-500 w-full max-w-5xl mx-auto pb-12">
        <div className="bg-[#FBE6DD] rounded-[24px] p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-[#F7D6BF] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F7D6BF] rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/4"></div>
          <div className="bg-white p-3 rounded-full shadow-sm relative z-10 text-[#845326] shrink-0">
            <Calendar className="size-6 sm:size-8" />
          </div>
          <div className="relative z-10 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#845326] leading-tight">
              Si nos dices cuál es tu horario disponible podemos personalizar los planes de tu
              proyecto.
            </h2>
            <p className="text-[#A57855] text-sm mt-1 font-semibold">
              Selecciona un mes para configurar tus horas de estudio o trabajo.
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
                <span className="truncate">Conectar Google Calendar</span>
              </button>
            ) : (
              <button
                onClick={handleDisconnectGoogle}
                className="group flex items-center justify-center gap-2 px-4 py-2 bg-[#E6F4EA] text-[#137333] hover:bg-[#FCE8E6] hover:text-[#C5221F] border border-[#CEEAD6] hover:border-[#FAD2CF] rounded-xl font-semibold shadow-sm transition-all w-full sm:w-auto"
              >
                <span className="group-hover:hidden flex items-center gap-2">
                  <Check className="size-4" /> Conectado a Google
                </span>
                <span className="hidden group-hover:flex items-center gap-2">
                  <X className="size-4" /> Desconectar
                </span>
              </button>
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

            return (
              <button
                key={month.toISOString()}
                disabled={isPastMonth}
                onClick={() => {
                  setCurrentDate(isCurrentMonth ? new Date() : month);
                  setView('week');
                }}
                className={`
                  flex flex-col items-center justify-center p-4 rounded-[16px] transition-all aspect-square border-2
                  ${isPastMonth ? 'opacity-50 cursor-not-allowed hover:bg-surface-container-lowest bg-surface-container-lowest text-on-surface-variant' : 'hover:-translate-y-1 hover:shadow-sm cursor-pointer'}
                  ${
                    isCurrentMonth
                      ? 'bg-[#f5e5d9] border-[#845326] text-[#845326]'
                      : !isPastMonth
                        ? 'bg-white border-[#EAE3DC] text-on-surface hover:border-[#F7D6BF]'
                        : 'border-[#EAE3DC]'
                  }
                `}
              >
                <span className="text-sm sm:text-base font-bold capitalize">
                  {format(month, 'MMMM', { locale: es })}
                </span>
                {isCurrentMonth && (
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">
                    Actual
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
      setUploadError('Por favor selecciona una imagen o documento PDF con tu horario.');
      return;
    }

    setUploadLoading(true);
    setUploadStatusText('Optimizando documento/imagen...');
    setUploadError(null);
    setUploadSuccessMsg(null);

    try {
      const { base64Data, mimeType } = await compressImageForUpload(uploadFile);
      setUploadStatusText('Analizando horario con IA Gemini...');

      const res = await fetch('/api/calendar/extract-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType,
          guardarEnDisponibilidad: true,
          categoria: scheduleCategory,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el horario');
      }

      if (data.bloques && data.bloques.length > 0) {
        // Calcular la semana activa actual
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekDays = eachDayOfInterval({
          start,
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        });

        const mappedAvails: Availability[] = [];

        data.bloques.forEach(
          (b: {
            dia_semana: number;
            hora_inicio: string;
            hora_fin: string;
            tipo: string;
            etiqueta?: string;
          }) => {
            // Mapear dia_semana (0: Domingo, 1: Lunes.. 6: Sábado) al día correspondiente en la semana visible
            const targetDay = weekDays.find((d) => d.getDay() === b.dia_semana);
            if (!targetDay) return;

            const dateStr = format(targetDay, 'yyyy-MM-dd');
            const dayOfWeekName = format(targetDay, 'EEEE', { locale: es });

            // Normalizar horas al slot más cercano
            const startSlot =
              b.hora_inicio.length === 5 ? b.hora_inicio : `${b.hora_inicio.padStart(5, '0')}`;
            const endSlot = b.hora_fin.length === 5 ? b.hora_fin : `${b.hora_fin.padStart(5, '0')}`;

            const startIdx = TIME_SLOTS.indexOf(startSlot);
            const endIdx = TIME_SLOTS.indexOf(endSlot);

            const fromIdx = startIdx !== -1 ? startIdx : 0;
            const toIdx = endIdx !== -1 && endIdx > fromIdx ? endIdx : fromIdx + 12;

            const mappedType: 'tareas' | 'descanso' | 'trabajo' | 'estudiando' | 'otra_actividad' =
              scheduleCategory === 'trabajo' ? 'trabajo' : 'estudiando';
            const defaultLabel = scheduleCategory === 'trabajo' ? 'Trabajo' : 'Estudio';
            const blockLabel = b.etiqueta && b.etiqueta.trim() !== '' ? b.etiqueta : defaultLabel;

            for (let i = fromIdx; i < toIdx; i++) {
              const slot = TIME_SLOTS[i];
              if (slot && slot !== '24:00') {
                mappedAvails.push({
                  date: dateStr,
                  dayOfWeek: dayOfWeekName,
                  startTime: slot,
                  endTime: TIME_SLOTS[i + 1] || '24:00',
                  label: blockLabel,
                  type: mappedType,
                  source: 'local',
                });
              }
            }
          },
        );

        if (mappedAvails.length > 0) {
          const keys = new Set(mappedAvails.map((m) => `${m.date}_${m.startTime}`));
          let mergedList: Availability[] = [];
          setAvailabilities((prev) => {
            const filtered = prev.filter((p) => !keys.has(`${p.date}_${p.startTime}`));
            mergedList = [...filtered, ...mappedAvails];
            return mergedList;
          });

          if (mergedList.length > 0) {
            const consolidated = consolidateAvailabilitySlots(mergedList);
            await syncAvailabilityBlocksAction(consolidated).catch((err) =>
              console.warn('Error sincronizando bloques tras extracción:', err),
            );
          }
        }

        // Recargar eventos de Supabase para reflejar de inmediato tareas reagendadas por IA
        await loadCalendarEventsFromSupabase();

        const reagendadasCount = data.reagendamiento?.reagendadas || 0;
        if (reagendadasCount > 0) {
          setUploadSuccessMsg(
            `¡Se agregaron ${data.bloques.length} bloques a tu horario y la IA reagendó automáticamente ${reagendadasCount} tarea(s) para evitar colisiones!`,
          );
        } else {
          setUploadSuccessMsg(
            `¡Se detectaron y agregaron ${data.bloques.length} bloques a tu calendario con éxito!`,
          );
        }
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadSuccessMsg(null);
          setView('week');
        }, 2200);
      } else {
        setUploadError(
          'La IA no pudo detectar bloques de horario en el documento o imagen. Asegúrate de que las horas y días sean legibles.',
        );
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error inesperado extrayendo el horario');
    } finally {
      setUploadLoading(false);
    }
  };

  // Helper para identificar el bloque completo de una celda
  const getBlockForCell = (dateStr: string, timeStr: string, isCollapsedHour: boolean) => {
    let targetAvail: Availability | undefined;
    if (isCollapsedHour) {
      const startIdx = TIME_SLOTS.indexOf(timeStr);
      for (let i = startIdx; i < startIdx + 12; i++) {
        const found = availabilities.find(
          (a) => a.date === dateStr && a.startTime === TIME_SLOTS[i],
        );
        if (found) {
          targetAvail = found;
          break;
        }
      }
    } else {
      targetAvail = availabilities.find((a) => a.date === dateStr && a.startTime === timeStr);
    }

    if (!targetAvail) return null;

    // Si tiene eventId (tarea de Supabase)
    if (targetAvail.eventId) {
      const eventSlots = availabilities
        .filter((a) => a.date === dateStr && a.eventId === targetAvail.eventId)
        .sort((a, b) => TIME_SLOTS.indexOf(a.startTime) - TIME_SLOTS.indexOf(b.startTime));

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
        .sort((a, b) => TIME_SLOTS.indexOf(a.startTime) - TIME_SLOTS.indexOf(b.startTime));

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
    const currentIdx = TIME_SLOTS.indexOf(targetAvail.startTime);
    let minIdx = currentIdx;
    let maxIdx = currentIdx;

    while (minIdx > 0) {
      const prevSlot = TIME_SLOTS[minIdx - 1];
      const prevAvail = availabilities.find(
        (a) =>
          a.date === dateStr &&
          a.startTime === prevSlot &&
          !a.eventId &&
          a.source !== 'google' &&
          a.label === targetAvail.label &&
          a.type === targetAvail.type,
      );
      if (prevAvail) {
        minIdx--;
      } else {
        break;
      }
    }

    while (maxIdx < TIME_SLOTS.length - 1) {
      const nextSlot = TIME_SLOTS[maxIdx + 1];
      const nextAvail = availabilities.find(
        (a) =>
          a.date === dateStr &&
          a.startTime === nextSlot &&
          !a.eventId &&
          a.source !== 'google' &&
          a.label === targetAvail.label &&
          a.type === targetAvail.type,
      );
      if (nextAvail) {
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

    const clickStartIdx = TIME_SLOTS.indexOf(timeStr);
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

  const handleCellMouseEnter = (_dateStr: string, timeStr: string) => {
    setHoveredTimeStr(timeStr);
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

    const sIdx = TIME_SLOTS.indexOf(block.startTime);
    const eIdx = TIME_SLOTS.indexOf(block.endTime);
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
        text: 'No se pueden mover bloques a fechas pasadas.',
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

    const startSlotIdx = TIME_SLOTS.indexOf(targetTimeStr);
    if (startSlotIdx === -1) {
      setDraggedTask(null);
      setDragOverCell(null);
      return;
    }

    const slotsCount = Math.max(1, Math.round(draggedTask.durationMinutes / 5));
    const endSlotIdx = Math.min(TIME_SLOTS.length - 1, startSlotIdx + slotsCount);
    const newEndTimeStr = TIME_SLOTS[endSlotIdx] || '24:00';

    // Verificar colisiones con otras tareas, Google o bloques ajenos
    const isOwnSlot = (a: Availability) => {
      if (draggedTask.eventId && a.eventId === draggedTask.eventId) return true;
      if (draggedTask.isManual) {
        if (draggedTask.blockId && a.blockId && a.blockId === draggedTask.blockId) return true;
        const aIdx = TIME_SLOTS.indexOf(a.startTime);
        const origStartIdx = TIME_SLOTS.indexOf(draggedTask.originalStartTime);
        const origEndIdx = TIME_SLOTS.indexOf(draggedTask.originalEndTime);
        if (a.date === draggedTask.sourceDate && aIdx >= origStartIdx && aIdx < origEndIdx) {
          return true;
        }
      }
      return false;
    };

    let collisionTitle: string | null = null;
    for (let i = startSlotIdx; i < endSlotIdx; i++) {
      const slot = TIME_SLOTS[i];
      const conflictAvail = availabilities.find(
        (a) => a.date === dateStr && a.startTime === slot && !isOwnSlot(a),
      );
      if (conflictAvail) {
        collisionTitle = conflictAvail.label
          ? conflictAvail.label.replace('📌 ', '')
          : conflictAvail.source === 'google'
            ? 'Google Calendar'
            : 'otra actividad o bloque';
        break;
      }
    }

    if (collisionTitle) {
      setToastMessage({
        type: 'error',
        text: `⚠️ Conflicto: El horario coincide con "${collisionTitle}". Por favor intenta utilizar otra hora o bloque disponible.`,
      });
      setDraggedTask(null);
      setDragOverCell(null);
      return;
    }

    // Actualización optimista inmediata
    const newSlots: Availability[] = [];
    const dayOfWeekName = format(parseISODate(dateStr), 'EEEE', { locale: es });
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
          : ` (${format(parseISODate(dateStr), "EEE d 'de' MMM", { locale: es })})`;
      setToastMessage({
        type: 'success',
        text: `¡Horario de "${cleanTitle}" actualizado a ${format12h(targetTimeStr)} - ${format12h(newEndTimeStr)}${daySuffix}!`,
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
            text: res.error || 'Error al persistir el nuevo horario en el servidor',
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
      const origStartIdx = TIME_SLOTS.indexOf(draggedTask.originalStartTime);
      const origEndIdx = TIME_SLOTS.indexOf(draggedTask.originalEndTime);

      setAvailabilities((prev) => {
        const withoutOld = prev.filter((a) => {
          if (a.date !== draggedTask.sourceDate) return true;
          if (draggedTask.blockId && a.blockId === draggedTask.blockId) return false;
          const aIdx = TIME_SLOTS.indexOf(a.startTime);
          return !(aIdx >= origStartIdx && aIdx < origEndIdx);
        });
        return [...withoutOld, ...newSlots];
      });

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
          : ` (${format(parseISODate(dateStr), "EEE d 'de' MMM", { locale: es })})`;
      setToastMessage({
        type: 'success',
        text: `¡${displayTitle} movido a ${format12h(targetTimeStr)} - ${format12h(newEndTimeStr)}${daySuffix}!`,
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

    const startIdx = TIME_SLOTS.indexOf(timeStr);
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

    setToastMessage({ type: 'success', text: 'Bloque y categoría eliminados del calendario' });
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
    setEditLabel(cleanLabel === 'Tareas' || cleanLabel === 'Libre' ? '' : cleanLabel);
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

    const startIdx = TIME_SLOTS.indexOf(editingCell.time);
    const endIdx = isCollapsed ? startIdx + 11 : startIdx;
    const targetSlots: string[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      if (TIME_SLOTS[i] && TIME_SLOTS[i] !== '24:00') {
        targetSlots.push(TIME_SLOTS[i]);
      }
    }
    const targetSet = new Set(targetSlots);

    const labelClean = editLabel.trim().substring(0, 15);
    const displayLabel = labelClean || (editType === 'tareas' ? 'Tareas' : '');
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
      setToastMessage({ type: 'success', text: 'Tarea actualizada en la base de datos' });
      setEditingCell(null);
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
      const dayOfWeekName = format(parseISODate(editingCell.date), 'EEEE', { locale: es });
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

    setToastMessage({ type: 'success', text: 'Cambios guardados en la base de datos' });
    setEditingCell(null);
  };

  const format12h = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    if (h === 24) return '12:00 AM';
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const generateFutureWeeks = (currentWeekStart: Date) => {
    const weeks = [];
    const maxYearLimit = new Date(2036, 11, 31, 23, 59, 59);
    const endOfActiveYear =
      currentDate.getFullYear() >= 2036 ? maxYearLimit : endOfYear(currentDate);
    let nextWeekStart = addDays(currentWeekStart, 7);

    while (nextWeekStart <= endOfActiveYear && nextWeekStart <= maxYearLimit) {
      const nextWeekEnd = addDays(nextWeekStart, 6);
      const label = `${format(nextWeekStart, 'd MMM', { locale: es })} - ${format(nextWeekEnd, 'd MMM', { locale: es })}`;
      weeks.push({ start: nextWeekStart, end: nextWeekEnd, label });
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

  const replicateToWeeks = (
    weekStarts: Date[],
    startOfCurrentWeek: Date,
    endOfCurrentWeek: Date,
  ) => {
    const currentWeekDates = eachDayOfInterval({
      start: startOfCurrentWeek,
      end: endOfCurrentWeek,
    }).map((d) => format(d, 'yyyy-MM-dd'));
    const currentWeekAvails = availabilities.filter((a) => currentWeekDates.includes(a.date));

    if (currentWeekAvails.length === 0) {
      alert('No hay disponibilidad marcada en esta semana para replicar.');
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
          if (!isBefore(parseISODate(targetDateStr), startOfDay(new Date()))) {
            newAvails.push({ ...avail, date: targetDateStr });
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

    setShowReplicateMenu(false);
    setShowSpecificWeeksModal(false);
    setSelectedWeeks([]);
    alert('¡Horario replicado con éxito!');
  };

  const renderWeeklyGrid = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    const goToPrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const canGoNextWeek = addWeeks(currentDate, 1).getFullYear() <= 2036;
    const goToNextWeek = () => {
      if (canGoNextWeek) setCurrentDate(addWeeks(currentDate, 1));
    };

    return (
      <div className="flex flex-col h-full w-full max-w-6xl mx-auto animate-in fade-in duration-300">
        {/* 1. CONTENEDOR MAESTRO DE SCROLL */}
        <div
          className="flex-grow overflow-y-auto custom-scrollbar select-none bg-white border border-[#EAE3DC] rounded-[20px] shadow-sm relative flex flex-col"
          style={{ height: 'calc(100vh - 120px)' }}
          onMouseLeave={() => setHoveredTimeStr(null)}
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
                  Volver
                </button>
                <h2 className="text-xl sm:text-2xl font-bold capitalize text-on-surface hidden sm:block">
                  {format(currentDate, 'MMMM yyyy', { locale: es })}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="tour-calendar-ai-upload"
                  onClick={() => {
                    setUploadFile(null);
                    setUploadError(null);
                    setUploadSuccessMsg(null);
                    setShowUploadModal(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#845326] hover:bg-[#6c421f] text-white rounded-xl text-sm font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                  title="Subir imagen o PDF de tu horario para que la IA lo monte automáticamente"
                >
                  <Sparkles className="size-4 text-[#F7D6BF]" />
                  <span>Subir Horario (IA)</span>
                </button>

                <div id="tour-calendar-replicate" className="relative">
                  <button
                    onClick={() => {
                      generateFutureWeeks(start);
                      setShowReplicateMenu(!showReplicateMenu);
                    }}
                    className="hidden md:flex items-center gap-2 px-3 py-2 bg-[#f5e5d9] hover:bg-[#E8DCD1] text-[#845326] rounded-xl text-sm font-bold transition-colors shadow-sm mr-2"
                    title="Copiar esta semana a otras fechas"
                  >
                    <Copy className="size-4" />
                    Replicar Horario
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
                            const endOfActiveMonth = endOfMonthFn(currentDate);
                            replicateToWeeks(
                              getWeeksUntil(addDays(start, 7), endOfActiveMonth),
                              start,
                              end,
                            );
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[#845326] hover:bg-[#FDFBF9] border-b border-[#EAE3DC] font-semibold transition-colors"
                        >
                          Replicar en todo el mes
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
                          Replicar en todos los meses
                        </button>
                        <button
                          onClick={() => {
                            setShowReplicateMenu(false);
                            setShowSpecificWeeksModal(true);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-[#845326] hover:bg-[#FDFBF9] font-semibold transition-colors"
                        >
                          Replicar en semanas específicas...
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-white border border-[#EAE3DC] rounded-xl p-1 shadow-sm">
                  <button
                    onClick={goToPrevWeek}
                    className="p-1.5 rounded-lg hover:bg-surface-container transition-colors text-on-surface"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <span className="px-2 text-xs sm:text-sm font-bold text-on-surface-variant capitalize">
                    {format(start, 'd MMM', { locale: es })} -{' '}
                    {format(end, 'd MMM', { locale: es })}
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
                        {format(day, 'EEE', { locale: es })}
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
                  <h3 className="text-lg font-bold text-[#845326]">Semanas Específicas</h3>
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
                    Selecciona a qué semanas futuras quieres copiar tu disponibilidad actual:
                  </p>
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
                          Semana del {week.label}
                        </span>
                      </label>
                    ))}
                    {futureWeeksList.length === 0 && (
                      <div className="text-center py-4 text-sm font-semibold text-on-surface-variant">
                        No hay semanas futuras disponibles en este año.
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
                    Cancelar
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
                    Aplicar Horario
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
                        Cargar Horario con Gemini AI
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium">
                        Extrae automáticamente tus materias o turnos
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

                <div className="p-6 space-y-4">
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
                    Sube una <strong>foto, captura de pantalla (.png, .jpg) o documento PDF</strong>{' '}
                    de tu horario escolar, universitario o laboral. La IA extraerá los días y
                    bloques horarios para que queden reflejados en tu calendario.
                  </p>

                  {/* Selector de opciones: De trabajo vs De estudio */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#845326] block">
                      ¿Qué tipo de horario deseas agregar?
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
                          <p className="text-xs font-bold text-[#2C1F14]">De trabajo</p>
                          <p className="text-[10px] text-on-surface-variant font-medium">
                            Categoría: Trabajo
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
                          <p className="text-xs font-bold text-[#2C1F14]">De estudio</p>
                          <p className="text-[10px] text-on-surface-variant font-medium">
                            Categoría: Estudio
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

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
                      {uploadFile ? uploadFile.name : 'Haz clic o arrastra tu archivo aquí'}
                    </p>
                    <p className="text-xs text-[#845326] mt-1 font-medium">
                      PNG, JPG, WEBP o PDF (Hasta 20MB)
                    </p>
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
                          Quitar
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
                    Cancelar
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
                        <span>Procesar y Montar Horario</span>
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

                const isHovered = hoveredTimeStr === time;

                return (
                  <div
                    key={`time-${time}`}
                    className={`
                      ${isHourStart ? 'min-h-[48px]' : 'min-h-[32px]'} relative flex justify-end items-center pr-3 group transition-colors cursor-default
                      ${isHourStart ? 'border-b border-[#EAE3DC]' : ''}
                      ${isHourEnd ? 'mb-3' : ''}
                      ${isHovered ? 'bg-[#f5e5d9]/60' : ''}
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
                const dayOfWeek = format(day, 'EEEE', { locale: es });
                const isPast = isBefore(day, startOfDay(new Date()));

                return (
                  <div
                    key={`col-${dateStr}`}
                    className={`flex flex-col border-r border-[#EAE3DC] last:border-r-0 bg-[#FDFBF9] ${isPast ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {visibleTimeSlots.map((timeStr) => {
                      const avail = availabilities.find(
                        (a) => a.date === dateStr && a.startTime === timeStr,
                      );
                      const isEditing =
                        editingCell?.date === dateStr && editingCell?.time === timeStr;
                      const isHourStart = timeStr.endsWith(':00');
                      const isHourEnd = timeStr.endsWith(':55');

                      const isHoveredRow = hoveredTimeStr === timeStr;

                      const isCollapsedHour =
                        timeStr.endsWith(':00') &&
                        !expandedHours.includes(parseInt(timeStr.split(':')[0], 10));
                      let macroAvailCount = 0;
                      let macroFirstAvail: Availability | undefined;
                      if (isCollapsedHour) {
                        const startIdx = TIME_SLOTS.indexOf(timeStr);
                        for (let i = startIdx; i < startIdx + 12; i++) {
                          const found = availabilities.find(
                            (a) => a.date === dateStr && a.startTime === TIME_SLOTS[i],
                          );
                          if (found) {
                            macroAvailCount++;
                            if (!macroFirstAvail) macroFirstAvail = found;
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

                      const slotIdx = TIME_SLOTS.indexOf(timeStr);

                      const isSelected = Boolean(
                        selectedBlock &&
                        selectedBlock.date === dateStr &&
                        ((selectedBlock.eventId &&
                          effectiveAvail?.eventId === selectedBlock.eventId) ||
                          (selectedBlock.blockId &&
                            effectiveAvail?.blockId === selectedBlock.blockId) ||
                          (slotIdx >= TIME_SLOTS.indexOf(selectedBlock.startTime) &&
                            slotIdx < TIME_SLOTS.indexOf(selectedBlock.endTime))),
                      );

                      const isDropTarget =
                        dragOverCell?.date === dateStr && dragOverCell?.time === timeStr;
                      const isBeingDragged = Boolean(
                        draggedTask &&
                        draggedTask.sourceDate === dateStr &&
                        ((draggedTask.eventId && effectiveAvail?.eventId === draggedTask.eventId) ||
                          (!draggedTask.eventId &&
                            slotIdx >= TIME_SLOTS.indexOf(draggedTask.originalStartTime) &&
                            slotIdx < TIME_SLOTS.indexOf(draggedTask.originalEndTime))),
                      );

                      const displayLabel = effectiveAvail?.label
                        ? effectiveAvail.label
                        : isGoogleEvent
                          ? 'Ocupado'
                          : effectiveAvail?.type === 'tareas'
                            ? 'Tareas'
                            : '';
                      return (
                        <div
                          key={`cell-${dateStr}-${timeStr}`}
                          onMouseEnter={() => handleCellMouseEnter(dateStr, timeStr)}
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
                            ${isHoveredRow && !isOccupied && !isDropTarget ? 'bg-[#f5e5d9]/60' : ''}
                            ${isOccupied ? `${colorTheme.bg}` : ''}
                            ${isMacroPartiallyOccupied ? `${colorTheme.bgPale} border-[1px] border-dashed ${colorTheme.border}` : ''}
                            ${isDropTarget ? 'ring-2 ring-[#845326] bg-[#845326]/20 scale-[0.98] z-20' : ''}
                            ${isBeingDragged ? 'opacity-35 scale-95' : ''}
                            ${isSelected ? 'ring-2 ring-black ring-inset z-30 shadow-sm' : ''}
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
                                        title="Borrar bloque del calendario"
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
                                        title={isTask ? 'Editar nombre de tarea' : 'Editar'}
                                      >
                                        <Edit2 className="size-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {isEditing && !isPast && (
                            <>
                              <div
                                className="fixed inset-0 z-[55]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCell(null);
                                  if (!effectiveAvail) setSelectedBlock(null);
                                }}
                              />
                              <div
                                className="absolute top-0 left-0 z-[60] bg-white p-3 border border-[#EAE3DC] rounded-xl shadow-xl flex flex-col gap-2.5 min-w-[170px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between pb-1 border-b border-[#EAE3DC]/60">
                                  <span className="text-[11px] font-bold text-[#845326]">
                                    {effectiveAvail
                                      ? effectiveAvail.eventId
                                        ? 'Editar tarea'
                                        : 'Editar bloque'
                                      : 'Nuevo bloque'}
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
                                    effectiveAvail?.eventId
                                      ? 'Nombre de tarea...'
                                      : 'Nombre / Nota...'
                                  }
                                />
                                <div className="flex gap-2 justify-center flex-wrap px-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditType('tareas')}
                                    className={`w-6 h-6 rounded border ${editType === 'tareas' ? 'border-[#845326] ring-2 ring-[#C8D6AF]/50' : 'border-[#EAE3DC]'} bg-[#C8D6AF] transition-transform hover:scale-110`}
                                    title="Tareas"
                                  ></button>
                                  <button
                                    type="button"
                                    onClick={() => setEditType('estudiando')}
                                    className={`w-6 h-6 rounded border ${editType === 'estudiando' ? 'border-[#845326] ring-2 ring-[#BBD0F4]/50' : 'border-[#EAE3DC]'} bg-[#BBD0F4] transition-transform hover:scale-110`}
                                    title="Estudiando"
                                  ></button>
                                  <button
                                    type="button"
                                    onClick={() => setEditType('trabajo')}
                                    className={`w-6 h-6 rounded border ${editType === 'trabajo' ? 'border-[#845326] ring-2 ring-[#F4C2BA]/50' : 'border-[#EAE3DC]'} bg-[#F4C2BA] transition-transform hover:scale-110`}
                                    title="Trabajo"
                                  ></button>
                                  <button
                                    type="button"
                                    onClick={() => setEditType('descanso')}
                                    className={`w-6 h-6 rounded border ${editType === 'descanso' ? 'border-[#845326] ring-2 ring-[#F9EBB2]/50' : 'border-[#EAE3DC]'} bg-[#F9EBB2] transition-transform hover:scale-110`}
                                    title="Descanso"
                                  ></button>
                                  <button
                                    type="button"
                                    onClick={() => setEditType('otra_actividad')}
                                    className={`w-6 h-6 rounded border ${editType === 'otra_actividad' ? 'border-[#845326] ring-2 ring-[#E1C6F5]/50' : 'border-[#EAE3DC]'} bg-[#E1C6F5] transition-transform hover:scale-110`}
                                    title="Otra actividad"
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
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveEditedLabel}
                                    className="flex-1 bg-[#845326] text-white text-xs font-bold py-1.5 rounded-lg hover:bg-[#6c421f] transition-colors cursor-pointer"
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            </>
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
            <span className="text-xs font-bold text-[#845326]">Tareas</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#BBD0F4] border border-[#203D6B]/20"></div>
            <span className="text-xs font-bold text-[#845326]">Estudiando</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#F4C2BA] border border-[#6B3229]/20"></div>
            <span className="text-xs font-bold text-[#845326]">Trabajo</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#F9EBB2] border border-[#5C4F1A]/20"></div>
            <span className="text-xs font-bold text-[#845326]">Descanso</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 rounded bg-[#E1C6F5] border border-[#4A2D69]/20"></div>
            <span className="text-xs font-bold text-[#845326]">Otra actividad</span>
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
    </div>
  );
}
