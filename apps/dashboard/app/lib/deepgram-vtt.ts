export interface TranscriptUtterance {
  start: number;
  end: number;
  text: string;
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const sec = Math.floor(s);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function utterancesToVtt(utterances: TranscriptUtterance[]): string {
  const lines = ['WEBVTT', ''];
  for (const u of utterances) {
    if (!u.text?.trim()) continue;
    lines.push(`${formatVttTime(u.start)} --> ${formatVttTime(u.end)}`);
    lines.push(u.text.trim());
    lines.push('');
  }
  return lines.join('\n');
}

export function parseDeepgramUtterances(payload: unknown): TranscriptUtterance[] {
  const results = (payload as { results?: any })?.results;
  if (!results) return [];

  // Prefer word-level chunking for short, readable captions
  const words = results.channels?.[0]?.alternatives?.[0]?.words;
  if (Array.isArray(words) && words.length > 0) {
    const chunks: TranscriptUtterance[] = [];
    let currentChunk: any[] = [];
    
    for (const word of words) {
      currentChunk.push(word);
      // Create a new chunk every 8 words or if there is a long pause (>1.5s)
      const isLongPause = currentChunk.length > 1 && (word.start - currentChunk[currentChunk.length - 2].end) > 1.5;
      
      if (currentChunk.length >= 8 || isLongPause) {
        chunks.push({
          start: Number(currentChunk[0].start),
          end: Number(currentChunk[currentChunk.length - 1].end),
          text: currentChunk.map(w => w.punctuated_word || w.word).join(' ').trim(),
        });
        currentChunk = [];
      }
    }
    if (currentChunk.length > 0) {
      chunks.push({
        start: Number(currentChunk[0].start),
        end: Number(currentChunk[currentChunk.length - 1].end),
        text: currentChunk.map(w => w.punctuated_word || w.word).join(' ').trim(),
      });
    }
    return chunks;
  }

  // Fallback to utterances
  const raw = results.utterances;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((u) => {
      const row = u as { start?: number; end?: number; transcript?: string };
      return {
        start: Number(row.start ?? 0),
        end: Number(row.end ?? 0),
        text: String(row.transcript ?? '').trim(),
      };
    })
    .filter((u) => u.text.length > 0);
}

export function snippetForTimeRange(
  utterances: TranscriptUtterance[],
  startSec: number,
  endSec: number
): string {
  const parts = utterances
    .filter((u) => u.end > startSec && u.start < endSec)
    .map((u) => u.text);
  return parts.join(' ').trim();
}
