'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Video } from '@framevid/types';

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
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
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
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'hour ago' : 'm ago'}`; // simplified or custom
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function getResolutionString(video: any) {
  // Check if filename or title represents a phone vertical screen recording (vertical 9:16 layout)
  const isVertical = video.title.toLowerCase().startsWith('img_') || video.originalFilename.toLowerCase().startsWith('img_');
  return isVertical ? '2160×3840' : '1920×1080';
}

function thumbnailFor(video: any) {
  return video.posterUrl || video.thumbnailUrls?.[0];
}

export default function VideoDashboardClient({ initialVideos, workspaceId, user, activeWorkspace }: ClientProps) {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>(initialVideos);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Workspace dropdown state
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  
  // Options menu active video state
  const [activeMenuVideoId, setActiveMenuVideoId] = useState<string | null>(null);

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

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Global Drag State
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragCounter = useRef(0);

  // Account initial
  const userInitial = (user.name || user.email)[0].toUpperCase();

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

  const handleFile = async (file: File) => {
    if (!file) return;
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
        }),
      });

      const initPayload = await initRes.json();
      if (!initRes.ok) throw new Error(initPayload.error || 'Failed to initiate upload');

      const { video, uploadUrl, rawKey } = initPayload.data;
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

        xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed with status code: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
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
      alert(`Upload Error: ${err.message}`);
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
        alert(`Failed to delete video: ${payload.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  const copyComponentId = async (video: Video) => {
    await navigator.clipboard?.writeText(video.id);
    alert('Copied FrameVid Component ID to clipboard!');
  };

  const openVideo = (video: Video) => {
    if (video.status !== 'uploading') router.push(`/videos/${video.id}`);
  };

  // Filtered Videos based on search query
  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, name: newFolderName.trim() }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to create folder');
      setFolders((prev) => [...prev, payload.data]);
      setNewFolderName('');
      setShowFolderModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create folder');
    }
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
        primaryColor: '#F97316',
        privacy: 'public',
        downloadEnabled: false,
        playbackSpeeds: [0.5, 1, 1.25, 1.5, 2],
      }
    };
    setVideos((prev) => [newMockRec, ...prev]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB] font-sans text-gray-900 selection:bg-orange-500 selection:text-white">
      {/* GLOBAL DRAG OVERLAY */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm p-8 transition-all duration-300">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl border-4 border-dashed border-orange-500 bg-orange-50/50 p-6 text-center animate-in-up">
            <svg className="h-16 w-16 text-orange-500 animate-bounce mb-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Drop files anywhere</h2>
            <p className="mt-2 text-lg font-medium text-gray-600">Upload video to FrameVid instantly</p>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div onClick={() => router.push('/')} className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-85">
            <span className="font-extrabold text-[15px] tracking-tight">FrameVid</span>
          </div>

          {/* Workspace Pill Selector */}
          <div className="relative">
            <button
              onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
            >
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{activeWorkspace.name}</span>
              <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                {activeWorkspace.plan}
              </span>
              <svg className="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .55.24l3.25 3.5a.75.75 0 1 1-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 0 1-1.1-1.02l3.25-3.5A.75.75 0 0 1 10 3Zm0 14a.75.75 0 0 1-.55-.24l-3.25-3.5a.75.75 0 1 1 1.1-1.02l2.7 2.908 2.7-2.908a.75.75 0 1 1 1.1 1.02l-3.25 3.5A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
              </svg>
            </button>

            {workspaceDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setWorkspaceDropdownOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-64 origin-top-left rounded-lg border border-gray-200 bg-white p-1 shadow-lg ring-1 ring-black/5 z-50">
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Workspaces</div>
                  <button className="flex w-full items-center justify-between rounded-md bg-orange-50/65 px-2 py-1.5 text-left text-xs font-semibold text-orange-600">
                    <span className="truncate">{activeWorkspace.name}</span>
                    <svg className="h-3.5 w-3.5 text-orange-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900">
                    Personal Workspace
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  <button className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900">
                    + Create Workspace
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search Middle */}
        <div className="relative mx-4 hidden max-w-md flex-1 md:block">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search videos and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-3 text-xs font-medium text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-300 focus:bg-white focus:ring-4 focus:ring-orange-500/5"
          />
        </div>

        {/* Right Nav */}
        <div className="flex items-center gap-3">
          {/* User profile avatar icon */}
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-sm shadow-orange-500/10" aria-label="Account Menu">
            {userInitial}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          
          {/* HEADER SECTION: WORKSPACE AND ACTIONS */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">{activeWorkspace.name}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
                  <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                  {videos.length} / 10 videos
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
                  <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
                  100MB / video
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
                  <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  5 minutes / video
                </span>
              </div>
            </div>

            {/* ACTION BUTTONS ROW */}
            <div className="flex flex-wrap items-center gap-2">
              {/* List / Grid selector */}
              <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition ${viewMode === 'list' ? 'bg-orange-50 text-orange-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'}`}
                  aria-label="List View"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition ${viewMode === 'grid' ? 'bg-orange-50 text-orange-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'}`}
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
              <button
                onClick={() => setShowFolderModal(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Create Folder
              </button>

              {/* Bulk Move button */}
              <button
                onClick={() => setShowBulkMoveModal(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0-4.5 4.5M21 7.5H7.5" />
                </svg>
                Bulk Move
              </button>

              {/* Record button */}
              <button
                onClick={() => {
                  setShowRecordModal(true);
                  setIsRecording(false);
                  setRecordingSeconds(0);
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9a2.25 2.25 0 0 1 2.25-2.25H12A2.25 2.25 0 0 1 14.25 9v7.5A2.25 2.25 0 0 1 12 18.75Z" />
                </svg>
                Record
              </button>

              {/* Upload button in primary orange */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-orange !h-9 flex items-center gap-2 rounded-lg px-3.5 text-xs font-bold shadow-sm"
                disabled={uploading}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Upload Video</span>
                <span className="h-4 w-[1px] bg-orange-400/80 mx-0.5" />
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
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 px-6 py-5 text-white shadow-md">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_50%,rgba(255,255,255,0.15),transparent_40%)]" />
              <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">You're using free plan</h3>
                  <p className="mt-1 text-xs font-semibold text-orange-100/90">Upgrade your plan to add more videos</p>
                </div>
                <button
                  onClick={() => alert('Plan subscription pricing coming soon!')}
                  className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-4 text-xs font-bold text-orange-600 shadow-sm transition hover:bg-orange-50 active:scale-95"
                >
                  View plans
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* FOLDERS OVERVIEW (mocked client state if folder exists) */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">Folders ({folders.length})</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="group flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/20"
                  >
                    <svg className="h-8 w-8 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <div className="mt-2 min-w-0">
                      <p className="truncate text-xs font-bold text-gray-900">{f.name}</p>
                      <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{f.videoCount} videos</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIDEOS SECTION TITLE */}
          <div className="space-y-4">
            <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">Videos ({filteredVideos.length})</h2>

            {/* UPLOADING STATE CARD IN GRID */}
            {uploading && viewMode === 'grid' && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                <article className="overflow-hidden rounded-xl border border-dashed border-orange-300 bg-orange-50/20 shadow-sm p-4 space-y-4 flex flex-col justify-between min-h-[220px]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white animate-pulse">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5h10.5" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-bold text-gray-900">Uploading video...</h3>
                      <p className="text-[10px] text-gray-400 font-semibold truncate">{uploadSpeed || 'Connecting'}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-gray-600">
                      <span>{timeRemaining || 'Estimating...'}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                </article>
              </div>
            )}

            {/* VIDEO CONTENTS */}
            {filteredVideos.length === 0 && !uploading ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 text-center shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 border border-gray-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9a2.25 2.25 0 0 1 2.25-2.25H12A2.25 2.25 0 0 1 14.25 9v7.5A2.25 2.25 0 0 1 12 18.75Z" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-gray-900 uppercase">No videos found</h3>
                <p className="mt-1 max-w-xs text-xs font-medium text-gray-500">
                  {searchQuery ? 'Adjust your search terms to find matching assets.' : 'Upload or record your first video asset to get started.'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredVideos.map((video) => {
                  const meta = statusMeta[video.status as Video['status']] || { label: 'Unknown', tone: 'danger', progress: 0 };
                  const thumbnail = thumbnailFor(video);
                  
                  return (
                    <article
                      key={video.id}
                      className="group flex flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300"
                    >
                      {/* Aspect Ratio Video Box */}
                      <div
                        onClick={() => openVideo(video)}
                        className="video-thumb relative aspect-video w-full overflow-hidden cursor-pointer bg-gray-950"
                      >
                        {thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbnail} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-tr from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                            <svg className="h-8 w-8 text-gray-700 transition group-hover:scale-105" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/5 opacity-0 transition group-hover:opacity-100" />
                        
                        {/* Overlays */}
                        {/* Duration: bottom-left */}
                        <div className="absolute bottom-2.5 left-2.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          {formatDuration(video.durationSeconds)}
                        </div>

                        {/* Status badge: top-right */}
                        <div className="absolute top-2.5 right-2.5">
                          {video.status === 'ready' ? (
                            <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-sm">
                              <svg className="h-3 w-3 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                              </svg>
                              Success
                            </span>
                          ) : video.status === 'error' ? (
                            <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 shadow-sm">
                              Failed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-sm animate-pulse">
                              {meta.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content & Details */}
                      <div className="p-3.5 space-y-3">
                        <div className="min-w-0">
                          <h3 onClick={() => openVideo(video)} className="cursor-pointer truncate text-[13px] font-bold text-gray-900 hover:text-orange-500 transition-colors">{video.title}</h3>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-gray-400">{getRelativeTimeString(video.createdAt)}</p>
                        </div>
                      </div>

                      {/* Card Footer: views count, resolution and dots menu */}
                      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><circle cx="12" cy="12" r="3" /></svg>
                            0
                          </span>
                          <span className="text-gray-300">|</span>
                          <span>{getResolutionString(video)}</span>
                        </div>

                        {/* Dropdown Options Button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuVideoId(activeMenuVideoId === video.id ? null : video.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:border-gray-300 hover:text-gray-900 focus:outline-none"
                            aria-label="Options"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
                            </svg>
                          </button>

                          {activeMenuVideoId === video.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-44 origin-bottom-right rounded-lg border border-gray-200 bg-white p-1 shadow-lg ring-1 ring-black/5 z-40">
                              <button
                                onClick={() => openVideo(video)}
                                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600"
                              >
                                Open Video
                              </button>
                              <button
                                onClick={() => copyComponentId(video)}
                                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-600"
                              >
                                Copy Component ID
                              </button>
                              <div className="my-1 border-t border-gray-100" />
                              <button
                                onClick={() => deleteVideo(video.id)}
                                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Delete Video
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3">Video Title & File</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredVideos.map((video) => {
                      const meta = statusMeta[video.status as Video['status']] || { label: 'Unknown', tone: 'danger', progress: 0 };
                      const thumbnail = thumbnailFor(video);
                      return (
                        <tr
                          key={video.id}
                          onClick={() => openVideo(video)}
                          className="group cursor-pointer transition hover:bg-gray-50/50"
                        >
                          <td className="px-4 py-3 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-[71px] flex-shrink-0 overflow-hidden rounded bg-gray-950">
                                {thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-tr from-gray-900 to-gray-800 flex items-center justify-center">
                                    <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                                  {video.title}
                                </span>
                                <span className="block truncate text-[10px] font-semibold text-gray-400 mt-0.5">
                                  {video.originalFilename}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {video.status === 'ready' ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                Success
                              </span>
                            ) : video.status === 'error' ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 animate-pulse">
                                {meta.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-500">
                            {formatDuration(video.durationSeconds)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-500">
                            {getRelativeTimeString(video.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-500">
                            {formatSize(video.sizeBytes)}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => copyComponentId(video)}
                                className="rounded border border-gray-200 bg-white p-1 text-gray-400 hover:border-gray-300 hover:text-gray-900 shadow-sm"
                                title="Copy Component ID"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteVideo(video.id)}
                                className="rounded border border-gray-200 bg-white p-1 text-red-500 hover:border-red-300 hover:bg-red-50 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in-up">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-gray-950">Create Folder</h3>
            <p className="mt-1 text-xs text-gray-500">Organize your stream assets by client or project.</p>
            <form onSubmit={handleCreateFolderSubmit} className="mt-4 space-y-4">
              <input
                type="text"
                required
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-orange rounded-lg h-8 px-4 text-xs font-bold"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK MOVE MODAL */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in-up">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-gray-950">Bulk Move Videos</h3>
            <p className="mt-1 text-xs text-gray-500">Relocate multiple stream assets to a folder.</p>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase">Target Folder</label>
                {folders.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center text-xs font-semibold text-gray-500">
                    No folders created yet. Please create a folder first.
                  </div>
                ) : (
                  <select
                    value={bulkMoveFolder}
                    onChange={(e) => setBulkMoveFolder(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold outline-none focus:border-orange-500"
                  >
                    <option value="">Select destination...</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkMoveModal(false)}
                  className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!bulkMoveFolder) return;
                    alert('Moved selected videos successfully!');
                    setShowBulkMoveModal(false);
                  }}
                  className="btn-orange rounded-lg h-8 px-4 text-xs font-bold"
                  disabled={folders.length === 0 || !bulkMoveFolder}
                >
                  Move Videos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEBCAM / SCREEN RECORDER PLAYFUL MODAL */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in-up">
          <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${isRecording ? 'animate-ping' : ''}`}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/10 p-3 text-red-500 animate-pulse">
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
                  <div className="absolute top-3 left-3 bg-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
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
                    <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
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
