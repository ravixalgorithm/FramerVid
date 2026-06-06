'use client';

import { useEffect, useMemo, useState } from 'react';

interface Lead {
  id: string;
  email: string | null;
  payload: Record<string, string | undefined>;
  source: string;
  referrerDomain: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function VideoLeads({ videoId }: { videoId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchLeads() {
      try {
        const res = await fetch(`/api/videos/${videoId}/leads`);
        if (!res.ok) {
          throw new Error('Failed to load leads');
        }
        const payload = await res.json();
        setLeads(payload.data || []);
      } catch (err: any) {
        console.error('Error fetching leads:', err);
        setError(err.message || 'Failed to fetch leads');
      } finally {
        setLoading(false);
      }
    }
    fetchLeads();
  }, [videoId]);

  // Extract all unique payload keys across all leads (excluding email) to create dynamic columns
  const dynamicFields = useMemo(() => {
    const keys = new Set<string>();
    leads.forEach((lead) => {
      if (lead.payload) {
        Object.keys(lead.payload).forEach((k) => {
          if (k.toLowerCase() !== 'email') {
            keys.add(k);
          }
        });
      }
    });
    return Array.from(keys);
  }, [leads]);

  // Filter leads by search query
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase().trim();
    return leads.filter((lead) => {
      const emailMatch = lead.email?.toLowerCase().includes(query);
      const sourceMatch = lead.source?.toLowerCase().includes(query);
      const referrerMatch = lead.referrerDomain?.toLowerCase().includes(query);
      const payloadMatch = Object.entries(lead.payload || {}).some(
        ([key, val]) => key.toLowerCase().includes(query) || String(val).toLowerCase().includes(query)
      );
      return emailMatch || sourceMatch || referrerMatch || payloadMatch;
    });
  }, [leads, searchQuery]);

  const handleDownloadCSV = () => {
    if (leads.length === 0) return;

    // Headers: Email, Dynamic Fields..., Source, Referrer, Created At
    const headers = ['Email', ...dynamicFields, 'Source', 'Referrer Domain', 'Date Captured'];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = leads.map((lead) => {
      const payload = lead.payload || {};
      const emailVal = lead.email || payload.email || payload.Email || '';
      const customVals = dynamicFields.map((key) => payload[key] || '');

      return [
        emailVal,
        ...customVals,
        lead.source || 'player',
        lead.referrerDomain || '',
        new Date(lead.createdAt).toISOString(),
      ].map(escapeCSV);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_video_${videoId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[hsl(var(--muted))]">
        <div className="flex flex-col items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-[hsl(var(--accent))]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider">Loading leads…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="detail-surface p-6 text-center text-xs font-semibold text-red-500">
        Error: {error}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="detail-surface flex flex-col items-center justify-center p-8 text-center text-xs text-[hsl(var(--muted))]">
        <svg className="h-10 w-10 text-[hsl(var(--muted))]/60 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
        </svg>
        <span className="font-semibold text-sm text-[hsl(var(--foreground))] mb-1">No leads captured yet</span>
        <p className="max-w-xs text-gray-500 leading-relaxed font-semibold text-[11px]">
          Configure and enable the Lead Capture Form in the "Form" tab, publish your video, and start collecting contact details!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Summary card & Actions bar */}
      <div className="detail-surface p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
        <div>
          <span className="section-label block">Total Leads Collected</span>
          <span className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            {leads.length.toLocaleString()}
          </span>
        </div>

        <button
          onClick={handleDownloadCSV}
          className="btn-action-secondary flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download CSV
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-4 w-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by email, name or other fields..."
          className="input-minimal pl-9"
        />
      </div>

      {/* Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="detail-surface py-12 text-center text-xs font-semibold text-[hsl(var(--muted))] bg-white">
          No matching leads found for "{searchQuery}".
        </div>
      ) : (
        <div className="list-table-wrap">
          <div className="overflow-x-auto">
            <table className="list-table">
              <thead>
                <tr className="bg-[hsl(var(--sidebar))]">
                  <th className="px-4 py-2.5">Email</th>
                  {dynamicFields.map((field) => (
                    <th key={field} className="px-4 py-2.5 capitalize">
                      {field}
                    </th>
                  ))}
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Referrer</th>
                  <th className="px-4 py-2.5">Date Captured</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="list-row hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-[hsl(var(--foreground))]">
                      {lead.email || lead.payload.email || lead.payload.Email || '-'}
                    </td>
                    {dynamicFields.map((field) => (
                      <td key={field} className="px-4 py-3 text-gray-600">
                        {lead.payload[field] || '-'}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 capitalize">
                        {lead.source || 'player'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-medium max-w-[150px] truncate" title={lead.referrerDomain || ''}>
                      {lead.referrerDomain || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 tabular-nums">
                      {new Date(lead.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
