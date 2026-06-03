'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    fetchInvite();
  }, []);

  async function fetchInvite() {
    try {
      const res = await fetch(`/api/invites/${token}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch invite');
      }
      setInviteData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        // If unauthorized, redirect to signin with a redirect parameter
        if (res.status === 401) {
          router.push(`/signin?redirect=/invite/${token}`);
          return;
        }
        throw new Error(data.error || 'Failed to accept invite');
      }

      // Automatically switch to the newly accepted workspace
      document.cookie = `framevid_workspace_id=${data.workspaceId}; path=/; max-age=31536000`;
      router.push('/');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center text-2xl mb-2">!</div>
        <div className="text-red-400 font-medium mt-4">Invalid or Expired Invite</div>
        <p className="text-gray-400 text-sm">{error}</p>
        <button onClick={() => router.push('/')} className="mt-4 px-4 py-2 border border-white/20 rounded-lg text-white hover:bg-white/5">
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center gap-6 shadow-2xl">
      <div className="w-16 h-16 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
        FV
      </div>
      
      <div className="flex flex-col gap-2 mt-2">
        <h1 className="text-2xl font-bold text-white">You've been invited!</h1>
        <p className="text-gray-400">
          You have been invited to join the workspace <span className="text-white font-medium">{inviteData.workspace.name}</span> as a <span className="capitalize text-white font-medium">{inviteData.invite.role}</span>.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3 mt-4">
        <button onClick={handleAccept} disabled={accepting} className="btn-accent h-12 w-full justify-center">
          {accepting ? 'Accepting...' : 'Accept Invitation'}
        </button>
        <p className="text-xs text-gray-500">
          If you don't have an account yet, you'll be asked to create one.
        </p>
      </div>
    </div>
  );
}
