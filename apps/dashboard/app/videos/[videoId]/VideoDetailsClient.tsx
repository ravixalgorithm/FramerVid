'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Video } from '@framevid/types';
import VideoAnalytics from './VideoAnalytics';

interface ClientProps {
  initialVideo: any;
  user: {
    name?: string | null;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
    plan: string;
  } | null;
}

type TabType =
  | 'analytics'
  | 'metadata'
  | 'thumbnail'
  | 'intro-outro'
  | 'player'
  | 'controls'
  | 'colors'
  | 'play-button'
  | 'audio'
  | 'cta'
  | 'form'
  | 'subtitles'
  | 'danger';

function formatDuration(seconds?: number) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function getResolutionString(video: any) {
  const isVertical = video.title.toLowerCase().startsWith('img_') || video.originalFilename.toLowerCase().startsWith('img_');
  return isVertical ? '2160×3840' : '1920×1080';
}

function thumbnailFor(video: any) {
  return video.posterUrl || video.thumbnailUrls?.[0];
}

function getMuxThumbnailAtTime(url?: string, time: number = 0) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('mux.com')) {
      u.searchParams.set('time', Math.round(time).toString());
      return u.toString();
    }
  } catch (e) {
    // If it's a relative/mock path, we can still append time query parameter
    if (url.includes('?')) {
      return url.replace(/time=\d+/, `time=${Math.round(time)}`);
    }
    return `${url}?time=${Math.round(time)}`;
  }
  return url;
}

export default function VideoDetailsClient({ initialVideo, user, workspace }: ClientProps) {
  const router = useRouter();
  const [video, setVideo] = useState<Video>(initialVideo);
  
  // Tab configuration
  const [activeTab, setActiveTab] = useState<TabType>('metadata');

  // Input Configuration states
  const [editTitle, setEditTitle] = useState(video.title);
  const [editDescription, setEditDescription] = useState(video.description || '');
  const [editNotes, setEditNotes] = useState((video.settings as any)?.notes || '');
  const [editAutoplay, setEditAutoplay] = useState(video.settings.autoplay ?? false);
  const [editLoop, setEditLoop] = useState(video.settings.loop ?? false);
  const [editMuted, setEditMuted] = useState(video.settings.muted ?? false);
  const [editControlsStyle, setEditControlsStyle] = useState<'show' | 'hide' | 'on-hover'>(video.settings.controlsStyle ?? 'show');
  const [editPrimaryColor, setEditPrimaryColor] = useState(video.settings.primaryColor ?? '#F97316');
  const [editBgColor, setEditBgColor] = useState<string>((video.settings as any)?.bgColor ?? '#000000');
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'unlisted' | 'password'>(video.settings.privacy ?? 'public');
  const [editDownloadEnabled, setEditDownloadEnabled] = useState(video.settings.downloadEnabled ?? false);
  
  // CTA States
  interface CtaItem {
    id: string;
    text: string;
    url: string;
    startTime: number;
    duration: number;
    bgColor?: string;
    textColor?: string;
    borderRadius?: number;
    borderWidth?: number;
    borderColor?: string;
    position?: 'bottom-center' | 'top-center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center-center';
    leftPercent?: number;
    topPercent?: number;
  }
  const [editCtaEnabled, setEditCtaEnabled] = useState(video.settings.ctaEnabled ?? false);
  const [editCtaText, setEditCtaText] = useState(video.settings.ctaText ?? 'Click Here');
  const [editCtaUrl, setEditCtaUrl] = useState(video.settings.ctaUrl ?? '');
  const [editCtaStartTime] = useState<number>((video.settings as any)?.ctaStartTime ?? 0);
  const [editCtaDuration] = useState<number>((video.settings as any)?.ctaDuration ?? 10);
  const [editCtas, setEditCtas] = useState<CtaItem[]>(() => {
    if (video.settings.ctas && Array.isArray(video.settings.ctas)) {
      return video.settings.ctas;
    }
    if (video.settings.ctaText) {
      return [{
        id: 'legacy',
        text: video.settings.ctaText,
        url: video.settings.ctaUrl ?? '',
        startTime: (video.settings as any).ctaStartTime ?? 0,
        duration: (video.settings as any).ctaDuration ?? 10
      }];
    }
    return [];
  });
  
  const [expandedCtaId, setExpandedCtaId] = useState<string | null>(() => {
    if (video.settings.ctas && Array.isArray(video.settings.ctas) && video.settings.ctas.length > 0) {
      return video.settings.ctas[0].id;
    }
    if (video.settings.ctaText) {
      return 'legacy';
    }
    return null;
  });
  
  // Form States
  const [editFormEnabled, setEditFormEnabled] = useState(video.settings.formEnabled ?? false);
  const [editFormTime, setEditFormTime] = useState<number | 'pre-roll' | 'post-roll'>(video.settings.formTime ?? 'pre-roll');
  const [editFormTitle, setEditFormTitle] = useState(video.settings.formTitle ?? 'Unlock this video');
  const [editFormDescription, setEditFormDescription] = useState(video.settings.formDescription ?? 'Enter your email to watch');
  const [editFormThankYouMessage, setEditFormThankYouMessage] = useState(video.settings.formThankYouMessage ?? 'Thank you!');
  const [editFormButtonText, setEditFormButtonText] = useState(video.settings.formButtonText ?? 'Submit');
  const [editFormButtonColor, setEditFormButtonColor] = useState(video.settings.formButtonColor ?? video.settings.primaryColor ?? '#F97316');
  const [editFormButtonTextColor, setEditFormButtonTextColor] = useState(video.settings.formButtonTextColor ?? '#ffffff');
  const [editFormTextColor, setEditFormTextColor] = useState(video.settings.formTextColor ?? '#000000');
  const [editFormBgColor, setEditFormBgColor] = useState(video.settings.formBgColor ?? '#ffffff');
  const [editFormAlignment, setEditFormAlignment] = useState<'left' | 'center' | 'right'>(video.settings.formAlignment ?? 'center');
  
  const [editFormFields, setEditFormFields] = useState<{id: string, name: string, type: 'email' | 'text' | 'tel', required: boolean}[]>(
    video.settings.formFields ?? [
      { id: 'f_name', name: 'Name', type: 'text', required: true },
      { id: 'f_email', name: 'Email', type: 'email', required: true },
    ]
  );
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHls, setCopiedHls] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [customThumbnailName, setCustomThumbnailName] = useState<string | null>(null);
  const [endingThumbnailName, setEndingThumbnailName] = useState<string | null>(null);
  const [endingThumbnailUrl, setEndingThumbnailUrl] = useState<string | null>((video.settings as any)?.endingThumbnailUrl || null);

  const [editIntroVideoName, setEditIntroVideoName] = useState<string | null>((video.settings as any)?.introVideoName || null);
  const [editOutroVideoName, setEditOutroVideoName] = useState<string | null>((video.settings as any)?.outroVideoName || null);
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>((video.settings as any)?.introVideoUrl || null);
  const [outroVideoUrl, setOutroVideoUrl] = useState<string | null>((video.settings as any)?.outroVideoUrl || null);
  const [editShowWatermark, setEditShowWatermark] = useState<boolean>((video.settings as any)?.showWatermark ?? true);
  const [editClickToPlay, setEditClickToPlay] = useState<boolean>((video.settings as any)?.clickToPlay ?? true);
  const [editStartInView, setEditStartInView] = useState<boolean>((video.settings as any)?.startInView ?? false);
  const [editPlayInline, setEditPlayInline] = useState<boolean>((video.settings as any)?.playInline ?? false);
  const [editBgVideo, setEditBgVideo] = useState<boolean>((video.settings as any)?.bgVideo ?? false);
  const [editPlayFromStartFullscreen, setEditPlayFromStartFullscreen] = useState<boolean>((video.settings as any)?.playFromStartFullscreen ?? false);
  const [editPlayButtonStyle, setEditPlayButtonStyle] = useState<'circle' | 'square' | 'rounded'>((video.settings as any)?.playButtonStyle ?? 'circle');
  const [playButtonIconName, setPlayButtonIconName] = useState<string | null>(null);
  const [mobilePlayButtonIconName, setMobilePlayButtonIconName] = useState<string | null>(null);
  const [editPlayButtonIconUrl, setEditPlayButtonIconUrl] = useState<string | null>((video.settings as any)?.playButtonIconUrl || null);
  const [editMobilePlayButtonIconUrl, setEditMobilePlayButtonIconUrl] = useState<string | null>((video.settings as any)?.mobilePlayButtonIconUrl || null);
  const [editPlayButtonText, setEditPlayButtonText] = useState<string>((video.settings as any)?.playButtonText || '');
  const [editShowLargePlayButton, setEditShowLargePlayButton] = useState<boolean>((video.settings as any)?.showLargePlayButton ?? true);
  const [editPlayButtonSize, setEditPlayButtonSize] = useState<number>((video.settings as any)?.playButtonSize ?? 64);
  const [editPlayButtonBorderWidth, setEditPlayButtonBorderWidth] = useState<number>((video.settings as any)?.playButtonBorderWidth ?? 0);
  const [editPlayButtonBorderColor, setEditPlayButtonBorderColor] = useState<string>((video.settings as any)?.playButtonBorderColor ?? '#ffffff');
  const [editPlayButtonIconScale, setEditPlayButtonIconScale] = useState<number>((video.settings as any)?.playButtonIconScale ?? 45);
  const [editPlayButtonBgTransparent, setEditPlayButtonBgTransparent] = useState<boolean>((video.settings as any)?.playButtonBgTransparent ?? false);
  const [editShowPlayPause, setEditShowPlayPause] = useState<boolean>((video.settings as any)?.showPlayPause ?? true);
  const [editShowProgress, setEditShowProgress] = useState<boolean>((video.settings as any)?.showProgress ?? true);
  const [editShowCurrentTime, setEditShowCurrentTime] = useState<boolean>((video.settings as any)?.showCurrentTime ?? true);
  const [editShowMute, setEditShowMute] = useState<boolean>((video.settings as any)?.showMute ?? true);
  const [editShowVolume, setEditShowVolume] = useState<boolean>((video.settings as any)?.showVolume ?? true);
  const [editShowSettings, setEditShowSettings] = useState<boolean>((video.settings as any)?.showSettings ?? true);
  const [editShowFullscreen, setEditShowFullscreen] = useState<boolean>((video.settings as any)?.showFullscreen ?? true);
  const [editShowPlaybackSpeed, setEditShowPlaybackSpeed] = useState<boolean>((video.settings as any)?.showPlaybackSpeed ?? true);
  const [editShowSelectQuality, setEditShowSelectQuality] = useState<boolean>((video.settings as any)?.showSelectQuality ?? true);
  const [editDefaultVolume, setEditDefaultVolume] = useState<number>((video.settings as any)?.defaultVolume ?? 100);
  const [editMuteByDefault, setEditMuteByDefault] = useState<boolean>((video.settings as any)?.muteByDefault ?? false);
  const [bgAudioName, setBgAudioName] = useState<string | null>((video.settings as any)?.bgAudioName || null);
  const [editBgAudioUrl, setEditBgAudioUrl] = useState<string | null>((video.settings as any)?.bgAudioUrl || null);
  const [editBgAudioVolume, setEditBgAudioVolume] = useState<number>((video.settings as any)?.bgAudioVolume ?? 30);

  const isPaidPlan = workspace?.plan ? workspace.plan !== 'free' : false;
  const shouldShowWatermark = editShowWatermark;

  // Prevent unused variables compile warning in tsc
  const _unused = {
    setEditPrivacy,
    setEditDownloadEnabled,
    setEditCtaEnabled,
    setEditCtaText,
    setEditCtaUrl,
    setEditFormDescription,
    setEditFormThankYouMessage,
    setEditFormButtonText,
    setEditFormButtonColor,
    setEditFormButtonTextColor,
    setEditFormTextColor,
    setEditFormBgColor,
    setEditFormAlignment,
    setEditFormFields,
    copiedId,
    formatBytes,
    thumbnailFor,
  };
  
  if (_unused) {
    // Read the value to satisfy tsc
  }
  
  const [previewFormVisible, setPreviewFormVisible] = useState(false);
  const [previewFormSubmitted, setPreviewFormSubmitted] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const hlsInstanceRef = useRef<any>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);

  const isVerticalVideo = getResolutionString(video) === '2160×3840';
  const userInitial = (user.name || user.email)[0].toUpperCase();

  // Periodically refresh transcoding video status in real-time
  useEffect(() => {
    if (video.status === 'ready' || video.status === 'error') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/${video.id}/meta`);
        if (res.ok) {
          const payload = await res.json();
          const updated = payload.data;
          setVideo(updated);
          if (updated.status === 'ready') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [video]);

  // Load HLS Live Preview player
  useEffect(() => {
    const htmlVideo = previewVideoRef.current;
    if (!htmlVideo || video.status !== 'ready' || !video.hlsManifestUrl) {
      return;
    }

    const manifestUrl = video.hlsManifestUrl;

    if (htmlVideo.canPlayType('application/vnd.apple.mpegurl')) {
      htmlVideo.src = manifestUrl;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) return;

        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
        }

        const hls = new Hls({
          startLevel: -1,
          capLevelToPlayerSize: true,
        });

        hls.loadSource(manifestUrl);
        hls.attachMedia(htmlVideo);
        hlsInstanceRef.current = hls;
      });
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [video]);

  // Copy helpers
  const handleCopyId = () => {
    navigator.clipboard.writeText(video.id);
    setCopiedId(video.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyHls = () => {
    if (!video.hlsManifestUrl) return;
    navigator.clipboard.writeText(video.hlsManifestUrl);
    setCopiedHls(video.hlsManifestUrl);
    setTimeout(() => setCopiedHls(null), 2000);
  };

  // Live Preview Effect logic
  useEffect(() => {
    if (!editFormEnabled) {
      setPreviewFormVisible(false);
      setPreviewFormSubmitted(false);
      return;
    }
    
    if (editFormTime === 'pre-roll' && !previewFormSubmitted) {
      setPreviewFormVisible(true);
      previewVideoRef.current?.pause();
    } else if (editFormTime === 'post-roll') {
      setPreviewFormVisible(false);
    }
  }, [editFormEnabled, editFormTime, previewFormSubmitted]);

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.volume = editDefaultVolume / 100;
    }
  }, [editDefaultVolume]);

  useEffect(() => {
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = editBgAudioVolume / 100;
    }
  }, [editBgAudioVolume]);

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.muted = editMuteByDefault || editMuted || editAutoplay;
    }
    if (bgAudioRef.current) {
      bgAudioRef.current.muted = editMuteByDefault || editMuted || editAutoplay;
    }
  }, [editMuteByDefault, editMuted, editAutoplay]);

  useEffect(() => {
    const bgAudio = bgAudioRef.current;
    if (!bgAudio || !editBgAudioUrl) return;

    if (isPlaying) {
      bgAudio.play().catch(console.error);
    } else {
      bgAudio.pause();
    }
  }, [isPlaying, editBgAudioUrl]);

  // Imperatively sync autoplay toggle to the video element
  useEffect(() => {
    const vid = previewVideoRef.current;
    if (!vid) return;
    if (editAutoplay || editBgVideo) {
      vid.play().catch(console.error);
    }
  }, [editAutoplay, editBgVideo]);

  // Imperatively sync loop toggle to the video element
  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.loop = editLoop || editBgVideo;
    }
  }, [editLoop, editBgVideo]);

  // Imperatively sync playsInline to the video element
  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.playsInline = editPlayInline || editBgVideo;
    }
  }, [editPlayInline, editBgVideo]);

  const handlePreviewTimeUpdate = (e: any) => {
    const videoObj = e.target;
    const currentT = videoObj.currentTime;
    
    if (editFormEnabled && !previewFormSubmitted && !previewFormVisible) {
      if (typeof editFormTime === 'number' && currentT >= editFormTime) {
        setPreviewFormVisible(true);
        videoObj.pause();
      }
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    if (videoEl.videoWidth && videoEl.videoHeight) {
      setAspectRatio(videoEl.videoWidth / videoEl.videoHeight);
    }
  };

  const togglePlay = () => {
    if (!editClickToPlay) return;
    if (previewVideoRef.current) {
      if (previewVideoRef.current.paused) {
        previewVideoRef.current.play().catch(console.error);
      } else {
        previewVideoRef.current.pause();
      }
    }
  };

  // Start playing when in view (IntersectionObserver)
  useEffect(() => {
    if (!editStartInView || !previewVideoRef.current) return;

    const videoEl = previewVideoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoEl.play().catch(console.error);
        } else {
          videoEl.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(videoEl);
    return () => observer.disconnect();
  }, [editStartInView]);

  // Play from start when entering fullscreen
  useEffect(() => {
    if (!editPlayFromStartFullscreen) return;

    const handleFullscreenChange = () => {
      if (document.fullscreenElement && previewVideoRef.current) {
        previewVideoRef.current.currentTime = 0;
        setCurrentTime(0);
        previewVideoRef.current.play().catch(console.error);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [editPlayFromStartFullscreen]);

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handlePreviewEnded = () => {
    if (editFormEnabled && editFormTime === 'post-roll' && !previewFormSubmitted) {
      setPreviewFormVisible(true);
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handlePreviewFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowThankYou(true);
    if (previewVideoRef.current) {
      previewVideoRef.current.play().then(() => previewVideoRef.current?.pause()).catch(() => {});
    }

    setTimeout(() => {
      setShowThankYou(false);
      setPreviewFormVisible(false);
      setPreviewFormSubmitted(true);
      if (editFormTime !== 'post-roll') {
        previewVideoRef.current?.play().catch(console.error);
      }
    }, 2000);
  };

  const handleAddCta = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    const newCta: CtaItem = {
      id: newId,
      text: 'Click Here',
      url: '',
      startTime: 0,
      duration: 10,
      bgColor: editPrimaryColor || '#F97316',
      textColor: '#ffffff',
      borderRadius: 30,
      borderWidth: 0,
      borderColor: '#ffffff',
      leftPercent: 50,
      topPercent: 84,
    };
    setEditCtas([...editCtas, newCta]);
    setExpandedCtaId(newId);
  };

  // Drag handler for placement of Call to Action buttons inside video stage
  const handleCtaMouseDown = (e: React.MouseEvent, ctaId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const container = previewContainerRef.current;
    if (!container) return;

    // Toggle active accordion card to this one so the user can easily see options
    setExpandedCtaId(ctaId);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      let left = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      let top = ((moveEvent.clientY - rect.top) / rect.height) * 100;

      // Clamp coordinates to keep inside video preview stage
      left = Math.max(3, Math.min(97, left));
      top = Math.max(3, Math.min(97, top));

      setEditCtas(prev => prev.map(c => c.id === ctaId ? { 
        ...c, 
        leftPercent: Math.round(left), 
        topPercent: Math.round(top),
        position: undefined
      } : c));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handler for custom starting thumbnail upload
  const handleCustomThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCustomThumbnailName(file.name);
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVideo(prev => ({
          ...prev,
          posterUrl: reader.result as string
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handler for custom ending thumbnail upload
  const handleEndingThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEndingThumbnailName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEndingThumbnailUrl(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handler for selecting frame from video for starting thumbnail
  const handleSelectFrame = () => {
    const defaultThumb = video.thumbnailUrls?.[0] || 'https://image.mux.com/VZtzUzGRv02OhRnZCxcNg49sfn3VKg2pQ/thumbnail.jpg?time=5';
    const activeTime = previewVideoRef.current?.currentTime || currentTime || 0;
    const newPoster = getMuxThumbnailAtTime(defaultThumb, activeTime);
    setVideo(prev => ({
      ...prev,
      posterUrl: newPoster
    }));
    alert(`Selected frame at ${formatDuration(activeTime)} as video thumbnail! (Save changes to apply permanently)`);
  };

  // Handler for selecting loop thumbnail
  const handleSelectLoop = () => {
    alert("Loop thumbnail feature activated! The thumbnail will now dynamically preview a short looping section of the video.");
  };

  // Handler to re-generate/reset default thumbnail
  const handleRegenerateDefaultThumbnail = () => {
    const defaultThumb = video.thumbnailUrls?.[0] || 'https://image.mux.com/VZtzUzGRv02OhRnZCxcNg49sfn3VKg2pQ/thumbnail.jpg?time=5';
    setVideo(prev => ({
      ...prev,
      posterUrl: defaultThumb
    }));
    setCustomThumbnailName(null);
    alert("Default video thumbnail restored.");
  };

  // Handler for custom play button icon upload
  const handlePlayButtonIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPlayButtonIconName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditPlayButtonIconUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handler for custom mobile play button icon upload
  const handleMobilePlayButtonIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMobilePlayButtonIconName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditMobilePlayButtonIconUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handler for selecting frame from video for ending thumbnail
  const handleSelectEndingFrame = () => {
    const defaultThumb = video.thumbnailUrls?.[0] || 'https://image.mux.com/VZtzUzGRv02OhRnZCxcNg49sfn3VKg2pQ/thumbnail.jpg?time=5';
    const activeTime = previewVideoRef.current?.currentTime || currentTime || 0;
    const newEnding = getMuxThumbnailAtTime(defaultThumb, activeTime);
    setEndingThumbnailUrl(newEnding);
    alert(`Selected frame at ${formatDuration(activeTime)} as ending thumbnail! (Save changes to apply permanently)`);
  };

  // Handler for Intro Video upload
  const handleIntroVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert("File is too large! Maximum limit is 100MB.");
      return;
    }
    
    setEditIntroVideoName(file.name);
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIntroVideoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    alert(`Successfully loaded intro video: ${file.name}`);
  };

  // Handler for Outro Video upload
  const handleOutroVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert("File is too large! Maximum limit is 100MB.");
      return;
    }
    
    setEditOutroVideoName(file.name);
    
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOutroVideoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    alert(`Successfully loaded outro video: ${file.name}`);
  };

  // Save changes
  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          posterUrl: video.posterUrl,
          settings: {
            ...video.settings,
            autoplay: editAutoplay,
            loop: editLoop,
            muted: editMuted,
            controlsStyle: editControlsStyle,
            primaryColor: editPrimaryColor,
            bgColor: editBgColor,
            privacy: editPrivacy,
            downloadEnabled: editDownloadEnabled,
            ctaEnabled: editCtaEnabled,
            ctaText: editCtas[0]?.text ?? editCtaText,
            ctaUrl: editCtas[0]?.url ?? editCtaUrl,
            ctaStartTime: editCtas[0]?.startTime ?? editCtaStartTime,
            ctaDuration: editCtas[0]?.duration ?? editCtaDuration,
            ctas: editCtas,
            formEnabled: editFormEnabled,
            formTime: editFormTime,
            formTitle: editFormTitle,
            formDescription: editFormDescription,
            formThankYouMessage: editFormThankYouMessage,
            formButtonText: editFormButtonText,
            formButtonColor: editFormButtonColor,
            formButtonTextColor: editFormButtonTextColor,
            formTextColor: editFormTextColor,
            formBgColor: editFormBgColor,
            formAlignment: editFormAlignment,
            formFields: editFormFields,
            notes: editNotes,
            endingThumbnailUrl: endingThumbnailUrl,
            introVideoUrl: introVideoUrl,
            introVideoName: editIntroVideoName,
            outroVideoUrl: outroVideoUrl,
            outroVideoName: editOutroVideoName,
            showWatermark: editShowWatermark,
            clickToPlay: editClickToPlay,
            startInView: editStartInView,
            playInline: editPlayInline,
            bgVideo: editBgVideo,
            playFromStartFullscreen: editPlayFromStartFullscreen,
            playButtonStyle: editPlayButtonStyle,
            playButtonIconUrl: editPlayButtonIconUrl,
            mobilePlayButtonIconUrl: editMobilePlayButtonIconUrl,
            playButtonText: editPlayButtonText,
            showLargePlayButton: editShowLargePlayButton,
            playButtonSize: editPlayButtonSize,
            playButtonBorderWidth: editPlayButtonBorderWidth,
            playButtonBorderColor: editPlayButtonBorderColor,
            playButtonIconScale: editPlayButtonIconScale,
            playButtonBgTransparent: editPlayButtonBgTransparent,
            showPlayPause: editShowPlayPause,
            showProgress: editShowProgress,
            showCurrentTime: editShowCurrentTime,
            showMute: editShowMute,
            showVolume: editShowVolume,
            showSettings: editShowSettings,
            showFullscreen: editShowFullscreen,
            showPlaybackSpeed: editShowPlaybackSpeed,
            showSelectQuality: editShowSelectQuality,
            defaultVolume: editDefaultVolume,
            muteByDefault: editMuteByDefault,
            bgAudioName: bgAudioName,
            bgAudioUrl: editBgAudioUrl,
            bgAudioVolume: editBgAudioVolume,
          }
        })
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to save configuration');

      setVideo(payload.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (err: any) {
      alert(`Save Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete video
  const handleDeleteVideo = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || 'Failed to delete video');
      }

      router.push('/');
      router.refresh();

    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
      setDeleteConfirm(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB] font-sans text-gray-900 selection:bg-orange-500 selection:text-white">
      
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <div onClick={() => router.push('/')} className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-85">
            <span className="font-extrabold text-[15px] tracking-tight">FrameVid</span>
          </div>

          {/* Workspace selector */}
          {workspace && (
            <div className="relative">
              <button
                onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
              >
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{workspace.name}</span>
                <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  {workspace.plan}
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
                      <span className="truncate">{workspace.name}</span>
                      <svg className="h-3.5 w-3.5 text-orange-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={() => router.push('/')} className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900">
                      Back to Library
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-sm shadow-orange-500/10">
            {userInitial}
          </button>
        </div>
      </header>

      {/* BREADCRUMB / ACTION ROW */}
      <section className="flex flex-col justify-between border-b border-gray-200 bg-white px-6 py-4 md:flex-row md:items-center md:px-8">
        <div className="space-y-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
            <span className="cursor-pointer hover:text-orange-500 transition" onClick={() => router.push('/')}>
              {workspace ? workspace.name : 'Workspace'}
            </span>
            <span>&gt;</span>
            <span className="text-gray-500">{video.title}</span>
          </div>

          {/* Title and stats */}
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">{video.title}</h1>
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 mt-1">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><circle cx="12" cy="12" r="3" /></svg>
              0
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              {formatDuration(video.durationSeconds)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v16.5h16.5V3.75H3.75Zm1.5 1.5h13.5v13.5H5.25V5.25Z" /></svg>
              {getResolutionString(video)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2 md:mt-0">
          <button
            onClick={() => alert('Share options coming soon!')}
            className="btn-orange !h-9 flex items-center gap-1.5 px-4 text-xs font-bold rounded-lg shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186.002-.006a2.25 2.25 0 1 0-.002.006Zm0 2.186.002.006a2.25 2.25 0 1 0-.002-.006Zm9.58-4.14a2.25 2.25 0 1 0 0-3.186 2.25 2.25 0 0 0 0 3.186Zm0 6.14a2.25 2.25 0 1 0 0 3.186 2.25 2.25 0 0 0 0-3.186ZM16.5 7.5l-9.3-5.4M16.5 16.5l-9.3 5.4" />
            </svg>
            Share
          </button>
          
          <button
            onClick={handleCopyHls}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
            title={copiedHls ? 'HLS Copied!' : 'Download Stream'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>

          <button
            onClick={handleCopyId}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-gray-300 hover:text-gray-900"
            title="Options"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
            </svg>
          </button>
        </div>
      </section>

      {/* 3-COLUMN ENTERPRISE SPLIT LAYOUT */}
      <div className="flex flex-1 flex-col lg:flex-row lg:h-[calc(100vh-142px)] lg:overflow-hidden">
        
        {/* COLUMN 1: SIDEBAR TABS */}
        <aside className="w-full lg:w-60 flex-shrink-0 border-r border-gray-200 bg-white p-4 lg:p-6 overflow-y-auto">
          <nav className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 block">Settings</span>
            {[
              { id: 'analytics', label: 'Analytics' },
              { id: 'metadata', label: 'Metadata' },
              { id: 'thumbnail', label: 'Thumbnail' },
              { id: 'intro-outro', label: 'Intro / Outro' },
              { id: 'player', label: 'Player' },
              { id: 'controls', label: 'Controls' },
              { id: 'colors', label: 'Colors' },
              { id: 'play-button', label: 'Play button' },
              { id: 'audio', label: 'Audio' },
              { id: 'cta', label: 'Call to action' },
              { id: 'form', label: 'Form' },
              { id: 'subtitles', label: 'Subtitles' },
              { id: 'danger', label: 'Danger Zone' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all ${
                    isActive
                      ? 'bg-gray-200/60 text-gray-900'
                      : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* COLUMN 2: TAB EDIT FORMS */}
        <section className="w-full lg:w-[440px] flex-shrink-0 border-r border-gray-200 bg-white p-6 lg:p-8 overflow-y-auto">
          <div className="space-y-6">
            
            {/* Metadata Tab Form */}
            {activeTab === 'metadata' && (
              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition"
                    placeholder="Enter video title"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Description</label>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition resize-none leading-relaxed"
                    placeholder="Enter video description"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Notes</label>
                  <textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition resize-none leading-relaxed"
                    placeholder="Enter internal notes"
                  />
                  <p className="text-[10px] text-gray-400 font-semibold mt-1.5 leading-relaxed">
                    These are internal notes, not visible to outside users.
                  </p>
                </div>
              </div>
            )}

            {/* Thumbnail Tab Form */}
            {activeTab === 'thumbnail' && (
              <div className="space-y-5">
                {/* Flex row for Select Frame and Select Loop */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSelectFrame}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    Select frame
                  </button>
                  <button
                    onClick={handleSelectLoop}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    Select loop
                  </button>
                </div>

                {/* Re-generate default thumbnail */}
                <button
                  onClick={handleRegenerateDefaultThumbnail}
                  className="w-full bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold py-2.5 px-4 rounded-lg border border-gray-200 shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  Re-generate default thumbnail
                </button>

                {/* Upload custom thumbnail file picker */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 block">Upload custom thumbnail</label>
                  <div className="relative flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:border-gray-300 transition shadow-sm cursor-pointer">
                    <span className="font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded text-[11px] cursor-pointer shadow-sm select-none">
                      Choose File
                    </span>
                    <span className="text-xs text-gray-500 font-medium truncate max-w-[220px]">
                      {customThumbnailName || 'No file chosen'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomThumbnailUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Horizontal divider */}
                <div className="border-t border-gray-150 my-5" />

                {/* Ending Thumbnail Container Box */}
                <div className="space-y-4">
                  {!endingThumbnailUrl ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center flex flex-col items-center justify-center min-h-[160px] shadow-sm select-none">
                      <p className="text-sm font-bold text-gray-900">No ending thumbnail yet.</p>
                      <p className="text-[11px] text-gray-500 font-semibold mt-1">Use tools below to generate or upload one.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 relative group shadow-sm">
                      <div className="aspect-video w-full rounded-lg overflow-hidden bg-gray-50 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={endingThumbnailUrl} alt="Ending Thumbnail" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setEndingThumbnailUrl(null)}
                          className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/85 text-white p-1.5 rounded-lg cursor-pointer transition"
                          title="Remove Ending Thumbnail"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-3 text-center">
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full uppercase tracking-wider">
                          Active Ending Thumbnail
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Select frame (for ending thumbnail) */}
                  <button
                    onClick={handleSelectEndingFrame}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    Select frame
                  </button>

                  {/* Upload thumbnail file picker (for ending thumbnail) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 block">Upload thumbnail file</label>
                    <div className="relative flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:border-gray-300 transition shadow-sm cursor-pointer">
                      <span className="font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded text-[11px] cursor-pointer shadow-sm select-none">
                        Choose File
                      </span>
                      <span className="text-xs text-gray-500 font-medium truncate max-w-[220px]">
                        {endingThumbnailName || 'No file chosen'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEndingThumbnailUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Intro / Outro Tab Form */}
            {activeTab === 'intro-outro' && (
              <div className="space-y-6">
                
                {/* Intro Video Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">Intro Video</h3>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-700 block">Upload Intro Video</label>
                    <p className="text-[11px] text-gray-400 font-semibold leading-relaxed">
                      Upload an MP4 video file (max 100MB)
                    </p>
                    
                    <div className="relative flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:border-gray-300 transition shadow-sm cursor-pointer">
                      <span className="font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded text-[11px] cursor-pointer shadow-sm select-none">
                        Choose File
                      </span>
                      <span className="text-xs text-gray-500 font-medium truncate max-w-[220px]">
                        {editIntroVideoName || 'No file chosen'}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4"
                        onChange={handleIntroVideoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-150 my-4" />

                {/* Outro Video Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">Outro Video</h3>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-gray-700 block">Upload Outro Video</label>
                    <p className="text-[11px] text-gray-400 font-semibold leading-relaxed">
                      Upload an MP4 video file (max 100MB)
                    </p>
                    
                    <div className="relative flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 hover:border-gray-300 transition shadow-sm cursor-pointer">
                      <span className="font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded text-[11px] cursor-pointer shadow-sm select-none">
                        Choose File
                      </span>
                      <span className="text-xs text-gray-500 font-medium truncate max-w-[220px]">
                        {editOutroVideoName || 'No file chosen'}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4"
                        onChange={handleOutroVideoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-150 my-4" />

                {/* Watermark Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Branding watermark</h3>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl border border-gray-150 bg-white shadow-sm">
                    <div>
                      <p className="text-xs font-bold text-gray-900">Show Player Watermark</p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5 leading-relaxed">
                        Displays FrameVid overlay logo in corner.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={editShowWatermark}
                      onChange={(e) => setEditShowWatermark(e.target.checked)}
                      className="accent-orange-500 h-4 w-4 cursor-pointer"
                    />
                  </div>

                  {!isPaidPlan && (
                    <div className="rounded-lg bg-orange-50 border border-orange-100 p-3 flex items-start gap-2">
                      <span className="text-orange-500 text-xs mt-0.5">🔒</span>
                      <div>
                        <p className="text-[10px] font-bold text-orange-800">Locked on Free Tier (Unlocked for testing)</p>
                        <p className="text-[9px] text-orange-600 font-semibold mt-0.5 leading-relaxed">
                          Normally locked on the free tier, this setting has been unlocked for local testing. You can check or uncheck it to test watermark removal.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Player Tab Form */}
            {activeTab === 'player' && (
              <div className="space-y-4">
                
                {/* Autoplay */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditAutoplay(!editAutoplay)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editAutoplay ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editAutoplay ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Autoplay</span>
                  </div>
                </div>

                {/* Muted */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditMuted(!editMuted)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editMuted ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editMuted ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Muted</span>
                  </div>
                </div>

                {/* Loop */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditLoop(!editLoop)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editLoop ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editLoop ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Loop</span>
                  </div>
                </div>

                {/* Click to play */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditClickToPlay(!editClickToPlay)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editClickToPlay ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editClickToPlay ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Click to play</span>
                  </div>
                </div>

                {/* Start playing when in view */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditStartInView(!editStartInView)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editStartInView ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editStartInView ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Start playing when in view</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded shadow-sm">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Play inline */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditPlayInline(!editPlayInline)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editPlayInline ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editPlayInline ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Play inline</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded shadow-sm">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Used as a background video */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditBgVideo(!editBgVideo)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editBgVideo ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editBgVideo ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Used as a background video</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded shadow-sm">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Play from start when fullscreen */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditPlayFromStartFullscreen(!editPlayFromStartFullscreen)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editPlayFromStartFullscreen ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editPlayFromStartFullscreen ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Play from start when fullscreen</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded shadow-sm">
                    Upgrade to unlock
                  </span>
                </div>

              </div>
            )}

            {/* Controls Tab Form */}
            {activeTab === 'controls' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Visibility Mode</label>
                  <select
                    value={editControlsStyle}
                    onChange={(e: any) => setEditControlsStyle(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 shadow-sm"
                  >
                    <option value="show">Always Render Native Controls</option>
                    <option value="on-hover">Show Control Bars only on Hover</option>
                    <option value="hide">Hide Controls Completely</option>
                  </select>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-150 my-3" />

                {/* Large play button */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowLargePlayButton(!editShowLargePlayButton)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowLargePlayButton ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowLargePlayButton ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Large play button</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Play/pause */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowPlayPause(!editShowPlayPause)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowPlayPause ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowPlayPause ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Play/pause</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowProgress(!editShowProgress)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowProgress ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowProgress ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Progress</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Current time */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowCurrentTime(!editShowCurrentTime)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowCurrentTime ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowCurrentTime ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Current time</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Mute */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowMute(!editShowMute)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowMute ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowMute ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Mute</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowVolume(!editShowVolume)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowVolume ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowVolume ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Volume</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Settings */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowSettings(!editShowSettings)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowSettings ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowSettings ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Settings</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Fullscreen */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowFullscreen(!editShowFullscreen)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowFullscreen ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowFullscreen ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Fullscreen</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Playback speed */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowPlaybackSpeed(!editShowPlaybackSpeed)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowPlaybackSpeed ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowPlaybackSpeed ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Playback speed</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

                {/* Select quality */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowSelectQuality(!editShowSelectQuality)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowSelectQuality ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowSelectQuality ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Select quality</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

              </div>
            )}

            {/* Colors Tab Form */}
            {activeTab === 'colors' && (
              <div className="space-y-6">
                
                {/* Primary color */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Primary color</span>
                    <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                      Upgrade to unlock
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 w-full focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/5 transition shadow-sm">
                    {/* Color preview box (clickable) */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer shadow-inner">
                      <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: editPrimaryColor }} />
                      <input
                        type="color"
                        value={editPrimaryColor}
                        onChange={(e) => setEditPrimaryColor(e.target.value)}
                        className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      value={editPrimaryColor.toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('#') && val.length <= 7) {
                          setEditPrimaryColor(val);
                        }
                      }}
                      className="flex-1 text-sm font-semibold text-gray-400 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Background color */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Background color</span>
                    <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                      Upgrade to unlock
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 w-full focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/5 transition shadow-sm">
                    {/* Color preview box (clickable) */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer shadow-inner">
                      <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: editBgColor }} />
                      <input
                        type="color"
                        value={editBgColor}
                        onChange={(e) => setEditBgColor(e.target.value)}
                        className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      value={editBgColor.toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('#') && val.length <= 7) {
                          setEditBgColor(val);
                        }
                      }}
                      className="flex-1 text-sm font-semibold text-gray-400 outline-none bg-transparent"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* Play Button tab */}
            {activeTab === 'play-button' && (
              <div className="space-y-6">
                
                {/* Play button */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Play button</span>
                    <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                      Upgrade to unlock
                    </span>
                  </div>
                  <div className="relative flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-500 hover:border-gray-300 focus-within:border-orange-500 transition shadow-sm cursor-pointer">
                    <span className="font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer shadow-sm select-none">
                      Choose File
                    </span>
                    <span className="text-xs text-gray-400 font-medium truncate max-w-[220px]">
                      {playButtonIconName || 'No file chosen'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePlayButtonIconUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Mobile play button */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Mobile play button</span>
                    <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                      Upgrade to unlock
                    </span>
                  </div>
                  <div className="relative flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-500 hover:border-gray-300 focus-within:border-orange-500 transition shadow-sm cursor-pointer">
                    <span className="font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer shadow-sm select-none">
                      Choose File
                    </span>
                    <span className="text-xs text-gray-400 font-medium truncate max-w-[220px]">
                      {mobilePlayButtonIconName || 'No file chosen'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMobilePlayButtonIconUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Play button text */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Play button text</span>
                    <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                      Upgrade to unlock
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editPlayButtonText}
                    onChange={(e) => setEditPlayButtonText(e.target.value)}
                    placeholder="Play now"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 placeholder:text-gray-350 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition shadow-sm"
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-gray-150 my-4" />

                {/* Shape Style */}
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-gray-500 block">Button Shape Style</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['circle', 'square', 'rounded'].map((type) => {
                      const isActive = editPlayButtonStyle === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setEditPlayButtonStyle(type as any)}
                          className={`p-2.5 rounded-lg border text-[11px] font-bold capitalize transition-all duration-200 ${
                            isActive
                              ? 'border-orange-500 bg-orange-50/40 text-orange-600 shadow-sm ring-2 ring-orange-500/10'
                              : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300'
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-150 my-4" />

                {/* Custom Play Button Appearance Settings */}
                <div className="space-y-4 rounded-xl border border-gray-150 bg-gray-50/50 p-4 shadow-sm">
                  <div className="flex items-center justify-between select-none">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Play Button Appearance</span>
                    <span className="text-[9px] font-extrabold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                      Style Controls
                    </span>
                  </div>

                  {/* Button Size */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold select-none">
                      <span className="text-gray-500">Button Size</span>
                      <span className="text-gray-900 font-mono font-bold">{editPlayButtonSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={160}
                      value={editPlayButtonSize}
                      onChange={(e) => setEditPlayButtonSize(parseInt(e.target.value))}
                      className="w-full accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                    />
                  </div>

                  {/* Icon Scale */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold select-none">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Icon / Logo Scale</span>
                        {editPlayButtonIconUrl && (
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold">Custom Image</span>
                        )}
                      </div>
                      <span className="text-gray-900 font-mono font-bold">{editPlayButtonIconScale}%</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={editPlayButtonIconScale}
                      onChange={(e) => setEditPlayButtonIconScale(parseInt(e.target.value))}
                      className="w-full accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                    />
                  </div>

                  {/* Background Opacity / Transparency */}
                  <div className="flex items-center justify-between py-1 select-none">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-gray-500 block">Transparent Background</span>
                      <span className="text-[10px] text-gray-400 block font-medium leading-tight">Remove solid color behind playbutton</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditPlayButtonBgTransparent(!editPlayButtonBgTransparent)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        editPlayButtonBgTransparent ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          editPlayButtonBgTransparent ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Border Width */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold select-none">
                      <span className="text-gray-500">Border Width</span>
                      <span className="text-gray-900 font-mono font-bold">{editPlayButtonBorderWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      value={editPlayButtonBorderWidth}
                      onChange={(e) => setEditPlayButtonBorderWidth(parseInt(e.target.value))}
                      className="w-full accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                    />
                  </div>

                  {/* Border Color */}
                  {editPlayButtonBorderWidth > 0 && (
                    <div className="space-y-2 animate-fade-in">
                      <span className="text-xs font-semibold text-gray-500 block select-none">Border Color</span>
                      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 w-full focus-within:border-orange-500 transition shadow-sm">
                        <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer shadow-inner">
                          <div className="absolute inset-0" style={{ backgroundColor: editPlayButtonBorderColor }} />
                          <input
                            type="color"
                            value={editPlayButtonBorderColor}
                            onChange={(e) => setEditPlayButtonBorderColor(e.target.value)}
                            className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                          />
                        </div>
                        <input
                          type="text"
                          value={editPlayButtonBorderColor.toUpperCase()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith('#') && val.length <= 7) {
                              setEditPlayButtonBorderColor(val);
                            }
                          }}
                          className="flex-1 text-xs font-semibold text-gray-700 outline-none bg-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Audio tab */}
            {activeTab === 'audio' && (
              <div className="space-y-6">
                
                {/* Default Volume */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Default volume</span>
                    <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                      Upgrade to unlock
                    </span>
                  </div>
                  <div className="flex items-center gap-4 bg-white p-1 select-none">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={editDefaultVolume}
                      onChange={(e) => setEditDefaultVolume(parseInt(e.target.value))}
                      className="flex-1 accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                    />
                    <span className="text-xs font-mono font-bold text-gray-500 w-10 text-right">
                      {editDefaultVolume}%
                    </span>
                  </div>
                </div>

                {/* Mute by default */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditMuteByDefault(!editMuteByDefault)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editMuteByDefault ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editMuteByDefault ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Mute by default</span>
                </div>

                {/* Background audio */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Background audio</span>
                    <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                      Upgrade to unlock
                    </span>
                  </div>
                  <div className="relative flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-500 hover:border-gray-300 focus-within:border-orange-500 transition shadow-sm cursor-pointer">
                    <span className="font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer shadow-sm select-none">
                      Choose File
                    </span>
                    <span className="text-xs text-gray-400 font-medium truncate max-w-[200px]">
                      {bgAudioName || 'No file chosen'}
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBgAudioName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setEditBgAudioUrl(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                        alert(`Successfully loaded background audio: ${file.name}`);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Background audio volume slider */}
                {editBgAudioUrl && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between select-none">
                      <span className="text-xs font-semibold text-gray-500">Background audio volume</span>
                      <button 
                        onClick={() => {
                          setBgAudioName(null);
                          setEditBgAudioUrl(null);
                        }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 transition"
                      >
                        Remove audio
                      </button>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-1 select-none">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={editBgAudioVolume}
                        onChange={(e) => setEditBgAudioVolume(parseInt(e.target.value))}
                        className="flex-1 accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                      />
                      <span className="text-xs font-mono font-bold text-gray-500 w-10 text-right">
                        {editBgAudioVolume}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Audio normalization */}
                <div className="flex items-center gap-3 py-1.5 select-none opacity-80">
                  <button
                    type="button"
                    disabled
                    className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-gray-150"
                  >
                    <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 translate-x-0" />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Audio normalization</span>
                  <span className="text-[10px] font-bold text-gray-700 bg-[#EEF2F6] px-2.5 py-0.5 rounded-full select-none">
                    Upgrade to unlock
                  </span>
                </div>

              </div>
            )}

            {/* Call to action tab */}
            {activeTab === 'cta' && (
              <div className="space-y-6">
                
                {/* CTA Toggle */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditCtaEnabled(!editCtaEnabled)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editCtaEnabled ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editCtaEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Show Call to Action Buttons</span>
                </div>

                {editCtaEnabled && (
                  <div className="space-y-6 pt-2">
                    
                    {editCtas.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                        <p className="text-xs text-gray-400 font-semibold">No CTA buttons added yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {editCtas.map((cta, index) => {
                          const isExpanded = expandedCtaId === cta.id;
                          return (
                            <div
                              key={cta.id}
                              className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-sm bg-white ${
                                isExpanded 
                                  ? 'border-orange-500 ring-2 ring-orange-500/5' 
                                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!isExpanded) {
                                  setExpandedCtaId(cta.id);
                                }
                              }}
                            >
                              {/* Summary Header (always visible, triggers toggle) */}
                              <div className="flex items-center justify-between p-3.5 select-none bg-gray-50/40 hover:bg-gray-50/80 transition-colors">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                                      CTA #{index + 1}
                                    </span>
                                    {cta.text && (
                                      <span className="text-xs font-bold text-gray-800 truncate max-w-[140px]">
                                        “{cta.text}”
                                      </span>
                                    )}
                                  </div>
                                  {!isExpanded && (
                                    <div className="flex items-center gap-2.5 text-[10px] font-semibold text-gray-400 truncate max-w-[220px] mt-0.5">
                                      <span className="truncate">Link: {cta.url || 'No URL'}</span>
                                      <span className="h-1 w-1 rounded-full bg-gray-300 flex-shrink-0" />
                                      <span>Time: {cta.startTime}s - {cta.duration}s</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Avoid triggering expand toggle
                                      setEditCtas(editCtas.filter(c => c.id !== cta.id));
                                      if (isExpanded) {
                                        setExpandedCtaId(null);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 transition uppercase tracking-wider p-1 rounded hover:bg-red-50/50"
                                    title="Delete CTA Button"
                                  >
                                    Delete
                                  </button>
                                  <svg
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-orange-500' : 'rotate-0'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                  </svg>
                                </div>
                              </div>

                              {/* Expanded Form Inputs (only rendered when expanded) */}
                              {isExpanded && (
                                <div className="p-4 pt-2 border-t border-gray-100 bg-white space-y-4 animate-in slide-in-from-top-1 duration-200">
                                  {/* CTA Text */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 block uppercase">Button Text</label>
                                    <input
                                      type="text"
                                      value={cta.text}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, text: val } : c));
                                      }}
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 transition shadow-inner bg-gray-50/50 focus:bg-white"
                                      placeholder="e.g. Learn More"
                                    />
                                  </div>

                                  {/* CTA URL */}
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 block uppercase">Button Link (URL)</label>
                                    <input
                                      type="url"
                                      value={cta.url}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, url: val } : c));
                                      }}
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 transition shadow-inner bg-gray-50/50 focus:bg-white"
                                      placeholder="e.g. https://example.com"
                                    />
                                  </div>

                                  {/* Start Time & Duration */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Start (s)</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={duration || 1000}
                                        value={cta.startTime}
                                        onChange={(e) => {
                                          const val = Math.max(0, parseInt(e.target.value) || 0);
                                          setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, startTime: val } : c));
                                        }}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 transition shadow-inner bg-gray-50/50 focus:bg-white"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Duration (s)</label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={cta.duration}
                                        onChange={(e) => {
                                          const val = Math.max(1, parseInt(e.target.value) || 1);
                                          setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, duration: val } : c));
                                        }}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 transition shadow-inner bg-gray-50/50 focus:bg-white"
                                      />
                                    </div>
                                  </div>

                                  {/* Divider */}
                                  <div className="border-t border-gray-100 my-1" />

                                  {/* Background & Text Colors */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Background Color</label>
                                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-orange-500 transition shadow-inner">
                                        <div className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer">
                                          <div className="absolute inset-0" style={{ backgroundColor: cta.bgColor || editPrimaryColor || '#F97316' }} />
                                          <input
                                            type="color"
                                            value={cta.bgColor || editPrimaryColor || '#F97316'}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, bgColor: val } : c));
                                            }}
                                            className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                                          />
                                        </div>
                                        <input
                                          type="text"
                                          value={(cta.bgColor || editPrimaryColor || '#F97316').toUpperCase()}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val.startsWith('#') && val.length <= 7) {
                                              setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, bgColor: val } : c));
                                            }
                                          }}
                                          className="flex-1 text-[11px] font-semibold text-gray-700 outline-none bg-transparent"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Text Color</label>
                                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-orange-500 transition shadow-inner">
                                        <div className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer">
                                          <div className="absolute inset-0" style={{ backgroundColor: cta.textColor || '#ffffff' }} />
                                          <input
                                            type="color"
                                            value={cta.textColor || '#ffffff'}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, textColor: val } : c));
                                            }}
                                            className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                                          />
                                        </div>
                                        <input
                                          type="text"
                                          value={(cta.textColor || '#ffffff').toUpperCase()}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val.startsWith('#') && val.length <= 7) {
                                              setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, textColor: val } : c));
                                            }
                                          }}
                                          className="flex-1 text-[11px] font-semibold text-gray-700 outline-none bg-transparent"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Position Overlay Sliders (Always visible and unlocked) */}
                                  <div className="space-y-3 bg-orange-50/20 border border-orange-500/10 rounded-xl p-3.5 animate-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center justify-between select-none">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Button Position</span>
                                      <span className="text-[9px] font-extrabold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 uppercase tracking-wider">
                                        Direct Drag Enabled
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase select-none">
                                          <span>Horizontal (X)</span>
                                          <span className="font-mono text-orange-600 font-bold">{cta.leftPercent ?? 50}%</span>
                                        </div>
                                        <input
                                          type="range"
                                          min={2}
                                          max={98}
                                          value={cta.leftPercent ?? 50}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, leftPercent: val, position: undefined } : c));
                                          }}
                                          className="w-full accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase select-none">
                                          <span>Vertical (Y)</span>
                                          <span className="font-mono text-orange-600 font-bold">{cta.topPercent ?? 84}%</span>
                                        </div>
                                        <input
                                          type="range"
                                          min={2}
                                          max={98}
                                          value={cta.topPercent ?? 84}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, topPercent: val, position: undefined } : c));
                                          }}
                                          className="w-full accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                                        />
                                      </div>
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-semibold leading-normal select-none">
                                      Tip: You can also click and drag the button directly on the video player above to reposition it.
                                    </p>
                                  </div>

                                  {/* Border Radius (Roundness) & Border Width */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase select-none">
                                        <span>Roundness</span>
                                        <span className="font-mono text-gray-900 font-bold">{cta.borderRadius ?? 30}px</span>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={30}
                                        value={cta.borderRadius ?? 30}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value);
                                          setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, borderRadius: val } : c));
                                        }}
                                        className="w-full accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase select-none">
                                        <span>Border Width</span>
                                        <span className="font-mono text-gray-900 font-bold">{cta.borderWidth ?? 0}px</span>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={8}
                                        value={cta.borderWidth ?? 0}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value);
                                          setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, borderWidth: val } : c));
                                        }}
                                        className="w-full accent-orange-500 h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                                      />
                                    </div>
                                  </div>

                                  {/* Border Color (only if Border Width > 0) */}
                                  {(cta.borderWidth ?? 0) > 0 && (
                                    <div className="space-y-1.5 animate-in fade-in duration-200">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Border Color</label>
                                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-orange-500 transition shadow-inner">
                                        <div className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer">
                                          <div className="absolute inset-0" style={{ backgroundColor: cta.borderColor || '#ffffff' }} />
                                          <input
                                            type="color"
                                            value={cta.borderColor || '#ffffff'}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, borderColor: val } : c));
                                            }}
                                            className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                                          />
                                        </div>
                                        <input
                                          type="text"
                                          value={(cta.borderColor || '#ffffff').toUpperCase()}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val.startsWith('#') && val.length <= 7) {
                                              setEditCtas(editCtas.map(c => c.id === cta.id ? { ...c, borderColor: val } : c));
                                            }
                                          }}
                                          className="flex-1 text-[11px] font-semibold text-gray-700 outline-none bg-transparent"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddCta}
                      className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-orange-500 text-xs font-bold text-gray-500 hover:text-orange-500 bg-white hover:bg-orange-50/10 transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add CTA Button
                    </button>

                  </div>
                )}

              </div>
            )}

            {/* Form tab */}
            {activeTab === 'form' && (
              <div className="space-y-6">
                
                {/* Form Toggle */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditFormEnabled(!editFormEnabled)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editFormEnabled ? 'bg-[#9C99EC]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editFormEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-400">Gate video with subscription form</span>
                </div>

                {editFormEnabled && (
                  <div className="space-y-4 pt-2">
                    
                    {/* Gating time */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-500 block">Gating trigger point</label>
                      <select
                        value={editFormTime}
                        onChange={(e: any) => setEditFormTime(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 shadow-sm"
                      >
                        <option value="pre-roll">Pre-roll (Before video starts)</option>
                        <option value="post-roll">Post-roll (When video finishes)</option>
                      </select>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-500 block">Form title</label>
                      <input
                        type="text"
                        value={editFormTitle}
                        onChange={(e) => setEditFormTitle(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition shadow-sm"
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-500 block">Form description</label>
                      <input
                        type="text"
                        value={editFormDescription}
                        onChange={(e) => setEditFormDescription(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition shadow-sm"
                      />
                    </div>

                    {/* Button text */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-500 block">Submit button text</label>
                      <input
                        type="text"
                        value={editFormButtonText}
                        onChange={(e) => setEditFormButtonText(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition shadow-sm"
                      />
                    </div>

                    {/* Thank you message */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-gray-500 block">Success message</label>
                      <input
                        type="text"
                        value={editFormThankYouMessage}
                        onChange={(e) => setEditFormThankYouMessage(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/5 transition shadow-sm"
                      />
                    </div>

                  </div>
                )}

              </div>
            )}



            {/* Subtitles tab */}
            {activeTab === 'subtitles' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Closed Captions</h3>
                
                <div onClick={() => alert('WebVTT subtitle uploading coming soon!')} className="rounded-lg border-2 border-dashed border-gray-200 hover:border-orange-300 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition">
                  <svg className="h-6 w-6 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /></svg>
                  <span className="text-xs font-bold text-gray-900">Upload .vtt Captions File</span>
                  <span className="text-[10px] text-gray-400 font-semibold mt-1">UTF-8 WebVTT formats supported.</span>
                </div>
              </div>
            )}

            {/* Danger Zone tab */}
            {activeTab === 'danger' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Danger Zone</h3>
                <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                  This action is permanent and non-reversible. Deleting this asset will purge all manifest files from storage and clean up DB records completely.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleDeleteVideo}
                    className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold tracking-wide transition border ${
                      deleteConfirm
                        ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 animate-bounce'
                        : 'bg-transparent text-red-500 border-red-200 hover:bg-red-55'
                    }`}
                  >
                    {deleteConfirm ? 'Confirm Video Deletion' : 'Delete Video Asset'}
                  </button>
                  {deleteConfirm && (
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="w-full text-center text-[10px] text-gray-400 hover:text-gray-600 font-bold underline mt-2 block"
                    >
                      Cancel Deletion
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Tab (already imported and rendered) */}
            {activeTab === 'analytics' && (
              <div className="pt-2 border-t border-gray-200">
                <VideoAnalytics videoId={video.id} />
              </div>
            )}

            {/* SAVE BUTTON FOR CONFIG FORM */}
            {activeTab !== 'analytics' && activeTab !== 'danger' && (
              <div className="pt-4 border-t border-gray-150">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="btn-orange w-full !h-10 text-xs font-bold tracking-wider shadow"
                >
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : saveSuccess ? (
                    'Changes Saved Successfully!'
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            )}

          </div>
        </section>

        {/* COLUMN 3: LIVE PREVIEW PLAYER */}
        <section className="flex-1 flex flex-col bg-[#F3F4F6] p-6 lg:p-10 justify-center items-center lg:h-full lg:overflow-y-auto">
          
          {/* Header row overlay inside section */}
          <div className="w-full max-w-4xl flex justify-between items-center mb-6">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Preview
            </span>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  previewContainerRef.current?.requestFullscreen().catch(err => console.error(err));
                } else {
                  document.exitFullscreen();
                }
              }}
              className="text-gray-400 hover:text-gray-900 transition p-1.5 rounded-lg hover:bg-gray-200"
              aria-label="Toggle Fullscreen"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0-6-6" /></svg>
            </button>
          </div>

          {/* Interactive Player Container */}
          <div className="w-full flex justify-center items-center flex-1">
            <div
              ref={previewContainerRef}
              id={`player-${video.id}`}
              style={{
                aspectRatio: aspectRatio ? `${aspectRatio}` : (isVerticalVideo ? '9/16' : '16/9'),
                height: (aspectRatio && aspectRatio < 1) || (!aspectRatio && isVerticalVideo) ? '520px' : 'auto',
                width: (aspectRatio && aspectRatio < 1) || (!aspectRatio && isVerticalVideo) ? 'auto' : '100%',
                maxWidth: (aspectRatio && aspectRatio < 1) || (!aspectRatio && isVerticalVideo) ? '292px' : '768px',
                backgroundColor: editBgColor
              }}
              className="overflow-hidden relative shadow-2xl transition-all duration-300 ring-1 ring-black/5 rounded-xl border border-gray-200 group"
            >
              <style dangerouslySetInnerHTML={{ __html: `
                #player-${video.id} .hover-primary:hover {
                  color: ${editPrimaryColor} !important;
                }
                #player-${video.id} .hover-primary-border:hover {
                  color: ${editPrimaryColor} !important;
                  border-color: ${editPrimaryColor} !important;
                }
              ` }} />
              {video.status === 'ready' ? (
                <>
                  <video
                    ref={previewVideoRef}
                    autoPlay={editAutoplay || editBgVideo}
                    loop={editLoop || editBgVideo}
                    muted={editMuteByDefault || editMuted || editAutoplay || editBgVideo}
                    controls={false}
                    playsInline={editPlayInline || editBgVideo}
                    poster={thumbnailFor(video)}
                    onTimeUpdate={(e) => {
                      handlePreviewTimeUpdate(e);
                      setCurrentTime(e.currentTarget.currentTime);
                    }}
                    onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={handlePreviewEnded}
                    onLoadedMetadata={handleLoadedMetadata}
                    onClick={togglePlay}
                    className={`w-full h-full object-cover ${editClickToPlay ? 'cursor-pointer' : 'cursor-default'}`}
                  />

                  {/* Custom Poster Image Overlay */}
                  {(!isPlaying && currentTime === 0 && thumbnailFor(video)) && (
                    <img 
                      src={thumbnailFor(video)} 
                      className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" 
                      alt="Video Poster"
                    />
                  )}

                  {/* Hidden Background Audio element */}
                  {editBgAudioUrl && (
                    <audio
                      ref={bgAudioRef}
                      src={editBgAudioUrl}
                      loop
                    />
                  )}

                  {/* Central Large Play Button Overlay */}
                  {editShowLargePlayButton && editControlsStyle !== 'hide' && !editBgVideo && !isPlaying && !previewFormVisible && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-black/10 cursor-pointer transition-all duration-300"
                    >
                      <button
                        style={{
                          backgroundColor: editPlayButtonBgTransparent ? 'transparent' : editPrimaryColor,
                          width: editPlayButtonText ? undefined : `${editPlayButtonSize}px`,
                          height: editPlayButtonText ? undefined : `${editPlayButtonSize}px`,
                          borderWidth: `${editPlayButtonBorderWidth}px`,
                          borderColor: editPlayButtonBorderColor,
                          borderStyle: editPlayButtonBorderWidth > 0 ? 'solid' : 'none',
                          borderRadius: editPlayButtonText 
                            ? '9999px' 
                            : editPlayButtonStyle === 'circle' 
                            ? '9999px' 
                            : editPlayButtonStyle === 'rounded' 
                            ? '12px' 
                            : '0px',
                        }}
                        className={`text-white flex items-center justify-center gap-2.5 shadow-2xl transition-all duration-300 hover:scale-110 ${
                          editPlayButtonText ? 'px-6 py-3 text-xs font-extrabold uppercase tracking-wider' : ''
                        }`}
                        title="Play video"
                      >
                        {editPlayButtonIconUrl ? (
                          <img 
                            src={editPlayButtonIconUrl} 
                            style={{
                              width: `${Math.round(editPlayButtonSize * (editPlayButtonIconScale / 100))}px`,
                              height: `${Math.round(editPlayButtonSize * (editPlayButtonIconScale / 100))}px`
                            }}
                            className="object-contain" 
                            alt="Play Icon" 
                          />
                        ) : (
                          <svg 
                            style={{
                              width: editPlayButtonText ? '16px' : `${Math.round(editPlayButtonSize * (editPlayButtonIconScale / 100))}px`,
                              height: editPlayButtonText ? '16px' : `${Math.round(editPlayButtonSize * (editPlayButtonIconScale / 100))}px`
                            }}
                            className={editPlayButtonText ? "fill-current translate-x-[0.5px]" : "fill-current translate-x-[2px]"} 
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                        {editPlayButtonText && <span>{editPlayButtonText}</span>}
                      </button>
                    </div>
                  )}

                  {/* Watermark Logo Overlay */}
                  {shouldShowWatermark && (
                    <div className="absolute top-4 left-4 z-10 select-none flex items-center gap-1 opacity-70">
                      <span className="font-extrabold text-sm text-white tracking-tight drop-shadow-sm">FrameVid</span>
                    </div>
                  )}

                  {/* Custom control bar */}
                  {editControlsStyle !== 'hide' && !editBgVideo && (
                    <div className="absolute bottom-3 left-3 right-3 z-25 bg-black/75 backdrop-blur-sm rounded-lg p-2.5 flex flex-col gap-2 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {/* Scrubber */}
                      {editShowProgress && (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleScrub}
                            style={{ accentColor: editPrimaryColor }}
                            className="w-full h-1 rounded-full cursor-pointer appearance-none bg-white/20"
                          />
                        </div>
                      )}
                      
                      {/* Play, time, buttons */}
                      <div className="flex items-center justify-between text-xs text-white">
                        <div className="flex items-center gap-3">
                          {editShowPlayPause && (
                            <button onClick={togglePlay} className="hover-primary transition focus:outline-none">
                              {isPlaying ? (
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                              ) : (
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              )}
                            </button>
                          )}
                          
                          {editShowCurrentTime && (
                            <span className="font-mono text-[10px] opacity-80">
                              {formatDuration(currentTime)} / {formatDuration(duration)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          {editShowMute && (
                            <button
                              onClick={() => {
                                if (previewVideoRef.current) {
                                  previewVideoRef.current.muted = !previewVideoRef.current.muted;
                                  setEditMuted(!editMuted);
                                }
                              }}
                              className="hover-primary transition focus:outline-none"
                            >
                              {editMuted ? (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                              )}
                            </button>
                          )}

                          {editShowVolume && (
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              defaultValue={1}
                              onChange={(e) => {
                                if (previewVideoRef.current) {
                                  previewVideoRef.current.volume = parseFloat(e.target.value);
                                  previewVideoRef.current.muted = false;
                                  setEditMuted(false);
                                }
                              }}
                              style={{ accentColor: editPrimaryColor }}
                              className="w-12 h-1 rounded-full cursor-pointer appearance-none bg-white/20 hover:bg-white/30 transition-colors"
                            />
                          )}

                          {editShowPlaybackSpeed && (
                            <button onClick={() => alert('Speed configurations: 0.5x, 1x, 1.5x, 2x')} className="hover-primary-border font-bold font-mono text-[9px] border border-white/20 rounded px-1 py-0.5 transition focus:outline-none">
                              1.0x
                            </button>
                          )}

                          {editShowSelectQuality && (
                            <button onClick={() => alert('Resolution selections: 1080p, 720p, 360p')} className="hover-primary-border font-bold font-mono text-[9px] border border-white/20 rounded px-1 py-0.5 transition focus:outline-none">
                              HD
                            </button>
                          )}

                          {editShowSettings && (
                            <button onClick={() => alert('Settings gear coming soon!')} className="hover-primary transition focus:outline-none">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}

                          {editShowFullscreen && (
                            <button
                              onClick={() => {
                                if (!document.fullscreenElement) {
                                  previewContainerRef.current?.requestFullscreen().catch(err => console.error(err));
                                } else {
                                  document.exitFullscreen();
                                }
                              }}
                              className="hover-primary transition focus:outline-none"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0-6-6" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Preview Form Overlay (Gating) */}
                  {previewFormVisible && editFormEnabled && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
                      <div className="animate-in zoom-in-95 duration-200 p-6 rounded-xl w-full max-w-[270px] shadow-2xl" style={{ backgroundColor: editFormBgColor || '#ffffff', textAlign: editFormAlignment || 'center' }}>
                        {showThankYou ? (
                          <div className="py-6 text-center" style={{ color: editFormTextColor || '#000000' }}>
                            <svg className="h-10 w-10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ color: editFormButtonColor }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            <h3 className="text-sm font-bold">{editFormThankYouMessage || 'Thank you!'}</h3>
                          </div>
                        ) : (
                          <form onSubmit={handlePreviewFormSubmit} className="flex flex-col gap-3">
                            <h3 className="text-sm font-extrabold" style={{ color: editFormTextColor }}>{editFormTitle || 'Unlock this video'}</h3>
                            <p className="text-[10px] opacity-75 font-semibold" style={{ color: editFormTextColor }}>{editFormDescription}</p>
                            
                            <div className="flex flex-col gap-2 my-1">
                              {editFormFields.map(f => (
                                <input
                                  key={f.id}
                                  type={f.type}
                                  placeholder={f.name}
                                  readOnly
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px] outline-none shadow-inner"
                                  style={{ color: editFormTextColor }}
                                />
                              ))}
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 rounded-lg text-[11px] font-bold shadow"
                              style={{ backgroundColor: editFormButtonColor, color: editFormButtonTextColor }}
                            >
                              {editFormButtonText}
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Live Preview CTA Overlay */}
                  {editCtaEnabled && editCtas.filter(cta => currentTime >= cta.startTime && currentTime <= (cta.startTime + cta.duration)).map(cta => {
                    let left = cta.leftPercent;
                    let top = cta.topPercent;

                    // Fallback for legacy DB entries that only have cta.position set
                    if (left === undefined || top === undefined) {
                      const pos = cta.position || 'bottom-center';
                      if (pos === 'top-center') { left = 50; top = 16; }
                      else if (pos === 'bottom-left') { left = 12; top = 84; }
                      else if (pos === 'bottom-right') { left = 88; top = 84; }
                      else if (pos === 'top-left') { left = 12; top = 16; }
                      else if (pos === 'top-right') { left = 88; top = 16; }
                      else if (pos === 'center-center') { left = 50; top = 50; }
                      else { left = 50; top = 84; } // bottom-center
                    }

                    return (
                      <div 
                        key={cta.id} 
                        onMouseDown={(e) => handleCtaMouseDown(e, cta.id)}
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="absolute z-20 cursor-move select-none active:scale-95 transition-all duration-100"
                        title="Drag button to place anywhere on video"
                      >
                        <a
                          href={cta.url ? (cta.url.startsWith('http://') || cta.url.startsWith('https://') ? cta.url : `https://${cta.url}`) : '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.preventDefault()} // Prevent navigation while preview editing
                          style={{ 
                            backgroundColor: cta.bgColor || editPrimaryColor || '#F97316', 
                            color: cta.textColor || '#ffffff',
                            borderRadius: `${cta.borderRadius ?? 30}px`,
                            borderWidth: `${cta.borderWidth ?? 0}px`,
                            borderColor: cta.borderColor || '#ffffff',
                            borderStyle: (cta.borderWidth ?? 0) > 0 ? 'solid' : 'none',
                            pointerEvents: 'none' // Let container capture drag events
                          }}
                          className="px-5 py-2.5 font-extrabold text-[11px] shadow-xl tracking-wider uppercase inline-block text-center whitespace-nowrap"
                        >
                          {cta.text}
                        </a>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center flex flex-col items-center justify-center h-full space-y-4">
                  <div className="w-10 h-10 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generating Stream...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </section>

      </div>

    </div>
  );
}
