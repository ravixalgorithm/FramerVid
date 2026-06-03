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
