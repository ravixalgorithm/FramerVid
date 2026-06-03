'use client';

import type { ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  dark?: boolean;
};

export function Modal({ open, onClose, children, className = '', dark = false }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-xl ${
          dark ? 'border-zinc-800 bg-zinc-900 text-white' : 'border-[hsl(var(--hairline))] bg-[hsl(var(--surface))]'
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
