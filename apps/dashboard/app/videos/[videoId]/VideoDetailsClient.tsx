'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Video } from '@framevid/types';

const VideoAnalytics = dynamic(() => import('./VideoAnalytics'), {
  ssr: false,
  loading: () => (
    <div className="py-8 text-center text-[11px] font-medium text-[hsl(var(--muted))]">
      Loading analytics…
    </div>
  ),
});
const VideoLeads = dynamic(() => import('./VideoLeads'), {
  ssr: false,
  loading: () => (
    <div className="py-8 text-center text-[11px] font-medium text-[hsl(var(--muted))]">
      Loading leads…
    </div>
  ),
});
import { Logo } from '@/components/brand/Logo';
import { ProfileMenu } from '@/components/dashboard/ProfileMenu';
import {
  captureVideoFrame,
  captureVideoFrameViaImageCapture,
} from '../../lib/capture-video-frame';
import { resolveMediaUrl } from '../../lib/asset-url';
import { useNotifications } from '@/components/notifications/NotificationProvider';
import { CustomVideoPlayer } from '@/components/player/CustomVideoPlayer';
import { ShareModal } from '@/components/ShareModal';

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
  | 'player'
  | 'controls'
  | 'colors'
  | 'play-button'
  | 'cta'
  | 'form'
  | 'leads'
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
  const isVertical = video?.title?.toLowerCase()?.startsWith('img_') || video?.originalFilename?.toLowerCase()?.startsWith('img_');
  return isVertical ? '2160×3840' : '1920×1080';
}

function thumbnailFor(video: any, cacheBust?: number) {
  const raw = resolveMediaUrl(video.posterUrl || video.thumbnailUrls?.[0]);
  if (!raw) return undefined;
  if (!cacheBust) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}t=${cacheBust}`;
}

export default function VideoDetailsClient({ initialVideo, user, workspace }: ClientProps) {
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useNotifications();
  const router = useRouter();
  const [video, setVideo] = useState<Video>(initialVideo);
  
  // Tab configuration
  const [activeTab, setActiveTab] = useState<TabType>('metadata');

  const [showShareModal, setShowShareModal] = useState(false);

  // Input Configuration states
  const [editTitle, setEditTitle] = useState(video.title);
  const [editDescription, setEditDescription] = useState(video.description || '');
  const [editNotes, setEditNotes] = useState((video.settings as any)?.notes || '');
  const [editAutoplay, setEditAutoplay] = useState(video.settings.autoplay ?? false);
  const [editLoop, setEditLoop] = useState(video.settings.loop ?? false);
  const [editMuted, setEditMuted] = useState(video.settings.muted ?? false);
  const [editControlsStyle, setEditControlsStyle] = useState<'show' | 'hide' | 'on-hover'>(video.settings.controlsStyle ?? 'show');
  const [editTheme, setEditTheme] = useState<string>((video.settings as any)?.theme ?? 'default');
  const [editPrimaryColor, setEditPrimaryColor] = useState(video.settings.primaryColor ?? '#5B4FE8');
  const [editBgColor, setEditBgColor] = useState<string>((video.settings as any)?.bgColor ?? '#000000');
  const [editCaptionBgColor, setEditCaptionBgColor] = useState<string>((video.settings as any)?.captionBgColor ?? 'rgba(0, 0, 0, 0.75)');
  const [editCaptionTextColor, setEditCaptionTextColor] = useState<string>((video.settings as any)?.captionTextColor ?? '#ffffff');
  const [editCaptionFontFamily, setEditCaptionFontFamily] = useState<string>((video.settings as any)?.captionFontFamily ?? 'Inter, system-ui, sans-serif');
  const [editCaptionFontSize, setEditCaptionFontSize] = useState<string>((video.settings as any)?.captionFontSize ?? '1rem');
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
  const [draggingCtaId, setDraggingCtaId] = useState<string | null>(null);
  
  // Form States
  const [editFormEnabled, setEditFormEnabled] = useState(video.settings.formEnabled ?? false);
  const [editFormTime, setEditFormTime] = useState<number | 'pre-roll' | 'post-roll'>(video.settings.formTime ?? 'pre-roll');
  const [editFormTitle, setEditFormTitle] = useState(video.settings.formTitle ?? 'Unlock this video');
  const [editFormDescription, setEditFormDescription] = useState(video.settings.formDescription ?? 'Enter your email to watch');
  const [editFormThankYouMessage, setEditFormThankYouMessage] = useState(video.settings.formThankYouMessage ?? 'Thank you!');
  const [editFormButtonText, setEditFormButtonText] = useState(video.settings.formButtonText ?? 'Submit');
  const [editFormButtonColor, setEditFormButtonColor] = useState(video.settings.formButtonColor ?? video.settings.primaryColor ?? '#F97316');
  const [editFormButtonTextColor, setEditFormButtonTextColor] = useState(video.settings.formButtonTextColor ?? '#ffffff');
  const [editFormTextColor, setEditFormTextColor] = useState(video.settings.formTextColor ?? '#ffffff');
  const [editFormBgColor, setEditFormBgColor] = useState(video.settings.formBgColor ?? '#ffffff');
  const [editFormAlignment, setEditFormAlignment] = useState<'left' | 'center' | 'right'>(video.settings.formAlignment ?? 'center');
  const [editFormSkipEnabled, setEditFormSkipEnabled] = useState<boolean>((video.settings as any)?.formSkipEnabled ?? true);
  const [editFormRequireConsent, setEditFormRequireConsent] = useState<boolean>((video.settings as any)?.formRequireConsent ?? false);
  const [editFormConsentText, setEditFormConsentText] = useState<string>((video.settings as any)?.formConsentText ?? 'I agree to receive emails about this content.');
  const [editFormOverlayOpacity, setEditFormOverlayOpacity] = useState<number>((video.settings as any)?.formOverlayOpacity ?? 0.75);
  const [editFormCardOpacity, setEditFormCardOpacity] = useState<number>((video.settings as any)?.formCardOpacity ?? 1);
  const [editFormFieldBgColor, setEditFormFieldBgColor] = useState<string>((video.settings as any)?.formFieldBgColor ?? 'rgba(255,255,255,0.08)');
  const [editFormFieldBorderColor, setEditFormFieldBorderColor] = useState<string>((video.settings as any)?.formFieldBorderColor ?? 'rgba(255,255,255,0.16)');
  const [editFormUseThemeColors, setEditFormUseThemeColors] = useState<boolean>((video.settings as any)?.formUseThemeColors ?? true);
  const [editFormFontFamily, setEditFormFontFamily] = useState<string>((video.settings as any)?.formFontFamily ?? 'Inter, system-ui, sans-serif');

  useEffect(() => {
    if (!editFormUseThemeColors) return;
    setEditFormButtonColor(editPrimaryColor || '#F97316');
    setEditFormBgColor(editBgColor || '#ffffff');
  }, [editFormUseThemeColors, editPrimaryColor, editBgColor]);
  
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
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [thumbnailAction, setThumbnailAction] = useState<'frame' | 'upload' | null>(null);
  const [posterPreviewKey, setPosterPreviewKey] = useState(0);
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false);
  const [thumbnailModalTab, setThumbnailModalTab] = useState<'frame' | 'upload'>('frame');
  const [scrubTime, setScrubTime] = useState(0);
  const thumbnailUploadRef = useRef<HTMLInputElement>(null);
  const [captionsPreviewKey, setCaptionsPreviewKey] = useState(0);
  const captionInputRef = useRef<HTMLInputElement>(null);
  const [captionAction, setCaptionAction] = useState<'upload' | 'remove' | 'generate' | null>(null);

  const [captionStylingOpen, setCaptionStylingOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  const handleGenerateAICaptions = async () => {
    if (!video.audioExtracted) return;
    setCaptionAction('generate');
    const originalUpdatedAt = video.updatedAt;
    
    try {
      const res = await fetch(`/api/videos/${video.id}/captions/generate`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to generate captions');
      notifySuccess('Transcription requested', { message: 'AI is generating captions. They will appear here in a few moments.' });
      
      // Poll for the result so the user doesn't have to manually refresh
      const pollInterval = setInterval(async () => {
        try {
          const metaRes = await fetch(`/api/videos/${video.id}/meta`);
          if (metaRes.ok) {
            const payload = await metaRes.json();
            const updated = payload.data;
            // Check if the webhook has updated the video record
            if (updated.updatedAt && updated.updatedAt !== originalUpdatedAt) {
              setVideo(updated);
              setCaptionsPreviewKey(k => k + 1);
              setCaptionAction(null);
              clearInterval(pollInterval);
              notifySuccess('Captions ready', { message: 'AI transcription completed successfully.' });
              router.refresh();
            }
          }
        } catch (e) {
          // ignore network errors during polling
        }
      }, 3000);

      // Stop polling after 60 seconds to prevent infinite loops if webhook fails
      setTimeout(() => {
        clearInterval(pollInterval);
        setCaptionAction((prev) => (prev === 'generate' ? null : prev));
      }, 60000);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      notifyError('Failed to generate captions', { message });
      setCaptionAction(null);
    }
  };

  const [captionEditorOpen, setCaptionEditorOpen] = useState(false);
  const [parsedCues, setParsedCues] = useState<{ id: number, header: string, text: string }[]>([]);
  const [isSavingCaptions, setIsSavingCaptions] = useState(false);
  const [, setEditorDebugText] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);

  const handleOpenCaptionEditor = async () => {
    if (captionEditorOpen) {
      setCaptionEditorOpen(false);
      return;
    }
    setCaptionEditorOpen(true);
    if (!video.captionsUrl || !previewCaptionsSrc) return;
    setEditorLoading(true);
    setEditorDebugText('');
    
    try {
      const res = await fetch(previewCaptionsSrc);
      if (!res.ok) throw new Error('Failed to load captions file');
      const text = await res.text();
      
      const normalizedText = text.trim().replace(/\r\n/g, '\n');
      const blocks = normalizedText.split(/\n\n+/);
      const cueBlocks = blocks.filter(b => !b.startsWith('WEBVTT'));
      
      const parsed = cueBlocks.map((block, idx) => {
        const lines = block.split('\n');
        const headerIdx = lines.findIndex(l => l.includes('-->'));
        if (headerIdx === -1) return { id: idx, header: '', text: block };
        
        const header = lines[headerIdx];
        const cueText = lines.slice(headerIdx + 1).join('\n');
        return { id: idx, header, text: cueText };
      }).filter(c => c.header);
      
      // setEditorDebugText(`Blocks: ${blocks.length}, Cues: ${cueBlocks.length}, Parsed: ${parsed.length}\nRaw: ${normalizedText.slice(0, 100)}...`);
      setParsedCues(parsed);
    } catch (e) {
      setEditorDebugText(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
      notifyError('Failed to load captions', { message: 'Could not fetch the captions file for editing.' });
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSaveCaptionsText = async () => {
    setIsSavingCaptions(true);
    try {
      let newVtt = 'WEBVTT\n\n';
      for (const cue of parsedCues) {
        newVtt += `${cue.header}\n${cue.text}\n\n`;
      }
      
      const file = new File([newVtt], 'captions.vtt', { type: 'text/vtt' });
      const form = new FormData();
      form.append('file', file);
      
      const res = await fetch(`/api/videos/${video.id}/captions`, {
        method: 'POST',
        body: form
      });
      
      if (!res.ok) throw new Error('Failed to save captions');
      
      notifySuccess('Captions saved', { message: 'Your text edits have been saved.' });
      setCaptionEditorOpen(false);
      setCaptionsPreviewKey(k => k + 1); // Refresh preview
      router.refresh();
    } catch (e) {
      notifyError('Failed to save', { message: 'Could not save caption edits.' });
    } finally {
      setIsSavingCaptions(false);
    }
  };
  const [editShowWatermark] = useState<boolean>((video.settings as any)?.showWatermark ?? true);
  const [editClickToPlay, setEditClickToPlay] = useState<boolean>((video.settings as any)?.clickToPlay ?? true);
  const [editStartInView, setEditStartInView] = useState<boolean>((video.settings as any)?.startInView ?? false);
  const [editPlayInline, setEditPlayInline] = useState<boolean>((video.settings as any)?.playInline ?? false);
  const [editBgVideo, setEditBgVideo] = useState<boolean>((video.settings as any)?.bgVideo ?? false);
  const [editPlayFromStartFullscreen, setEditPlayFromStartFullscreen] = useState<boolean>((video.settings as any)?.playFromStartFullscreen ?? false);
  const [editBrandingEnabled, setEditBrandingEnabled] = useState<boolean>((video.settings as any)?.brandingEnabled ?? false);
  const [editBrandingLogoUrl, setEditBrandingLogoUrl] = useState<string | undefined>((video.settings as any)?.brandingLogoUrl);
  const [editBrandingPosition, setEditBrandingPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>((video.settings as any)?.brandingPosition || 'top-left');
  const [editBrandingSize, setEditBrandingSize] = useState<number>((video.settings as any)?.brandingSize || 100);
  const [editKeyboardShortcuts, setEditKeyboardShortcuts] = useState<boolean>((video.settings as any)?.keyboardShortcuts ?? true);
  const [editShowExitThumbnail, setEditShowExitThumbnail] = useState<boolean>((video.settings as any)?.showExitThumbnail ?? false);
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
  const [editShowCaptionsControl, setEditShowCaptionsControl] = useState<boolean>((video.settings as any)?.showCaptionsControl ?? true);
  const [ccEnabled, setCcEnabled] = useState<boolean>(true);
  // Audio tab removed (audio settings still exist on the type, but are not exposed here)

  // Prevent unused variables compile warning in tsc
  const _unused = {
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
    setEditFormFieldBgColor,
    setEditFormFieldBorderColor,
    copiedId,
    formatBytes,
    thumbnailFor,
    setEditPlayFromStartFullscreen,
    setEditBrandingEnabled,
    setEditBrandingLogoUrl,
    setEditBrandingPosition,
    setEditBrandingSize,
    setEditKeyboardShortcuts,
    setEditShowExitThumbnail,
  };
  
  if (_unused) {
    // Read the value to satisfy tsc
  }
  
  const [previewFormVisible, setPreviewFormVisible] = useState(false);
  const [previewFormSubmitted, setPreviewFormSubmitted] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [previewFormError, setPreviewFormError] = useState<string | null>(null);
  const [previewFormSubmitting, setPreviewFormSubmitting] = useState(false);
  const [previewFormData, setPreviewFormData] = useState<Record<string, string>>({});
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [formEditorOpen, setFormEditorOpen] = useState(false);
  const [openFormFieldId, setOpenFormFieldId] = useState<string | null>(null);
  const [draggingFormFieldId, setDraggingFormFieldId] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const hlsInstanceRef = useRef<any>(null);
  const isPlayingRef = useRef(false);
  // Audio tab removed
  const mainDurationRef = useRef<number>(0);

  // Sync previewVideoRef to the actual <video> element inside CustomVideoPlayer
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    if (previewVideoRef.current) return previewVideoRef.current;
    const container = document.getElementById(`player-${video.id}`);
    const el = container?.querySelector('video') ?? null;
    if (el) previewVideoRef.current = el as HTMLVideoElement;
    return el as HTMLVideoElement | null;
  }, [video.id]);

  // Keep ref synced after player mounts
  useEffect(() => {
    const timer = setTimeout(() => { getVideoElement(); }, 500);
    return () => clearTimeout(timer);
  }, [getVideoElement]);

  const handleChartSeek = useCallback((time: number) => {
    // Find ALL video elements and seek the one that's loaded
    const allVideos = document.querySelectorAll('video');
    console.log('[ChartSeek] time:', time, 'found videos:', allVideos.length);
    for (const videoEl of allVideos) {
      if (videoEl.duration && videoEl.duration > 0) {
        console.log('[ChartSeek] seeking video to', time, 'duration:', videoEl.duration);
        videoEl.currentTime = time;
        break;
      }
    }
  }, []);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [settingsMenuState, setSettingsMenuState] = useState<'closed' | 'main' | 'speed' | 'quality'>('closed');
  const [hlsLevels, setHlsLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);

  const isVerticalVideo = getResolutionString(video) === '2160×3840';
  const userInitial = (user.name || user.email)[0].toUpperCase();
  const persistentPosterUrl = thumbnailFor(video, posterPreviewKey);
  const previewPosterUrl =
    !isPlaying && currentTime < 0.05 ? persistentPosterUrl : undefined;

  const previewCaptionsSrc = (() => {
    const base = resolveMediaUrl(video.captionsUrl);
    if (!base) return undefined;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}t=${captionsPreviewKey}`;
  })();
  const showPosterOverlay =
    !isPlaying &&
    currentTime < 0.05 &&
    thumbnailAction !== 'frame' &&
    Boolean(previewPosterUrl);

  const canDragCtaInPreview = !isPlaying && activeTab === 'cta';

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const el = previewVideoRef.current;
    if (!el) return;
    const tracks = el.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = (previewCaptionsSrc && ccEnabled) ? 'showing' : 'hidden';
    }
  }, [previewCaptionsSrc, ccEnabled]);

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
  }, [video.id, video.status]);

  const hlsManifestSrc = resolveMediaUrl(video.hlsManifestUrl) ?? video.hlsManifestUrl;

  const destroyPreviewHls = () => {
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }
  };

  // Load HLS Live Preview player (narrow deps — poster updates must not reload the stream)
  useEffect(() => {
    const htmlVideo = previewVideoRef.current;
    if (!htmlVideo || video.status !== 'ready' || !hlsManifestSrc) return;

    const savedTime = htmlVideo.currentTime;

    import('hls.js').then(({ default: Hls }) => {
      if (Hls.isSupported()) {
        destroyPreviewHls();
        const hls = new Hls({
          startLevel: -1,
          capLevelToPlayerSize: true,
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (_event: any, data: any) => {
          setHlsLevels(data.levels || []);
          if (savedTime > 0) {
            htmlVideo.currentTime = savedTime;
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
          setCurrentLevel(data.level);
        });

        hls.loadSource(hlsManifestSrc);
        hls.attachMedia(htmlVideo);
        hlsInstanceRef.current = hls;
      } else if (htmlVideo.canPlayType('application/vnd.apple.mpegurl')) {
        destroyPreviewHls();
        htmlVideo.src = hlsManifestSrc;
        if (savedTime > 0) htmlVideo.currentTime = savedTime;
      }
    });

    return () => destroyPreviewHls();
  }, [video.id, video.status, hlsManifestSrc]);

  // HLS for thumbnail scrub video
  useEffect(() => {
    if (!thumbnailModalOpen || thumbnailModalTab !== 'frame' || !video.hlsManifestUrl) return;
    const manifestUrl = resolveMediaUrl(video.hlsManifestUrl) || '';
    if (!manifestUrl) return;

    let hls: any = null;
    const initHls = async () => {
      const vid = document.getElementById('thumbnail-scrub-video') as HTMLVideoElement;
      if (!vid) {
        setTimeout(initHls, 100);
        return;
      }
      const { default: Hls } = await import('hls.js');
      if (Hls.isSupported()) {
        hls = new Hls({ startLevel: -1 });
        hls.loadSource(manifestUrl);
        hls.attachMedia(vid);
      } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
        vid.src = manifestUrl;
      }
    };
    initHls();

    return () => {
      if (hls) hls.destroy();
    };
  }, [thumbnailModalOpen, thumbnailModalTab, video.hlsManifestUrl]);

  // Copy helpers
  const handleCopyId = () => {
    navigator.clipboard.writeText(video.id);
    setCopiedId(video.id);
    setTimeout(() => setCopiedId(null), 2000);
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

  // Persisted unlock (dashboard preview parity)
  useEffect(() => {
    try {
      const key = `framevid_unlock:${video.workspaceId}:${video.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        setPreviewFormSubmitted(true);
        setPreviewFormVisible(false);
      }
    } catch {
      // ignore
    }
  }, [video.id, video.workspaceId]);

  // Audio tab removed

  // Imperatively sync autoplay toggle to the video element
  useEffect(() => {
    const vid = previewVideoRef.current;
    if (!vid) return;
    if (previewFormVisible && editFormEnabled && editFormTime === 'pre-roll' && !previewFormSubmitted) return;
    if (editAutoplay || editBgVideo) {
      vid.play().catch(console.error);
    }
  }, [editAutoplay, editBgVideo, previewFormVisible, editFormEnabled, editFormTime, previewFormSubmitted]);

  // Loop only applies to main video when there are no bumpers (intro/outro use onEnded)
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

    const d = videoEl.duration || 0;
    mainDurationRef.current = d;
    setDuration(d);
  };

  const togglePlay = () => {
    if (!editClickToPlay) return;
    if (previewFormVisible) return;
    const vid = previewVideoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(console.error);
    } else {
      vid.pause();
    }
  };

  // Start playing when in view (IntersectionObserver)
  useEffect(() => {
    if (!editStartInView || !previewVideoRef.current) return;

    const videoEl = previewVideoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (previewFormVisible) return;
          videoEl.play().catch(console.error);
        } else {
          videoEl.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(videoEl);
    return () => observer.disconnect();
  }, [editStartInView, previewFormVisible]);

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

  const handlePreviewFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewFormError(null);
    setPreviewFormSubmitting(true);

    try {
      const payloadFields: Record<string, string> = {};
      for (const f of editFormFields) {
        payloadFields[f.id] = (previewFormData[f.id] || '').trim();
      }

      const res = await fetch(`/api/videos/${video.id}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: payloadFields,
          source: 'dashboard-preview',
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to submit form');

      setShowThankYou(true);
      setTimeout(() => setShowThankYou(false), 1600);

      setPreviewFormVisible(false);
      setPreviewFormSubmitted(true);

      try {
        const key = `framevid_unlock:${video.workspaceId}:${video.id}`;
        localStorage.setItem(key, JSON.stringify({ unlockedAt: Date.now(), key: json?.unlock?.key }));
      } catch {
        // ignore
      }

      if (editFormTime !== 'post-roll') {
        previewVideoRef.current?.play().catch(() => {});
      }
    } catch (err: any) {
      setPreviewFormError(err?.message || 'Failed to submit form');
    } finally {
      setPreviewFormSubmitting(false);
    }
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
    if (isPlayingRef.current || activeTab !== 'cta') return;

    e.preventDefault();
    e.stopPropagation();

    const container = previewContainerRef.current;
    if (!container) return;

    // Toggle active accordion card to this one so the user can easily see options
    setExpandedCtaId(ctaId);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isPlayingRef.current) return;

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
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [logoAction, setLogoAction] = useState<'upload' | 'remove' | null>(null);

  const uploadLogoBlob = async (blob: Blob) => {
    const form = new FormData();
    form.append('file', blob, blob.type === 'image/svg+xml' ? 'logo.svg' : 'logo.png');
    const res = await fetch(`/api/videos/${video.id}/logo`, { method: 'POST', body: form });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Failed to upload logo');
    const brandingLogoUrl = payload.data?.brandingLogoUrl as string;
    setVideo((prev: any) => ({ ...prev, settings: { ...prev.settings, brandingLogoUrl } }));
    return brandingLogoUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoAction('upload');
    try {
      const url = await uploadLogoBlob(file);
      setEditBrandingLogoUrl(url);
      notifySuccess('Custom logo uploaded');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      notifyError('Logo upload failed', { message });
    } finally {
      setLogoAction(null);
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!editBrandingLogoUrl) return;
    setLogoAction('remove');
    try {
      const res = await fetch(`/api/videos/${video.id}/logo`, { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to remove logo');
      setVideo((prev: any) => {
        const newSettings = { ...prev.settings };
        delete newSettings.brandingLogoUrl;
        return { ...prev, settings: newSettings };
      });
      setEditBrandingLogoUrl(undefined);
      notifySuccess('Logo removed');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Remove failed';
      notifyError('Could not remove logo', { message });
    } finally {
      setLogoAction(null);
    }
  };

  const uploadPosterBlob = async (blob: Blob) => {
    const form = new FormData();
    form.append('file', blob, 'poster.jpg');
    const res = await fetch(`/api/videos/${video.id}/poster`, { method: 'POST', body: form });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || 'Failed to upload thumbnail');
    const posterUrl = payload.data?.posterUrl as string;
    setVideo((prev) => ({ ...prev, posterUrl }));
    setPosterPreviewKey((k) => k + 1);
    return posterUrl;
  };

  const handleCaptionsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.vtt') && !lower.endsWith('.srt')) {
      notifyError('Invalid file', { message: 'Upload a .vtt or .srt caption file.' });
      e.target.value = '';
      return;
    }

    setCaptionAction('upload');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/videos/${video.id}/captions`, { method: 'POST', body: form });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to upload captions');
      const captionsUrl = payload.data?.captionsUrl as string;
      setVideo((prev) => ({ ...prev, captionsUrl }));
      setCaptionsPreviewKey((k) => k + 1);
      notifySuccess('Captions uploaded', { message: 'Subtitles are active in the live preview.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      notifyError('Caption upload failed', { message });
    } finally {
      setCaptionAction(null);
      e.target.value = '';
    }
  };

  const handleRemoveCaptions = async () => {
    if (!video.captionsUrl) return;
    setCaptionAction('remove');
    try {
      const res = await fetch(`/api/videos/${video.id}/captions`, { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to remove captions');
      setVideo((prev) => ({ ...prev, captionsUrl: undefined }));
      setCaptionsPreviewKey((k) => k + 1);
      notifySuccess('Captions removed');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Remove failed';
      notifyError('Could not remove captions', { message });
    } finally {
      setCaptionAction(null);
    }
  };

  const restorePreviewTime = (time: number) => {
    const el = previewVideoRef.current;
    if (!el || !Number.isFinite(time) || time <= 0) return;
    const apply = () => {
      try {
        el.currentTime = Math.min(time, el.duration || time);
      } catch {
        /* ignore */
      }
    };
    apply();
    el.addEventListener('loadedmetadata', apply, { once: true });
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnailAction('upload');
    try {
      await uploadPosterBlob(file);
      notifySuccess('Thumbnail updated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      notifyError('Thumbnail upload failed', { message });
    } finally {
      setThumbnailAction(null);
      e.target.value = '';
    }
  };

  const capturePosterOnServer = async (timeSeconds: number) => {
    const res = await fetch(`/api/videos/${video.id}/poster/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeSeconds }),
    });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error || 'Server frame capture failed');
    }
    const posterUrl = payload.data?.posterUrl as string;
    if (posterUrl) {
      setVideo((prev) => ({ ...prev, posterUrl }));
      setPosterPreviewKey((k) => k + 1);
    }
  };

  const handleSelectPosterFrame = async () => {
    if (video.status !== 'ready') {
      notifyInfo('Video still encoding', {
        message: 'Wait until encoding finishes, then try again.',
      });
      return;
    }

    const modalVid = document.getElementById('thumbnail-scrub-video') as HTMLVideoElement | null;
    const el = modalVid || getVideoElement();
    if (!el) {
      notifyInfo('Select a frame', {
        message: 'Scrub the preview to the frame you want.',
      });
      return;
    }

    setThumbnailAction('frame');
    const activeTime = el.currentTime || currentTime || 0;

    try {
      el.pause();
      await new Promise<void>((r) => window.setTimeout(r, 200));

      let captured = false;
      let lastError = '';

      const finishCapture = async (blob: Blob) => {
        await uploadPosterBlob(blob);
        restorePreviewTime(activeTime);
        notifySuccess('Thumbnail updated');
        captured = true;
      };

      let dataUrl: string | null = null;
      try {
        dataUrl = await captureVideoFrame(el);
      } catch {
        dataUrl = null;
      }
      if (!dataUrl) {
        try {
          dataUrl = await captureVideoFrameViaImageCapture(el);
        } catch {
          dataUrl = null;
        }
      }
      if (dataUrl) {
        try {
          await finishCapture(await (await fetch(dataUrl)).blob());
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Upload failed';
        }
      }

      if (!captured) {
        try {
          await capturePosterOnServer(activeTime);
          restorePreviewTime(activeTime);
          notifySuccess('Thumbnail updated');
          captured = true;
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Server capture failed';
        }
      }

      if (!captured) {
        notifyError('Could not capture frame', {
          message:
            lastError ||
            'Scrub the preview, pause on your frame, then try again. For your own uploads, install ffmpeg or use Upload.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to capture frame';
      notifyError('Thumbnail capture failed', { message });
    } finally {
      setThumbnailAction(null);
    }
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
            captionBgColor: editCaptionBgColor,
            captionTextColor: editCaptionTextColor,
            captionFontFamily: editCaptionFontFamily,
            captionFontSize: editCaptionFontSize,
            // Privacy is managed entirely by the Share Modal now
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
            formSkipEnabled: editFormSkipEnabled,
            formRequireConsent: editFormRequireConsent,
            formConsentText: editFormConsentText,
            formOverlayOpacity: editFormOverlayOpacity,
            formCardOpacity: editFormCardOpacity,
            formFieldBgColor: editFormFieldBgColor,
            formFieldBorderColor: editFormFieldBorderColor,
            formUseThemeColors: editFormUseThemeColors,
            formFontFamily: editFormFontFamily,
            notes: editNotes,
            showWatermark: editShowWatermark,
            clickToPlay: editClickToPlay,
            startInView: editStartInView,
            playInline: editPlayInline,
            bgVideo: editBgVideo,
            playFromStartFullscreen: editPlayFromStartFullscreen,
            brandingEnabled: editBrandingEnabled,
            brandingLogoUrl: editBrandingLogoUrl,
            brandingPosition: editBrandingPosition,
            brandingSize: editBrandingSize,
            keyboardShortcuts: editKeyboardShortcuts,
            showExitThumbnail: editShowExitThumbnail,
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
            showCaptionsControl: editShowCaptionsControl,
            theme: editTheme,
          }
        })
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to save configuration');

      setVideo(payload.data);
      setSaveSuccess(true);
      notifySuccess('Settings saved');
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (err: any) {
      notifyError('Save failed', { message: err.message });
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
      notifyError('Delete failed', { message: err.message });
      setDeleteConfirm(false);
    }
  };

  return (
    <div className="dash-shell font-sans">
      
      {/* VIMEO-STYLE SINGLE HEADER */}
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 bg-white z-40 relative">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.push('/')} className="cursor-pointer transition-opacity hover:opacity-85 mr-2">
            <Logo />
          </button>

          {/* Breadcrumb / Title */}
          <div className="flex items-center text-[13px] font-medium text-gray-500">
            <span className="cursor-pointer hover:text-gray-900 transition-colors" onClick={() => router.push('/')}>
              {workspace ? workspace.name : 'Library'}
            </span>
            <svg className="w-4 h-4 mx-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            <span className="text-gray-900 font-semibold">{video.title}</span>
          </div>


        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Action icons */}
          <button
            type="button"
            onClick={() => {
              if (!video.id) return;
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
                notifyInfo('Could not download the video');
              }
            }}
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 p-2 rounded-full transition-colors"
            title="Download Video"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm ml-1"
          >
            <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            Share
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
              className="text-gray-500 hover:text-gray-900 p-1.5 transition-colors"
              title="Options"
            >
              <svg className="h-5 w-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>

            {optionsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOptionsMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100 z-50 py-2 flex flex-col">
                  
                  <button onClick={() => {
                    setOptionsMenuOpen(false);
                    if (!video.id) return;
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
                      notifyInfo('Could not download the video');
                    }
                  }} className="text-left px-4 py-2 text-[14px] text-gray-700 hover:bg-gray-100 flex items-center gap-3">
                    <svg className="w-[18px] h-[18px] text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download...
                  </button>

                  <button onClick={() => { setOptionsMenuOpen(false); window.open(`/v/${video.id}`, '_blank'); }} className="text-left px-4 py-2 text-[14px] text-gray-700 hover:bg-gray-100 flex items-center gap-3">
                    <svg className="w-[18px] h-[18px] text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    View video page
                  </button>

                  <button onClick={() => { setOptionsMenuOpen(false); handleCopyId(); }} className="text-left px-4 py-2 text-[14px] text-gray-700 hover:bg-gray-100 flex items-center gap-3">
                    <svg className="w-[18px] h-[18px] text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                    Copy Video ID
                  </button>
                  
                  <div className="h-px bg-gray-100 my-1"></div>

                  <button onClick={async () => { 
                    setOptionsMenuOpen(false); 
                    if (!window.confirm('Are you sure you want to delete this video? This cannot be undone.')) return;
                    try {
                      const res = await fetch(`/api/videos/${video.id}`, { method: 'DELETE' });
                      if (!res.ok) throw new Error('Failed to delete');
                      router.push('/');
                      router.refresh();
                    } catch (e: any) {
                      notifyError('Delete failed', { message: e.message });
                    }
                  }} className="text-left px-4 py-2 text-[14px] text-gray-700 hover:bg-gray-100 flex items-center gap-3">
                    <svg className="w-[18px] h-[18px] text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    Delete
                  </button>

                </div>
              </>
            )}
          </div>
          
          <div className="w-px h-5 bg-gray-200 mx-1"></div>
          
          <ProfileMenu userInitial={userInitial} userName={user.name} userEmail={user.email} />
        </div>
      </header>

      {/* 2-COLUMN SPLIT WITH TOP TABS */}
      <div className="flex flex-1 flex-col h-[calc(100vh-64px)] overflow-hidden">
        
        {/* HORIZONTAL TABS BAR */}
        <div className="bg-[#EAECEE] px-4 sm:px-8 pt-3 flex gap-4 overflow-x-auto no-scrollbar shrink-0 items-end">
          {[
            { id: 'analytics', label: 'Analytics' },
            { id: 'metadata', label: 'Metadata' },
            { id: 'thumbnail', label: 'Thumbnail' },
            { id: 'player', label: 'Player' },
            { id: 'controls', label: 'Controls' },
            { id: 'colors', label: 'Colors' },
            { id: 'play-button', label: 'Play button' },
            { id: 'cta', label: 'Call to action' },
            { id: 'form', label: 'Form' },
            { id: 'leads', label: 'Leads' },
            { id: 'subtitles', label: 'Subtitles' },
            { id: 'danger', label: 'Danger Zone' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`detail-tab ${isActive ? 'detail-tab-active' : 'detail-tab-idle'}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTENT SPLIT (50/50) */}
        <div className="flex flex-1 flex-col lg:flex-row overflow-hidden bg-white">
          
          {/* COLUMN 1: TAB EDIT FORMS */}
          <section className="detail-editor">
          <div className="space-y-6">
            
            {/* Metadata Tab Form */}
            {activeTab === 'metadata' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="detail-field"
                    placeholder="Enter video title"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Description</label>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition resize-none leading-relaxed"
                    placeholder="Enter video description"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Notes</label>
                  <textarea
                    rows={4}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition resize-none leading-relaxed"
                    placeholder="Enter internal notes"
                  />
                  <p className="text-[10px] text-gray-400 font-semibold mt-1.5 leading-relaxed">
                    These are internal notes, not visible to outside users.
                  </p>
                </div>

              </div>
            )}

            {/* Thumbnail Tab */}
            {activeTab === 'thumbnail' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-4">
                {/* Thumbnail Preview Row */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Thumbnail</p>
                  <div className="flex gap-3">
                    {/* + Button */}
                    <button
                      type="button"
                      onClick={() => { setThumbnailModalOpen(true); setThumbnailModalTab('frame'); }}
                      className="w-28 aspect-video rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center hover:border-gray-400 hover:bg-gray-100 transition-all cursor-pointer group flex-shrink-0"
                    >
                      <svg className="w-7 h-7 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                    {/* Current Thumbnail */}
                    <div className="flex-1 aspect-video rounded-xl overflow-hidden bg-gray-900 border border-gray-200">
                      {thumbnailFor(video, posterPreviewKey) ? (
                        <img
                          key={posterPreviewKey}
                          src={thumbnailFor(video, posterPreviewKey)}
                          alt="Selected thumbnail"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <p className="text-[10px] font-medium text-gray-500">No thumbnail</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-150 my-3" />

                {/* Show Exit Thumbnail Toggle */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditShowExitThumbnail(!editShowExitThumbnail)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editShowExitThumbnail ? 'bg-accent' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editShowExitThumbnail ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800">Show exit thumbnail</span>
                      <span className="text-[10px] text-gray-500 font-medium mt-0.5">Show the thumbnail when the video finishes playing.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Thumbnail Modal */}
            {thumbnailModalOpen && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setThumbnailModalOpen(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <h3 className="text-lg font-bold text-gray-900">Add thumbnail</h3>
                    <button onClick={() => setThumbnailModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Tab Switcher */}
                  <div className="mx-6 mb-4 flex bg-gray-100 rounded-full p-1">
                    <button
                      onClick={() => setThumbnailModalTab('frame')}
                      className={`flex-1 text-sm font-semibold py-2 rounded-full transition-all ${
                        thumbnailModalTab === 'frame'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >Select from video</button>
                    <button
                      onClick={() => setThumbnailModalTab('upload')}
                      className={`flex-1 text-sm font-semibold py-2 rounded-full transition-all ${
                        thumbnailModalTab === 'upload'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >Upload image</button>
                  </div>

                  {/* Tab Content */}
                  <div className="px-6 pb-6">
                    {thumbnailModalTab === 'frame' ? (
                      <div className="space-y-4">
                        {/* Frame Preview */}
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-gray-200 relative">
                          <video
                            id="thumbnail-scrub-video"
                            crossOrigin="anonymous"
                            muted
                            playsInline
                            className="w-full h-full object-contain"
                            onLoadedMetadata={(e) => {
                              const vid = e.currentTarget;
                              if (vid.duration && vid.duration > 0) {
                                setScrubTime(0);
                              }
                            }}
                          />
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-md">
                            {formatDuration(scrubTime)} / {formatDuration(duration)}
                          </div>
                        </div>

                        {/* Scrub Slider */}
                        <div className="relative">
                          <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            step={0.1}
                            value={scrubTime}
                            onChange={(e) => {
                              const t = parseFloat(e.target.value);
                              setScrubTime(t);
                              const vid = document.getElementById('thumbnail-scrub-video') as HTMLVideoElement;
                              if (vid) vid.currentTime = t;
                            }}
                            className="w-full h-2 rounded-full appearance-none bg-gray-200 cursor-pointer"
                            style={{ accentColor: 'hsl(var(--accent))' }}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            onClick={() => setThumbnailModalOpen(false)}
                            className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                          >Cancel</button>
                          <button
                            disabled={thumbnailAction === 'frame'}
                            onClick={async () => {
                              await handleSelectPosterFrame();
                              setThumbnailModalOpen(false);
                            }}
                            className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-50"
                          >{thumbnailAction === 'frame' ? 'Capturing…' : 'Save'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Upload Area */}
                        <div
                          className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
                          onClick={() => thumbnailUploadRef.current?.click()}
                        >
                          <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.39 4.502 4.502 0 013.516 5.855A3 3 0 0118 19.5H6.75z" />
                          </svg>
                          <p className="text-sm font-semibold text-gray-700">Select a file to upload</p>
                          <p className="text-xs text-gray-400 mt-1">JPG, PNG or WEBP. Max 10MB</p>
                          <button
                            type="button"
                            className="mt-4 px-5 py-2 rounded-full text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-white transition"
                            onClick={(e) => { e.stopPropagation(); thumbnailUploadRef.current?.click(); }}
                          >Browse files</button>
                          <input
                            ref={thumbnailUploadRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              await handleThumbnailUpload(e);
                              setThumbnailModalOpen(false);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Player Tab Form */}
            {activeTab === 'player' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-4">

                {/* Theme Selector */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Player Theme</label>
                  <select
                    value={editTheme}
                    onChange={(e) => setEditTheme(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                  >
                    <option value="default">Default</option>
                    <option value="minimal">Minimal</option>
                    <option value="gradient">Gradient</option>
                    <option value="outlined">Outlined</option>
                    <option value="floating">Floating</option>
                  </select>
                </div>

                <div className="border-t border-gray-100" />
                
                {/* Autoplay */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditAutoplay(!editAutoplay)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editAutoplay ? 'bg-accent' : 'bg-gray-200'
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
                        editMuted ? 'bg-accent' : 'bg-gray-200'
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
                        editLoop ? 'bg-accent' : 'bg-gray-200'
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
                        editClickToPlay ? 'bg-accent' : 'bg-gray-200'
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
                        editStartInView ? 'bg-accent' : 'bg-gray-200'
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
                </div>

                {/* Play inline */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditPlayInline(!editPlayInline)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editPlayInline ? 'bg-accent' : 'bg-gray-200'
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
                </div>

                {/* Used as a background video */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditBgVideo(!editBgVideo)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editBgVideo ? 'bg-accent' : 'bg-gray-200'
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
                </div>

                {/* Play from start when fullscreen */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditPlayFromStartFullscreen(!editPlayFromStartFullscreen)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editPlayFromStartFullscreen ? 'bg-accent' : 'bg-gray-200'
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
                </div>

                {/* Custom Branding Toggle */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditBrandingEnabled(!editBrandingEnabled)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editBrandingEnabled ? 'bg-accent' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editBrandingEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Custom Branding</span>
                  </div>
                </div>

                {/* Branding Editor */}
                {editBrandingEnabled && (
                  <div className="py-2.5 space-y-4 pt-1 pb-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Logo Image</span>
                      {editBrandingLogoUrl && (
                        <button
                          onClick={handleRemoveLogo}
                          disabled={logoAction !== null}
                          className="text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors"
                        >
                          {logoAction === 'remove' ? 'Removing...' : 'Remove Logo'}
                        </button>
                      )}
                    </div>
                    
                    {!editBrandingLogoUrl ? (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-accent hover:bg-accent/5 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg className="w-6 h-6 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-gray-500 font-medium">
                            {logoAction === 'upload' ? 'Uploading...' : 'Click to upload logo'}
                          </p>
                        </div>
                        <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={handleLogoUpload} disabled={logoAction !== null} />
                      </label>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-full h-24 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center relative overflow-hidden group">
                          <img src={editBrandingLogoUrl} alt="Custom Logo" className="max-h-16 max-w-[80%] object-contain drop-shadow-sm" />
                          <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                            <span className="text-white text-xs font-bold shadow-sm">Change Logo</span>
                            <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={handleLogoUpload} disabled={logoAction !== null} />
                          </label>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 block">Position</label>
                          <select
                            value={editBrandingPosition}
                            onChange={(e: any) => setEditBrandingPosition(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent shadow-sm"
                          >
                            <option value="top-left">Top Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-right">Bottom Right</option>
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 block flex items-center justify-between">
                            <span>Size</span>
                            <span className="text-gray-900">{editBrandingSize}px</span>
                          </label>
                          <input
                            type="range"
                            min="20"
                            max="200"
                            value={editBrandingSize}
                            onChange={(e) => setEditBrandingSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* Controls Tab Form */}
            {activeTab === 'controls' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1.5">Visibility Mode</label>
                  <select
                    value={editControlsStyle}
                    onChange={(e: any) => setEditControlsStyle(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent shadow-sm"
                  >
                    <option value="show">Always Render Native Controls</option>
                    <option value="on-hover">Show Control Bars only on Hover</option>
                    <option value="hide">Hide Controls Completely</option>
                  </select>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-150 my-3" />

                {/* Keyboard Shortcuts */}
                <div className="flex items-center justify-between py-2.5 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditKeyboardShortcuts(!editKeyboardShortcuts)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                        editKeyboardShortcuts ? 'bg-accent' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-250 ease-in-out ${
                          editKeyboardShortcuts ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-bold text-gray-800">Enable Keyboard Shortcuts</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-150 my-3" />

                {/* Large play button */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowLargePlayButton(!editShowLargePlayButton)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowLargePlayButton ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowLargePlayButton ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Large play button</span>
                </div>

                {/* Play/pause */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowPlayPause(!editShowPlayPause)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowPlayPause ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowPlayPause ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Play/pause</span>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowProgress(!editShowProgress)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowProgress ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowProgress ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Progress</span>
                </div>

                {/* Current time */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowCurrentTime(!editShowCurrentTime)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowCurrentTime ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowCurrentTime ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Current time</span>
                </div>

                {/* Mute */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowMute(!editShowMute)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowMute ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowMute ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Mute</span>
                </div>

                {/* Volume */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowVolume(!editShowVolume)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowVolume ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowVolume ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Volume</span>
                </div>

                {/* Settings */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowSettings(!editShowSettings)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowSettings ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowSettings ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Settings</span>
                </div>

                {/* Fullscreen */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowFullscreen(!editShowFullscreen)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowFullscreen ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowFullscreen ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Fullscreen</span>
                </div>

                {/* Playback speed */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowPlaybackSpeed(!editShowPlaybackSpeed)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowPlaybackSpeed ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowPlaybackSpeed ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Playback speed</span>
                </div>

                {/* Select quality */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowSelectQuality(!editShowSelectQuality)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowSelectQuality ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowSelectQuality ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Select quality</span>
                </div>

                {/* CC Button */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditShowCaptionsControl(!editShowCaptionsControl)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editShowCaptionsControl ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editShowCaptionsControl ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">CC button</span>
                </div>

              </div>
            )}

            {/* Colors Tab Form */}
            {activeTab === 'colors' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-6">
                
                {/* Primary color */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Primary color</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 w-full focus-within:border-accent focus-within:ring-4 focus-within:ring-[hsl(var(--accent)/0.15)] transition shadow-sm">
                    {/* Color preview box (clickable) */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer shadow-inner">
                      <div className="absolute inset-0" style={{ backgroundColor: editPrimaryColor }} />
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
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 w-full focus-within:border-accent focus-within:ring-4 focus-within:ring-[hsl(var(--accent)/0.15)] transition shadow-sm">
                    {/* Color preview box (clickable) */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer shadow-inner">
                      <div className="absolute inset-0" style={{ backgroundColor: editBgColor }} />
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
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-6">
                
                {/* Play button */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-sm font-semibold text-gray-500">Play button</span>
                  </div>
                  <div className="relative flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-500 transition-colors duration-150 hover:border-gray-300 focus-within:border-accent shadow-sm cursor-pointer">
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
                  </div>
                  <div className="relative flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-500 transition-colors duration-150 hover:border-gray-300 focus-within:border-accent shadow-sm cursor-pointer">
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
                  </div>
                  <input
                    type="text"
                    value={editPlayButtonText}
                    onChange={(e) => setEditPlayButtonText(e.target.value)}
                    placeholder="Play now"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 placeholder:text-gray-350 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm"
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
                          className={`p-2.5 rounded-lg border text-[11px] font-bold capitalize transition-colors duration-150 ${
                            isActive
                              ? 'border-accent bg-accent-muted/40 text-accent shadow-sm ring-2 ring-[hsl(var(--accent)/0.15)]'
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
                    <span className="text-[9px] font-extrabold text-accent bg-accent-muted px-2 py-0.5 rounded-full border border-accent-border">
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
                      className="w-full accent-accent h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
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
                      className="w-full accent-accent h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
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
                        editPlayButtonBgTransparent ? 'bg-accent' : 'bg-gray-200'
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
                      className="w-full accent-accent h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                    />
                  </div>

                  {/* Border Color */}
                  {editPlayButtonBorderWidth > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-gray-500 block select-none">Border Color</span>
                      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 w-full focus-within:border-accent transition shadow-sm">
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

            {/* Call to action tab */}
            {activeTab === 'cta' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-6">
                
                {/* CTA Toggle */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditCtaEnabled(!editCtaEnabled)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editCtaEnabled ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editCtaEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Show Call to Action Buttons</span>
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
                              draggable={editCtaEnabled}
                              onDragStart={() => setDraggingCtaId(cta.id)}
                              onDragEnd={() => setDraggingCtaId(null)}
                              onDragOver={(e) => {
                                if (!draggingCtaId || draggingCtaId === cta.id) return;
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                if (!draggingCtaId || draggingCtaId === cta.id) return;
                                e.preventDefault();
                                const fromIdx = editCtas.findIndex((x) => x.id === draggingCtaId);
                                const toIdx = editCtas.findIndex((x) => x.id === cta.id);
                                if (fromIdx < 0 || toIdx < 0) return;

                                const next = [...editCtas];
                                const [moved] = next.splice(fromIdx, 1);
                                next.splice(toIdx, 0, moved);
                                setEditCtas(next);
                              }}
                              className={`rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white transition-colors duration-150 ${
                                isExpanded 
                                  ? 'border-accent ring-2 ring-[hsl(var(--accent)/0.15)] ring-inset' 
                                  : 'cursor-pointer hover:border-gray-300'
                              }`}
                            >
                              {/* Summary Header (always visible, triggers toggle) */}
                              <button
                                type="button"
                                onClick={() => setExpandedCtaId(isExpanded ? null : cta.id)}
                                className="w-full flex items-center justify-between p-3.5 select-none bg-gray-50/40 hover:bg-gray-50/80 transition-colors text-left"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-300 cursor-grab active:cursor-grabbing">
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <circle cx="9" cy="7" r="1.4" />
                                        <circle cx="15" cy="7" r="1.4" />
                                        <circle cx="9" cy="12" r="1.4" />
                                        <circle cx="15" cy="12" r="1.4" />
                                        <circle cx="9" cy="17" r="1.4" />
                                        <circle cx="15" cy="17" r="1.4" />
                                      </svg>
                                    </span>
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
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-accent' : 'rotate-0'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                  </svg>
                                </div>
                              </button>

                              {/* Expanded Form Inputs (only rendered when expanded) */}
                              {isExpanded && (
                                <div className="p-4 pt-2 border-t border-gray-100 bg-white space-y-4">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (index <= 0) return;
                                          const next = [...editCtas];
                                          const tmp = next[index - 1];
                                          next[index - 1] = next[index];
                                          next[index] = tmp;
                                          setEditCtas(next);
                                        }}
                                        disabled={index <= 0}
                                        className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 disabled:opacity-40 hover:text-gray-700 transition"
                                      >
                                        Move up
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (index >= editCtas.length - 1) return;
                                          const next = [...editCtas];
                                          const tmp = next[index + 1];
                                          next[index + 1] = next[index];
                                          next[index] = tmp;
                                          setEditCtas(next);
                                        }}
                                        disabled={index >= editCtas.length - 1}
                                        className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 disabled:opacity-40 hover:text-gray-700 transition"
                                      >
                                        Move down
                                      </button>
                                    </div>
                                  </div>

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
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition shadow-inner bg-gray-50/50 focus:bg-white"
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
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition shadow-inner bg-gray-50/50 focus:bg-white"
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
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition shadow-inner bg-gray-50/50 focus:bg-white"
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
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition shadow-inner bg-gray-50/50 focus:bg-white"
                                      />
                                    </div>
                                  </div>

                                  {/* Divider */}
                                  <div className="border-t border-gray-100 my-1" />

                                  {/* Background & Text Colors */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Background Color</label>
                                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
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
                                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
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

                                  <div className="rounded-xl border border-accent/10 bg-accent-muted/20 p-3.5">
                                    <p className="text-[10px] font-semibold text-gray-500 leading-normal select-none">
                                      {canDragCtaInPreview
                                        ? 'Drag the CTA button in the preview player to position it.'
                                        : isPlaying
                                          ? 'Pause the video to drag and reposition the CTA in the preview.'
                                          : 'Use the CTA tab with the video paused to drag the button in the preview.'}
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
                                        className="w-full accent-accent h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
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
                                        className="w-full accent-accent h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                                      />
                                    </div>
                                  </div>

                                  {/* Border Color (only if Border Width > 0) */}
                                  {(cta.borderWidth ?? 0) > 0 && (
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Border Color</label>
                                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
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
                      className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-accent text-xs font-bold text-gray-500 hover:text-accent bg-white hover:bg-accent-muted/10 transition shadow-sm flex items-center justify-center gap-1.5"
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
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-6">
                
                {/* Form Toggle */}
                <div className="flex items-center gap-3 py-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setEditFormEnabled(!editFormEnabled)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editFormEnabled ? 'bg-accent' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        editFormEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm font-semibold text-gray-700">Forms</span>
                </div>

                <fieldset
                  disabled={!editFormEnabled}
                  className={[
                    'space-y-4 pt-2',
                    editFormEnabled ? '' : 'opacity-60 pointer-events-none select-none',
                  ].join(' ')}
                >
                    {/* Always-visible core settings */}
                    <div className="space-y-4">
                      {/* Gating time */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-500 block">Gating trigger point</label>
                        <select
                          value={typeof editFormTime === 'number' ? 'timestamp' : editFormTime}
                          onChange={(e: any) => {
                            const v = e.target.value;
                            if (v === 'timestamp') {
                              setEditFormTime(typeof editFormTime === 'number' ? editFormTime : 5);
                            } else {
                              setEditFormTime(v);
                            }
                          }}
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent shadow-sm"
                        >
                          <option value="pre-roll">Pre-roll (Before video starts)</option>
                          <option value="post-roll">Post-roll (When video finishes)</option>
                          <option value="timestamp">At timestamp (seconds)</option>
                        </select>
                      </div>

                      {typeof editFormTime === 'number' && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-500 block">Timestamp (seconds)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={Number.isFinite(editFormTime) ? editFormTime : 0}
                            onChange={(e) => setEditFormTime(Math.max(0, parseFloat(e.target.value || '0')))}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm"
                          />
                        </div>
                      )}

                      {/* Title */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-500 block">Form title</label>
                        <input
                          type="text"
                          value={editFormTitle}
                          onChange={(e) => setEditFormTitle(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-500 block">Form description</label>
                        <input
                          type="text"
                          value={editFormDescription}
                          onChange={(e) => setEditFormDescription(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm"
                        />
                      </div>

                      {/* Button text */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-500 block">Submit button text</label>
                        <input
                          type="text"
                          value={editFormButtonText}
                          onChange={(e) => setEditFormButtonText(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm"
                        />
                      </div>

                      {/* Success message */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-gray-500 block">Success message</label>
                        <input
                          type="text"
                          value={editFormThankYouMessage}
                          onChange={(e) => setEditFormThankYouMessage(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Always-visible fields + consent/skip */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] font-bold text-gray-500 block">Form fields</label>
                        <button
                          type="button"
                          onClick={() => {
                            const newId = `f_${Math.random().toString(36).slice(2, 9)}`;
                            setEditFormFields([
                              ...editFormFields,
                              { id: newId, name: 'New field', type: 'text', required: false },
                            ]);
                            setOpenFormFieldId(newId);
                          }}
                          className="text-[10px] font-extrabold uppercase tracking-wider text-accent hover:opacity-90"
                        >
                          + Add field
                        </button>
                      </div>

                      <div className="space-y-2">
                        {editFormFields.map((f, idx) => (
                          <div
                            key={f.id}
                            draggable={editFormEnabled}
                            onDragStart={() => setDraggingFormFieldId(f.id)}
                            onDragEnd={() => setDraggingFormFieldId(null)}
                            onDragOver={(e) => {
                              if (!draggingFormFieldId || draggingFormFieldId === f.id) return;
                              e.preventDefault();
                            }}
                            onDrop={(e) => {
                              if (!draggingFormFieldId || draggingFormFieldId === f.id) return;
                              e.preventDefault();
                              const fromIdx = editFormFields.findIndex((x) => x.id === draggingFormFieldId);
                              const toIdx = editFormFields.findIndex((x) => x.id === f.id);
                              if (fromIdx < 0 || toIdx < 0) return;

                              const next = [...editFormFields];
                              const [moved] = next.splice(fromIdx, 1);
                              next.splice(toIdx, 0, moved);
                              setEditFormFields(next);
                            }}
                            className={[
                              'rounded-xl border bg-white shadow-sm overflow-hidden',
                              draggingFormFieldId === f.id ? 'border-accent' : 'border-gray-200',
                            ].join(' ')}
                          >
                            <button
                              type="button"
                              onClick={() => setOpenFormFieldId(openFormFieldId === f.id ? null : f.id)}
                              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50 transition select-none"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-gray-300 cursor-grab active:cursor-grabbing">
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <circle cx="9" cy="7" r="1.4" />
                                    <circle cx="15" cy="7" r="1.4" />
                                    <circle cx="9" cy="12" r="1.4" />
                                    <circle cx="15" cy="12" r="1.4" />
                                    <circle cx="9" cy="17" r="1.4" />
                                    <circle cx="15" cy="17" r="1.4" />
                                  </svg>
                                </span>
                                <div className="flex flex-col items-start min-w-0">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                                    Field {idx + 1}
                                  </span>
                                  <span className="text-xs font-semibold text-gray-900 truncate">
                                    {f.name || 'Untitled'}
                                    <span className="text-gray-400 font-bold"> · </span>
                                    <span className="text-gray-500 font-bold">{f.type}</span>
                                    {f.required ? <span className="text-gray-400 font-bold"> · required</span> : null}
                                  </span>
                                </div>
                              </div>

                              <svg
                                className={[
                                  'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
                                  openFormFieldId === f.id ? 'rotate-180' : 'rotate-0',
                                ].join(' ')}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2.2"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 9l-7.5 7.5L4.5 9" />
                              </svg>
                            </button>

                            {openFormFieldId === f.id && (
                              <div className="px-3 pb-3">
                                <div className="flex items-center justify-between gap-2 py-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (idx <= 0) return;
                                        const next = [...editFormFields];
                                        const tmp = next[idx - 1];
                                        next[idx - 1] = next[idx];
                                        next[idx] = tmp;
                                        setEditFormFields(next);
                                      }}
                                      disabled={idx <= 0}
                                      className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 disabled:opacity-40 hover:text-gray-700 transition"
                                    >
                                      Move up
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (idx >= editFormFields.length - 1) return;
                                        const next = [...editFormFields];
                                        const tmp = next[idx + 1];
                                        next[idx + 1] = next[idx];
                                        next[idx] = tmp;
                                        setEditFormFields(next);
                                      }}
                                      disabled={idx >= editFormFields.length - 1}
                                      className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 disabled:opacity-40 hover:text-gray-700 transition"
                                    >
                                      Move down
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = editFormFields.filter((x) => x.id !== f.id);
                                      setEditFormFields(next.length ? next : editFormFields);
                                      if (openFormFieldId === f.id) setOpenFormFieldId(null);
                                    }}
                                    className="text-[10px] font-bold text-red-500 hover:text-red-700 transition"
                                    disabled={editFormFields.length <= 1}
                                    title={editFormFields.length <= 1 ? 'At least one field is required' : 'Remove field'}
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="mt-1 grid grid-cols-1 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 block uppercase">Label</label>
                                    <input
                                      type="text"
                                      value={f.name}
                                      onChange={(e) => {
                                        const name = e.target.value;
                                        setEditFormFields(editFormFields.map((x) => (x.id === f.id ? { ...x, name } : x)));
                                      }}
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Type</label>
                                      <select
                                        value={f.type}
                                        onChange={(e) => {
                                          const type = e.target.value as 'email' | 'text' | 'tel';
                                          setEditFormFields(editFormFields.map((x) => (x.id === f.id ? { ...x, type } : x)));
                                        }}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition"
                                      >
                                        <option value="text">Text</option>
                                        <option value="email">Email</option>
                                        <option value="tel">Phone</option>
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-gray-400 block uppercase">Required</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditFormFields(editFormFields.map((x) => (x.id === f.id ? { ...x, required: !x.required } : x)));
                                        }}
                                        className={`w-full rounded-lg border px-3 py-2 text-xs font-extrabold transition ${
                                          f.required
                                            ? 'border-accent bg-accent-muted/20 text-accent'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                        }`}
                                      >
                                        {f.required ? 'Required' : 'Optional'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-1 space-y-3">
                      <div className="flex items-center justify-between py-1.5 select-none">
                        <span className="text-xs font-semibold text-gray-500">Allow skip</span>
                        <button
                          type="button"
                          onClick={() => setEditFormSkipEnabled(!editFormSkipEnabled)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            editFormSkipEnabled ? 'bg-accent' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              editFormSkipEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-1.5 select-none">
                        <span className="text-xs font-semibold text-gray-500">Require consent checkbox</span>
                        <button
                          type="button"
                          onClick={() => setEditFormRequireConsent(!editFormRequireConsent)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            editFormRequireConsent ? 'bg-accent' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              editFormRequireConsent ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {editFormRequireConsent && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-gray-500 block">Consent text</label>
                          <input
                            type="text"
                            value={editFormConsentText}
                            onChange={(e) => setEditFormConsentText(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent focus:ring-4 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm"
                          />
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setFormEditorOpen(!formEditorOpen)}
                        className="w-full flex items-center justify-between px-3.5 py-3 select-none"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-extrabold text-gray-900">Edit form</span>
                          <span className="text-[10px] font-semibold text-gray-500">
                            Design + fields + consent/skip
                          </span>
                        </div>
                        <svg className={`h-4 w-4 text-gray-400 transition-transform ${formEditorOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 9l-7.5 7.5L4.5 9" />
                        </svg>
                      </button>

                      {formEditorOpen && (
                        <div className="px-3.5 pb-4 space-y-4">
                          <div className="flex items-center justify-between py-1.5 select-none">
                            <span className="text-xs font-semibold text-gray-500">Match Colors tab</span>
                            <button
                              type="button"
                              onClick={() => setEditFormUseThemeColors(!editFormUseThemeColors)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                editFormUseThemeColors ? 'bg-accent' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  editFormUseThemeColors ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Design */}
                          <div className="space-y-3 pt-1">
                            <label className="text-[11px] font-bold text-gray-500 block">Design</label>

                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-400 block uppercase">Font</label>
                              <select
                                value={editFormFontFamily}
                                onChange={(e) => setEditFormFontFamily(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition shadow-sm"
                              >
                                <option value="Inter, system-ui, sans-serif">Inter</option>
                                <option value="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">System</option>
                                <option value="Poppins, system-ui, sans-serif">Poppins</option>
                                <option value="Manrope, system-ui, sans-serif">Manrope</option>
                                <option value="DM Sans, system-ui, sans-serif">DM Sans</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 block uppercase">Form bg</label>
                                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
                                  <div className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer">
                                    <div className="absolute inset-0" style={{ backgroundColor: editFormBgColor || '#ffffff' }} />
                                    <input
                                      type="color"
                                      value={editFormBgColor || '#ffffff'}
                                      onChange={(e) => setEditFormBgColor(e.target.value)}
                                      className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                                      disabled={editFormUseThemeColors}
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={(editFormBgColor || '#ffffff').toUpperCase()}
                                    onChange={(e) => setEditFormBgColor(e.target.value)}
                                    className="w-full bg-transparent text-[11px] font-bold text-gray-700 outline-none"
                                    disabled={editFormUseThemeColors}
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 block uppercase">Text</label>
                                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
                                  <div className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer">
                                    <div className="absolute inset-0" style={{ backgroundColor: editFormTextColor || '#000000' }} />
                                    <input
                                      type="color"
                                      value={editFormTextColor || '#000000'}
                                      onChange={(e) => setEditFormTextColor(e.target.value)}
                                      className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={(editFormTextColor || '#000000').toUpperCase()}
                                    onChange={(e) => setEditFormTextColor(e.target.value)}
                                    className="w-full bg-transparent text-[11px] font-bold text-gray-700 outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 block uppercase">Button bg</label>
                                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
                                  <div className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer">
                                    <div className="absolute inset-0" style={{ backgroundColor: editFormButtonColor || '#F97316' }} />
                                    <input
                                      type="color"
                                      value={editFormButtonColor || '#F97316'}
                                      onChange={(e) => setEditFormButtonColor(e.target.value)}
                                      className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                                      disabled={editFormUseThemeColors}
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={(editFormButtonColor || '#F97316').toUpperCase()}
                                    onChange={(e) => setEditFormButtonColor(e.target.value)}
                                    className="w-full bg-transparent text-[11px] font-bold text-gray-700 outline-none"
                                    disabled={editFormUseThemeColors}
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 block uppercase">Button text</label>
                                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
                                  <div className="relative w-6 h-6 rounded-md overflow-hidden border border-gray-100 flex-shrink-0 cursor-pointer">
                                    <div className="absolute inset-0" style={{ backgroundColor: editFormButtonTextColor || '#ffffff' }} />
                                    <input
                                      type="color"
                                      value={editFormButtonTextColor || '#ffffff'}
                                      onChange={(e) => setEditFormButtonTextColor(e.target.value)}
                                      className="absolute inset-[-10px] w-[calc(100%+20px)] h-[calc(100%+20px)] opacity-0 cursor-pointer"
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={(editFormButtonTextColor || '#ffffff').toUpperCase()}
                                    onChange={(e) => setEditFormButtonTextColor(e.target.value)}
                                    className="w-full bg-transparent text-[11px] font-bold text-gray-700 outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold select-none">
                                <span className="text-gray-500">Overlay transparency</span>
                                <span className="text-gray-900 font-mono font-bold">{Math.round((1 - editFormOverlayOpacity) * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min={0.2}
                                max={0.95}
                                step={0.05}
                                value={editFormOverlayOpacity}
                                onChange={(e) => setEditFormOverlayOpacity(parseFloat(e.target.value))}
                                className="w-full accent-accent h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold select-none">
                                <span className="text-gray-500">Form card opacity</span>
                                <span className="text-gray-900 font-mono font-bold">{Math.round(editFormCardOpacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min={0.5}
                                max={1}
                                step={0.05}
                                value={editFormCardOpacity}
                                onChange={(e) => setEditFormCardOpacity(parseFloat(e.target.value))}
                                className="w-full accent-accent h-1.5 rounded-full cursor-pointer appearance-none bg-gray-200"
                              />
                            </div>

                            {/* Field background/border controls removed (defaults are white-styled) */}
                          </div>

                          {/* Core form logic moved outside "Edit form" */}
                        </div>
                      )}
                    </div>
                    
                </fieldset>

              </div>
            )}

            {/* Subtitles tab */}
            {activeTab === 'subtitles' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Closed Captions</h3>

                {video.captionsUrl ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900">Captions active</p>
                        <p className="text-[10px] font-semibold text-gray-500 mt-0.5 leading-relaxed">
                          Shown in the live preview and on your published player when captions are enabled in the browser.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <label
                        className={`btn-action-secondary relative flex-1 cursor-pointer text-center ${
                          captionAction !== null ? 'pointer-events-none opacity-50' : ''
                        }`}
                      >
                        {captionAction === 'upload' ? 'Uploading…' : 'Replace file'}
                        <input
                          ref={captionInputRef}
                          type="file"
                          accept=".vtt,.srt,text/vtt,application/x-subrip"
                          disabled={captionAction !== null || video.status !== 'ready'}
                          onChange={handleCaptionsUpload}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={captionAction !== null}
                        onClick={handleRemoveCaptions}
                        className="btn-action-secondary flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {captionAction === 'remove' ? 'Removing…' : 'Remove'}
                      </button>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mt-6">
                      <button
                        type="button"
                        onClick={handleOpenCaptionEditor}
                        className="w-full flex items-center justify-between px-3.5 py-3 select-none"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-extrabold text-gray-900">Edit Caption Text</span>
                          <span className="text-[10px] font-semibold text-gray-500">
                            Manually fix spelling or AI transcription errors
                          </span>
                        </div>
                        <svg className={`h-4 w-4 text-gray-400 transition-transform ${captionEditorOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 9l-7.5 7.5L4.5 9" />
                        </svg>
                      </button>

                      {captionEditorOpen && (
                        <div className="px-3.5 pb-4 space-y-4">
                          {/* {editorDebugText && (
                            <pre className="text-[10px] text-red-500 bg-red-50 p-2 rounded whitespace-pre-wrap">{editorDebugText}</pre>
                          )} */}
                          {editorLoading ? (
                            <p className="text-[11px] font-semibold text-gray-500">Loading editor...</p>
                          ) : parsedCues.length === 0 ? (
                            <p className="text-[11px] font-semibold text-gray-500">No editable speech found in this video.</p>
                          ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {parsedCues.map((cue, idx) => (
                                <div key={cue.id} className="space-y-1">
                                  <span className="text-[10px] font-mono text-gray-400 font-bold">{cue.header.split(' --> ')[0]}</span>
                                  <textarea
                                    rows={2}
                                    value={cue.text}
                                    onChange={(e) => {
                                      const newCues = [...parsedCues];
                                      newCues[idx].text = e.target.value;
                                      setParsedCues(newCues);
                                    }}
                                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-accent focus:ring-2 focus:ring-[hsl(var(--accent)/0.15)] transition shadow-sm resize-none"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={handleSaveCaptionsText}
                              disabled={isSavingCaptions || parsedCues.length === 0}
                              className="btn-action-primary text-xs px-4 py-2"
                            >
                              {isSavingCaptions ? 'Saving...' : 'Save Text Edits'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {video.audioExtracted && (
                      <button
                        type="button"
                        onClick={handleGenerateAICaptions}
                        disabled={captionAction !== null || video.status !== 'ready'}
                        className={`relative rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:border-indigo-300 hover:bg-indigo-50 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                          captionAction !== null || video.status !== 'ready'
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }`}
                      >
                        {captionAction === 'generate' ? (
                          <span className="text-xs font-bold text-indigo-900">✨ Generating... (This takes a few seconds)</span>
                        ) : (
                          <>
                            <svg className="h-6 w-6 text-indigo-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09l2.846.813-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                            </svg>
                            <span className="text-xs font-bold text-indigo-900">✨ Generate AI Captions</span>
                            <span className="text-[10px] text-indigo-700/60 font-semibold mt-1">
                              Uses Deepgram AI to transcribe audio.
                            </span>
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-3">
                      <hr className="flex-1 border-gray-100" />
                      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">OR</span>
                      <hr className="flex-1 border-gray-100" />
                    </div>

                    <label
                      className={`relative rounded-lg border-2 border-dashed border-gray-200 hover:border-accent-border p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                        captionAction !== null || video.status !== 'ready'
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }`}
                    >
                      {captionAction === 'upload' ? (
                        <span className="text-xs font-bold text-gray-900">Uploading…</span>
                      ) : (
                        <>
                          <svg className="h-6 w-6 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                          </svg>
                          <span className="text-xs font-bold text-gray-900">Upload .vtt or .srt file</span>
                          <span className="text-[10px] text-gray-400 font-semibold mt-1">
                            WebVTT and SubRip supported. SRT is converted to VTT automatically.
                          </span>
                        </>
                      )}
                      <input
                        ref={captionInputRef}
                        type="file"
                        accept=".vtt,.srt,text/vtt,application/x-subrip"
                        disabled={captionAction !== null || video.status !== 'ready'}
                        onChange={handleCaptionsUpload}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      />
                    </label>
                  </div>
                )}

                {video.status !== 'ready' && (
                  <p className="text-[10px] font-semibold text-amber-700 leading-relaxed">
                    Captions can be uploaded after the video finishes processing.
                  </p>
                )}

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mt-6">
                  <button
                    type="button"
                    onClick={() => setCaptionStylingOpen(!captionStylingOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-3 select-none"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-extrabold text-gray-900">Caption styling</span>
                      <span className="text-[10px] font-semibold text-gray-500">
                        Colors, font family, and size
                      </span>
                    </div>
                    <svg className={`h-4 w-4 text-gray-400 transition-transform ${captionStylingOpen ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 9l-7.5 7.5L4.5 9" />
                    </svg>
                  </button>

                  {captionStylingOpen && (
                    <div className="px-3.5 pb-4 space-y-4">
                      <div className="space-y-3 pt-1">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 block uppercase">Font Family</label>
                          <select
                            value={editCaptionFontFamily}
                            onChange={(e) => setEditCaptionFontFamily(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition shadow-sm"
                          >
                            <option value="Inter, system-ui, sans-serif">Inter</option>
                            <option value="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">System</option>
                            <option value="Poppins, system-ui, sans-serif">Poppins</option>
                            <option value="Manrope, system-ui, sans-serif">Manrope</option>
                            <option value="DM Sans, system-ui, sans-serif">DM Sans</option>
                            <option value="monospace">Monospace</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 block uppercase">Font Size</label>
                          <select
                            value={editCaptionFontSize}
                            onChange={(e) => setEditCaptionFontSize(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-900 outline-none focus:border-accent transition shadow-sm"
                          >
                            <option value="0.75rem">Small</option>
                            <option value="1rem">Medium</option>
                            <option value="1.25rem">Large</option>
                            <option value="1.5rem">Extra Large</option>
                            <option value="2rem">Massive</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 block uppercase">Background</label>
                            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
                              <input
                                type="color"
                                value={editCaptionBgColor.startsWith('#') ? editCaptionBgColor.slice(0, 7) : '#000000'}
                                onChange={(e) => setEditCaptionBgColor(e.target.value)}
                                className="h-6 w-6 shrink-0 cursor-pointer rounded bg-transparent p-0 border-0 outline-none"
                              />
                              <input
                                type="text"
                                value={editCaptionBgColor}
                                onChange={(e) => setEditCaptionBgColor(e.target.value)}
                                className="w-full bg-transparent text-[11px] font-semibold text-gray-700 outline-none"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 block uppercase">Text</label>
                            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 w-full focus-within:border-accent transition shadow-inner">
                              <input
                                type="color"
                                value={editCaptionTextColor.startsWith('#') ? editCaptionTextColor : '#ffffff'}
                                onChange={(e) => setEditCaptionTextColor(e.target.value)}
                                className="h-6 w-6 shrink-0 cursor-pointer rounded bg-transparent p-0 border-0 outline-none"
                              />
                              <input
                                type="text"
                                value={editCaptionTextColor}
                                onChange={(e) => setEditCaptionTextColor(e.target.value)}
                                className="w-full bg-transparent text-[11px] font-semibold text-gray-700 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Danger Zone tab */}
            {activeTab === 'danger' && (
              <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-gray-200 space-y-4">
                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Danger Zone</h3>
                <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                  This action is permanent and non-reversible. Deleting this asset will purge all manifest files from storage and clean up DB records completely.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleDeleteVideo}
                    className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold tracking-wide transition border ${
                      deleteConfirm
                        ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
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
              <div className="border-t border-[hsl(var(--hairline))] pt-2">
                <VideoAnalytics 
                  videoId={video.id} 
                  duration={duration}
                  onHover={handleChartSeek}
                />
              </div>
            )}

            {/* Leads Tab */}
            {activeTab === 'leads' && (
              <div className="border-t border-[hsl(var(--hairline))] pt-2">
                <VideoLeads videoId={video.id} />
              </div>
            )}

            {/* SAVE BUTTON FOR CONFIG FORM */}
            {activeTab !== 'analytics' && activeTab !== 'danger' && activeTab !== 'leads' && (
              <div className="pt-4 border-t border-gray-150">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="btn-accent w-full !h-10 min-h-10 text-xs font-bold tracking-wider shadow"
                >
                  <span className="block truncate">
                  {saving ? (
                    'Saving…'
                  ) : saveSuccess ? (
                    'Saved!'
                  ) : (
                    'Save'
                  )}
                  </span>
                </button>
              </div>
            )}

          </div>
        </section>

        {/* COLUMN 3: LIVE PREVIEW PLAYER */}
        <section className="detail-preview">
          
          {/* Header row overlay inside section */}
          <div className="mb-6 flex w-full max-w-4xl items-center justify-between">
            <span className="section-label flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live Preview
            </span>
            <button
              type="button"
              onClick={() => {
                if (!document.fullscreenElement) {
                  previewContainerRef.current?.requestFullscreen().catch(err => console.error(err));
                } else {
                  document.exitFullscreen();
                }
              }}
              className="icon-button"
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
              className="group relative overflow-hidden rounded-xl border border-[hsl(var(--hairline))] shadow-[0_20px_50px_-16px_rgba(15,23,42,0.2)] ring-1 ring-black/5"
            >
              <CustomVideoPlayer
                videoId={video.id}
                workspaceId={video.workspaceId}
                status={video.status}
                posterUrl={thumbnailFor(video, posterPreviewKey)}
                hlsManifestUrl={resolveMediaUrl(video.hlsManifestUrl) ?? video.hlsManifestUrl}
                originalMp4Url={(video as any).originalMp4Url}
                captionsUrl={(() => {
                  const base = resolveMediaUrl(video.captionsUrl);
                  if (!base) return undefined;
                  return `${base}${base.includes('?') ? '&' : '?'}t=${captionsPreviewKey}`;
                })()}
                isLivePreview={true}
                onCtaMouseDown={(e, ctaId) => handleCtaMouseDown(e, ctaId)}
                onPlayStateChange={(playing) => setIsPlaying(playing)}
                onAspectRatioChange={setAspectRatio}
                onDurationChange={setDuration}
                settings={{
                  autoplay: editAutoplay || editBgVideo,
                  loop: editLoop || editBgVideo,
                  muted: editMuted || editAutoplay || editBgVideo,
                  controlsStyle: editControlsStyle,
                  primaryColor: editPrimaryColor,
                  bgColor: editBgColor,
                  captionBgColor: editCaptionBgColor,
                  captionTextColor: editCaptionTextColor,
                  captionFontFamily: editCaptionFontFamily,
                  captionFontSize: editCaptionFontSize,
                  downloadEnabled: editDownloadEnabled,
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
                  formSkipEnabled: editFormSkipEnabled,
                  formRequireConsent: editFormRequireConsent,
                  formConsentText: editFormConsentText,
                  formOverlayOpacity: editFormOverlayOpacity,
                  formCardOpacity: editFormCardOpacity,
                  formFieldBgColor: editFormFieldBgColor,
                  formFieldBorderColor: editFormFieldBorderColor,
                  formUseThemeColors: editFormUseThemeColors,
                  formFontFamily: editFormFontFamily,
                  formFields: editFormFields,
                  ctaEnabled: editCtaEnabled,
                  ctas: editCtas,
                  clickToPlay: editClickToPlay,
                  startInView: editStartInView,
                  playInline: editPlayInline,
                  bgVideo: editBgVideo,
                  playFromStartFullscreen: editPlayFromStartFullscreen,
                  brandingEnabled: editBrandingEnabled,
                  brandingLogoUrl: editBrandingLogoUrl,
                  brandingPosition: editBrandingPosition,
                  brandingSize: editBrandingSize,
                  keyboardShortcuts: editKeyboardShortcuts,
                  showExitThumbnail: editShowExitThumbnail,
                  playButtonStyle: editPlayButtonStyle,
                  playButtonIconUrl: editPlayButtonIconUrl,
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
                  showCaptionsControl: editShowCaptionsControl,
                  theme: editTheme,
                  activeTab: activeTab,
                }}
              />
            </div>
          </div>

          {/* Static Video Details Below Preview */}
          <div className="w-full max-w-4xl mx-auto mt-4 px-4 py-3 bg-white border border-gray-100 rounded-xl flex items-center justify-around text-xs font-medium text-gray-500 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Duration</span>
              <span className="text-gray-800 font-semibold">{formatDuration(duration || video.durationSeconds || 0)}</span>
            </div>
            <div className="h-8 w-px bg-gray-100"></div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Uploaded</span>
              <span className="text-gray-800 font-semibold">{new Date(video.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="h-8 w-px bg-gray-100"></div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Status</span>
              <span className="text-gray-800 font-semibold capitalize">
                {video.status === 'ready' ? (
                  <span className="text-emerald-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ready</span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {video.status}</span>
                )}
              </span>
            </div>
          </div>

        </section>

        </div>
      </div>
      
      <ShareModal 
        video={video}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        notifySuccess={notifySuccess}
      />
    </div>
  );
}
