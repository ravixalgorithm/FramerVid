'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Video } from '@framevid/types';
import Link from 'next/link';
import { Logo } from '../components/brand/Logo';
import { ProfileMenu } from '../components/dashboard/ProfileMenu';
import { WorkspaceSwitcher } from '../components/dashboard/WorkspaceSwitcher';
import { VideoGridCard } from '../components/dashboard/VideoGridCard';
import { NotificationPanel } from '../components/notifications/NotificationPanel';
import { useNotifications } from '../components/notifications/NotificationProvider';
import { getPlanLimits, formatMaxFileSize, formatMaxDuration } from './lib/plan-limits';
import { resolveMediaUrl } from './lib/asset-url';

interface ClientProps {
  initialVideos: any[];
  workspaceId: string;
  user: {
    name?: string | null;
    email: string;
  };
  activeWorkspace: {
    id: string;
    name: string;
    plan: string;
  };
}

type StatusTone = 'success' | 'warning' | 'danger';

const statusMeta: Record<Video['status'], { label: string; tone: StatusTone; progress: number }> = {
  ready: { label: 'Success', tone: 'success', progress: 100 },
  processing: { label: 'Encoding', tone: 'warning', progress: 62 },
  uploading: { label: 'Uploading', tone: 'warning', progress: 28 },
  error: { label: 'Error', tone: 'danger', progress: 0 },
};

function formatDuration(seconds?: number) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatSize(bytes?: number) {
  if (!bytes) return '--';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
}

function getRelativeTimeString(dateInput: Date | string) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min ago' : 'mins ago'}`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function getResolutionString(video: any) {
  // If we have actual resolution stored in the database, use it
  if (video?.settings?.resolution) {
    return video.settings.resolution;
  }
  // Fallback for older videos: Check if filename or title represents a phone vertical screen recording
  const isVertical = video?.title?.toLowerCase()?.startsWith('img_') || video?.originalFilename?.toLowerCase()?.startsWith('img_');
  return isVertical ? '2160×3840' : '1920×1080';
}

function thumbnailFor(video: any) {
  return resolveMediaUrl(video.posterUrl || video.thumbnailUrls?.[0]);
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  if (status === 'ready') {
    return <span className="status-pill status-pill-success">Success</span>;
  }
  if (status === 'error') {
    return <span className="status-pill status-pill-danger">Failed</span>;
  }
  return <span className="status-pill status-pill-warning">{label}</span>;
}

export default function VideoDashboardClient({ initialVideos, workspaceId, user, activeWorkspace }: ClientProps) {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>(initialVideos);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useNotifications();

  // Options menu active video state
  const [activeMenuVideoId, setActiveMenuVideoId] = useState<string | null>(null);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // Uploading state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [folders, setFolders] = useState<{ id: string; name: string; videoCount: number }[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveFolder, setBulkMoveFolder] = useState('');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [movingVideos, setMovingVideos] = useState(false);
  const [singleMoveVideoId, setSingleMoveVideoId] = useState<string | null>(null);

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Global Drag State
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragCounter = useRef(0);

  // Account initial
  const userInitial = (user.name || user.email)[0].toUpperCase();
  const planLimits = getPlanLimits(activeWorkspace.plan);
  const atVideoLimit = planLimits.maxVideos !== null && videos.length >= planLimits.maxVideos;

  useEffect(() => {
    setVideos(initialVideos);
    setActiveFolderId(null);
  }, [initialVideos]);

  const showToast = (message: string) => toastSuccess(message);

  // Load folders from API
  useEffect(() => {
    fetch(`/api/folders?workspaceId=${workspaceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.data) setFolders(payload.data);
      })
      .catch(console.error);
  }, [workspaceId]);

  // Close menus when clicking anywhere
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuVideoId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Poll video transcoding status
  useEffect(() => {
    const processingExist = videos.some((video) => video.status === 'processing' || video.status === 'uploading');
    if (!processingExist) return;

    const interval = setInterval(async () => {
      try {
        const updatedList = await Promise.all(
          videos.map(async (video) => {
            if (video.status === 'processing' || video.status === 'uploading') {
              const res = await fetch(`/api/videos/${video.id}/meta`);
              if (res.ok) {
                const payload = await res.json();
                return payload.data;
              }
            }
            return video;
          }),
        );
        setVideos(updatedList);
      } catch (err) {
        console.error('Failed to poll updates:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [videos]);

  // Global window drag listeners
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsWindowDragging(true);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsWindowDragging(false);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDropEvent = (e: DragEvent) => {
      e.preventDefault();
      setIsWindowDragging(false);
      dragCounter.current = 0;
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        handleFile(file);
      }
    };

    window.addEventListener('dragenter', handleDragEnter as any);
    window.addEventListener('dragleave', handleDragLeave as any);
    window.addEventListener('dragover', handleDragOver as any);
    window.addEventListener('drop', handleDropEvent as any);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter as any);
      window.removeEventListener('dragleave', handleDragLeave as any);
      window.removeEventListener('dragover', handleDragOver as any);
      window.removeEventListener('drop', handleDropEvent as any);
    };
  }, []);

  // Timer for Camera Recording Mockup
  useEffect(() => {
    if (isRecording) {
      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [isRecording]);

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    if (atVideoLimit) {
      toastError(`Video limit reached (${planLimits.maxVideos} on ${planLimits.label} plan).`);
      return;
    }
    
    setImporting(true);
    try {
      const res = await fetch('/api/videos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl, workspaceId }),
      });
      
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to initiate import');
      
      setVideos((prev) => [payload.data.video, ...prev]);
      setShowImportModal(false);
      setImportUrl('');
      showToast('Import job queued. The video is downloading.');
    } catch (err: any) {
      toastError('Import failed', { message: err.message });
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (atVideoLimit) {
      toastError(`Video limit reached (${planLimits.maxVideos} on ${planLimits.label} plan).`);
      return;
    }
    if (planLimits.maxBytesPerVideo !== null && file.size > planLimits.maxBytesPerVideo) {
      toastError(`File exceeds ${formatMaxFileSize(planLimits.maxBytesPerVideo)} limit for your plan.`);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed('');
    setTimeRemaining('');

    try {
      const initRes = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
          originalFilename: file.name,
          workspaceId,
          sizeBytes: file.size,
          contentType: file.type || 'application/octet-stream',
        }),
      });

      const initPayload = await initRes.json();
      if (!initRes.ok) throw new Error(initPayload.error || 'Failed to initiate upload');

      const { video, uploadUrl, rawKey, contentType } = initPayload.data;
      const putContentType = contentType || file.type || 'application/octet-stream';
      setVideos((prev) => [video, ...prev]);

      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          const elapsedMs = Date.now() - startTime;
          const bytesPerSec = e.loaded / (elapsedMs / 1000);
          const remainingSec = Math.round((e.total - e.loaded) / bytesPerSec);

          setUploadProgress(pct);
          setUploadSpeed(`${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`);
          setTimeRemaining(remainingSec > 60 ? `${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s left` : `${remainingSec}s left`);
        };

        xhr.onload = () => {
          if (xhr.status === 200) resolve();
          else {
            reject(
              new Error(
                xhr.status === 403
                  ? 'Upload blocked (403). Check R2 CORS on your bucket for this site.'
                  : `Upload failed with status ${xhr.status}`
              )
            );
          }
        };
        xhr.onerror = () =>
          reject(
            new Error(
              'Network error during upload. Check R2 CORS allows PUT from your dashboard URL.'
            )
          );
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', putContentType);
        xhr.send(file);
      });

      // Real R2 uploads: queue transcode after PUT (mock endpoint queues automatically)
      if (rawKey && !uploadUrl.includes('mock-destination')) {
        const completeRes = await fetch('/api/videos/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: video.id, rawKey }),
        });
        if (!completeRes.ok) {
          const completePayload = await completeRes.json();
          throw new Error(completePayload.error || 'Failed to queue transcoding');
        }
      }

      const refetchRes = await fetch(`/api/videos/${video.id}/meta`);
      if (refetchRes.ok) {
        const refetchPayload = await refetchRes.json();
        setVideos((prev) => prev.map((item) => (item.id === video.id ? refetchPayload.data : item)));
      }
    } catch (err: any) {
      toastError('Upload failed', { message: err.message });
      console.error(err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setVideos((prev) => prev.filter((video) => video.id !== videoId));
      } else {
        const payload = await res.json();
        toastError('Failed to delete', { message: payload.error || 'Unknown error' });
      }
    } catch (err: any) {
      toastError('Delete failed', { message: err.message });
    }
  };

  const copyComponentId = async (video: Video) => {
    await navigator.clipboard?.writeText(video.id);
    showToast('Copied component ID to clipboard');
  };

  const downloadVideo = (video: Video) => {
    try {
      const downloadUrl = `/api/videos/${video.id}/download`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = video.originalFilename || 'video.mp4';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to trigger download:', err);
      toastError('Download failed', { message: 'Could not download the video' });
    }
  };

  const moveVideosToFolder = async (videoIds: string[], folderId: string) => {
    if (videoIds.length === 0 || !folderId) return;
    setMovingVideos(true);
    try {
      const res = await fetch('/api/folders/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds, folderId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to move videos');
      setVideos((prev) =>
        prev.map((v) => (videoIds.includes(v.id) ? { ...v, folderId } : v)),
      );
      showToast(
        videoIds.length === 1 ? 'Video moved to folder' : `Moved ${videoIds.length} videos`,
      );
      setShowBulkMoveModal(false);
      setSingleMoveVideoId(null);
      setBulkSelectedIds([]);
      setBulkMoveFolder('');
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to move videos');
    } finally {
      setMovingVideos(false);
    }
  };

  const openVideo = (video: Video) => {
    if (video.status !== 'uploading') router.push(`/videos/${video.id}`);
  };

  const filteredVideos = videos.filter((video) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      video?.title?.toLowerCase()?.includes(q) || video?.originalFilename?.toLowerCase()?.includes(q);
    const matchesFolder =
      activeFolderId === null || video.folderId === activeFolderId;
    return matchesSearch && matchesFolder;
  });

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to create folder');
      setFolders((prev) => [...prev, payload.data]);
      setNewFolderName('');
      setShowFolderModal(false);
      showToast(`Folder "${name}" created`);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const openBulkMoveModal = () => {
    setBulkSelectedIds([]);
    setBulkMoveFolder('');
    setShowBulkMoveModal(true);
  };

  // Mock Camera Action
  const startRecordingAction = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
  };

  const stopRecordingAction = () => {
    setIsRecording(false);
    setShowRecordModal(false);
    
    // Add new simulated mock recording
    const recId = `mock-rec-${Date.now()}`;
    const newMockRec: any = {
      id: recId,
      workspaceId,
      title: `Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`,
      originalFilename: `record-${Date.now()}.mp4`,
      status: 'ready',
      durationSeconds: recordingSeconds || 8,
      sizeBytes: (recordingSeconds || 8) * 1.8 * 1024 * 1024,
      thumbnailUrls: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        autoplay: false,
        loop: false,
        muted: false,
        controlsStyle: 'show',
        primaryColor: '#5B4FE8',
        privacy: 'public',
        downloadEnabled: false,
        playbackSpeeds: [0.5, 1, 1.25, 1.5, 2],
      }
    };
    setVideos((prev) => [newMockRec, ...prev]);
  };

  return (
    <div className="dash-shell selection:bg-[hsl(var(--accent))] selection:text-white">
      {isWindowDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-inner">
            <svg className="mb-4 h-14 w-14 text-[hsl(var(--accent))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h2 className="page-title text-2xl">Drop files anywhere</h2>
            <p className="page-subtitle mt-2 text-base">Release to upload to FrameVid</p>
          </div>
        </div>
      )}

      <header className="dash-topbar">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.push('/')} className="cursor-pointer transition-opacity hover:opacity-85">
            <Logo />
          </button>

          <WorkspaceSwitcher activeWorkspace={activeWorkspace} />
        </div>

        <div className="dash-search-wrap">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="h-4 w-4 text-[hsl(var(--muted))]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search videos and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dash-search"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="icon-button"
            aria-label="Feedback"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
          </button>
          <NotificationPanel />
          <button
            type="button"
            onClick={() => setShowFolderModal(true)}
            className="icon-button"
            aria-label="Folders"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </button>
          <ProfileMenu userInitial={userInitial} userName={user.name} userEmail={user.email} />
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          
          {/* HEADER SECTION: WORKSPACE AND ACTIONS */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="page-title text-2xl sm:text-[28px]">{activeWorkspace.name}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="stat-chip">
                  <svg className="h-3.5 w-3.5 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                  {planLimits.maxVideos === null
                    ? `${videos.length} videos`
                    : `${videos.length} / ${planLimits.maxVideos} videos`}
                </span>
                <span className="stat-chip">
                  <svg className="h-3.5 w-3.5 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
                  {formatMaxFileSize(planLimits.maxBytesPerVideo)} / video
                </span>
                <span className="stat-chip">
                  <svg className="h-3.5 w-3.5 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  {formatMaxDuration(planLimits.maxDurationSeconds)} / video
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="segment">
                <button
                  onClick={() => setViewMode('list')}
                  className={`segment-btn h-8 w-8 ${viewMode === 'list' ? 'segment-btn-active' : ''}`}
                  aria-label="List View"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`segment-btn h-8 w-8 ${viewMode === 'grid' ? 'segment-btn-active' : ''}`}
                  aria-label="Grid View"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3.75" y="3.75" width="7.5" height="7.5" rx="1" />
                    <rect x="12.75" y="3.75" width="7.5" height="7.5" rx="1" />
                    <rect x="3.75" y="12.75" width="7.5" height="7.5" rx="1" />
                    <rect x="12.75" y="12.75" width="7.5" height="7.5" rx="1" />
                  </svg>
                </button>
              </div>

              {/* Create Folder button */}
              <button type="button" onClick={() => setShowFolderModal(true)} className="btn-secondary !h-9">
                <svg className="h-4 w-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Create Folder
              </button>

              <button type="button" onClick={openBulkMoveModal} className="btn-secondary !h-9">
                <svg className="h-4 w-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0-4.5 4.5M21 7.5H7.5" />
                </svg>
                Bulk Move
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowRecordModal(true);
                  setIsRecording(false);
                  setRecordingSeconds(0);
                }}
                className="btn-secondary !h-9"
              >
                <svg className="h-4 w-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9a2.25 2.25 0 0 1 2.25-2.25H12A2.25 2.25 0 0 1 14.25 9v7.5A2.25 2.25 0 0 1 12 18.75Z" />
                </svg>
                Record
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="btn-secondary !h-9"
              >
                <svg className="h-4 w-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                Import URL
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-orange !h-9 flex items-center gap-2 rounded-lg px-3.5 text-xs font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={uploading || atVideoLimit}
                title={atVideoLimit ? 'Video limit reached for your plan' : undefined}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Upload Video</span>
                <span className="mx-0.5 h-4 w-[1px] bg-white/30" />
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {/* FREE PLAN UPGRADE BANNER */}
          {activeWorkspace.plan === 'free' && (
            <div className="plan-upgrade-banner">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              <div className="relative z-[1] flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">You&apos;re on the free plan</h3>
                  <p className="mt-1 text-xs font-medium text-white/75">Upgrade to upload more videos and higher limits</p>
                </div>
                <Link
                  href="/settings/billing"
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-4 text-xs font-bold text-gray-950 shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:bg-white/95"
                >
                  View plans
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

          {folders.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="section-label">Folders ({folders.length})</h2>
                {activeFolderId && (
                  <button type="button" onClick={() => setActiveFolderId(null)} className="chip-clear">
                    Clear filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {folders.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => setActiveFolderId(activeFolderId === f.id ? null : f.id)}
                    className={`folder-tile ${activeFolderId === f.id ? 'folder-tile-active' : ''}`}
                  >
                    <svg className="h-8 w-8 text-[hsl(var(--accent))]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <div className="mt-2 min-w-0">
                      <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">{f.name}</p>
                      <p className="card-meta mt-0.5">{f.videoCount} videos</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* VIDEOS SECTION TITLE */}
          <div className="space-y-4">
            <h2 className="section-label">Videos ({filteredVideos.length})</h2>

            {uploading && viewMode === 'grid' && (
              <div className="asset-grid">
                <article className="product-card-uploading">
                  <div>
                    <span className="product-card-badge">Uploading</span>
                    <h3 className="product-card-title mt-4">New video</h3>
                    <p className="product-card-subtitle">{uploadSpeed || 'Connecting…'}</p>
                    <p className="product-card-desc">{timeRemaining || 'Estimating time remaining…'}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-[hsl(var(--muted))]">
                      <span>Progress</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="progress-track h-2">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                </article>
              </div>
            )}

            {filteredVideos.length === 0 && !uploading ? (
              <div className="empty-studio !mx-0 min-h-[260px]">
                <div className="empty-studio-icon">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9a2.25 2.25 0 0 1 2.25-2.25H12A2.25 2.25 0 0 1 14.25 9v7.5A2.25 2.25 0 0 1 12 18.75Z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">No videos found</h3>
                <p className="page-subtitle mt-1 max-w-xs">
                  {searchQuery ? 'Try different search terms.' : 'Upload or record your first video to get started.'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="asset-grid">
                {filteredVideos.map((video) => {
                  const meta = statusMeta[video.status as Video['status']] || { label: 'Unknown', tone: 'danger', progress: 0 };
                  const thumbnail = thumbnailFor(video);

                  return (
                    <VideoGridCard
                      key={video.id}
                      video={video}
                      meta={meta}
                      thumbnail={thumbnail}
                      onOpen={() => openVideo(video)}
                      onMenuToggle={(e) => {
                        e.stopPropagation();
                        setActiveMenuVideoId(activeMenuVideoId === video.id ? null : video.id);
                      }}
                      menuOpen={activeMenuVideoId === video.id}
                      onCopyId={() => copyComponentId(video)}
                      onDownload={() => downloadVideo(video)}
                      onDelete={() => deleteVideo(video.id)}
                      showMove={folders.length > 0}
                      onMove={() => {
                        setActiveMenuVideoId(null);
                        setSingleMoveVideoId(video.id);
                        setBulkMoveFolder('');
                      }}
                      formatDuration={formatDuration}
                      getRelativeTimeString={getRelativeTimeString}
                      getResolutionString={getResolutionString}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="list-table-wrap">
                <table className="list-table">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Video Title & File</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVideos.map((video) => {
                      const meta = statusMeta[video.status as Video['status']] || { label: 'Unknown', tone: 'danger', progress: 0 };
                      const thumbnail = thumbnailFor(video);
                      return (
                        <tr key={video.id} onClick={() => openVideo(video)} className="list-row group">
                          <td className="min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="list-thumb">
                                {thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="video-thumb-fallback flex h-full w-full items-center justify-center">
                                    <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--accent))]">
                                  {video.title}
                                </span>
                                <span className="card-meta mt-0.5 block truncate !text-[10px]">
                                  {video.originalFilename}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={video.status} label={meta.label} />
                          </td>
                          <td className="font-medium text-[hsl(var(--muted))]">
                            {formatDuration(video.durationSeconds)}
                          </td>
                          <td className="font-medium text-[hsl(var(--muted))]">
                            {getRelativeTimeString(video.createdAt)}
                          </td>
                          <td className="font-medium text-[hsl(var(--muted))]">
                            {formatSize(video.sizeBytes)}
                          </td>
                          <td className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => copyComponentId(video)}
                                className="icon-btn"
                                title="Copy Component ID"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadVideo(video)}
                                className="icon-btn"
                                title="Download Video"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteVideo(video.id)}
                                className="icon-btn icon-btn-danger"
                                title="Delete Video"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.78 0L9 9m12 1.5a2 2 0 0 0-2-2h-3.75a2 2 0 0 0-2 2H10.5m4.5-4.5V3a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 3v1.5m10.5 0h-12" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* CREATE FOLDER MODAL */}
      {showFolderModal && (
        <div className="modal-overlay">
          <div className="modal-panel-sm">
            <h3 className="page-title text-base">Create Folder</h3>
            <p className="page-subtitle">Group videos by client, campaign, or project.</p>
            <form onSubmit={handleCreateFolderSubmit} className="mt-4 space-y-4">
              <input
                type="text"
                required
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="input-minimal"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowFolderModal(false)} className="btn-secondary !h-8">
                  Cancel
                </button>
                <button type="submit" className="btn-accent !h-8">
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK MOVE MODAL */}
      {showBulkMoveModal && (
        <div className="modal-overlay">
          <div className="modal-panel-md flex max-h-[85vh] flex-col">
            <h3 className="page-title text-base">Bulk Move Videos</h3>
            <p className="page-subtitle">Select videos and a destination folder.</p>
            <div className="mt-4 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="section-label !text-[10px]">Videos</label>
                  <button
                    type="button"
                    onClick={() =>
                      setBulkSelectedIds(
                        bulkSelectedIds.length === videos.length
                          ? []
                          : videos.map((v) => v.id),
                      )
                    }
                    className="text-[11px] font-bold text-[hsl(var(--accent))] hover:underline"
                  >
                    {bulkSelectedIds.length === videos.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[hsl(var(--hairline))] divide-y divide-[hsl(var(--hairline))]">
                  {videos.length === 0 ? (
                    <p className="p-3 text-center text-xs text-[hsl(var(--muted))]">No videos in this workspace.</p>
                  ) : (
                    videos.map((v) => (
                      <label
                        key={v.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--sidebar))]"
                      >
                        <input
                          type="checkbox"
                          checked={bulkSelectedIds.includes(v.id)}
                          onChange={(e) => {
                            setBulkSelectedIds((prev) =>
                              e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id),
                            );
                          }}
                          className="rounded border-[hsl(var(--hairline))] text-[hsl(var(--accent))] focus:ring-[hsl(var(--accent))]"
                        />
                        <span className="truncate">{v.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="section-label !text-[10px]">Target Folder</label>
                {folders.length === 0 ? (
                  <div className="rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--sidebar))] p-3 text-center text-xs font-medium text-[hsl(var(--muted))]">
                    No folders yet. Create a folder first.
                  </div>
                ) : (
                  <select
                    value={bulkMoveFolder}
                    onChange={(e) => setBulkMoveFolder(e.target.value)}
                    className="input-minimal"
                  >
                    <option value="">Select destination...</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBulkMoveModal(false)} className="btn-secondary !h-8">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => moveVideosToFolder(bulkSelectedIds, bulkMoveFolder)}
                  className="btn-accent !h-8"
                  disabled={
                    folders.length === 0 ||
                    !bulkMoveFolder ||
                    bulkSelectedIds.length === 0 ||
                    movingVideos
                  }
                >
                  {movingVideos ? 'Moving…' : `Move ${bulkSelectedIds.length || ''} video${bulkSelectedIds.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE VIDEO MOVE MODAL */}
      {singleMoveVideoId && (
        <div className="modal-overlay">
          <div className="modal-panel-sm">
            <h3 className="page-title text-base">Move to folder</h3>
            <p className="page-subtitle truncate">
              {videos.find((v) => v.id === singleMoveVideoId)?.title}
            </p>
            <div className="mt-4 space-y-4">
              <select
                value={bulkMoveFolder}
                onChange={(e) => setBulkMoveFolder(e.target.value)}
                className="input-minimal"
              >
                <option value="">Select folder...</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSingleMoveVideoId(null);
                    setBulkMoveFolder('');
                  }}
                  className="btn-secondary !h-8"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => moveVideosToFolder([singleMoveVideoId], bulkMoveFolder)}
                  className="btn-accent !h-8"
                  disabled={!bulkMoveFolder || movingVideos}
                >
                  {movingVideos ? 'Moving…' : 'Move'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT URL MODAL */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-panel-sm">
            <div className="flex items-center justify-between">
              <h3 className="page-title text-base">Import via URL</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                disabled={importing}
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleImportUrl} className="mt-4 space-y-4">
              <div>
                <label htmlFor="import-url" className="section-label !text-[10px] mb-1.5 block">
                  Video URL (YouTube, Vimeo, Loom, TikTok, etc.)
                </label>
                <input
                  id="import-url"
                  type="url"
                  required
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="input-minimal w-full"
                  disabled={importing}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="btn-secondary !h-8"
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent !h-8"
                  disabled={importing || !importUrl.trim()}
                >
                  {importing ? 'Importing...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEBCAM / SCREEN RECORDER PLAYFUL MODAL */}
      {showRecordModal && (
        <div className="modal-overlay !bg-[hsl(240_6%_10%/0.72)]">
          <div className="modal-panel-md max-w-lg !border-zinc-800 !bg-zinc-950 !p-6 text-white !shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
                Record Studio
              </h3>
              <button
                onClick={() => {
                  setIsRecording(false);
                  setShowRecordModal(false);
                }}
                className="text-gray-400 hover:text-white"
                aria-label="Close Recorder"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Visual Camera Canvas Mockup */}
            <div className="relative mt-4 aspect-video rounded-lg overflow-hidden bg-black flex flex-col items-center justify-center border border-gray-800">
              {isRecording ? (
                <>
                  {/* Grid lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
                  
                  {/* Camera view - pulsing recording ring */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/10 p-3 text-red-500">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold tracking-widest text-red-500">RECORDING</span>
                    <span className="text-2xl font-mono font-extrabold tracking-wider">
                      {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60) < 10 ? '0' : ''}{recordingSeconds % 60}
                    </span>
                  </div>

                  {/* Corner indicator */}
                  <div className="absolute top-3 left-3 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Live
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center px-6">
                  <svg className="h-12 w-12 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-400">Webcam & Screen recorder</p>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-xs">Grant microphone and camera permissions or select screen capture sharing in next step.</p>
                </div>
              )}
            </div>

            {/* Recorder Controls */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 bg-gray-800/50 hover:bg-gray-800 hover:text-white text-gray-400 transition shadow-sm">
                  {/* mic icon */}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 bg-gray-800/50 hover:bg-gray-800 hover:text-white text-gray-400 transition shadow-sm">
                  {/* monitor/screen icon */}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                {isRecording ? (
                  <button
                    onClick={stopRecordingAction}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-xs font-bold text-gray-900 transition hover:bg-gray-100 shadow"
                  >
                    <span className="h-2 w-2 rounded-sm bg-gray-900" />
                    Stop Recording
                  </button>
                ) : (
                  <button
                    onClick={startRecordingAction}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-500 shadow-lg shadow-red-600/20"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    Start Recording
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
