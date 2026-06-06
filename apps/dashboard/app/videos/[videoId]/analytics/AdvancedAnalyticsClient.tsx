'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const VideoAnalytics = dynamic(() => import('../VideoAnalytics'), {
  ssr: false,
  loading: () => (
    <div className="py-8 text-center text-[11px] font-medium text-[hsl(var(--muted))]">
      Loading analytics…
    </div>
  ),
});

const VideoLeads = dynamic(() => import('../VideoLeads'), {
  ssr: false,
  loading: () => (
    <div className="py-8 text-center text-[11px] font-medium text-[hsl(var(--muted))]">
      Loading leads…
    </div>
  ),
});

interface Props {
  video: {
    id: string;
    workspaceId: string;
    title: string;
    durationSeconds: number | null;
  };
}

export default function AdvancedAnalyticsClient({ video }: Props) {
  const [activeTab, setActiveTab] = useState<'insights' | 'leads'>('insights');

  return (
    <div className="space-y-6">
      {/* Horizontal Tab Selector */}
      <div className="flex border-b border-[hsl(var(--hairline))] bg-white rounded-xl p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 sm:flex-initial text-center px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'insights'
              ? 'bg-[hsl(var(--foreground))] text-white'
              : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-gray-50'
          }`}
        >
          Insights & Charts
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex-1 sm:flex-initial text-center px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'leads'
              ? 'bg-[hsl(var(--foreground))] text-white'
              : 'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-gray-50'
          }`}
        >
          Captured Leads
        </button>
      </div>

      {/* Tab Panels */}
      <div className="transition-all duration-200">
        {activeTab === 'insights' && (
          <div className="bg-white rounded-2xl p-6 border border-[hsl(var(--hairline))] shadow-sm">
            <VideoAnalytics 
              videoId={video.id} 
              duration={video.durationSeconds ? Number(video.durationSeconds) : undefined} 
            />
          </div>
        )}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-2xl p-6 border border-[hsl(var(--hairline))] shadow-sm">
            <VideoLeads videoId={video.id} />
          </div>
        )}
      </div>
    </div>
  );
}
