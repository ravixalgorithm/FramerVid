import { addPropertyControls, ControlType, RenderTarget } from 'framer';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { motionVariants } from './effects/variants.js';
import { resolveApiBaseUrl } from './config.js';
import type { Video, VideoEventType, MotionEffect } from '@framevid/types';

// Static Canvas Mock Fallback
function CanvasPoster({ videoId, borderRadius, aspectRatio }: { videoId?: string; borderRadius: number; aspectRatio: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '180px',
        borderRadius: `${borderRadius}px`,
        backgroundColor: '#111',
        border: '1px dashed #333',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        textAlign: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        aspectRatio: aspectRatio === 'custom' ? 'auto' : aspectRatio.replace('/', ':'),
      }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#00F0FF', marginBottom: '8px' }}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
      <div style={{ fontWeight: 600, color: '#fff', marginBottom: '2px' }}>FrameVid Player</div>
      <div>{videoId ? `Video ID: ${videoId}` : 'Paste a Video ID in the property panel'}</div>
      <div style={{ fontSize: '10px', color: '#555', marginTop: '6px' }}>[Canvas Mode — Player Offline]</div>
    </div>
  );
}

// Main FrameVidPlayer component
export function FrameVidPlayer(props: any) {
  const {
    videoId,
    previewMeta,
    autoplay,
    loop,
    muted,
    controls,
    aspectRatio,
    borderRadius,
    backgroundColor,
    thumbnailOverride,
    motionEffect,
    effectDuration,
    effectDelay,
    clickAction,
    lightbox,
    trackingLabel,
    apiBaseUrl,
  } = props;

  const apiBase = resolveApiBaseUrl(apiBaseUrl);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Viewport checking for scroll/viewport animations
  const isElementInView = useInView(wrapperRef, { once: motionEffect === 'scroll-reveal' });
  
  const [videoMeta, setVideoMeta] = useState<Video | null>(previewMeta || null);
  const [error, setError] = useState<string | null>(null);
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hlsInstance, setHlsInstance] = useState<any>(null);

  // Password Lock States
  const [isLocked, setIsLocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // CTA and Form states
  const [showCta, setShowCta] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formConsentChecked, setFormConsentChecked] = useState(false);
  const [showPopularity, setShowPopularity] = useState(false);

  const sessionIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const lastHeartbeatBucketRef = useRef<number | null>(null);
  const progressMilestones = useRef<{ [key: number]: boolean }>({ 25: false, 50: false, 75: false });

  // Parallax calculations
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start end', 'end start'],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);

  // 1. Canvas target check - Static preview fallback in designer canvas
  if (RenderTarget.current() === RenderTarget.canvas) {
    return <CanvasPoster videoId={videoId} borderRadius={borderRadius} aspectRatio={aspectRatio} />;
  }

  // 2. Fetch Video Metadata
  useEffect(() => {
    if (previewMeta) {
      setVideoMeta(previewMeta);
      return;
    }

    if (!videoId) return;

    fetch(`${apiBase}/videos/${videoId}/meta`)
      .then((res) => {
        if (!res.ok) throw new Error(`Video metadata fetch failed (${res.status})`);
        return res.json();
      })
      .then((payload: { data: any }) => {
        setVideoMeta(payload.data);
        if (payload.data.locked) {
          setIsLocked(true);
        }
      })
      .catch((err) => {
        console.error('FrameVid API Error:', err);
        setError(err.message);
      });

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [videoId, previewMeta, apiBase]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setUnlocking(true);
    setPasswordError(null);

    try {
      const res = await fetch(`${apiBase}/videos/${videoId}/meta?password=${encodeURIComponent(passwordInput)}`);
      if (!res.ok) throw new Error('Incorrect password');
      const payload = await res.json();
      
      if (payload.data?.locked) {
        throw new Error('Incorrect password');
      }

      setVideoMeta(payload.data);
      setIsLocked(false);
    } catch (err: any) {
      setPasswordError(err.message || 'Unlock failed');
    } finally {
      setUnlocking(false);
    }
  };

  // 3. Initialize HLS/Native Player
  useEffect(() => {
    const video = videoRef.current;
    if (!videoMeta || !video) return;

    const manifestUrl = videoMeta.hlsManifestUrl;
    if (!manifestUrl) return;

    // Handle Safari / Native iOS HLS support
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = manifestUrl!;
    } else {
      // Dynamic import of hls.js to keep bundle lightweight
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          setError('HLS Streaming is not supported by this browser.');
          return;
        }

        const hls = new Hls({
          startLevel: -1, // Auto bitrate
          capLevelToPlayerSize: true,
        });

        hls.loadSource(manifestUrl!);
        hls.attachMedia(video);
        setHlsInstance(hls);
      });
    }
  }, [videoMeta]);

  // 4. Analytics Beacon Integration
  const detectDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return 'mobile';
    if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
    return 'desktop';
  };

  const trackEvent = (eventType: VideoEventType, progressPct = 0, eventData?: Record<string, unknown>) => {
    if (typeof navigator === 'undefined' || !videoId) return;
    navigator.sendBeacon(
      `${apiBase}/events`,
      JSON.stringify({
        videoId,
        workspaceId: videoMeta?.workspaceId,
        trackingLabel: trackingLabel || 'framer-component',
        eventType,
        progressPct,
        sessionId: sessionIdRef.current,
        deviceType: detectDeviceType(),
        referrerDomain: window.location.hostname,
        timestamp: new Date().toISOString(),
        eventData,
      })
    );
  };

  const maybeSendHeartbeat = (currentTime: number, duration: number, playing: boolean) => {
    if (!playing) return;
    const bucket = Math.floor(currentTime / 5) * 5;
    if (lastHeartbeatBucketRef.current === bucket) return;
    lastHeartbeatBucketRef.current = bucket;
    const progressPct = duration > 0 ? Math.floor((currentTime / duration) * 100) : 0;
    trackEvent('heartbeat', progressPct, { bucket, currentTime });
  };

  // Autoplay and volume control integration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Persisted unlock (device)
    try {
      const key = `framevid_unlock:${videoMeta?.workspaceId}:${videoId}`;
      const unlocked = key && localStorage.getItem(key);
      if (unlocked) {
        setFormSubmitted(true);
        setShowForm(false);
      }
    } catch {
      // ignore
    }

    // Do not autoplay if pre-roll form is enabled and not submitted
    if (videoMeta?.settings?.formEnabled && videoMeta.settings.formTime === 'pre-roll' && !formSubmitted) {
      setShowForm(true);
      trackEvent('form_view');
      return;
    }

    video.muted = muted || autoplay;
    if (autoplay && isElementInView) {
      video.play().catch(() => {
        console.log('Autoplay blocked by browser. Muting and retrying...');
        video.muted = true;
        video.play().catch((e) => console.error('Play command failed', e));
      });
    }
  }, [autoplay, muted, isElementInView, videoMeta, formSubmitted, videoId]);

  // Viewport trigger support
  useEffect(() => {
    const video = videoRef.current;
    if (!video || motionEffect !== 'viewport-trigger') return;

    if (isElementInView) {
      video.play().catch((e) => console.log('Viewport play blocked', e));
    } else {
      video.pause();
    }
  }, [isElementInView, motionEffect]);

  // Mouse hover event handler for Hover Play
  const handleMouseEnter = () => {
    if (motionEffect !== 'hover-play') return;
    const video = videoRef.current;
    if (video) video.play().catch((e) => console.log('Hover play blocked', e));
  };

  const handleMouseLeave = () => {
    if (motionEffect !== 'hover-play') return;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  const handlePlayState = () => {
    const video = videoRef.current;
    if (!video) return;

    if (clickAction === 'play-pause') {
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch((e) => console.error(e));
      }
    } else if (clickAction === 'lightbox' || lightbox) {
      setLightboxOpen(true);
      trackEvent('lightbox_open');
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!video.duration) return;

    const currentT = video.currentTime;
    
    // Form trigger
    if (videoMeta?.settings?.formEnabled && !formSubmitted && !showForm) {
      const fTime = videoMeta.settings.formTime;
      if (typeof fTime === 'number' && currentT >= fTime) {
        setShowForm(true);
        video.pause();
        trackEvent('form_view');
      }
    }

    // CTA trigger
    if (videoMeta?.settings?.ctaEnabled && !showCta) {
      const cTime = videoMeta.settings.ctaTime;
      if (typeof cTime === 'number' && currentT >= cTime) {
        setShowCta(true);
      }
    }

    const pct = Math.floor((currentT / video.duration) * 100);
    [25, 50, 75].forEach((milestone) => {
      if (pct >= milestone && !progressMilestones.current[milestone]) {
        progressMilestones.current[milestone] = true;
        trackEvent('video_progress', milestone);
      }
    });

    maybeSendHeartbeat(currentT, video.duration, !video.paused);
  };

  const rawPopularity = videoMeta?.popularityCurve;
  const popularityCurve = rawPopularity?.length ? rawPopularity : [
    5, 12, 18, 25, 35, 60, 95, 100, 85, 50, 
    30, 25, 40, 65, 75, 55, 35, 20, 15, 10, 5
  ];
  const popularityPath = (() => {
    if (!popularityCurve?.length) return '';
    const w = 200;
    const h = 40;
    const step = w / Math.max(popularityCurve.length - 1, 1);
    const pts = popularityCurve.map((v: number, i: number) => ({
      x: i * step,
      y: h - (Math.max(0, Math.min(100, v)) / 100) * (h * 0.85),
    }));
    return pts.reduce((path: string, pt, i) => {
      if (i === 0) return `M${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      const prev = pts[i - 1];
      const cpX = (prev.x + pt.x) / 2;
      return `${path} C${cpX.toFixed(1)},${prev.y.toFixed(1)} ${cpX.toFixed(1)},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    }, '');
  })();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoMeta) return;
    setFormError(null);
    setFormSubmitting(true);
    trackEvent('form_submit_attempt', undefined, { keys: Object.keys(formData) });

    try {
      if (videoMeta?.settings?.formRequireConsent && !formConsentChecked) {
        throw new Error('Please accept the consent checkbox');
      }

      const res = await fetch(`${apiBase}/videos/${videoId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: formData,
          source: trackingLabel || 'framer-component',
          referrerDomain: window.location.hostname,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Submit failed (${res.status})`);

      // Persist unlock marker for this device
      try {
        const key = `framevid_unlock:${videoMeta.workspaceId}:${videoId}`;
        localStorage.setItem(key, JSON.stringify({ unlockedAt: Date.now(), key: json?.unlock?.key }));
      } catch {
        // ignore
      }

      trackEvent('form_submit_success');
      setShowThankYou(true);

      // Unlock video for script playback on mobile/safari by calling play() then pause()
      if (videoRef.current) {
        videoRef.current.play().then(() => videoRef.current?.pause()).catch(() => {});
      }

      setTimeout(() => {
        setShowThankYou(false);
        setFormSubmitted(true);
        setShowForm(false);
        if (videoMeta?.settings?.formTime !== 'post-roll') {
          videoRef.current?.play().catch(console.error);
        }
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || 'Failed to submit form';
      setFormError(msg);
      trackEvent('form_submit_error', undefined, { message: msg });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Base motion effects definition
  const selectedVariant = motionVariants[motionEffect as MotionEffect] || {};
  const isParallax = motionEffect === 'parallax';
  const shouldAnimate = motionEffect !== 'none' && !isParallax;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((videoMeta?.settings as any)?.keyboardShortcuts === false) return;
      
      // Ignore if user is typing in an input or textarea
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) video.play();
          else video.pause();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + (e.shiftKey ? 10 : 5));
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 10 : 5));
          break;
        case 'f':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            wrapperRef.current?.requestFullscreen().catch(() => {});
          }
          break;
        case 'm':
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          if (video.volume > 0) video.muted = false;
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: `${borderRadius}px`,
    backgroundColor: backgroundColor || '#000',
    width: '100%',
    height: '100%',
    aspectRatio: aspectRatio === 'custom' ? 'auto' : aspectRatio.replace('/', ':'),
  };

  if (error) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4d', padding: '16px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600, margin: '0 0 4px 0' }}>FrameVid Load Error</p>
          <p style={{ fontSize: '11px', margin: 0, opacity: 0.8 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={wrapperRef}
      style={{
        ...containerStyle,
        y: isParallax ? parallaxY : 0,
      }}
      variants={shouldAnimate ? selectedVariant : undefined}
      initial={shouldAnimate ? 'initial' : undefined}
      animate={shouldAnimate && isElementInView ? 'animate' : undefined}
      transition={{ duration: effectDuration, delay: effectDelay, ease: 'easeOut' }}
      onMouseEnter={() => {
        handleMouseEnter();
        if (popularityCurve?.length) setShowPopularity(true);
      }}
      onMouseLeave={() => {
        handleMouseLeave();
        setShowPopularity(false);
      }}
      onClick={handlePlayState}
    >
      <video
        ref={videoRef}
        loop={loop}
        controls={controls === 'show'}
        poster={thumbnailOverride || videoMeta?.posterUrl || (videoMeta?.thumbnailUrls && videoMeta.thumbnailUrls[0])}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          cursor: clickAction !== 'none' ? 'pointer' : 'default',
        }}
        onLoadedMetadata={(e) => {
          if (!videoMeta?.captionsUrl) return;
          const tracks = e.currentTarget.textTracks;
          for (let i = 0; i < tracks.length; i++) {
            tracks[i].mode = 'showing';
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          lastHeartbeatBucketRef.current = null;
          trackEvent('video_play');
        }}
        onPause={() => {
          setIsPlaying(false);
          if (videoRef.current) {
            const pct = Math.floor((videoRef.current.currentTime / videoRef.current.duration) * 100);
            trackEvent('video_pause', pct);
          }
        }}
        onEnded={() => {
          trackEvent('video_complete');
          // Reset milestones
          progressMilestones.current = { 25: false, 50: false, 75: false };

          if (videoMeta?.settings?.formEnabled && videoMeta.settings.formTime === 'post-roll' && !formSubmitted) {
            setShowForm(true);
            trackEvent('form_view');
          }

          if (videoMeta?.settings?.ctaEnabled && videoMeta.settings.ctaTime === 'end') {
            setShowCta(true);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
      >
        {videoMeta?.captionsUrl ? (
          <track kind="subtitles" src={videoMeta.captionsUrl} label="Captions" srcLang="en" default />
        ) : null}
      </video>

      {/* Exit Thumbnail Overlay — shown when video is paused */}
      {(videoMeta?.settings as any)?.showExitThumbnail && (thumbnailOverride || videoMeta?.posterUrl || (videoMeta?.thumbnailUrls && videoMeta.thumbnailUrls[0])) && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            pointerEvents: 'none',
            backgroundImage: `url(${thumbnailOverride || videoMeta?.posterUrl || (videoMeta?.thumbnailUrls && videoMeta.thumbnailUrls[0])})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'opacity 300ms ease-in-out',
            opacity: !isPlaying ? 1 : 0,
          }} 
        />
      )}

      {/* Custom Branding Logo */}
      {(videoMeta?.settings as any)?.brandingEnabled && videoMeta?.settings?.brandingLogoUrl && (
        <div style={{
          position: 'absolute',
          zIndex: 10,
          pointerEvents: 'none',
          opacity: 0.8,
          ...(
            (videoMeta.settings as any).brandingPosition === 'top-left' ? { top: '16px', left: '16px' } :
            (videoMeta.settings as any).brandingPosition === 'top-right' ? { top: '16px', right: '16px' } :
            (videoMeta.settings as any).brandingPosition === 'bottom-left' ? { bottom: '16px', left: '16px' } :
            { bottom: '16px', right: '16px' }
          )
        }}>
          <img 
            src={videoMeta.settings.brandingLogoUrl} 
            alt="Logo" 
            style={{ 
              maxWidth: `${(videoMeta.settings as any).brandingSize || 100}px`, 
              objectFit: 'contain', 
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' 
            }} 
          />
        </div>
      )}

      {popularityPath ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: controls === 'show' ? 52 : 0,
            height: 40,
            pointerEvents: 'none',
            zIndex: 40,
            opacity: showPopularity ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <svg width="100%" height="40" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="fv-popularity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
              </linearGradient>
            </defs>
            <path d={`${popularityPath} L200,40 L0,40 Z`} fill="url(#fv-popularity-fill)" />
            <path d={popularityPath} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
          </svg>
        </div>
      ) : null}

      {/* Form Overlay */}
      {isLocked && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(16px)', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <form onSubmit={handleUnlock} style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fff', margin: '0 auto 16px', opacity: 0.8 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>This video is private</h3>
            <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 24px' }}>Enter the password to watch</p>
            <input 
              type="password" 
              placeholder="Password" 
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: '14px', marginBottom: '12px', outline: 'none', boxSizing: 'border-box' }}
              disabled={unlocking}
            />
            <button 
              type="submit" 
              disabled={unlocking || !passwordInput}
              style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#fff', color: '#000', fontWeight: 600, fontSize: '14px', cursor: unlocking || !passwordInput ? 'not-allowed' : 'pointer', opacity: unlocking || !passwordInput ? 0.7 : 1, transition: 'opacity 0.2s' }}
            >
              {unlocking ? 'Unlocking...' : 'Unlock Video'}
            </button>
            {passwordError && <p style={{ color: '#ff4d4d', fontSize: '12px', marginTop: '16px', fontWeight: 500 }}>{passwordError}</p>}
          </form>
        </div>
      )}

      {showForm && !isLocked && videoMeta?.settings?.formEnabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(0,0,0,${Math.min(0.95, Math.max(0.05, (videoMeta?.settings as any)?.formOverlayOpacity ?? 0.75))})`,
            backdropFilter: 'blur(12px)',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            fontFamily: ((videoMeta?.settings as any)?.formFontFamily as string) || 'Inter, system-ui, sans-serif',
          }}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              backgroundColor: videoMeta.settings.formBgColor || '#ffffff',
              opacity: Math.min(1, Math.max(0.2, (videoMeta?.settings as any)?.formCardOpacity ?? 1)),
              padding: '28px',
              borderRadius: '20px',
              maxWidth: '340px',
              width: '100%',
              maxHeight: '95%',
              overflowY: 'auto',
              textAlign: videoMeta.settings.formAlignment || 'center',
              boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5)`,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {showThankYou ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', color: videoMeta.settings.formTextColor || '#000000', padding: '32px 0' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: videoMeta.settings.formButtonColor || '#4e5ffd', margin: '0 auto 16px auto' }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{videoMeta.settings.formThankYouMessage || 'Thank you!'}</h3>
              </motion.div>
            ) : (
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: videoMeta.settings.formTextColor || '#000000', fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>{videoMeta.settings.formTitle || 'Unlock this video'}</h3>
                <p style={{ color: videoMeta.settings.formTextColor || '#000000', opacity: 0.65, fontSize: '13px', margin: '0 0 20px 0', lineHeight: 1.4 }}>{videoMeta.settings.formDescription || 'Enter your details to continue watching'}</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {(videoMeta.settings.formFields || [{ id: 'f_email', name: 'Email', type: 'email', required: true }]).map(f => (
                    <input
                      key={f.id}
                      type={f.type}
                      placeholder={f.name}
                      required={f.required}
                      value={formData[f.id] || ''}
                      onChange={(e) => setFormData({ ...formData, [f.id]: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: `1px solid ${((videoMeta?.settings as any)?.formFieldBorderColor as string) || 'rgba(255,255,255,0.16)'}`,
                        backgroundColor: ((videoMeta?.settings as any)?.formFieldBgColor as string) || 'rgba(255,255,255,0.08)',
                        color: videoMeta.settings.formTextColor || '#ffffff',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                      }}
                    />
                  ))}
                </div>

                {videoMeta.settings.formRequireConsent && (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formConsentChecked}
                      onChange={(e) => setFormConsentChecked(e.target.checked)}
                      style={{ marginTop: '2px' }}
                      required
                    />
                    <span style={{ color: videoMeta.settings.formTextColor || '#000000', opacity: 0.7, fontSize: '12px', lineHeight: 1.35, fontWeight: 600 }}>
                      {videoMeta.settings.formConsentText || 'I agree to receive emails about this content.'}
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={formSubmitting}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: videoMeta.settings.formButtonColor || '#4e5ffd',
                    color: videoMeta.settings.formButtonTextColor || '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: formSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.1s, opacity 0.2s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    opacity: formSubmitting ? 0.7 : 1,
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = formSubmitting ? '0.7' : '0.9')}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = formSubmitting ? '0.7' : '1')}
                  onMouseDown={(e) => (e.currentTarget.style.transform = formSubmitting ? 'scale(1)' : 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {formSubmitting ? 'Submitting…' : videoMeta.settings.formButtonText || 'Submit'}
                </button>

                {formError && (
                  <div style={{ marginTop: '10px', color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>
                    {formError}
                  </div>
                )}
                {videoMeta.settings.formSkipEnabled && (
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setFormError(null);
                        if (videoMeta.settings.formTime !== 'post-roll') videoRef.current?.play();
                        trackEvent('form_skip');
                      }}
                      style={{ background: 'none', border: 'none', color: videoMeta.settings.formTextColor || '#000000', opacity: 0.5, fontSize: '11px', cursor: 'pointer', fontWeight: 600, padding: '4px' }}
                    >
                      Skip for now
                    </button>
                  </div>
                )}
              </form>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* CTA Overlay */}
      {showCta && videoMeta?.settings?.ctaEnabled && (
        <div style={{ position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 10, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <a href={videoMeta.settings.ctaUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent('cta_click')} style={{ backgroundColor: videoMeta.settings.primaryColor, color: '#000', padding: '14px 28px', borderRadius: '99px', textDecoration: 'none', fontWeight: 800, fontSize: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'inline-block', transition: 'transform 0.2s', letterSpacing: '-0.01em' }}>
            {videoMeta.settings.ctaText || 'Learn More'}
          </a>
        </div>
      )}

      {/* Lightbox Portal Overlay */}
      {isLightboxOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(false);
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '80vw',
              maxWidth: '1200px',
              aspectRatio: '16/9',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#000',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={videoMeta?.hlsManifestUrl}
              autoPlay
              controls
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Framer property controls layout structure mapping
addPropertyControls(FrameVidPlayer, {
  // 1. VIDEO
  videoId: {
    type: ControlType.String,
    title: 'Video ID',
    placeholder: 'Paste video ID from FrameVid...',
  },
  autoplay: {
    type: ControlType.Boolean,
    title: 'Autoplay',
    defaultValue: false,
  },
  loop: {
    type: ControlType.Boolean,
    title: 'Loop',
    defaultValue: false,
  },
  muted: {
    type: ControlType.Boolean,
    title: 'Muted',
    defaultValue: false,
  },
  controls: {
    type: ControlType.Enum,
    title: 'Controls',
    options: ['show', 'hide', 'on-hover'],
    optionTitles: ['Show Controls', 'Hide Controls', 'Show on Hover'],
    defaultValue: 'show',
  },

  // 2. APPEARANCE
  aspectRatio: {
    type: ControlType.Enum,
    title: 'Aspect Ratio',
    options: ['16/9', '4/3', '1/1', '9/16', 'custom'],
    defaultValue: '16/9',
  },
  borderRadius: {
    type: ControlType.Number,
    title: 'Radius',
    min: 0,
    max: 100,
    defaultValue: 8,
  },
  backgroundColor: {
    type: ControlType.Color,
    title: 'Background',
    defaultValue: '#000000',
  },
  thumbnailOverride: {
    type: ControlType.Image,
    title: 'Thumbnail',
  },

  // 3. MOTION EFFECT
  motionEffect: {
    type: ControlType.Enum,
    title: 'Effect',
    options: ['none', 'fade-in', 'scroll-reveal', 'parallax', 'blur-in', 'cinematic', 'hover-play', 'viewport-trigger'],
    optionTitles: ['None', 'Fade In', 'Scroll Reveal', 'Parallax', 'Blur In', 'Cinematic', 'Hover Play', 'Viewport Trigger'],
    defaultValue: 'none',
  },
  effectDuration: {
    type: ControlType.Number,
    title: 'Duration',
    min: 0.1,
    max: 3.0,
    step: 0.1,
    defaultValue: 0.6,
  },
  effectDelay: {
    type: ControlType.Number,
    title: 'Delay',
    min: 0,
    max: 2.0,
    step: 0.1,
    defaultValue: 0,
  },

  // 4. INTERACTION
  clickAction: {
    type: ControlType.Enum,
    title: 'Click Action',
    options: ['play-pause', 'lightbox', 'none'],
    optionTitles: ['Play / Pause', 'Open Lightbox', 'None'],
    defaultValue: 'play-pause',
  },
  lightbox: {
    type: ControlType.Boolean,
    title: 'Force Lightbox',
    defaultValue: false,
  },

  // 5. ANALYTICS
  trackingLabel: {
    type: ControlType.String,
    title: 'Tracking Label',
    placeholder: 'hero-banner-video',
  },
  apiBaseUrl: {
    type: ControlType.String,
    title: 'API Base URL',
    placeholder: 'http://localhost:3000/api/v1',
    description: 'Override API host (include /v1). Leave empty for production.',
  },
});
