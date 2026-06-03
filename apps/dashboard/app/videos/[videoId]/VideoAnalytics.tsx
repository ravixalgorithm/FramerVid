'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { FrictionInsight, RetentionSeries, VideoAnalyticsData } from '@framevid/types';

const VideoRetentionChart = dynamic(() => import('./VideoRetentionChart'), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 items-center justify-center text-[11px] font-medium text-[hsl(var(--muted))]">
      Loading chart…
    </div>
  ),
});

function BreakdownBars({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number; pct: number }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="section-label mb-2">{title}</h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            <div className="mb-1 flex justify-between text-[11px] font-medium text-[hsl(var(--foreground))]">
              <span className="capitalize">{item.label}</span>
              <span className="text-[hsl(var(--muted))]">
                {item.count} ({item.pct}%)
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--sidebar))]">
              <div
                className="h-full rounded-full bg-[hsl(var(--accent))]"
                style={{ width: `${Math.max(item.pct, 2)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VideoAnalytics({ videoId }: { videoId: string }) {
  const [data, setData] = useState<VideoAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingFriction, setAnalyzingFriction] = useState(false);

  const handleAnalyzeFriction = async () => {
    if (!data?.friction) return;
    setAnalyzingFriction(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/analytics/friction`, { method: 'POST' });
      if (res.ok) {
        const payload = await res.json();
        setData({ ...data, friction: payload.data });
      }
    } catch (err) {
      console.error('Failed to generate friction analysis', err);
    } finally {
      setAnalyzingFriction(false);
    }
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}/analytics`);
        if (res.ok) {
          const payload = await res.json();
          setData(payload.data);
        }
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [videoId]);

  const chartData = useMemo(() => {
    const retention: RetentionSeries | undefined = data?.retention;
    if (!retention?.buckets?.length) return [];
    return retention.buckets.map((bucket, i) => ({
      time: bucket,
      retention: retention.retentionPct[i] ?? 0,
    }));
  }, [data?.retention]);

  const friction: FrictionInsight | null | undefined = data?.friction;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[hsl(var(--muted))]">
        <span className="text-xs font-semibold uppercase tracking-wider">Loading analytics…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="detail-surface py-12 text-center text-xs font-semibold text-[hsl(var(--muted))]">
        No analytics data found.
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Views',
      value: data.views.toLocaleString(),
      highlight: true,
      iconBg: 'bg-[hsl(var(--accent-muted))] text-[hsl(var(--accent))]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      ),
    },
    {
      label: 'Form Leads',
      value: data.formSubmissions.toLocaleString(),
      iconBg: 'bg-indigo-50 text-indigo-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'CTA Clicks',
      value: data.ctaClicks.toLocaleString(),
      iconBg: 'bg-violet-50 text-violet-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.303.197-1.593 1.593M21.75 12h-2.25m-.197 5.303-1.593-1.593" />
        </svg>
      ),
    },
    {
      label: 'Avg Retention',
      value: `${data.engagement}%`,
      iconBg: 'bg-emerald-50 text-emerald-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 18.375v-5.25ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-9.75ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-5 p-1">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`detail-surface flex items-center justify-between p-4 ${
              stat.highlight ? 'ring-2 ring-[hsl(var(--accent)/0.15)] border-[hsl(var(--accent-border))]' : ''
            }`}
          >
            <div className="space-y-0.5">
              <span className="section-label block">{stat.label}</span>
              <span className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">{stat.value}</span>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconBg}`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="detail-surface overflow-hidden p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-label">Retention heatmap</h3>
          {friction ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
              Cliff at {friction.cliffBucket}s (−{friction.dropPct}%)
            </span>
          ) : null}
        </div>
        {chartData.length > 0 ? (
          <VideoRetentionChart data={chartData} friction={friction} />
        ) : (
          <p className="py-8 text-center text-[11px] font-medium text-[hsl(var(--muted))]">
            Play this video on a published page to collect heartbeat retention data.
          </p>
        )}

        {friction ? (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-900">⚠️ Drop-off detected</p>
              {!friction.analysis && (
                <button
                  onClick={handleAnalyzeFriction}
                  disabled={analyzingFriction}
                  className="rounded-lg bg-gradient-to-r from-[hsl(var(--accent))] to-violet-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                >
                  {analyzingFriction ? 'Analyzing...' : '✨ Analyze with AI'}
                </button>
              )}
            </div>
            
            {friction.analysis ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-amber-950/90">{friction.analysis}</p>
                {friction.transcriptSnippet ? (
                  <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-[11px] italic text-amber-900/80">
                    “{friction.transcriptSnippet}”
                  </p>
                ) : null}
                {friction.actions && friction.actions.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-amber-950/90">
                    {friction.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-amber-950/70">
                We noticed a sharp drop-off here. Would you like AI to analyze the transcript and suggest how to fix it?
              </p>
            )}
          </div>
        ) : null}
      </div>

      {data.audience && (data.audience.devices.length > 0 || data.audience.referrers.length > 0) ? (
        <div className="detail-surface grid gap-6 p-4 sm:grid-cols-2">
          <BreakdownBars title="Devices" items={data.audience.devices} />
          <BreakdownBars title="Top referrers" items={data.audience.referrers} />
        </div>
      ) : null}

      <div className="detail-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-[hsl(var(--hairline))] bg-[hsl(var(--sidebar)/0.4)] px-4 py-3">
          <h3 className="section-label">Recent captured leads</h3>
          <span className="rounded-full bg-[hsl(var(--sidebar))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted))]">
            {data.recentLeads.length} lead{data.recentLeads.length !== 1 ? 's' : ''}
          </span>
        </div>
        {data.recentLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="list-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Captured</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map((lead, i) => (
                  <tr key={i} className="list-row">
                    <td className="font-semibold text-[hsl(var(--foreground))]">{lead.email}</td>
                    <td className="text-[hsl(var(--muted))]">{lead.country}</td>
                    <td className="text-[hsl(var(--muted))]">{new Date(lead.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3 px-6 py-12 text-center">
            <div className="empty-studio-icon mx-auto">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="mx-auto max-w-[280px] text-[11px] font-medium leading-relaxed text-[hsl(var(--muted))]">
              No leads captured yet. Enable lead capture in the customizer to start collecting emails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
