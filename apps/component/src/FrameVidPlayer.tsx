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
  
  // CTA and Form states
  const [showCta, setShowCta] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

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
      .then((payload: { data: Video }) => {
        setVideoMeta(payload.data);
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

  // 3. Initialize HLS/Native Player
  useEffect(() => {
    const video = videoRef.current;
    if (!videoMeta || !video) return;

    const manifestUrl = videoMeta.hlsManifestUrl;
    if (!manifestUrl) return;

    // Handle Safari / Native iOS HLS support
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = manifestUrl;
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

        hls.loadSource(manifestUrl);
        hls.attachMedia(video);
        setHlsInstance(hls);
      });
    }
  }, [videoMeta]);

  // 4. Analytics Beacon Integration
  const trackEvent = (eventType: VideoEventType, progressPct = 0, eventData?: any) => {
    if (typeof navigator === 'undefined') return;
    navigator.sendBeacon(
      `${apiBase}/events`,
      JSON.stringify({
        videoId,
        workspaceId: videoMeta?.workspaceId,
        trackingLabel: trackingLabel || 'framer-component',
        eventType,
        progressPct,
        referrerDomain: window.location.hostname,
        timestamp: new Date().toISOString(),
        eventData,
      })
    );
  };

  // Autoplay and volume control integration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
  }, [autoplay, muted, isElementInView, videoMeta, formSubmitted]);

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

  // Video time progress tracker for 25/50/75/100 thresholds
  const progressMilestones = useRef<{ [key: number]: boolean }>({ 25: false, 50: false, 75: false });
  const handleTimeUpdate = (e: any) => {
    const video = e.target;
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
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    trackEvent('form_submit', undefined, formData);
    setShowThankYou(true);
    
    // Unlock video for script playback on mobile/safari by calling play() then pause() synchronously
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
    }, 2000);
  };

  // Base motion effects definition
  const selectedVariant = motionVariants[motionEffect as MotionEffect] || {};
  const isParallax = motionEffect === 'parallax';
  const shouldAnimate = motionEffect !== 'none' && !isParallax;

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
        onPlay={() => {
          setIsPlaying(true);
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
      />

      {/* Form Overlay */}
      {showForm && videoMeta?.settings?.formEnabled && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ backgroundColor: videoMeta.settings.formBgColor || '#ffffff', padding: '28px', borderRadius: '20px', maxWidth: '340px', width: '100%', maxHeight: '95%', overflowY: 'auto', textAlign: videoMeta.settings.formAlignment || 'center', boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5)`, border: '1px solid rgba(255,255,255,0.1)' }}
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
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)', backgroundColor: 'rgba(0,0,0,0.03)', color: videoMeta.settings.formTextColor || '#000000', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                    />
                  ))}
                </div>

                <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: videoMeta.settings.formButtonColor || '#4e5ffd', color: videoMeta.settings.formButtonTextColor || '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'transform 0.1s, opacity 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                  {videoMeta.settings.formButtonText || 'Submit'}
                </button>
                {videoMeta.settings.formSkipEnabled && (
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button type="button" onClick={() => { setShowForm(false); if(videoMeta.settings.formTime !== 'post-roll') videoRef.current?.play(); }} style={{ background: 'none', border: 'none', color: videoMeta.settings.formTextColor || '#000000', opacity: 0.5, fontSize: '11px', cursor: 'pointer', fontWeight: 600, padding: '4px' }}>Skip for now</button>
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
