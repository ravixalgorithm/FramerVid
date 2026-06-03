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
        <div className="bg-[#1C1C1F] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-medium text-white">Pending Invites ({invites.length})</h3>
          </div>
          <div className="divide-y divide-white/10">
            {invites.map(invite => (
              <div key={invite.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{invite.email}</div>
                  <div className="text-xs text-gray-400 capitalize mt-0.5">{invite.role} · Expires in 7 days</div>
                </div>
                <button
                  onClick={() => handleRevoke(invite.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-[#1C1C1F] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-medium text-white">Workspace Members ({members.length})</h3>
          <button onClick={() => setShowInviteModal(true)} className="btn-accent h-8 px-3 text-xs">
            Invite Member
          </button>
        </div>
        <div className="divide-y divide-white/10">
          {members.map(member => (
            <div key={member.userId} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center font-semibold text-sm">
                  {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {member.name || 'Unnamed User'}
                  </div>
                  <div className="text-xs text-gray-400">{member.email}</div>
                </div>
              </div>
              <div className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded capitalize">
                {member.role}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1F] border border-white/10 p-6 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Invite Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-300">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input-minimal h-10"
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-300">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="input-minimal h-10"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Admins can manage billing and invites. Editors can upload and edit videos. Viewers have read-only access.
                </p>
              </div>

              <div className="flex justify-end mt-4">
                <button type="submit" className="btn-accent h-10 px-4 w-full" disabled={inviting}>
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
