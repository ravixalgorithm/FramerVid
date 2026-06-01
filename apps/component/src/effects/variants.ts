import type { Variants } from 'framer-motion';
import type { MotionEffect } from '@framevid/types';

export const motionVariants: Record<MotionEffect, Variants> = {
  none: {},
  'fade-in': {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  'scroll-reveal': {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
  },
  'blur-in': {
    initial: { filter: 'blur(20px)', opacity: 0 },
    animate: { filter: 'blur(0px)', opacity: 1 },
  },
  cinematic: {
    initial: { scaleX: 0.85, opacity: 0 },
    animate: { scaleX: 1, opacity: 1 },
  },
  // Handled imperatively inside component:
  parallax: {},
  'hover-play': {},
  'viewport-trigger': {},
};
