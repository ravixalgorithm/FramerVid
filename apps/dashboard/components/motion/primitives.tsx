'use client';

import { motion, AnimatePresence, type HTMLMotionProps, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

export const spring = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 };
export const springSoft = { type: 'spring' as const, stiffness: 280, damping: 28, mass: 0.9 };
export const easeOut = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: easeOut },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const cardHover = {
  rest: { y: 0, scale: 1, boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)' },
  hover: {
    y: -4,
    scale: 1.012,
    boxShadow: '0 12px 40px rgba(15,23,42,0.12), 0 0 0 1px hsl(var(--accent-border))',
    transition: spring,
  },
};

type FadeUpProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export function FadeUp({ children, delay = 0, className = '' }: FadeUpProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: fadeUp.hidden,
        show: {
          ...fadeUp.show,
          transition: { ...(fadeUp.show as { transition: object }).transition, delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

type StaggerGridProps = {
  children: ReactNode;
  className?: string;
};

export function StaggerGrid({ children, className = '' }: StaggerGridProps) {
  return (
    <motion.div className={className} variants={staggerContainer} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

type MotionCardProps = HTMLMotionProps<'article'> & { children: ReactNode };

export function MotionCard({ children, className = '', ...props }: MotionCardProps) {
  return (
    <motion.article
      variants={fadeUp}
      initial="rest"
      whileHover="hover"
      animate="rest"
      className={`group flex flex-col justify-between overflow-hidden rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] ${className}`}
      {...props}
    >
      {children}
    </motion.article>
  );
}

type SegmentToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon: ReactNode }[];
};

export function SegmentToggle<T extends string>({ value, onChange, options }: SegmentToggleProps<T>) {
  return (
    <div className="relative flex items-center rounded-[10px] border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] p-0.5 shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors"
          aria-label={opt.label}
          aria-pressed={value === opt.value}
        >
          {value === opt.value && (
            <motion.span
              layoutId="view-segment-pill"
              className="absolute inset-0 rounded-[8px] bg-accent-muted"
              transition={spring}
            />
          )}
          <span className={`relative ${value === opt.value ? 'text-accent' : 'text-[hsl(var(--muted))]'}`}>
            {opt.icon}
          </span>
        </button>
      ))}
    </div>
  );
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  dark?: boolean;
};

export function Modal({ open, onClose, children, className = '', dark = false }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
              dark
                ? 'border-gray-800 bg-gray-900 text-white'
                : 'border-[hsl(var(--hairline))] bg-[hsl(var(--surface))]'
            } ${className}`}
            initial={{ opacity: 0, y: 16, scale: 0.96, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 10, scale: 0.98, filter: 'blur(4px)' }}
            transition={springSoft}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StudioBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-[20%] top-[-10%] h-[520px] w-[520px] rounded-full bg-[hsl(var(--accent)/0.12)] blur-[80px]"
        animate={{ x: [0, 40, 0], y: [0, 24, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-[10%] top-[20%] h-[420px] w-[420px] rounded-full bg-[hsl(240_6%_10%/0.04)] blur-[70px]"
        animate={{ x: [0, -30, 0], y: [0, -20, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[-15%] left-[30%] h-[380px] w-[380px] rounded-full bg-[hsl(var(--accent)/0.08)] blur-[90px]"
        animate={{ x: [0, 24, 0], y: [0, -16, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </div>
  );
}

export function PlayReveal({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[hsl(var(--foreground))] shadow-lg"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={spring}
          >
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11.34-6.86a1 1 0 0 0 0-1.72L9.52 4.28A1 1 0 0 0 8 5.14Z" />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { motion, AnimatePresence };
