'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import type { Locale } from '@/lib/i18n/locale';

interface ProgressChartProps {
  data: Array<{
    projectId: string;
    name: string;
    value: number; // percentage
    completedTasks: number;
    totalTasks: number;
  }>;
  locale: Locale;
}

export function ProgressChart({ data, locale }: ProgressChartProps) {
  const copy =
    locale === 'es'
      ? { aria: 'Progreso por proyecto', complete: 'completado', tasks: 'tareas' }
      : { aria: 'Progress by project', complete: 'complete', tasks: 'tasks' };
  return (
    <div className="h-[400px] w-full pt-4 min-w-[34rem] sm:min-w-0" aria-label={copy.aria}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="var(--color-outline-variant)"
            opacity={0.3}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            axisLine={{ stroke: 'var(--color-outline-variant)', strokeWidth: 1, opacity: 0.5 }}
            tickLine={false}
            tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={150}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-on-surface)', fontSize: 12, fontWeight: 600 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-container-high)', opacity: 0.3 }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-xl border border-outline-variant/40 bg-surface/95 px-3 py-2 text-sm shadow-md backdrop-blur">
                    <p className="font-bold text-on-surface mb-1">{data.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold" style={{ color: 'var(--color-secondary)' }}>
                        {data.value}% {copy.complete}
                      </span>
                      <span className="text-on-surface-variant text-xs font-medium">
                        ({data.completedTasks}/{data.totalTasks} {copy.tasks})
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24} animationDuration={1000}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill="var(--color-secondary)"
                className="transition-all duration-300 hover:opacity-80"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
