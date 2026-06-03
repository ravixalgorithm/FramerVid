type LogoProps = {
  size?: 'sm' | 'md';
  variant?: 'default' | 'inverse';
  className?: string;
};

export function Logo({ size = 'md', variant = 'default', className = '' }: LogoProps) {
  const textSize = size === 'sm' ? 'text-sm' : 'text-[15px]';
  const inverse = variant === 'inverse';

  return (
    <span
      className={`font-semibold tracking-[-0.02em] ${textSize} ${
        inverse ? 'text-white' : 'text-[hsl(var(--foreground))]'
      } ${className}`}
    >
      FrameVid
    </span>
  );
}
