'use client';

import React, { useState, useEffect } from 'react';

type Member = {
  userId: string;
  role: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  acceptedAt: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export default function TeamSettingsClient({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Invite Form State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadTeam();
  }, [workspaceId]);

  async function loadTeam() {
    try {
      setLoading(true);
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        fetch(`/api/workspaces/${workspaceId}/invites`)
      ]);

      if (membersRes.ok) {
        const { members } = await membersRes.json();
        setMembers(members);
      }
      
      if (invitesRes.ok) {
        const { invites } = await invitesRes.json();
        setInvites(invites);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send invite');
      }

      setInviteEmail('');
      setShowInviteModal(false);
      loadTeam();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!confirm('Are you sure you want to revoke this invite?')) return;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to revoke');
      loadTeam();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <div className="text-gray-400">Loading team...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="flex flex-col gap-8">
      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="border-t border-[hsl(var(--hairline))] pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[13px] uppercase tracking-wider text-[hsl(var(--muted))]">Pending Invites ({invites.length})</h3>
          </div>
          <div className="space-y-2">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium text-[hsl(var(--foreground))]">{invite.email}</div>
                  <div className="text-xs text-[hsl(var(--muted))] capitalize mt-0.5">{invite.role} · Expires in 7 days</div>
                </div>
                <button
                  onClick={() => handleRevoke(invite.id)}
                  className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="border-t border-[hsl(var(--hairline))] pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[13px] uppercase tracking-wider text-[hsl(var(--muted))]">Workspace Members ({members.length})</h3>
          <button onClick={() => setShowInviteModal(true)} className="bg-black text-white hover:bg-black/90 rounded-[10px] h-9 px-4 text-[13px] font-bold transition-colors">
            Invite Member
          </button>
        </div>
        <div className="space-y-4">
          {members.map(member => (
            <div key={member.userId} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-[14px]">
                  {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-[14px] font-medium text-[hsl(var(--foreground))]">
                    {member.name || 'Unnamed User'}
                  </div>
                  <div className="text-xs text-[hsl(var(--muted))]">{member.email}</div>
                </div>
              </div>
              <div className="text-xs font-bold bg-[#f3f4f6] text-[hsl(var(--muted))] px-2.5 py-1 rounded-[6px] capitalize">
                {member.role}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[24px] w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[hsl(var(--foreground))]">Invite Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInvite} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[hsl(var(--muted))] uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-[12px] border-transparent bg-[#f6f8fa] px-4 py-3 text-[14px] font-medium text-[hsl(var(--foreground))] outline-none transition-colors focus:ring-2 focus:ring-[hsl(var(--accent)/0.2)]"
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[hsl(var(--muted))] uppercase tracking-wider block">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-[12px] border-transparent bg-[#f6f8fa] px-4 py-3 text-[14px] font-medium text-[hsl(var(--foreground))] outline-none transition-colors focus:ring-2 focus:ring-[hsl(var(--accent)/0.2)] appearance-none"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <p className="text-[11px] text-[hsl(var(--muted))] mt-1 font-medium leading-relaxed">
                  Admins can manage billing and invites. Editors can upload and edit videos. Viewers have read-only access.
                </p>
              </div>

              <div className="pt-2">
                <button type="submit" className="bg-black text-white hover:bg-black/90 rounded-[12px] h-12 w-full text-[14px] font-bold disabled:opacity-50 transition-colors" disabled={inviting}>
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
