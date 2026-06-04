'use client';

import { useState } from 'react';
import { useNotifications } from '@/components/notifications/NotificationProvider';

interface WorkspaceFormProps {
  workspaceId: string;
  initialName: string;
  plan: string;
  role: string;
}

export default function ClientWorkspaceForm({ workspaceId, initialName, plan, role }: WorkspaceFormProps) {
  const { success: notifySuccess, error: notifyError } = useNotifications();
  const [workspaceEditName, setWorkspaceEditName] = useState(initialName);
  const [workspaceDeleteConfirm, setWorkspaceDeleteConfirm] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRenameWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceEditName.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workspaceId, name: workspaceEditName.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to rename workspace');
      
      notifySuccess('Workspace renamed');
      window.location.reload();
    } catch (err: any) {
      notifyError('Failed to rename workspace', { message: err.message });
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workspaceDeleteConfirm !== initialName) {
      notifyError('Confirmation name does not match');
      return;
    }
    if (!confirm('Are you absolutely sure? This will delete all video streams, analytics, and folders in this workspace permanently.')) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces?id=${workspaceId}`, {
        method: 'DELETE',
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to delete workspace');
      
      // Clear workspace cookie to fall back to another workspace on load
      document.cookie = 'framevid_workspace_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
      window.location.href = '/';
    } catch (err: any) {
      notifyError('Failed to delete workspace', { message: err.message });
      setDeleting(false);
    }
  };


  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-[hsl(var(--foreground))]">Workspace Settings</h2>
        <p className="text-[13px] text-[hsl(var(--muted))] mt-1">Manage settings for {initialName}</p>
      </div>

      <div className="space-y-8">
        {/* General settings: Rename workspace */}
        <form onSubmit={handleRenameWorkspaceSubmit} className="space-y-2">
          <label className="text-[13px] font-bold text-[hsl(var(--muted))] uppercase tracking-wider block">Rename Workspace</label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Workspace name"
              value={workspaceEditName}
              onChange={(e) => setWorkspaceEditName(e.target.value)}
              className="w-full rounded-[12px] border-transparent bg-white px-4 py-3 text-[14px] font-medium text-[hsl(var(--foreground))] outline-none transition-colors focus:ring-2 focus:ring-[hsl(var(--accent)/0.2)] flex-1"
            />
            <button
              type="submit"
              disabled={renaming || !workspaceEditName.trim() || workspaceEditName.trim() === initialName}
              className="bg-black text-white hover:bg-black/90 rounded-[12px] h-[48px] px-6 text-[14px] font-bold disabled:opacity-50 transition-colors"
            >
              {renaming ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>

        {/* Workspace Metadata */}
        <div className="bg-white rounded-[16px] space-y-3 p-5">
          <div className="flex justify-between items-center text-[13px]">
            <span className="font-bold text-[hsl(var(--muted))]">Workspace Plan</span>
            <span className="plan-pill !ml-0">{plan}</span>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="font-bold text-[hsl(var(--muted))]">Role</span>
            <span className="font-bold uppercase text-[hsl(var(--foreground))]">{role}</span>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="font-bold text-[hsl(var(--muted))]">Workspace ID</span>
            <span className="max-w-[200px] truncate font-mono text-[hsl(var(--muted))] select-all" title={workspaceId}>
              {workspaceId}
            </span>
          </div>
        </div>

        {/* Danger zone: delete workspace */}
        <div className="space-y-4 border-t border-[hsl(var(--hairline))] pt-6">
          <div>
            <h4 className="text-[13px] font-bold uppercase tracking-wider text-red-600">Danger Zone</h4>
            <p className="text-[13px] text-[hsl(var(--muted))] mt-1">
              Permanently delete this workspace and all its folders and videos. This action cannot be undone.
            </p>
          </div>
          <form onSubmit={handleDeleteWorkspaceSubmit} className="space-y-3">
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-gray-500 block">
                Type <span className="font-mono bg-red-50 text-red-700 px-1 rounded">{initialName}</span> to confirm:
              </label>
              <input
                type="text"
                required
                placeholder={initialName}
                value={workspaceDeleteConfirm}
                onChange={(e) => setWorkspaceDeleteConfirm(e.target.value)}
                className="w-full rounded-[12px] border border-red-200 px-4 py-3 text-[14px] font-medium outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 text-red-900 bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={deleting || workspaceDeleteConfirm !== initialName}
              className="w-full flex justify-center items-center rounded-[12px] border border-red-200 bg-red-50 hover:bg-red-100 disabled:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-red-700 h-[48px] px-6 text-[14px] font-bold transition shadow-sm"
            >
              {deleting ? 'Deleting...' : 'Delete Workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
