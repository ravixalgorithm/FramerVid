type LogoProps = {
  size?: 'sm' | 'md';
  variant?: 'default' | 'inverse';
  className?: string;
};

export function Logo({ size = 'xl', variant = 'default', className = '' }: LogoProps) {
  const textSize = size === 'xl' ? 'text-xl' : 'text-[15px]';
  const inverse = variant === 'inverse';

  return (
    <span
      className={`font-black ${textSize} ${
        inverse ? 'text-white' : 'text-[hsl(var(--foreground))]'
      } ${className}`}
    >
      FrameVid
    </span>
  );
}
