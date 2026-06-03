import { uploadFileToR2, PUBLIC_CDN_URL } from './r2.js';
import { audioStorageKey } from './storage-keys.js';

export async function extractAndUploadAudio(
  rawFilePath: string,
  tempDir: string,
  workspaceId: string,
  videoId: string
): Promise<string> {
  const { spawn } = await import('child_process');
  const path = await import('path');
  const audioPath = path.join(tempDir, 'audio.mp3');

  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-y',
      '-i',
      rawFilePath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '4',
      audioPath,
    ]);
    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Audio extract failed: ${stderr}`));
    });
    child.on('error', reject);
  });

  const key = audioStorageKey(workspaceId, videoId);
  const url = await uploadFileToR2(audioPath, key);
  return url;
}

export async function requestDeepgramTranscription(audioUrl: string, callbackUrl: string): Promise<void> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.log('[Worker] DEEPGRAM_API_KEY not set — skipping transcription');
    return;
  }

  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    utterances: 'true',
    punctuate: 'true',
    callback: callbackUrl,
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Deepgram request failed (${res.status}): ${text}`);
  }

  console.log('[Worker] Deepgram transcription requested for', audioUrl);
}

export function audioPublicUrl(workspaceId: string, videoId: string): string {
  const key = audioStorageKey(workspaceId, videoId);
  return `${PUBLIC_CDN_URL.replace(/\/$/, '')}/${key}`;
}
