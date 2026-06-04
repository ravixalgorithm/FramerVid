import { Metadata } from 'next';
import ClientSharePlayer from './ClientSharePlayer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { videoId: string } }): Promise<Metadata> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/videos/${params.videoId}/meta`, { cache: 'no-store' });
    if (!res.ok) return { title: 'Video Not Found' };
    const data = await res.json();

    return {
      title: data.title || 'Video',
      description: 'Shared via FramerVid',
      openGraph: {
        images: data.posterUrl ? [data.posterUrl] : [],
      }
    };
  } catch (e) {
    return { title: 'Video' };
  }
}

export default function PublicVideoPage({ params }: { params: { videoId: string } }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-sans">
      <div className="w-full h-screen max-w-[1200px] max-h-[800px] mx-auto p-4 md:p-8 flex items-center justify-center">
        <ClientSharePlayer videoId={params.videoId} />
      </div>
    </div>
  );
}
