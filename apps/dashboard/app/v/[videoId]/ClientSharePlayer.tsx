'use client';

import { useEffect, useState } from 'react';
import { CustomVideoPlayer } from '@/components/player/CustomVideoPlayer';

export default function ClientSharePlayer({ videoId }: { videoId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const fetchMeta = async (pass?: string) => {
    try {
      setLoading(true);
      const url = new URL(`/api/videos/${videoId}/meta`, window.location.origin);
      if (pass) url.searchParams.set('password', pass);
      
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (res.status === 404) {
        setError('Video not found');
        return;
      }
      
      const json = await res.json();
      const videoData = json.data || json;
      
      if (pass && videoData.locked) {
        setPasswordError(true);
      } else {
        setPasswordError(false);
        setData(videoData);
      }
    } catch (e) {
      setError('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, [videoId]);

  if (loading && !data) {
    return <div className="text-white flex items-center justify-center h-full w-full"><div className="animate-pulse">Loading...</div></div>;
  }

  if (error) {
    return <div className="text-white text-center flex flex-col items-center"><p className="text-xl font-bold">{error}</p></div>;
  }

  if (data?.locked) {
    return (
      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl w-full max-w-md mx-auto shadow-2xl flex flex-col items-center">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Private Video</h2>
        <p className="text-white/60 text-sm mb-8 text-center">This video is password protected. Please enter the password to view it.</p>
        
        <form 
          className="w-full space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            fetchMeta(password);
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all"
          />
          {passwordError && <p className="text-red-400 text-xs text-center font-semibold">Incorrect password. Please try again.</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Watch Video'}
          </button>
        </form>
      </div>
    );
  }

  // Helper to append cache bust parameter to urls
  const cacheBust = (url?: string) => url ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : undefined;

  return (
    <div 
      className="w-full relative group bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center"
      style={{
        aspectRatio: aspectRatio ? String(aspectRatio) : '16/9',
        maxHeight: '100%',
        maxWidth: '100%',
        height: aspectRatio && aspectRatio < 1 ? '100%' : 'auto',
        width: !aspectRatio || aspectRatio >= 1 ? '100%' : 'auto',
      }}
    >
      {!data?.hlsManifestUrl && !data?.originalMp4Url ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-white text-center p-6 bg-red-500/20 rounded-xl border border-red-500/50 max-w-md">
            <h3 className="text-lg font-bold mb-2">Playback Error</h3>
            <p className="text-sm text-red-200">No media URLs available for this video.</p>
          </div>
        </div>
      ) : (
        <CustomVideoPlayer
          videoId={videoId}
          workspaceId={data.workspaceId}
          status={data.status}
          posterUrl={cacheBust(data.posterUrl)}
          hlsManifestUrl={data.hlsManifestUrl}
          originalMp4Url={data.originalMp4Url}
          captionsUrl={cacheBust(data.captionsUrl)}
          settings={data.settings || {}}
          isLivePreview={false}
          onAspectRatioChange={setAspectRatio}
        />
      )}
    </div>
  );
}
