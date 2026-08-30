import type { BackgroundSettings } from '../types.js';

export type LocalMediaKind = 'image' | 'video';

export interface PortableBackgroundMedia {
  image?: string;
  video?: string;
}

const DB_NAME = 'clicksTheGameMediaV1';
const STORE_NAME = 'backgrounds';
const DB_VERSION = 1;
const IMAGE_KEY = 'custom-image';
const VIDEO_KEY = 'custom-video';
const IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento local.'));
  });
}

function mediaKey(kind: LocalMediaKind): string {
  return kind === 'image' ? IMAGE_KEY : VIDEO_KEY;
}

export function validateLocalMedia(kind: LocalMediaKind, file: File): string | null {
  const allowed = kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES;
  const maxBytes = kind === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
  if (!allowed.has(file.type)) {
    return kind === 'image'
      ? 'Usa una imagen PNG, JPEG o WebP.'
      : 'Usa un video MP4 o WebM.';
  }
  if (file.size > maxBytes) {
    const maxMb = Math.floor(maxBytes / (1024 * 1024));
    return `El archivo supera el máximo de ${maxMb} MB.`;
  }
  return null;
}

export async function saveLocalMedia(kind: LocalMediaKind, file: File): Promise<void> {
  const validation = validateLocalMedia(kind, file);
  if (validation) throw new Error(validation);
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(file, mediaKey(kind));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar el fondo.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('No se pudo guardar el fondo.'));
  });
  database.close();
}

export async function loadLocalMedia(kind: LocalMediaKind): Promise<Blob | null> {
  const database = await openDatabase();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(mediaKey(kind));
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('No se pudo leer el fondo.'));
  });
  database.close();
  return result;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo exportar el fondo.'));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function exportStoredMedia(settings: BackgroundSettings): Promise<PortableBackgroundMedia | undefined> {
  const portable: PortableBackgroundMedia = {};
  if (settings.mode === 'customImage') {
    const image = await loadLocalMedia('image');
    if (image) portable.image = await blobToDataUrl(image);
  }
  if (settings.mode === 'customVideo') {
    const video = await loadLocalMedia('video');
    if (video) portable.video = await blobToDataUrl(video);
  }
  return portable.image || portable.video ? portable : undefined;
}

export async function importStoredMedia(media: PortableBackgroundMedia | undefined): Promise<void> {
  if (!media) return;
  if (typeof media.image === 'string' && media.image.startsWith('data:image/')) {
    const image = await dataUrlToBlob(media.image);
    if (IMAGE_TYPES.has(image.type) && image.size <= IMAGE_MAX_BYTES) {
      await saveLocalMedia('image', new File([image], 'background-image', { type: image.type }));
    }
  }
  if (typeof media.video === 'string' && media.video.startsWith('data:video/')) {
    const video = await dataUrlToBlob(media.video);
    if (VIDEO_TYPES.has(video.type) && video.size <= VIDEO_MAX_BYTES) {
      await saveLocalMedia('video', new File([video], 'background-video', { type: video.type }));
    }
  }
}
