/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        muted: 'hsl(var(--muted))',
        hairline: 'hsl(var(--hairline))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          muted: 'hsl(var(--accent-muted))',
          border: 'hsl(var(--accent-border))',
        },
      },
      fontFamily: {
        sans: ['"Koerber Repro Screen"', '"ABC Repro"', 'var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        frame: '10px',
        'frame-lg': '14px',
      },
    },
  },
  plugins: [],
};
