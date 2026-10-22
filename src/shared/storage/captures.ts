/** Capturas en IndexedDB (con miniatura y anotaciones para el historial); chrome.storage solo guarda preferencias. */
import { readPreferences } from './preferences';

const dbName = 'dotsnap';
const storeName = 'captures';
export const captureTtlMs = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_ITEMS = 60;
export const MAX_BYTES = 300 * 1024 * 1024;
const THUMB_WIDTH = 240;
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isCaptureId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}

interface CaptureRecord {
  id: string;
  blob: Blob;
  createdAt: number;
  updatedAt?: number;
  width?: number;
  height?: number;
  thumb?: Blob;
  annotations?: unknown[];
  name?: string;
}

export interface HistoryItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  bytes: number;
  edited: boolean;
  name: string | undefined;
  thumb: Blob | undefined;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('storage'));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(
        db.transaction(storeName, mode).objectStore(storeName),
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('storage'));
    });
  } finally {
    db.close();
  }
}

async function readAll(): Promise<CaptureRecord[]> {
  return run<CaptureRecord[]>('readonly', (store) => store.getAll());
}

async function makeThumb(
  blob: Blob,
): Promise<{ thumb?: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = bitmap;
    const w = Math.min(THUMB_WIDTH, width);
    const h = Math.max(1, Math.round((height * w) / width));
    const canvas = new OffscreenCanvas(w, Math.min(h, THUMB_WIDTH * 2));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width, height };
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return {
      thumb: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 }),
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

export async function putCapture(
  blob: Blob,
  annotations?: unknown[],
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const record: CaptureRecord = { id, blob, createdAt: now, updatedAt: now };
  try {
    const meta = await makeThumb(blob);
    record.width = meta.width;
    record.height = meta.height;
    if (meta.thumb) record.thumb = meta.thumb;
  } catch {
    /* sin miniatura: el historial muestra solo los datos */
  }
  if (annotations && annotations.length > 0) record.annotations = annotations;
  await run('readwrite', (store) => store.put(record));
  await enforceQuota(id).catch(() => {});
  return id;
}

export async function getCapture(id: string): Promise<Blob | undefined> {
  return (await getRecord(id))?.blob;
}

export async function getRecord(
  id: string,
): Promise<{ blob: Blob; annotations: unknown[] | undefined } | undefined> {
  if (!isCaptureId(id)) return undefined;
  const record = await run<CaptureRecord | undefined>('readonly', (store) =>
    store.get(id),
  );
  return record
    ? { blob: record.blob, annotations: record.annotations }
    : undefined;
}

/** Guarda las anotaciones de una captura existente (autoguardado del editor). */
export async function saveAnnotations(
  id: string,
  annotations: readonly unknown[],
): Promise<void> {
  if (!isCaptureId(id)) return;
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as CaptureRecord | undefined;
        if (!record) return;
        if (annotations.length > 0) record.annotations = [...annotations];
        else delete record.annotations;
        record.updatedAt = Date.now();
        store.put(record);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('storage'));
    });
  } finally {
    db.close();
  }
}

export const MAX_NAME = 60;
/** Nombre limpio para el historial: sin caracteres de control, recortado; '' = sin nombre. */
export function cleanName(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    out += code < 32 || code === 127 ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}
/** Texto buscable de un elemento del historial: nombre y fecha. */
export function matchesQuery(
  item: { name: string | undefined; updatedAt: number },
  query: string,
  locale: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const date = new Date(item.updatedAt).toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return `${item.name ?? ''} ${date}`.toLowerCase().includes(q);
}
/** Cambia el nombre de una captura del historial (vacío lo quita). */
export async function renameCapture(id: string, name: string): Promise<void> {
  if (!isCaptureId(id)) return;
  const clean = cleanName(name);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as CaptureRecord | undefined;
        if (!record) return;
        if (clean) record.name = clean;
        else delete record.name;
        store.put(record);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('storage'));
    });
  } finally {
    db.close();
  }
}

export async function deleteCapture(id: string): Promise<void> {
  if (!isCaptureId(id)) return;
  await run('readwrite', (store) => store.delete(id));
}

export async function clearCaptures(): Promise<void> {
  await run('readwrite', (store) => store.clear());
}

/** Capturas recientes, la más nueva primero (sin los blobs originales). */
export async function listHistory(): Promise<HistoryItem[]> {
  const records = await readAll();
  return records
    .map<HistoryItem>((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt ?? r.createdAt,
      width: r.width ?? 0,
      height: r.height ?? 0,
      bytes: r.blob.size,
      edited: (r.annotations?.length ?? 0) > 0,
      name: r.name,
      thumb: r.thumb,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Elimina lo más antiguo hasta cumplir el máximo de elementos y de bytes (nunca `keep`). */
export async function enforceQuota(keep: string): Promise<number> {
  const records = (await readAll()).sort(
    (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
  );
  let items = 0;
  let bytes = 0;
  let removed = 0;
  for (const r of records) {
    items += 1;
    bytes += r.blob.size + (r.thumb?.size ?? 0);
    if (r.id !== keep && (items > MAX_ITEMS || bytes > MAX_BYTES)) {
      await deleteCapture(r.id);
      removed += 1;
    }
  }
  return removed;
}

/** Retención efectiva: la elegida con historial activo; 24 h si está desactivado. */
export async function retentionMs(): Promise<number> {
  try {
    const prefs = await readPreferences();
    return prefs.historyEnabled ? prefs.retentionDays * DAY_MS : captureTtlMs;
  } catch {
    return captureTtlMs;
  }
}

/** Limpieza por caducidad: se ejecuta antes de cada captura. */
export async function purgeExpired(
  now = Date.now(),
  ttl?: number,
): Promise<void> {
  const limit = ttl ?? (await retentionMs());
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const cursorRequest = tx.objectStore(storeName).openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const value = cursor.value as CaptureRecord;
        if (now - (value.updatedAt ?? value.createdAt) > limit) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('storage'));
    });
  } finally {
    db.close();
  }
}
