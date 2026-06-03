/**
 * Ping the Render worker so the free-tier web service spins up before BullMQ jobs arrive.
 * Set FRAMEVID_WORKER_URL=https://framevid-worker.onrender.com on Vercel.
 */
export async function wakeTranscodeWorker(): Promise<void> {
  const base = process.env.FRAMEVID_WORKER_URL?.replace(/\/$/, '');
  if (!base) return;

  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[wake-worker] ${base}/health returned ${res.status}`);
    }
  } catch (err) {
    console.warn('[wake-worker] Could not reach worker (may still be spinning up):', err);
  }
}
