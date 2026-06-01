'use client';

import { useEffect, useState } from 'react';

interface AnalyticsData {
  views: number;
  formSubmissions: number;
  ctaClicks: number;
  engagement: number;
  recentLeads: { email: string; timestamp: string; country: string }[];
}

export default function VideoAnalytics({ videoId }: { videoId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-xs font-bold uppercase tracking-wider">Loading Analytics...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-400 font-semibold text-xs border border-gray-200 rounded-2xl bg-white shadow-sm">
        No analytics data found.
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 bg-white p-2">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { 
            label: 'Total Views', 
            value: data.views.toLocaleString(), 
            color: 'text-gray-900',
            bg: 'bg-white', 
            borderStyle: 'border-2 border-orange-500/85 ring-4 ring-orange-500/5', 
            iconBg: 'bg-orange-50/70 text-orange-500',
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )
          },
          { 
            label: 'Form Leads', 
            value: data.formSubmissions.toLocaleString(), 
            color: 'text-gray-900',
            bg: 'bg-white', 
            borderStyle: 'border border-gray-150', 
            iconBg: 'bg-indigo-50/75 text-[#9C99EC]',
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            )
          },
          { 
            label: 'CTA Clicks', 
            value: data.ctaClicks.toLocaleString(), 
            color: 'text-gray-900',
            bg: 'bg-white', 
            borderStyle: 'border-2 border-purple-500/85 ring-4 ring-purple-500/5', 
            iconBg: 'bg-purple-50/70 text-purple-500',
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.303.197-1.593 1.593M21.75 12h-2.25m-.197 5.303-1.593-1.593" />
              </svg>
            )
          },
          { 
            label: 'Avg Engagement', 
            value: `${data.engagement}%`, 
            color: 'text-gray-900',
            bg: 'bg-white', 
            borderStyle: 'border border-gray-150', 
            iconBg: 'bg-emerald-50/70 text-emerald-500',
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 18.375v-5.25ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-9.75ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            )
          },
        ].map((stat, i) => (
          <div key={i} className={`p-5 rounded-2xl ${stat.bg} ${stat.borderStyle} flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-300 select-none`}>
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-0.5">{stat.label}</span>
              <span className={`text-3xl font-bold tracking-tight ${stat.color}`}>{stat.value}</span>
            </div>
            <div className={`p-3 rounded-2xl ${stat.iconBg} flex-shrink-0 flex items-center justify-center shadow-inner`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-gray-150 bg-white shadow-sm overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/20 flex items-center justify-between select-none">
          <h3 className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider">Recent Captured Leads</h3>
          <span className="text-[10px] font-extrabold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full select-none">
            {data.recentLeads.length} Lead{data.recentLeads.length !== 1 ? 's' : ''}
          </span>
        </div>
        {data.recentLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-500">
              <thead className="bg-gray-50 text-[10px] uppercase font-extrabold tracking-wider text-gray-400 border-b border-gray-100 select-none">
                <tr>
                  <th className="px-6 py-3.5 font-bold">Email Address</th>
                  <th className="px-6 py-3.5 font-bold">Location</th>
                  <th className="px-6 py-3.5 font-bold">Captured At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentLeads.map((lead, i) => (
                  <tr key={i} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-800">{lead.email}</td>
                    <td className="px-6 py-3.5 font-medium text-gray-600">{lead.country}</td>
                    <td className="px-6 py-3.5 text-gray-400">{new Date(lead.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-6 text-center text-gray-400 text-xs font-semibold space-y-4 bg-white select-none">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
            </div>
            <p className="max-w-[280px] mx-auto text-gray-400/80 leading-relaxed font-semibold text-[11px]">
              No leads captured yet. Enable Lead Capture in the Customizer to start collecting emails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
