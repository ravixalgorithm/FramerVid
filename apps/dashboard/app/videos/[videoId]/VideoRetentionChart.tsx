'use client';

import { useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
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
  onHover?: (time: number) => void;
};

export default function VideoRetentionChart({ data, friction, onHover }: VideoRetentionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; time: number } | null>(null);

  // For flat 0-data, boost to a small value so the line is visible
  const isAllZero = data.every((d) => d.retention === 0);
  const displayData = isAllZero
    ? data.map((d) => ({ ...d, retention: 2 }))
    : data;

  const maxTime = data.length > 0 ? data[data.length - 1].time : 0;
  const chartLeft = 36;
  const chartRight = 8;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !onHover || maxTime === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const chartWidth = rect.width - chartLeft - chartRight;
    const mouseX = e.clientX - rect.left - chartLeft;
    const pct = Math.max(0, Math.min(1, mouseX / chartWidth));
    const time = Math.round(pct * maxTime);
    const xPos = chartLeft + pct * chartWidth;
    setHoverInfo({ x: xPos, time });
    onHover(time);
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  return (
    <div ref={containerRef} className="h-48 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={displayData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
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
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Hover indicator — vertical line + time label */}
      {hoverInfo && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: hoverInfo.x,
              top: 8,
              bottom: 20,
              width: 1,
              background: 'hsl(var(--accent))',
              opacity: 0.5,
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              left: hoverInfo.x,
              bottom: 16,
              transform: 'translateX(-50%)',
            }}
          >
            <div
              className="rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md"
              style={{ background: 'hsl(var(--accent))' }}
            >
              {hoverInfo.time}s
            </div>
          </div>
        </>
      )}

      {/* Thin scrub strip along the curve */}
      <div
        className="absolute left-0 right-0"
        style={{
          cursor: 'pointer',
          zIndex: 10,
          bottom: '4px',
          height: '40px',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleMouseMove}
      />
    </div>
  );
}
