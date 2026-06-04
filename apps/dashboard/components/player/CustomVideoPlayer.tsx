'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseVttCues, type VttCue } from '../../app/lib/captions';

export interface CustomVideoPlayerRef {
  seekTo: (time: number) => void;
}

function formatDuration(seconds?: number) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export interface CustomVideoPlayerProps {
  videoId: string;
  workspaceId: string;
  status: string;
  posterUrl?: string;
  hlsManifestUrl?: string;
  originalMp4Url?: string;
  captionsUrl?: string;
  settings: any;
  isLivePreview?: boolean;
  onCtaMouseDown?: (e: React.MouseEvent, ctaId: string) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onAspectRatioChange?: (ratio: number) => void;
  onDurationChange?: (duration: number) => void;
  onRegisterSeek?: (seekFn: (time: number) => void) => void;
}

export function CustomVideoPlayer({
  videoId,
  workspaceId,
  status,
  posterUrl,
  hlsManifestUrl,
  originalMp4Url,
  captionsUrl,
  settings,
  isLivePreview = false,
  onCtaMouseDown,
  onPlayStateChange,
  onAspectRatioChange,
  onDurationChange,
  onRegisterSeek,
}: CustomVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsInstanceRef = useRef<any>(null);
  const isPlayingRef = useRef(false);

  // Register seek function with parent
  useEffect(() => {
    if (onRegisterSeek) {
      onRegisterSeek((time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
        }
      });
    }
  }, [onRegisterSeek]);

  // Settings
  const autoplay = settings.autoplay ?? false;
  const loop = settings.loop ?? false;
  const muted = settings.muted ?? false;
  const primaryColor = settings.primaryColor ?? '#5B4FE8';
  const bgColor = settings.bgColor ?? '#000000';
  const theme = settings.theme ?? 'default';
  
  // Controls
  const controlsStyle = settings.controlsStyle ?? 'show';
  const showPlayPause = settings.showPlayPause ?? true;
  const showProgress = settings.showProgress ?? true;
  const showCurrentTime = settings.showCurrentTime ?? true;
  const showMute = settings.showMute ?? true;
  const showVolume = settings.showVolume ?? true;
  const showSettings = settings.showSettings ?? true;
  const showFullscreen = settings.showFullscreen ?? true;
  const showPlaybackSpeed = settings.showPlaybackSpeed ?? true;
  const showSelectQuality = settings.showSelectQuality ?? true;
  const showCaptionsControl = settings.showCaptionsControl ?? true;
  
  // Play Button
  const showLargePlayButton = settings.showLargePlayButton ?? true;
  const playButtonSize = settings.playButtonSize ?? 64;
  const playButtonIconScale = settings.playButtonIconScale ?? 45;
  const playButtonStyle = settings.playButtonStyle ?? 'circle';
  const playButtonBgTransparent = settings.playButtonBgTransparent ?? false;
  const playButtonBorderWidth = settings.playButtonBorderWidth ?? 0;
  const playButtonBorderColor = settings.playButtonBorderColor ?? '#ffffff';
  const playButtonText = settings.playButtonText ?? '';
  const playButtonIconUrl = settings.playButtonIconUrl ?? null;
  
  // Captions
  const captionBgColor = settings.captionBgColor ?? 'rgba(0, 0, 0, 0.75)';
  const captionTextColor = settings.captionTextColor ?? '#ffffff';
  const captionFontFamily = settings.captionFontFamily ?? 'Inter, system-ui, sans-serif';
  const captionFontSize = settings.captionFontSize ?? '1rem';
  
  // Branding
  const brandingEnabled = settings.brandingEnabled ?? false;
  const brandingLogoUrl = settings.brandingLogoUrl ?? null;
  const brandingPosition = settings.brandingPosition ?? 'top-left';
  const brandingSize = settings.brandingSize ?? 100;
  
  // Form
  const formEnabled = settings.formEnabled ?? false;
  const formTime = settings.formTime ?? 'pre-roll';
  const formTitle = settings.formTitle ?? 'Unlock this video';
  const formDescription = settings.formDescription ?? 'Enter your email to watch';
  const formButtonText = settings.formButtonText ?? 'Submit';
  const formButtonColor = settings.formButtonColor ?? primaryColor;
  const formButtonTextColor = settings.formButtonTextColor ?? '#ffffff';
  const formTextColor = settings.formTextColor ?? '#ffffff';
  const formBgColor = settings.formBgColor ?? '#ffffff';
  const formAlignment = settings.formAlignment ?? 'center';
  const formFields = settings.formFields ?? [
    { id: 'f_name', name: 'Name', type: 'text', required: true },
    { id: 'f_email', name: 'Email', type: 'email', required: true },
  ];
  
  // Misc
  const clickToPlay = settings.clickToPlay ?? true;
  const playInline = settings.playInline ?? false;
  const showExitThumbnail = settings.showExitThumbnail ?? false;
  const ctas = Array.isArray(settings.ctas) ? settings.ctas : [];

  const [isMuted, setIsMuted] = useState(muted);
  const [ccEnabled, setCcEnabled] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [settingsMenuState, setSettingsMenuState] = useState<'closed' | 'main' | 'speed' | 'quality'>('closed');
  const [hlsLevels, setHlsLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [previewCues, setPreviewCues] = useState<VttCue[]>([]);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showThankYou, setShowThankYou] = useState(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    onPlayStateChange?.(isPlaying);
  }, [isPlaying, onPlayStateChange]);

  useEffect(() => {
    setIsMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (!captionsUrl) {
      setPreviewCues([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(captionsUrl);
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (!cancelled) setPreviewCues(parseVttCues(text));
      } catch {
        if (!cancelled) setPreviewCues([]);
      }
    })();
    return () => { cancelled = true; };
  }, [captionsUrl]);

  const activeCue = ccEnabled && previewCues.length > 0
    ? previewCues.find((c) => currentTime >= c.start && currentTime < c.end)
    : undefined;

  const destroyHls = () => {
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }
  };

  useEffect(() => {
    const htmlVideo = videoRef.current;
    if (!htmlVideo || status !== 'ready' || !hlsManifestUrl) return;

    const savedTime = htmlVideo.currentTime;

    import('hls.js').then(({ default: Hls }) => {
      if (Hls.isSupported()) {
        destroyHls();
        const hls = new Hls({ startLevel: -1, capLevelToPlayerSize: true });

        hls.on(Hls.Events.MANIFEST_PARSED, (_event: any, data: any) => {
          setHlsLevels(data.levels || []);
          if (savedTime > 0) htmlVideo.currentTime = savedTime;
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event: any, data: any) => {
          setCurrentLevel(data.level);
        });

        hls.on(Hls.Events.ERROR, (event, dataHls) => {
          if (dataHls.fatal) {
            if (dataHls.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.destroy();
              if (originalMp4Url) {
                htmlVideo.src = originalMp4Url;
              } else {
                setPlayerError('Video unavailable');
              }
            } else {
              hls.destroy();
              if (originalMp4Url) htmlVideo.src = originalMp4Url;
            }
          }
        });

        hls.loadSource(hlsManifestUrl);
        hls.attachMedia(htmlVideo);
        hlsInstanceRef.current = hls;
      } else if (htmlVideo.canPlayType('application/vnd.apple.mpegurl')) {
        destroyHls();
        htmlVideo.src = hlsManifestUrl;
        if (savedTime > 0) htmlVideo.currentTime = savedTime;
      }
    });

    return () => destroyHls();
  }, [videoId, status, hlsManifestUrl, originalMp4Url]);

  // Form persistence check
  useEffect(() => {
    try {
      const key = `framevid_unlock:${workspaceId}:${videoId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        setFormSubmitted(true);
        setFormVisible(false);
      }
    } catch {}
  }, [videoId, workspaceId]);

  useEffect(() => {
    if (!formEnabled) {
      setFormVisible(false);
      setFormSubmitted(false);
      return;
    }
    if (formTime === 'pre-roll' && !formSubmitted) {
      setFormVisible(true);
      videoRef.current?.pause();
    } else if (formTime === 'post-roll') {
      setFormVisible(false);
    }
  }, [formEnabled, formTime, formSubmitted]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (formVisible && formEnabled && formTime === 'pre-roll' && !formSubmitted) return;
    if (autoplay) {
      vid.play().catch(() => {});
    }
  }, [autoplay, formVisible, formEnabled, formTime, formSubmitted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = loop;
      videoRef.current.playsInline = playInline;
      videoRef.current.muted = isMuted || autoplay;
    }
  }, [loop, playInline, isMuted, autoplay]);

  const togglePlay = () => {
    if (!clickToPlay || formVisible) return;
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play().catch(() => {});
    else vid.pause();
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const currentT = e.currentTarget.currentTime;
    setCurrentTime(currentT);
    
    if (formEnabled && !formSubmitted && !formVisible) {
      if (typeof formTime === 'number' && currentT >= formTime) {
        setFormVisible(true);
        e.currentTarget.pause();
      }
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    if (videoEl.videoWidth && videoEl.videoHeight) {
      const ratio = videoEl.videoWidth / videoEl.videoHeight;
      setAspectRatio(ratio);
      onAspectRatioChange?.(ratio);
    }
    const d = videoEl.duration || 0;
    setDuration(d);
    onDurationChange?.(d);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleEnded = () => {
    if (formEnabled && formTime === 'post-roll' && !formSubmitted) {
      setFormVisible(true);
    }
    if (videoRef.current) videoRef.current.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLivePreview) {
      // In dashboard preview, mock the submission
      setFormVisible(false);
      setFormSubmitted(true);
      setShowThankYou(true);
      setTimeout(() => setShowThankYou(false), 1600);
      if (formTime !== 'post-roll') videoRef.current?.play().catch(() => {});
      return;
    }

    setFormError(null);
    setFormSubmitting(true);
    try {
      const payloadFields: Record<string, string> = {};
      for (const f of formFields) {
        payloadFields[f.id] = (formData[f.id] || '').trim();
      }
      const res = await fetch(`/api/videos/${videoId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: payloadFields, source: 'shared-player' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to submit form');

      setShowThankYou(true);
      setTimeout(() => setShowThankYou(false), 1600);
      setFormVisible(false);
      setFormSubmitted(true);

      try {
        const key = `framevid_unlock:${workspaceId}:${videoId}`;
        localStorage.setItem(key, JSON.stringify({ unlockedAt: Date.now(), key: json?.unlock?.key }));
      } catch {}

      if (formTime !== 'post-roll') {
        videoRef.current?.play().catch(() => {});
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit');
    } finally {
      setFormSubmitting(false);
    }
  };

  const showPosterOverlay = !isPlaying && currentTime < 0.05 && Boolean(posterUrl);
  
  return (
    <div
      ref={containerRef}
      id={`player-${videoId}`}
      className="group relative w-full h-full overflow-hidden bg-black flex items-center justify-center rounded-xl"
      style={{ backgroundColor: bgColor }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        #player-${videoId} .hover-primary:hover { color: ${primaryColor} !important; }
        #player-${videoId} .hover-primary-border:hover { color: ${primaryColor} !important; border-color: ${primaryColor} !important; }
      ` }} />
      
      {playerError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-white text-center p-6 bg-red-500/20 rounded-xl border border-red-500/50 max-w-md">
            <h3 className="text-lg font-bold mb-2">Playback Error</h3>
            <p className="text-sm text-red-200">{playerError}</p>
          </div>
        </div>
      )}

      {status === 'ready' ? (
        <>
          <video
            ref={videoRef}
            crossOrigin="anonymous"
            autoPlay={autoplay}
            loop={loop}
            muted={isMuted || autoplay}
            controls={false}
            playsInline={playInline}
            poster={posterUrl}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleLoadedMetadata}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleEnded}
            onClick={togglePlay}
            onError={(e) => {
              const el = e.currentTarget;
              if (originalMp4Url && el.src !== originalMp4Url && !hlsInstanceRef.current) {
                el.src = originalMp4Url;
              } else {
                setPlayerError('The video media could not be loaded.');
              }
            }}
            className={`w-full h-full object-cover ${clickToPlay ? 'cursor-pointer' : 'cursor-default'}`}
          />

          {activeCue ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-14 z-30 flex justify-center px-4">
              <p
                className="max-w-[92%] rounded px-2 py-1 text-center leading-snug shadow-lg"
                style={{ backgroundColor: captionBgColor, color: captionTextColor, fontFamily: captionFontFamily, fontSize: captionFontSize }}
              >
                {activeCue.text}
              </p>
            </div>
          ) : null}

          {showPosterOverlay && posterUrl && (
            <img src={posterUrl} className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" alt="Poster" />
          )}

          {showExitThumbnail && posterUrl && (
            <div 
              className={`absolute inset-0 z-[6] pointer-events-none transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundImage: `url(${posterUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          )}

          {showLargePlayButton && controlsStyle !== 'hide' && !isPlaying && !formVisible && (
            <div onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="absolute inset-0 z-20 flex items-center justify-center bg-black/10 cursor-pointer transition-opacity duration-150">
              <button
                style={{
                  backgroundColor: playButtonBgTransparent ? 'transparent' : primaryColor,
                  width: playButtonText ? undefined : `${playButtonSize}px`,
                  height: playButtonText ? undefined : `${playButtonSize}px`,
                  borderWidth: `${playButtonBorderWidth}px`,
                  borderColor: playButtonBorderColor,
                  borderStyle: playButtonBorderWidth > 0 ? 'solid' : 'none',
                  borderRadius: playButtonText ? '9999px' : playButtonStyle === 'circle' ? '9999px' : playButtonStyle === 'rounded' ? '12px' : '0px',
                }}
                className={`text-white flex items-center justify-center gap-2.5 shadow-2xl transition-opacity duration-150 hover:opacity-90 ${playButtonText ? 'px-6 py-3 text-xs font-extrabold uppercase tracking-wider' : ''}`}
              >
                {playButtonIconUrl ? (
                  <img src={playButtonIconUrl} style={{ width: `${Math.round(playButtonSize * (playButtonIconScale / 100))}px`, height: `${Math.round(playButtonSize * (playButtonIconScale / 100))}px` }} className="object-contain" alt="Play" />
                ) : (
                  <svg style={{ width: playButtonText ? '16px' : `${Math.round(playButtonSize * (playButtonIconScale / 100))}px`, height: playButtonText ? '16px' : `${Math.round(playButtonSize * (playButtonIconScale / 100))}px` }} className={playButtonText ? "fill-current translate-x-[0.5px]" : "fill-current translate-x-[2px]"} viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
                {playButtonText && <span>{playButtonText}</span>}
              </button>
            </div>
          )}

          {brandingEnabled && brandingLogoUrl && (
            <div className={`absolute z-10 select-none flex items-center gap-1 opacity-80 pointer-events-none ${brandingPosition === 'top-left' ? 'top-4 left-4' : brandingPosition === 'top-right' ? 'top-4 right-4' : brandingPosition === 'bottom-left' ? 'bottom-4 left-4' : 'bottom-4 right-4'}`}>
              <img src={brandingLogoUrl} alt="Logo" style={{ maxWidth: `${brandingSize}px`, objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            </div>
          )}

          {controlsStyle !== 'hide' && (
            <div className={`absolute z-25 flex flex-col transition-opacity duration-300 group/controls ${controlsStyle === 'show' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${
              theme === 'minimal' ? 'bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/40 to-transparent' :
              theme === 'gradient' ? 'bottom-0 left-0 right-0 p-3 pb-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent' :
              theme === 'outlined' ? 'bottom-3 left-3 right-3 p-2.5 rounded-full border border-white/25 bg-black/30 backdrop-blur-md' :
              theme === 'floating' ? 'bottom-3 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] p-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 shadow-2xl' :
              'bottom-3 left-3 right-3 p-2.5 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10'
            }`} style={theme === 'gradient' ? { paddingTop: '28px' } : undefined}>
              {showProgress && (
                <div className="flex items-center gap-2">
                  <div
                    className="relative w-full h-5 flex items-center cursor-pointer group/scrub"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const scrubBar = e.currentTarget;
                      const scrubTo = (clientX: number) => {
                        const rect = scrubBar.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                        const time = pct * (duration || 100);
                        if (videoRef.current) {
                          videoRef.current.currentTime = time;
                          setCurrentTime(time);
                        }
                      };
                      scrubTo(e.clientX);
                      const onMove = (ev: MouseEvent) => scrubTo(ev.clientX);
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                      };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                    }}
                  >
                    <div className={`absolute left-0 right-0 rounded-full transition-all ${
                      theme === 'minimal' ? 'h-[2px] bg-white/30 group-hover/scrub:h-[3px]' :
                      theme === 'gradient' ? 'h-[3px] bg-white/20 group-hover/scrub:h-[5px]' :
                      theme === 'outlined' ? 'h-[3px] bg-white/15 group-hover/scrub:h-[4px]' :
                      theme === 'floating' ? 'h-[2px] bg-white/20 group-hover/scrub:h-[4px]' :
                      'h-[3px] bg-white/20 group-hover/scrub:h-[5px]'
                    }`} />
                    <div className={`absolute left-0 rounded-full transition-all ${
                      theme === 'minimal' ? 'h-[2px] group-hover/scrub:h-[3px]' :
                      theme === 'gradient' ? 'h-[3px] group-hover/scrub:h-[5px]' :
                      theme === 'outlined' ? 'h-[3px] group-hover/scrub:h-[4px]' :
                      theme === 'floating' ? 'h-[2px] group-hover/scrub:h-[4px]' :
                      'h-[3px] group-hover/scrub:h-[5px]'
                    }`} style={{
                      width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      backgroundColor: primaryColor,
                      ...(theme === 'gradient' ? { boxShadow: `0 0 8px ${primaryColor}80` } : {})
                    }} />
                    {theme !== 'minimal' && theme !== 'floating' && (
                      <div className="absolute w-3 h-3 rounded-full shadow-md opacity-0 group-hover/scrub:opacity-100 transition-opacity -translate-x-1/2" style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%`, backgroundColor: primaryColor }} />
                    )}
                  </div>
                </div>
              )}
              
              <div className={`flex items-center justify-between text-white ${
                theme === 'minimal' ? 'text-[10px]' :
                theme === 'floating' ? 'text-[10px]' :
                'text-xs'
              }`} style={{ marginTop: theme === 'outlined' ? '0' : undefined }}>
                <div className="flex items-center gap-3">
                  {showPlayPause && (
                    <button onClick={togglePlay} className="hover-primary transition focus:outline-none">
                      {isPlaying ? <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                    </button>
                  )}
                  {showCurrentTime && (
                    <span className="font-mono text-[10px] opacity-80">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2.5">
                  {showMute && (
                    <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !videoRef.current.muted; setIsMuted(!isMuted); } }} className="hover-primary transition focus:outline-none">
                      {isMuted ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>}
                    </button>
                  )}
                  {showVolume && (
                    <input type="range" min={0} max={1} step={0.05} defaultValue={1} onChange={(e) => { if (videoRef.current) { videoRef.current.volume = parseFloat(e.target.value); videoRef.current.muted = false; setIsMuted(false); } }} style={{ accentColor: primaryColor }} className="w-12 h-1 rounded-full cursor-pointer appearance-none bg-white/20 hover:bg-white/30 transition-colors" />
                  )}
                  {showCaptionsControl && captionsUrl && (
                    <button onClick={() => setCcEnabled(!ccEnabled)} className={`hover-primary transition focus:outline-none ${ccEnabled ? 'text-white' : 'text-white/50'}`}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="6" width="16" height="12" rx="2" ry="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 14c-.667.667-2 .667-2 0V10c0-.667 1.333-.667 2 0m6 4c-.667.667-2 .667-2 0V10c0-.667 1.333-.667 2 0" /></svg>
                    </button>
                  )}
                  {showSettings && (
                    <div className="relative flex items-center">
                      <button onClick={() => setSettingsMenuState(settingsMenuState === 'closed' ? 'main' : 'closed')} className="hover-primary transition focus:outline-none">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      {settingsMenuState !== 'closed' && (
                        <div className="absolute bottom-full mb-3 right-0 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 py-1.5 min-w-[160px] text-white">
                          {settingsMenuState === 'main' && (
                            <>
                              {showSelectQuality && (
                                <button onClick={() => setSettingsMenuState('quality')} className="w-full px-4 py-2 text-xs font-medium hover:bg-white/10 transition-colors flex items-center justify-between">
                                  <div className="flex items-center gap-2"><svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Quality</div>
                                  <div className="flex items-center gap-1 text-white/50 text-[10px]">{currentLevel === -1 ? 'Auto' : `${hlsLevels[currentLevel]?.height || 'HD'}p`}<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></div>
                                </button>
                              )}
                              {showPlaybackSpeed && (
                                <button onClick={() => setSettingsMenuState('speed')} className="w-full px-4 py-2 text-xs font-medium hover:bg-white/10 transition-colors flex items-center justify-between">
                                  <div className="flex items-center gap-2"><svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Speed</div>
                                  <div className="flex items-center gap-1 text-white/50 text-[10px]">{playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></div>
                                </button>
                              )}
                            </>
                          )}
                          {settingsMenuState === 'quality' && (
                            <>
                              <button onClick={() => setSettingsMenuState('main')} className="w-full px-4 py-2.5 border-b border-white/10 text-xs font-medium hover:bg-white/5 transition-colors flex items-center gap-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Quality</button>
                              <div className="py-1">
                                <button onClick={() => { if (hlsInstanceRef.current) hlsInstanceRef.current.currentLevel = -1; setCurrentLevel(-1); setSettingsMenuState('closed'); }} className={`w-full text-left px-6 py-2 text-xs hover:bg-white/10 flex items-center gap-2 ${currentLevel === -1 ? 'text-[hsl(var(--accent))]' : ''}`}>{currentLevel === -1 && <svg className="w-3 h-3 absolute left-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}Auto</button>
                                {[...hlsLevels].reverse().map((level, index) => {
                                  const actualIndex = hlsLevels.length - 1 - index;
                                  return (
                                    <button key={actualIndex} onClick={() => { if (hlsInstanceRef.current) hlsInstanceRef.current.currentLevel = actualIndex; setCurrentLevel(actualIndex); setSettingsMenuState('closed'); }} className={`w-full text-left px-6 py-2 text-xs hover:bg-white/10 flex items-center gap-2 relative ${currentLevel === actualIndex ? 'text-[hsl(var(--accent))]' : ''}`}>
                                      {currentLevel === actualIndex && <svg className="w-3 h-3 absolute left-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                      {level.height}p
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                          {settingsMenuState === 'speed' && (
                            <>
                              <button onClick={() => setSettingsMenuState('main')} className="w-full px-4 py-2.5 border-b border-white/10 text-xs font-medium hover:bg-white/5 transition-colors flex items-center gap-2"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Playback speed</button>
                              <div className="py-1">
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                                  <button key={speed} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = speed; setPlaybackSpeed(speed); setSettingsMenuState('closed'); }} className={`w-full text-left px-6 py-2 text-xs hover:bg-white/10 flex items-center gap-2 relative ${playbackSpeed === speed ? 'text-[hsl(var(--accent))]' : ''}`}>
                                    {playbackSpeed === speed && <svg className="w-3 h-3 absolute left-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    {speed === 1 ? 'Normal' : `${speed}x`}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {showFullscreen && (
                    <button onClick={() => { if (!document.fullscreenElement) { containerRef.current?.requestFullscreen().catch(console.error); } else { document.exitFullscreen(); } }} className="hover-primary transition focus:outline-none">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0-6-6" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* CTAs */}
          {ctas.map((cta: any) => {
            if (currentTime < cta.startTime || currentTime > cta.startTime + cta.duration) return null;
            return (
              <div
                key={cta.id}
                onMouseDown={(e) => onCtaMouseDown?.(e, cta.id)}
                className="absolute z-30 transition-transform shadow-xl flex items-center justify-center font-bold px-5 py-2.5"
                style={{
                  backgroundColor: cta.bgColor || primaryColor,
                  color: cta.textColor || '#ffffff',
                  borderRadius: `${cta.borderRadius || 30}px`,
                  borderWidth: `${cta.borderWidth || 0}px`,
                  borderColor: cta.borderColor || '#ffffff',
                  left: cta.position ? undefined : `${cta.leftPercent ?? 50}%`,
                  top: cta.position ? undefined : `${cta.topPercent ?? 84}%`,
                  transform: cta.position ? undefined : 'translate(-50%, -50%)',
                  ...(cta.position === 'bottom-center' ? { bottom: '20%', left: '50%', transform: 'translateX(-50%)' } :
                      cta.position === 'top-center' ? { top: '10%', left: '50%', transform: 'translateX(-50%)' } :
                      cta.position === 'bottom-left' ? { bottom: '20%', left: '5%' } :
                      cta.position === 'bottom-right' ? { bottom: '20%', right: '5%' } :
                      cta.position === 'top-left' ? { top: '10%', left: '5%' } :
                      cta.position === 'top-right' ? { top: '10%', right: '5%' } :
                      cta.position === 'center-center' ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } : {})
                }}
                onClick={(e) => {
                  if (isLivePreview) e.preventDefault();
                  else if (cta.url) window.open(cta.url, '_blank');
                }}
              >
                {cta.text}
              </div>
            );
          })}

          {/* Form Capture Overlay */}
          {formVisible && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto">
              <div className="absolute inset-0 bg-black transition-opacity duration-500" style={{ opacity: showThankYou ? 0.9 : 0.75 }} />
              
              {showThankYou ? (
                <div className="relative z-10 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: primaryColor }}>
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{settings.formThankYouMessage || 'Thank you!'}</h3>
                  <p className="text-white/70">Enjoy the video</p>
                </div>
              ) : (
                <div 
                  className="relative z-10 w-full max-w-md p-8 rounded-2xl shadow-2xl mx-4 flex flex-col"
                  style={{ backgroundColor: formBgColor }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-6" style={{ textAlign: formAlignment }}>
                    <h2 className="text-2xl font-bold mb-2 tracking-tight" style={{ color: formTextColor }}>{formTitle}</h2>
                    <p className="opacity-80 leading-relaxed text-sm" style={{ color: formTextColor }}>{formDescription}</p>
                  </div>

                  {formError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {formError}
                    </div>
                  )}

                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    {formFields.map((field: any) => (
                      <div key={field.id}>
                        <label className="block text-xs font-semibold mb-1.5 opacity-90" style={{ color: formTextColor }}>
                          {field.name} {field.required && <span className="opacity-70">*</span>}
                        </label>
                        <input
                          type={field.type}
                          required={field.required}
                          value={formData[field.id] || ''}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border text-[14px] outline-none transition-all focus:ring-2 focus:ring-opacity-20 placeholder-opacity-50"
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.03)',
                            borderColor: 'rgba(0,0,0,0.1)',
                            color: formTextColor,
                          }}
                        />
                      </div>
                    ))}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={formSubmitting}
                        className="w-full py-3 px-4 rounded-xl font-bold text-[15px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
                        style={{ backgroundColor: formButtonColor, color: formButtonTextColor }}
                      >
                        {formSubmitting ? (
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        ) : formButtonText}
                      </button>
                    </div>

                    {settings.formSkipEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormVisible(false);
                          setFormSubmitted(true);
                          if (formTime !== 'post-roll') {
                            videoRef.current?.play().catch(() => {});
                          }
                        }}
                        className="w-full text-center text-[13px] font-medium opacity-60 hover:opacity-100 transition-opacity mt-2"
                        style={{ color: formTextColor }}
                      >
                        Skip for now
                      </button>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-white/50 w-full h-full text-sm">
          <svg className="w-8 h-8 mb-4 animate-spin text-white/20" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          <p>Processing video...</p>
        </div>
      )}
    </div>
  );
}
