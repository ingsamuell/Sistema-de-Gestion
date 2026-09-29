'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatMinutes } from '../../data/calculations';
import type { Locale } from '@/lib/i18n/locale';

interface WorkloadChartProps {
  data: Array<{ day: string; label: string; plannedMinutes: number }>;
  locale: Locale;
}

export function WorkloadChart({ data, locale }: WorkloadChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat(locale === 'es' ? 'es-VE' : 'en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${item.day}T12:00:00Z`)),
  }));
  const copy =
    locale === 'es'
      ? { aria: 'Minutos planificados por día', free: 'Libre', planned: 'planificados' }
      : { aria: 'Planned minutes by day', free: 'Free', planned: 'planned' };
  return (
    <div className="h-72 w-full pt-4 min-w-[34rem] sm:min-w-0" aria-label={copy.aria}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={{ stroke: 'var(--color-outline-variant)', strokeWidth: 1, opacity: 0.5 }}
            tickLine={false}
            tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12, fontWeight: 600 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => (value === 0 ? '' : formatMinutes(value))}
            tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-container-high)', opacity: 0.5 }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-xl border border-outline-variant/40 bg-surface/95 px-3 py-2 text-sm shadow-md backdrop-blur">
                    <p className="font-bold text-on-surface">{data.label}</p>
                    <p className="font-semibold" style={{ color: 'var(--color-accent-amber)' }}>
                      {data.plannedMinutes ? formatMinutes(data.plannedMinutes) : copy.free}{' '}
                      {copy.planned}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="plannedMinutes" radius={[6, 6, 0, 0]} maxBarSize={50}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill="var(--color-accent-amber)"
                className="transition-all duration-300 hover:opacity-80"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
