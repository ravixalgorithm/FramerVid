/** Capture the frame currently displayed on a <video> element. */
export async function captureVideoFrame(
  videoEl: HTMLVideoElement,
): Promise<string | null> {
  await waitForVisibleFrame(videoEl);

  const width = videoEl.videoWidth;
  const height = videoEl.videoHeight;
  if (!width || !height) return null;

  const fromBitmap = await captureViaCreateImageBitmap(videoEl, width, height);
  if (fromBitmap) return fromBitmap;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.drawImage(videoEl, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  }
}

const READY_TIMEOUT_MS = 3000;
const FRAME_CALLBACK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

async function waitForFrameReady(videoEl: HTMLVideoElement): Promise<void> {
  if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;

  try {
    await withTimeout(
      new Promise<void>((resolve) => {
        const done = () => {
          videoEl.removeEventListener('loadeddata', done);
          videoEl.removeEventListener('canplay', done);
          videoEl.removeEventListener('seeked', done);
          resolve();
        };
        if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          resolve();
          return;
        }
        videoEl.addEventListener('loadeddata', done);
        videoEl.addEventListener('canplay', done);
        videoEl.addEventListener('seeked', done);
      }),
      READY_TIMEOUT_MS,
      'Ready',
    );
  } catch {
    if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      throw new Error('Video not ready');
    }
  }
}

async function waitForPaint(videoEl: HTMLVideoElement): Promise<void> {
  if ('requestVideoFrameCallback' in videoEl) {
    try {
      await withTimeout(
        new Promise<void>((resolve) => {
          (
            videoEl as HTMLVideoElement & {
              requestVideoFrameCallback: (cb: () => void) => number;
            }
          ).requestVideoFrameCallback(() => resolve());
        }),
        FRAME_CALLBACK_TIMEOUT_MS,
        'Frame paint',
      );
      return;
    } catch {
      /* fall through */
    }
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForVisibleFrame(videoEl: HTMLVideoElement): Promise<void> {
  await waitForFrameReady(videoEl);
  await waitForPaint(videoEl);
  if (videoEl.paused) {
    await delay(200);
    await waitForPaint(videoEl);
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function captureViaCreateImageBitmap(
  videoEl: HTMLVideoElement,
  width: number,
  height: number,
): Promise<string | null> {
  if (typeof createImageBitmap !== 'function') return null;

  try {
    const bitmap = await createImageBitmap(videoEl);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  }
}

type CaptureStreamVideo = HTMLVideoElement & {
  captureStream: () => MediaStream;
};

/** Grab a frame via ImageCapture when canvas draw is blocked. */
export async function captureVideoFrameViaImageCapture(
  videoEl: HTMLVideoElement,
): Promise<string | null> {
  if (typeof ImageCapture === 'undefined' || !('captureStream' in videoEl)) {
    return null;
  }

  try {
    const stream = (videoEl as CaptureStreamVideo).captureStream();
    const track = stream.getVideoTracks()[0];
    if (!track) return null;

    const capture = new ImageCapture(track);
    const bitmap = await (capture as ImageCapture & { grabFrame(): Promise<ImageBitmap> }).grabFrame();
    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch {
    return null;
  }
}
