import type { CaptureResponse } from '../messaging';
import { putCapture, purgeExpired } from '../storage/captures';
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

export async function captureVisible(): Promise<CaptureResponse> {
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
      const blob = decodeDataUrl(dataUrl);
      const bitmap = await createImageBitmap(blob);
      const fits = withinBudget(bitmap.width, bitmap.height);
      bitmap.close();
      if (!fits) return fail('tooLarge');
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
