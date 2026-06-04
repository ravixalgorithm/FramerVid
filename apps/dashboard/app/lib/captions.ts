export interface VttCue {
  start: number;
  end: number;
  text: string;
}

function vttTimestampToSeconds(value: string): number {
  const t = value.trim().replace(',', '.');
  const segments = t.split(':');
  if (segments.length === 3) {
    const [h, m, s] = segments;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  if (segments.length === 2) {
    const [m, s] = segments;
    return Number(m) * 60 + Number(s);
  }
  return Number(t);
}

/** Parse WebVTT into timed cues for custom preview overlays (HLS.js + MSE ignores native tracks). */
export function parseVttCues(vtt: string): VttCue[] {
  const normalized = vtt.replace(/^\uFEFF/, '').trim().replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  const cues: VttCue[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE')) continue;

    const lines = block.split('\n');
    const timeIdx = lines.findIndex((line) => line.includes('-->'));
    if (timeIdx === -1) continue;

    const [startPart, endPart] = lines[timeIdx].split('-->').map((s) => s.trim());
    const start = vttTimestampToSeconds(startPart);
    const end = vttTimestampToSeconds(endPart);
    const text = lines
      .slice(timeIdx + 1)
      .join('\n')
      .trim()
      .replace(/^NOTE\s+/i, '');

    if (!text || text.toLowerCase().startsWith('no speech detected')) continue;
    cues.push({ start, end, text });
  }

  return cues;
}

/** Normalize uploaded caption files to WebVTT. */
export function normalizeCaptionsFile(raw: string, filename: string): string {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (!text) {
    throw new Error('Caption file is empty.');
  }

  if (text.startsWith('WEBVTT')) {
    return text.endsWith('\n') ? text : `${text}\n`;
  }

  const lower = filename.toLowerCase();
  if (lower.endsWith('.srt') || /^\d+\s*[\r\n]+\d{2}:\d{2}:\d{2}/m.test(text)) {
    return srtToVtt(text);
  }

  throw new Error('Upload a WebVTT (.vtt) or SubRip (.srt) file.');
}

function srtToVtt(srt: string): string {
  const normalized = srt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\n+/);
  let vtt = 'WEBVTT\n\n';

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0);
    if (lines.length < 2) continue;

    let timeIdx = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      timeIdx = 1;
    }
    if (timeIdx >= lines.length) continue;

    const timeLine = lines[timeIdx];
    if (!timeLine.includes('-->')) continue;

    const cueTimes = timeLine.replace(/,/g, '.');
    const cueText = lines.slice(timeIdx + 1).join('\n');
    vtt += `${cueTimes}\n${cueText}\n\n`;
  }

  if (vtt.trim() === 'WEBVTT') {
    throw new Error('Could not parse SRT file. Check the format and try again.');
  }

  return vtt;
}
