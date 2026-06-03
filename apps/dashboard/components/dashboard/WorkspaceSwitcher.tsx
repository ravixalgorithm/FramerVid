'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { setActiveWorkspaceCookie } from '../../app/lib/workspace-cookie';

type WorkspaceItem = {
  id: string;
  name: string;
  plan: string;
};

type WorkspaceSwitcherProps = {
  activeWorkspace: WorkspaceItem;
};

export function WorkspaceSwitcher({ activeWorkspace }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/workspaces')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.data) setWorkspaces(payload.data);
      })
      .catch(console.error);
  }, [activeWorkspace.id]);

  const switchWorkspace = (id: string) => {
    if (id === activeWorkspace.id) {
      setOpen(false);
      return;
    }
    setLoading(true);
    setActiveWorkspaceCookie(id);
    setOpen(false);
    router.refresh();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to create workspace');
      setActiveWorkspaceCookie(payload.data.id);
      setShowCreate(false);
      setNewName('');
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="workspace-select !py-1.5 text-xs disabled:opacity-60"
      >
        <span className="truncate max-w-[140px] sm:max-w-[200px]">{activeWorkspace.name}</span>
        <span className="plan-pill !ml-0">{activeWorkspace.plan}</span>
        <svg className="h-3 w-3 shrink-0 text-[hsl(var(--muted))]" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 0 1 .55.24l3.25 3.5a.75.75 0 1 1-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 0 1-1.1-1.02l3.25-3.5A.75.75 0 0 1 10 3Zm0 14a.75.75 0 0 1-.55-.24l-3.25-3.5a.75.75 0 1 1 1.1-1.02l2.7 2.908 2.7-2.908a.75.75 0 1 1 1.1 1.02l-3.25 3.5A.75.75 0 0 1 10 17Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="menu-popover left-0 z-50 mt-1.5 w-64 origin-top-left">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted))]">
              Workspaces
            </div>
            {workspaces.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[hsl(var(--muted))]">Loading…</p>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => switchWorkspace(ws.id)}
                  className={`menu-popover-item justify-between ${
                    ws.id === activeWorkspace.id ? '!bg-[hsl(var(--accent-muted))] !text-[hsl(var(--accent))]' : ''
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspace.id && (
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))
            )}
            <div className="my-1 border-t border-[hsl(var(--hairline))]" />
            {showCreate ? (
              <form onSubmit={handleCreate} className="space-y-2 p-2">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Workspace name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-minimal !py-1.5 text-xs"
                />
                {error && <p className="text-[11px] font-medium text-red-600">{error}</p>}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setError(null);
                    }}
                    className="btn-secondary flex-1 !h-8 !text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={creating} className="btn-accent flex-1 !h-8 !text-xs">
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="menu-popover-item text-[hsl(var(--muted))]"
              >
                + Create workspace
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
