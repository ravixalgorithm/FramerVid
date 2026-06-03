import fs from 'fs/promises';
import type { FrictionInsight, VideoAiInsights } from '@framevid/types';
import { db, videos } from '@framevid/db';
import { eq } from 'drizzle-orm';
import type { RetentionSeries } from '@framevid/types';
import { detectRetentionCliff } from './analytics-queries';
import { localUploadPath } from '../../lib/storage';
import { transcriptStorageKey } from './asset-url';
import { snippetForTimeRange, type TranscriptUtterance } from './deepgram-vtt';

async function loadTranscriptUtterances(workspaceId: string, videoId: string): Promise<TranscriptUtterance[]> {
  try {
    const raw = await fs.readFile(localUploadPath(transcriptStorageKey(workspaceId, videoId)), 'utf8');
    const parsed = JSON.parse(raw) as { utterances?: TranscriptUtterance[] };
    return parsed.utterances ?? [];
  } catch {
    return [];
  }
}

async function callFrictionLlm(input: {
  cliffBucket: number;
  dropPct: number;
  fromPct: number;
  toPct: number;
  transcriptSnippet: string;
  videoTitle: string;
}): Promise<{ analysis: string; actions: string[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      analysis: `Viewers drop sharply around ${input.cliffBucket}s (${input.fromPct}% → ${input.toPct}%, −${input.dropPct} pts). Add GROQ_API_KEY for AI recommendations.`,
      actions: [
        'Review pacing and messaging at the cliff timestamp.',
        'Consider a mid-roll CTA or chapter break before the drop.',
      ],
    };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You analyze video retention drop-offs for creators. Respond with JSON: { "analysis": string, "actions": string[2] }.',
        },
        {
          role: 'user',
          content: `Video: "${input.videoTitle}"
Drop at ${input.cliffBucket}s: retention fell ${input.dropPct} points (${input.fromPct}% to ${input.toPct}%).
Transcript near cliff: ${input.transcriptSnippet || '(no transcript)'}
Explain likely friction and give exactly 2 concrete actions.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Groq API Error:', res.status, errText);
    throw new Error(`Groq error: ${res.status} - ${errText}`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenAI response');

  const parsed = JSON.parse(content) as { analysis?: string; actions?: string[] };
  return {
    analysis: parsed.analysis || 'Retention dropped at this segment.',
    actions: (parsed.actions ?? []).slice(0, 2),
  };
}

export async function getFrictionData(
  videoId: string,
  retention: RetentionSeries
): Promise<FrictionInsight | null> {
  const cliff = detectRetentionCliff(retention);
  if (!cliff) return null;

  const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!video) return null;

  const cached = video.aiInsights?.friction;
  if (
    cached &&
    cached.cliffBucket === cliff.cliffBucket
  ) {
    return cached;
  }

  return {
    cliffBucket: cliff.cliffBucket,
    dropPct: cliff.dropPct,
  };
}

export async function generateFrictionAnalysis(
  videoId: string,
  retention: RetentionSeries
): Promise<FrictionInsight | null> {
  const cliff = detectRetentionCliff(retention);
  if (!cliff) return null;

  const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!video) return null;

  const utterances = await loadTranscriptUtterances(video.workspaceId, videoId);
  const transcriptSnippet = snippetForTimeRange(
    utterances,
    cliff.cliffBucket,
    cliff.cliffBucket + 5
  );

  const llm = await callFrictionLlm({
    cliffBucket: cliff.cliffBucket,
    dropPct: cliff.dropPct,
    fromPct: cliff.fromPct,
    toPct: cliff.toPct,
    transcriptSnippet,
    videoTitle: video.title,
  });

  const friction: FrictionInsight = {
    cliffBucket: cliff.cliffBucket,
    dropPct: cliff.dropPct,
    analysis: llm.analysis,
    actions: llm.actions,
    transcriptSnippet: transcriptSnippet || undefined,
    generatedAt: new Date().toISOString(),
  };

  const aiInsights: VideoAiInsights = {
    ...(video.aiInsights ?? {}),
    friction,
  };

  await db
    .update(videos)
    .set({ aiInsights, updatedAt: new Date() })
    .where(eq(videos.id, videoId));

  return friction;
}
