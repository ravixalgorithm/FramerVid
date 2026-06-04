import './globals.css';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from '../components/Providers';

const font = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'FrameVid — Video for Framer',
  description: 'Upload once. Drop a component. Video that feels native to your Framer site.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${font.variable} font-sans font-light bg-background text-foreground antialiased selection:bg-[hsl(var(--accent))] selection:text-white`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
