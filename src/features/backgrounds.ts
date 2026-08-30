import { loadLocalMedia, saveLocalMedia, type LocalMediaKind } from '../game/media-storage.js';
import type { BackgroundSettings } from '../types.js';

const PRESET_URLS = {
  neonGrid: './assets/backgrounds/neon-grid.svg',
  synthSunset: './assets/backgrounds/synth-sunset.svg',
  cyberCircuit: './assets/backgrounds/cyber-circuit.svg'
} as const;

let objectUrl = '';
let visibilityBound = false;
let latestSettings: BackgroundSettings | null = null;

function layer(): HTMLElement | null {
  return document.getElementById('custom-background-layer');
}

function imageLayer(): HTMLElement | null {
  return document.getElementById('custom-background-image');
}

function videoLayer(): HTMLVideoElement | null {
  return document.getElementById('custom-background-video') as HTMLVideoElement | null;
}

function revokeObjectUrl(): void {
  if (!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  objectUrl = '';
}

function shouldReduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function isCompactViewport(): boolean {
  return window.matchMedia?.('(max-width: 767px)').matches ?? false;
}

async function syncVideoPlayback(): Promise<void> {
  const video = videoLayer();
  if (!video || !latestSettings || latestSettings.mode !== 'customVideo') return;
  const shouldPause = latestSettings.videoPaused || shouldReduceMotion() || document.visibilityState === 'hidden';
  if (shouldPause) {
    video.pause();
    return;
  }
  try {
    await video.play();
  } catch {
    video.pause();
  }
}

function bindVisibilityOnce(): void {
  if (visibilityBound) return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => void syncVideoPlayback());
}

export async function saveBackgroundFile(kind: LocalMediaKind, file: File): Promise<void> {
  await saveLocalMedia(kind, file);
}

export async function applyBackground(settings: BackgroundSettings): Promise<void> {
  latestSettings = settings;
  bindVisibilityOnce();
  const host = layer();
  const image = imageLayer();
  const video = videoLayer();
  if (!host || !image || !video) return;

  revokeObjectUrl();
  image.style.backgroundImage = '';
  video.pause();
  video.removeAttribute('src');
  video.load();
  host.dataset.mode = settings.mode;
  document.body.dataset.backgroundMode = settings.mode;

  if (settings.mode === 'default') {
    host.classList.remove('is-active');
    return;
  }

  host.classList.add('is-active');

  if (settings.mode === 'preset') {
    image.style.backgroundImage = `url("${PRESET_URLS[settings.preset]}")`;
    return;
  }

  if (settings.mode === 'customImage') {
    const blob = await loadLocalMedia('image');
    if (!blob) {
      host.classList.remove('is-active');
      return;
    }
    objectUrl = URL.createObjectURL(blob);
    image.style.backgroundImage = `url("${objectUrl}")`;
    return;
  }

  const blob = await loadLocalMedia('video');
  if (!blob) {
    host.classList.remove('is-active');
    return;
  }
  objectUrl = URL.createObjectURL(blob);
  video.src = objectUrl;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = isCompactViewport() ? 'metadata' : 'auto';
  await syncVideoPlayback();
}
