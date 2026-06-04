'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Video } from '@framevid/types';
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
  const [activeFilter, setActiveFilter] = useState<'home' | 'favorites' | 'trash'>('home');
  
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
  const [uploadStage, setUploadStage] = useState('');
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
    setUploadStage('Preparing upload…');

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

      setUploadStage('Uploading to storage…');
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      const uploadTimeoutMs = 30 * 60 * 1000;

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
          if (xhr.status >= 200 && xhr.status < 300) resolve();
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
        xhr.ontimeout = () =>
          reject(new Error('Upload timed out. Try a smaller file or check your connection.'));
        xhr.timeout = uploadTimeoutMs;
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', putContentType);
        xhr.send(file);
      });

      // Real R2 uploads: queue transcode after PUT (mock endpoint queues automatically)
      if (rawKey && !uploadUrl.includes('mock-destination')) {
        setUploadStage('Queuing transcode…');
        setUploadProgress(100);
        setUploadSpeed('');
        setTimeRemaining('');

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

      setUploadStage('Processing on worker…');
      const refetchRes = await fetch(`/api/videos/${video.id}/meta`);
      if (refetchRes.ok) {
        const refetchPayload = await refetchRes.json();
        setVideos((prev) => prev.map((item) => (item.id === video.id ? refetchPayload.data : item)));
      }

      showToast('Upload complete. Transcoding may take a few minutes on the free worker.');
    } catch (err: any) {
      toastError('Upload failed', { message: err.message });
      console.error(err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const handleImport = async () => {
    if (!importUrl) return;
    setImporting(true);
    try {
      const res = await fetch('/api/videos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl, workspaceId, folderId: activeFolderId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to import video');
      
      setVideos((prev) => [payload.data, ...prev]);
      setImportUrl('');
      setShowImportModal(false);
      showToast('Video import started');
    } catch (err: any) {
      toastError('Import failed', { message: err.message });
      console.error(err);
    } finally {
      setImporting(false);
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
    <div className="flex h-screen w-full bg-[hsl(var(--background))] font-sans overflow-hidden">
      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOPBAR */}
        <header className="h-[72px] flex items-center justify-between px-8 bg-transparent gap-8">
          <div className="flex items-center shrink-0">
            <Logo />
          </div>
          <div className="flex-1 max-w-xl relative">
             <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
             </svg>
             <input 
               type="text" 
               placeholder="Search all of FrameVid" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-[#f1f1f2] border-transparent rounded-full py-2 pl-11 pr-4 text-[14px] text-[hsl(var(--foreground))] placeholder:text-[#5e5e62] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:bg-white transition-all font-medium" 
             />
          </div>
          
          <div className="flex items-center gap-4 ml-6 shrink-0">
             <button onClick={() => router.push('/settings')} className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:bg-[#f3f4f6] p-2 rounded-full transition-colors" aria-label="Settings">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
               </svg>
             </button>
             <NotificationPanel />
             <button onClick={() => fileInputRef.current?.click()} className="bg-[hsl(var(--foreground))] text-white text-[13px] font-bold px-4 py-2 rounded-full flex items-center gap-1.5 hover:opacity-90 transition shadow-sm whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create
             </button>
             <ProfileMenu userInitial={userInitial} userName={user.name} userEmail={user.email} />
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto px-10 py-8">
           
           {/* ACTION CARDS ROW */}
           <div className="flex gap-4 mb-10 overflow-x-auto pb-4 pt-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button onClick={() => fileInputRef.current?.click()} className="snap-start shrink-0 w-52 bg-[hsl(var(--surface))] rounded-2xl p-4 flex items-center gap-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-shadow">
                 <div className="w-10 h-10 bg-[hsl(var(--background))] rounded-full flex items-center justify-center text-[hsl(var(--foreground))] shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                 </div>
                 <div className="text-left min-w-0">
                    <div className="font-bold text-[14px] text-[hsl(var(--foreground))] truncate tracking-tight">Upload</div>
                    <div className="text-[12px] text-[hsl(var(--muted))] truncate">from computer</div>
                 </div>
              </button>
              <button onClick={() => setShowImportModal(true)} className="snap-start shrink-0 w-52 bg-[hsl(var(--surface))] rounded-2xl p-4 flex items-center gap-4 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-shadow">
                 <div className="w-10 h-10 bg-[hsl(var(--background))] rounded-full flex items-center justify-center text-[hsl(var(--foreground))] shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5l3 3m0 0l3-3m-3 3v-6m1.06-4.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
                 </div>
                 <div className="text-left min-w-0">
                    <div className="font-bold text-[14px] text-[hsl(var(--foreground))] truncate tracking-tight">Import</div>
                    <div className="text-[12px] text-[hsl(var(--muted))] truncate">from Drive and more</div>
                 </div>
              </button>
           </div>
           
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold text-[hsl(var(--foreground))] tracking-tight">Recents</h2>
             <div className="flex items-center gap-2">
               <button className="w-8 h-8 rounded-full bg-[hsl(var(--surface))] flex items-center justify-center text-[hsl(var(--foreground))] hover:bg-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition border-0">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
               </button>
               <button className="w-8 h-8 rounded-full bg-[hsl(var(--surface))] flex items-center justify-center text-[hsl(var(--foreground))] hover:bg-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition border-0">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
               </button>
             </div>
           </div>
           
           {uploading && (
              <div className="mb-8 w-[340px] shrink-0 snap-start bg-[hsl(var(--surface))] border border-dashed border-[hsl(var(--accent-border))] rounded-xl p-4 flex flex-col justify-between shadow-sm">
                 <div>
                    <span className="inline-block bg-[hsl(var(--accent))] text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-3">Uploading</span>
                    <h3 className="font-bold text-sm text-[hsl(var(--foreground))] truncate mb-1">New video</h3>
                    <p className="text-[11px] text-[hsl(var(--muted))]">{uploadStage || uploadSpeed || 'Connecting…'}</p>
                 </div>
                 <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-bold text-[hsl(var(--foreground))] mb-1.5">
                       <span>Progress</span>
                       <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[hsl(var(--sidebar))] rounded-full overflow-hidden">
                       <div className="h-full bg-[hsl(var(--accent))]" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                 </div>
              </div>
           )}

           <div className="flex gap-2 overflow-x-auto pb-6 pt-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
             {filteredVideos.length === 0 && !uploading ? (
               <div className="text-sm text-[hsl(var(--muted))] py-10 w-full text-center">No recent videos. Upload one to get started!</div>
             ) : (
               filteredVideos.map(video => (
                 <div key={video.id} className="w-[364px] shrink-0 snap-start group relative p-3 rounded-[24px] hover:bg-[#eaf0f4] transition-colors cursor-pointer" onClick={() => openVideo(video)}>
                   <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                      {thumbnailFor(video) ? (
                        <img src={thumbnailFor(video)} className="w-full h-full object-cover" alt={video.title} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[hsl(var(--muted))] bg-gray-900">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[11px] font-bold px-1.5 py-0.5 rounded tracking-wide">
                        {formatDuration(video.durationSeconds)}
                      </div>
                      {video.status !== 'ready' && (
                        <div className="absolute top-2 left-2 bg-[hsl(var(--accent))] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Processing
                        </div>
                      )}
                   </div>
                   <div className="flex items-start justify-between px-1">
                      <div className="flex gap-3 min-w-0">
                         <div className="w-[26px] h-[26px] rounded-full bg-[#f87171] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                           {userInitial}
                         </div>
                         <div className="min-w-0">
                           <h3 className="font-bold text-[14px] text-[hsl(var(--foreground))] truncate tracking-tight">{video.title}</h3>
                           <p className="text-[12px] text-[hsl(var(--foreground))] truncate leading-tight mt-0.5">{user.name || 'User'}</p>
                           <p className="text-[11px] text-[hsl(var(--muted))] truncate mt-0.5">{getRelativeTimeString(video.createdAt)}</p>
                         </div>
                      </div>
                      <div className="relative">
                        <button 
                          className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] p-1" 
                          onClick={(e) => { e.stopPropagation(); setActiveMenuVideoId(activeMenuVideoId === video.id ? null : video.id); }}
                        >
                           <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                           </svg>
                        </button>
                        {activeMenuVideoId === video.id && (
                           <div className="absolute right-0 bottom-8 z-50 w-36 bg-[hsl(var(--surface))] rounded-xl shadow-lg p-1.5 overflow-hidden border border-gray-100">
                              <button className="w-full text-left px-2.5 py-2 text-[12px] font-semibold text-[hsl(var(--foreground))] hover:bg-[#f0f5f6] rounded-lg transition" onClick={() => { copyComponentId(video); setActiveMenuVideoId(null); }}>Copy ID</button>
                              <button className="w-full text-left px-2.5 py-2 text-[12px] font-semibold text-[hsl(var(--foreground))] hover:bg-[#f0f5f6] rounded-lg transition" onClick={() => { downloadVideo(video); setActiveMenuVideoId(null); }}>Download</button>
                              <button className="w-full text-left px-2.5 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition" onClick={() => { deleteVideo(video.id); setActiveMenuVideoId(null); }}>Delete</button>
                           </div>
                        )}
                      </div>
                   </div>
                 </div>
               ))
             )}
           </div>


        </main>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleFile(f); }} />

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-panel-md bg-[hsl(var(--surface))]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="page-title text-lg">Import Video URL</h3>
              <button onClick={() => setShowImportModal(false)} className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="page-subtitle mb-4 text-[13px] text-[hsl(var(--muted))] leading-relaxed">Provide any video URL (YouTube, Vimeo, Google Drive, Mux, or a direct link) and we'll process it in the background.</p>
            <div className="flex gap-2">
              <input type="url" required placeholder="https://youtube.com/watch?v=..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} className="input-minimal" onKeyDown={(e) => { if (e.key === 'Enter') handleImport(); }} />
              <button type="button" onClick={handleImport} disabled={!importUrl || importing} className="btn-accent shrink-0">
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD MODAL */}
      {showRecordModal && (
        <div className="modal-overlay">
          <div className="modal-panel-md bg-[hsl(var(--surface))]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="page-title text-lg">Record Screen & Camera</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-900 shadow-inner flex items-center justify-center border border-gray-800">
              {isRecording ? (
                <>
                  <div className="absolute inset-0 border-2 border-red-500/80 rounded-xl pointer-events-none animate-pulse"></div>
                  <div className="flex flex-col items-center justify-center text-white">
                    <div className="h-4 w-4 rounded-full bg-red-600 animate-pulse mb-3 shadow-[0_0_12px_rgba(220,38,38,0.8)]"></div>
                    <span className="text-2xl font-mono font-extrabold tracking-wider">
                      {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60) < 10 ? '0' : ''}{recordingSeconds % 60}
                    </span>
                  </div>
                  <div className="absolute top-3 left-3 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
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

            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 bg-gray-800/50 hover:bg-gray-800 hover:text-white text-gray-400 transition shadow-sm">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 bg-gray-800/50 hover:bg-gray-800 hover:text-white text-gray-400 transition shadow-sm">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                {isRecording ? (
                  <button onClick={stopRecordingAction} className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-xs font-bold text-gray-900 transition hover:bg-gray-100 shadow">
                    <span className="h-2 w-2 rounded-sm bg-gray-900" /> Stop Recording
                  </button>
                ) : (
                  <button onClick={startRecordingAction} className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-500 shadow-lg shadow-red-600/20">
                    <span className="h-2.5 w-2.5 rounded-full bg-white" /> Start Recording
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
