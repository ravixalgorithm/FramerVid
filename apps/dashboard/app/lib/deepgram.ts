export async function requestDeepgramTranscription(audioUrl: string, callbackUrl: string): Promise<void> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set in environment variables');
  }

  const params = new URLSearchParams({
    model: 'nova-2',
    detect_language: 'true',
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

  console.log('[Dashboard] Deepgram transcription requested for', audioUrl);
}
