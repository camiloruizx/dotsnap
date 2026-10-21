/** Capturas temporales en IndexedDB; chrome.storage queda solo para preferencias. */
const dbName = 'dotsnap';
const storeName = 'captures';
export const captureTtlMs = 24 * 60 * 60 * 1000;
const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isCaptureId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}

interface CaptureRecord {
  id: string;
  blob: Blob;
  createdAt: number;
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

export async function putCapture(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const record: CaptureRecord = { id, blob, createdAt: Date.now() };
  await run('readwrite', (store) => store.put(record));
  return id;
}

export async function getCapture(id: string): Promise<Blob | undefined> {
  if (!isCaptureId(id)) return undefined;
  const record = await run<CaptureRecord | undefined>('readonly', (store) =>
    store.get(id),
  );
  return record?.blob;
}

export async function deleteCapture(id: string): Promise<void> {
  if (!isCaptureId(id)) return;
  await run('readwrite', (store) => store.delete(id));
}

/** Limpieza por caducidad: se ejecuta antes de cada captura. */
export async function purgeExpired(now = Date.now()): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const cursorRequest = tx.objectStore(storeName).openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if (now - (cursor.value as CaptureRecord).createdAt > captureTtlMs)
          cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('storage'));
    });
  } finally {
    db.close();
  }
}
