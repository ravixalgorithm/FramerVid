'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AppNotification } from '../../lib/notifications';

type ToastViewportProps = {
  toasts: AppNotification[];
  onDismiss: (id: string) => void;
  onPauseTimers?: () => void;
  onResumeTimers?: () => void;
};

const MAX_VISIBLE = 3;
const DEFAULT_HEIGHT = 56;
const STACK_PEEK = 20;
const STACK_GAP_HOVER = 10;

export function ToastViewport({
  toasts,
  onDismiss,
  onPauseTimers,
  onResumeTimers,
}: ToastViewportProps) {
  const [mounted, setMounted] = useState(false);
  const [shownIds, setShownIds] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [heights, setHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unseen = toasts.filter((t) => !shownIds.includes(t.id)).map((t) => t.id);
    if (unseen.length > 0) {
      requestAnimationFrame(() => {
        setShownIds((prev) => [...prev, ...unseen]);
      });
    }
  }, [toasts]);

  const measureRef = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (!node) return;
      const h = Math.round(node.getBoundingClientRect().height);
      setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
    },
    []
  );

  const heightOf = (id: string) => heights[id] ?? DEFAULT_HEIGHT;

  const getFinalTransform = (index: number, length: number) => {
    if (index === length - 1) {
      return 'none';
    }
    const offset = length - 1 - index;
    let translateY = heightOf(toasts[length - 1]!.id);
    for (let i = length - 1; i > index; i--) {
      if (isHovered) {
        translateY += heightOf(toasts[i - 1]!.id) + STACK_GAP_HOVER;
      } else {
        translateY += STACK_PEEK;
      }
    }
    const z = -offset;
    const scale = isHovered ? 1 : 1 - 0.05 * offset;
    return `translate3d(0, calc(100% - ${translateY}px), ${z}px) scale(${scale})`;
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    onPauseTimers?.();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onResumeTimers?.();
  };

  if (!mounted || toasts.length === 0) return null;

  const lastVisibleStart = Math.max(0, toasts.length - MAX_VISIBLE);
  const visibleToasts = toasts.slice(lastVisibleStart);
  const containerHeight = visibleToasts.reduce((acc, toast) => acc + heightOf(toast.id), 0);

  return createPortal(
    <div
      className="toast-viewport"
      style={{ height: containerHeight }}
      aria-live="polite"
      aria-relevant="additions"
    >
      <div
        className="toast-stack-host"
        style={{ height: containerHeight }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {toasts.map((toast, index) => {
          const isVisible = index >= lastVisibleStart;
          const isShown = shownIds.includes(toast.id);

          return (
            <div
              key={toast.id}
              ref={measureRef(toast.id)}
              className={`toast-glass toast-glass--${toast.type} ${isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              role="status"
              style={{
                transition: 'all 0.35s cubic-bezier(0.25, 0.75, 0.6, 0.98)',
                transform: isShown
                  ? getFinalTransform(index, toasts.length)
                  : 'translate3d(0, 100%, 150px) scale(1)',
              }}
            >
              <div className="toast-glass-noise" aria-hidden />
              <div className="toast-glass-shine" aria-hidden />
              <div className="toast-card-inner">
                <div className="toast-card-copy">
                  <p className="toast-card-title">{toast.title}</p>
                  {toast.message ? (
                    <p className="toast-card-message">{toast.message}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="toast-dismiss"
                  aria-label="Dismiss"
                  onClick={() => onDismiss(toast.id)}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12.4697 13.5303L13 14.0607L14.0607 13L13.5303 12.4697L9.06065 7.99999L13.5303 3.53032L14.0607 2.99999L13 1.93933L12.4697 2.46966L7.99999 6.93933L3.53032 2.46966L2.99999 1.93933L1.93933 2.99999L2.46966 3.53032L6.93933 7.99999L2.46966 12.4697L1.93933 13L2.99999 14.0607L3.53032 13.5303L7.99999 9.06065L12.4697 13.5303Z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
