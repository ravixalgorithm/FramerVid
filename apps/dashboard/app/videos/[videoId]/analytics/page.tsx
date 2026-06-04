import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../../lib/auth';

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

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <div className="rounded-2xl border border-[hsl(var(--hairline))] bg-white shadow-sm overflow-hidden">
          <div className="p-12 md:p-16 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 mb-6">
              <svg className="h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 18.375v-5.25ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-9.75ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Advanced Analytics</h2>
            <p className="text-[15px] font-medium text-gray-500 max-w-sm mx-auto leading-relaxed">
              We are working on powerful new insights for your videos. Advanced analytics will be available here soon.
            </p>
            <div className="pt-6">
              <Link
                href={`/videos/${video.id}`}
                className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800"
              >
                Go back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
