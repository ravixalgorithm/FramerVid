import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

const font = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'FrameVid - Video Operations for Framer',
  description: 'Upload once, manage HLS delivery, and publish component-ready video assets for Framer sites.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${font.variable} font-sans bg-background text-foreground antialiased selection:bg-black selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
