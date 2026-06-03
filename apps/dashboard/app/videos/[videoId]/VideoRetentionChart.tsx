'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FrictionInsight } from '@framevid/types';

export type RetentionChartPoint = {
  time: number;
  retention: number;
};

type VideoRetentionChartProps = {
  data: RetentionChartPoint[];
  friction?: FrictionInsight | null;
};

export default function VideoRetentionChart({ data, friction }: VideoRetentionChartProps) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--hairline))" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => `${v}s`}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted))' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value) => [`${value ?? 0}%`, 'Retention']}
            labelFormatter={(label) => `${label}s`}
          />
          {friction ? (
            <ReferenceLine
              x={friction.cliffBucket}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: 'Cliff', position: 'top', fill: '#b45309', fontSize: 10 }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="retention"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            fill="url(#retentionFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
