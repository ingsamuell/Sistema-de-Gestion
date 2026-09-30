'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Locale } from '@/lib/i18n/locale';

interface PrioritiesChartProps {
  data: Array<{
    name: string;
    value: number;
    tone: 'priority' | 'required' | 'personal' | 'neutral';
  }>;
  locale: Locale;
}

function getToneColor(tone: string) {
  if (tone === 'priority') return 'var(--color-secondary)';
  if (tone === 'required') return 'var(--color-status-urgent)';
  if (tone === 'personal') return 'var(--color-status-success)';
  return 'var(--color-outline-variant)';
}

export function PrioritiesChart({ data, locale }: PrioritiesChartProps) {
  // Filter out 0 values so they don't render empty slices
  const priorityNames =
    locale === 'es'
      ? {
          priority: 'Prioritario',
          required: 'Obligatorio',
          personal: 'Personal',
          neutral: 'Sin prioridad',
        }
      : {
          priority: 'High priority',
          required: 'Required',
          personal: 'Personal',
          neutral: 'No priority',
        };
  const activeData = data
    .filter((item) => item.value > 0)
    .map((item) => ({ ...item, name: priorityNames[item.tone] }));

  return (
    <div
      className="h-[350px] w-full pt-4 min-w-[34rem] sm:min-w-0"
      aria-label={locale === 'es' ? 'Proyectos por prioridad' : 'Projects by priority'}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={activeData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={120}
            paddingAngle={2}
            dataKey="value"
            animationDuration={1000}
          >
            {activeData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getToneColor(entry.tone)}
                className="transition-all duration-300 hover:opacity-80 outline-none"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-xl border border-outline-variant/40 bg-surface/95 px-3 py-2 text-sm shadow-md backdrop-blur flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getToneColor(data.tone) }}
                    />
                    <p className="font-bold text-on-surface">{data.name}:</p>
                    <p className="font-semibold text-on-surface-variant">
                      {data.value}{' '}
                      {locale === 'es'
                        ? data.value === 1
                          ? 'proyecto'
                          : 'proyectos'
                        : data.value === 1
                          ? 'project'
                          : 'projects'}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            content={({ payload }) => (
              <ul className="flex flex-wrap justify-center gap-6 mt-4">
                {payload?.map((entry, index) => {
                  const item = activeData[index];
                  return (
                    <li
                      key={`item-${index}`}
                      className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getToneColor(item.tone) }}
                      />
                      {entry.value} ({item.value})
                    </li>
                  );
                })}
              </ul>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
