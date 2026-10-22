import type { CaptureResponse } from '../messaging';
import { putCapture, purgeExpired } from '../storage/captures';
import {
  captureScale,
  toPixelCrop,
  type Rectangle,
  type Size,
} from '../geometry/crop';
import { decodeDataUrl } from './dataUrl';
import { mapCaptureError, withinBudget } from './errors';

const lockKey = 'capture.lock';
const lastKey = 'capture.last';
/** captureVisibleTab admite 2 llamadas por segundo; se deja holgura. */
export const minIntervalMs = 600;
const lockTtlMs = 20_000;
/** Cierra la ventana de carrera dentro de una misma vida del worker; el candado en storage.session cubre reinicios. */
let running = false;

const fail = (code: Extract<CaptureResponse, { ok: false }>['code']) =>
  ({ version: 1, ok: false, code }) as const;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function activeTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab?.id !== undefined && tab.windowId !== undefined ? tab : undefined;
}

export interface CaptureOptions {
  /** Si se indica, la pestaña activa debe ser esta; si no, se descarta la captura. */
  tabId?: number;
  /** Región en px CSS del viewport; se recorta con la escala medida del bitmap. */
  crop?: { region: Rectangle; viewport: Size };
}

/** Recorta el bitmap a la región; null si la geometría es inválida o queda vacía. */
async function cropBlob(
  bitmap: ImageBitmap,
  crop: NonNullable<CaptureOptions['crop']>,
): Promise<Blob | null> {
  try {
    const scale = captureScale(bitmap, crop.viewport);
    const box = toPixelCrop(crop.region, scale, bitmap);
    if (box.width < 1 || box.height < 1) return null;
    const canvas = new OffscreenCanvas(box.width, box.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      bitmap,
      box.x,
      box.y,
      box.width,
      box.height,
      0,
      0,
      box.width,
      box.height,
    );
    return await canvas.convertToBlob({ type: 'image/png' });
  } catch {
    return null;
  }
}

export async function captureVisible(
  options: CaptureOptions = {},
): Promise<CaptureResponse> {
  if (running) return fail('busy');
  running = true;
  try {
    const stored = await chrome.storage.session.get([lockKey, lastKey]);
    const lock = stored[lockKey] as number | undefined;
    if (typeof lock === 'number' && Date.now() - lock < lockTtlMs)
      return fail('busy');
    await chrome.storage.session.set({ [lockKey]: Date.now() });
    try {
      const last = stored[lastKey] as number | undefined;
      if (typeof last === 'number') {
        const remaining = minIntervalMs - (Date.now() - last);
        if (remaining > 0) await wait(remaining);
      }
      await purgeExpired();
      const tab = await activeTab();
      if (!tab) return fail('noTab');
      if (options.tabId !== undefined && tab.id !== options.tabId)
        return fail('tabChanged');
      let dataUrl: string;
      try {
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
        });
      } catch (error) {
        return fail(
          mapCaptureError(error instanceof Error ? error.message : ''),
        );
      }
      // Si el foco cambió durante la captura, el bitmap podría ser de otra pestaña.
      if ((await activeTab())?.id !== tab.id) return fail('tabChanged');
      let blob = decodeDataUrl(dataUrl);
      const bitmap = await createImageBitmap(blob);
      try {
        if (options.crop) {
          const cropped = await cropBlob(bitmap, options.crop);
          if (!cropped) return fail('failed');
          blob = cropped;
        } else if (!withinBudget(bitmap.width, bitmap.height))
          return fail('tooLarge');
      } finally {
        bitmap.close();
      }
      const id = await putCapture(blob);
      await chrome.tabs.create({
        url: chrome.runtime.getURL(`/editor.html?capture=${id}`),
        index: tab.index + 1,
        openerTabId: tab.id,
      });
      return { version: 1, ok: true };
    } finally {
      await chrome.storage.session.set({ [lastKey]: Date.now() });
      await chrome.storage.session.remove(lockKey);
    }
  } catch {
    return fail('failed');
  } finally {
    running = false;
  }
}
