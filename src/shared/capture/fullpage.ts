import { captureScale, type Size } from '../geometry/crop';
import {
  maxPartRows,
  nextTile,
  planParts,
  splitTile,
  tileCount,
  type PartRange,
} from '../geometry/stitch';
import {
  parseFullPageMessage,
  type CaptureErrorCode,
  type CaptureResponse,
} from '../messaging';
import { product } from '../config/product';
import { readPreferences } from '../storage/preferences';
import { putCapture, purgeExpired } from '../storage/captures';
import { resolveLanguage, translate, type MessageKey } from '../i18n/translate';
import { maxCaptureArea, maxCaptureSide } from './errors';
import {
  acquireCaptureLock,
  grabVisibleTab,
  refreshCaptureLock,
} from './visible';

const stateKey = 'fullpage.state';
/** Tope de tramos (≈ 84 s con la cola de 600 ms) y de partes (pestañas del editor) por captura. */
export const MAX_TILES = 120;
export const MAX_PARTS = 12;

interface State {
  requestId: string;
  tabId: number;
  createdAt: number;
}
interface Sender {
  id?: string | undefined;
  frameId?: number | undefined;
  tab?: { id?: number | undefined } | undefined;
}
interface Measure {
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  clientWidth: number;
  clientHeight: number;
  scrollY: number;
}

const fail = (code: CaptureErrorCode) =>
  ({ version: 1, ok: false, code }) as const;
class Failure extends Error {
  constructor(readonly code: CaptureErrorCode) {
    super(code);
  }
}
class Cancelled extends Error {}

// Memoria del worker: solo para esta operación; el estado duradero está en storage.session.
let cancelled = false;
let readyWaiter: ((requestId: string) => void) | null = null;

const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

async function send(
  tabId: number,
  requestId: string,
  command: object,
): Promise<Record<string, unknown>> {
  try {
    const response = (await chrome.tabs.sendMessage(
      tabId,
      { version: 1, requestId, ...command },
      { frameId: 0 },
    )) as Record<string, unknown> | undefined;
    if (!response || response.ok !== true) throw new Failure('failed');
    return response;
  } catch (error) {
    // Una navegación o el cierre de la pestaña destruyen el agente.
    throw error instanceof Failure ? error : new Failure('tabChanged');
  }
}

async function badge(text: string, color = '#0078d4'): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
  } catch {
    /* sin acción disponible */
  }
}
async function reportFailure(code: CaptureErrorCode): Promise<void> {
  const language = resolveLanguage(
    (await readPreferences()).language,
    chrome.i18n.getUILanguage(),
  );
  const keys: Record<CaptureErrorCode, MessageKey> = {
    restricted: 'errorRestricted',
    quota: 'errorQuota',
    busy: 'errorBusy',
    tabChanged: 'errorTabChanged',
    noTab: 'errorNoTab',
    tooLarge: 'errorFullPageTooLarge',
    failed: 'errorFailed',
  };
  const key = keys[code];
  try {
    await chrome.action.setTitle({ title: translate(language, key) });
  } catch {
    /* sin acción disponible */
  }
  await badge('!', '#d13438');
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' });
    void chrome.action.setTitle({ title: product.name });
  }, 10_000);
}

/** Inicia la captura: valida y mide con la página, y sigue en segundo plano. */
export async function startFullPage(): Promise<CaptureResponse> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (tab?.id === undefined) return fail('noTab');
  const release = await acquireCaptureLock();
  if (!release) return fail('busy');
  const tabId = tab.id;
  const requestId = crypto.randomUUID();
  cancelled = false;
  let started = false;
  try {
    await purgeExpired();
    await chrome.storage.session.set({
      [stateKey]: { requestId, tabId, createdAt: Date.now() } satisfies State,
    });
    const ready = new Promise<string>((resolve, reject) => {
      readyWaiter = resolve;
      setTimeout(() => reject(new Failure('failed')), 5000);
    });
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/fullpage.js'],
      });
    } catch {
      throw new Failure('restricted');
    }
    await ready;
    const raw = await send(tabId, requestId, { type: 'fp-measure' });
    const m = raw as unknown as Measure;
    if (
      ![
        m.scrollHeight,
        m.viewportWidth,
        m.viewportHeight,
        m.clientWidth,
        m.clientHeight,
        m.scrollY,
      ].every(finite) ||
      m.clientWidth < 1 ||
      m.clientHeight < 1 ||
      m.viewportWidth < 1 ||
      m.viewportHeight < 1
    )
      throw new Failure('failed');
    const pageHeight = Math.max(m.scrollHeight, m.clientHeight);
    if (tileCount(pageHeight, m.clientHeight) > MAX_TILES)
      throw new Failure('tooLarge');
    started = true;
    void run(
      { tabId, tabIndex: tab.index, requestId, measure: m, pageHeight },
      release,
    );
    return { version: 1, ok: true };
  } catch (error) {
    await finish(tabId, requestId);
    await release();
    const code = error instanceof Failure ? error.code : 'failed';
    if (!started) await reportFailure(code);
    return fail(code);
  }
}

interface Job {
  tabId: number;
  tabIndex: number;
  requestId: string;
  measure: Measure;
  pageHeight: number;
}

async function finish(tabId: number, requestId: string): Promise<void> {
  try {
    await send(tabId, requestId, { type: 'fp-finish' });
  } catch {
    /* el agente ya no existe o se restauró solo */
  }
  readyWaiter = null;
  await chrome.storage.session.remove(stateKey);
}

/** Bucle de captura: un tramo por posición de scroll, componiendo por partes sin imagen monolítica. */
async function run(job: Job, release: () => Promise<void>): Promise<void> {
  const { tabId, requestId, measure: m, pageHeight } = job;
  const tileHeight = m.clientHeight;
  const viewport: Size = { width: m.viewportWidth, height: m.viewportHeight };
  const partIds: string[] = [];
  let parts: PartRange[] = [];
  let canvas: OffscreenCanvas | null = null;
  let current = -1;
  let covered = 0;
  let written = 0;
  let widthPx = 0;

  const flush = async (rows: number) => {
    if (!canvas) return;
    let source = canvas;
    if (rows < canvas.height) {
      source = new OffscreenCanvas(canvas.width, Math.max(1, rows));
      source.getContext('2d')?.drawImage(canvas, 0, 0);
    }
    const blob = await source.convertToBlob({ type: 'image/png' });
    if (!blob || blob.size === 0) throw new Failure('failed');
    partIds.push(await putCapture(blob));
    canvas = null;
  };

  try {
    const total = tileCount(pageHeight, tileHeight);
    for (let k = 0; k < total + 2; k++) {
      if (cancelled) throw new Cancelled();
      await badge(`${Math.min(k + 1, total)}/${total}`);
      await refreshCaptureLock();
      const scroll = await send(tabId, requestId, {
        type: 'fp-scroll',
        y: covered,
        hideFloating: k > 0,
      });
      if (!finite(scroll.scrollY) || !finite(scroll.maxScroll))
        throw new Failure('failed');
      if (cancelled) throw new Cancelled();
      const grab = await grabVisibleTab(tabId, 3);
      if (!grab.ok) throw new Failure(grab.code);
      const { bitmap } = grab;
      try {
        const scale = captureScale(bitmap, viewport);
        if (k === 0) {
          widthPx = Math.min(bitmap.width, Math.round(m.clientWidth * scale.x));
          const totalRows = Math.round(pageHeight * scale.y);
          const perPart = maxPartRows(widthPx, maxCaptureSide, maxCaptureArea);
          parts = planParts(totalRows, perPart);
          if (parts.length === 0 || parts.length > MAX_PARTS)
            throw new Failure('tooLarge');
        }
        const tile = nextTile(covered, scroll.scrollY, tileHeight, scale.y);
        if (tile) {
          const rows = Math.min(
            tile.rows,
            bitmap.height - tile.srcY,
            (parts.at(-1)?.end ?? 0) - tile.dstY,
          );
          for (const piece of splitTile({ ...tile, rows }, parts)) {
            if (piece.part !== current) {
              const previous = parts[current];
              await flush(previous ? previous.end - previous.start : 0);
              current = piece.part;
              const range = parts[current]!;
              canvas = new OffscreenCanvas(widthPx, range.end - range.start);
            }
            const ctx = canvas?.getContext('2d');
            if (!ctx) throw new Failure('failed');
            ctx.drawImage(
              bitmap,
              0,
              piece.srcY,
              widthPx,
              piece.rows,
              0,
              piece.destY,
              widthPx,
              piece.rows,
            );
          }
          written = tile.dstY + rows;
        }
      } catch (error) {
        if (error instanceof RangeError) throw new Failure('failed');
        throw error;
      } finally {
        bitmap.close();
      }
      covered = scroll.scrollY + tileHeight;
      // Fin: ya se cubrió toda la altura medida, o el desplazamiento llegó al final real.
      if (
        covered >= pageHeight - 0.5 ||
        scroll.scrollY >= scroll.maxScroll - 0.5
      )
        break;
    }
    if (cancelled) throw new Cancelled();
    const last = parts[current];
    if (!last || written <= 0) throw new Failure('failed');
    // La página pudo acortarse durante la captura: la última parte se recorta a lo escrito.
    await flush(Math.min(last.end, written) - last.start);
    const ids = partIds;
    for (const [i, id] of ids.entries()) {
      const query =
        ids.length > 1
          ? `capture=${id}&part=${i + 1}&parts=${ids.length}`
          : `capture=${id}`;
      await chrome.tabs.create({
        url: chrome.runtime.getURL(`/editor.html?${query}`),
        index: job.tabIndex + 1 + i,
        openerTabId: tabId,
        active: i === 0,
      });
    }
    await chrome.action.setBadgeText({ text: '' });
  } catch (error) {
    if (error instanceof Cancelled)
      await chrome.action.setBadgeText({ text: '' });
    else await reportFailure(error instanceof Failure ? error.code : 'failed');
  } finally {
    await finish(tabId, requestId);
    await release();
    cancelled = false;
  }
}

/** Mensajes del agente de la página; solo la pestaña y el marco principal ligados a la operación. */
export async function handleFullPageMessage(
  message: unknown,
  sender: Sender,
  extensionId: string,
): Promise<unknown> {
  const parsed = parseFullPageMessage(message);
  const state = (await chrome.storage.session.get(stateKey))[stateKey] as
    State | undefined;
  if (
    !parsed ||
    !state ||
    sender.id !== extensionId ||
    sender.tab?.id !== state.tabId ||
    sender.frameId !== 0
  )
    return fail('failed');
  if (parsed.type === 'fullpage-ready') {
    readyWaiter?.(state.requestId);
    readyWaiter = null;
    return { version: 1, ok: true, requestId: state.requestId };
  }
  if (parsed.requestId !== state.requestId) return fail('failed');
  cancelled = true;
  return { version: 1, ok: true };
}
