import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../lib/auth';
import AdvancedAnalyticsClient from './AdvancedAnalyticsClient';

export default async function VideoAnalyticsPage({
  params,
}: {
  params: { videoId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/signin');
  }

  const { videoId } = params;
  if (!videoId) {
    redirect('/');
  }

  const matchedVideos = await db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  const video = matchedVideos[0];
  
  if (!video) {
    redirect('/');
  }

  const clientVideo = {
    id: video.id,
    workspaceId: video.workspaceId,
    title: video.title,
    durationSeconds: video.durationSeconds ? Number(video.durationSeconds) : null,
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-[hsl(var(--hairline))] bg-white px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link 
            href={`/videos/${video.id}`}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900 leading-tight">Advanced Analytics</h1>
            <p className="text-[12px] font-medium text-gray-500 truncate max-w-sm">{video.title}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <AdvancedAnalyticsClient video={clientVideo} />
      </main>
    </div>
  );
}
