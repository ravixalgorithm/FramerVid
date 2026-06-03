'use client';

type VideoGridCardProps = {
  video: any;
  meta: { label: string; tone: string; progress: number };
  thumbnail?: string;
  onOpen: () => void;
  onMenuToggle: (e: React.MouseEvent) => void;
  menuOpen: boolean;
  onCopyId: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  onMove?: () => void;
  showMove?: boolean;
  formatDuration: (seconds?: number) => string;
  getRelativeTimeString: (date: Date | string) => string;
  getResolutionString: (video: any) => string;
};

function statusBadgeLabel(status: string, metaLabel: string) {
  if (status === 'ready') return 'Ready';
  if (status === 'error') return 'Failed';
  return metaLabel;
}

function statusSubtitle(status: string) {
  if (status === 'ready') return 'Ready to embed';
  if (status === 'processing') return 'Encoding';
  if (status === 'uploading') return 'Uploading';
  return 'Needs attention';
}

function CtaArrowIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}

export function VideoGridCard({
  video,
  meta,
  thumbnail,
  onOpen,
  onMenuToggle,
  menuOpen,
  onCopyId,
  onDelete,
  onDownload,
  onMove,
  showMove,
  formatDuration,
  getRelativeTimeString,
  getResolutionString,
}: VideoGridCardProps) {
  const badge = statusBadgeLabel(video.status, meta.label);
  const subtitle = statusSubtitle(video.status);

  return (
    <article className="product-card group">
      <div className="product-card-media-wrap">
        <button type="button" onClick={onOpen} className="product-card-media">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="video-thumb-fallback flex h-full w-full items-center justify-center">
              <svg className="h-7 w-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          )}
          <span className="product-card-badge">{badge}</span>
        </button>

        <div className="product-card-menu">
          <button
            type="button"
            onClick={onMenuToggle}
            className="product-card-menu-btn"
            aria-label="Video options"
            aria-expanded={menuOpen}
          >
            <svg className="h-3.5 w-3.5 text-[hsl(var(--foreground))]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
            </svg>
          </button>

          {menuOpen && (
            <div className="menu-popover right-0 top-full z-50 mt-1.5 w-44 origin-top-right">
              <button type="button" onClick={onOpen} className="menu-popover-item">
                Open video
              </button>
              <button type="button" onClick={onCopyId} className="menu-popover-item">
                Copy component ID
              </button>
              {onDownload && (
                <button type="button" onClick={onDownload} className="menu-popover-item">
                  Download video
                </button>
              )}
              {showMove && onMove && (
                <button type="button" onClick={onMove} className="menu-popover-item">
                  Move to folder
                </button>
              )}
              <div className="my-1 border-t border-[hsl(var(--hairline))]" />
              <button type="button" onClick={onDelete} className="menu-popover-item menu-popover-item-danger">
                Delete video
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="product-card-body">
        <button type="button" onClick={onOpen} className="product-card-title">
          {video.title}
        </button>
        <p className="product-card-subtitle">{subtitle}</p>
        <p className="product-card-desc">
          {getRelativeTimeString(video.createdAt)} · {getResolutionString(video)}
        </p>

        <div className="product-card-actions">
          <span className="product-card-chip">{formatDuration(video.durationSeconds)}</span>
          <button type="button" onClick={onOpen} className="product-card-cta">
            Open
            <span className="product-card-cta-icon" aria-hidden>
              <CtaArrowIcon />
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
