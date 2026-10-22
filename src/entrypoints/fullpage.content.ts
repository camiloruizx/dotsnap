import { defineContentScript } from 'wxt/utils/define-content-script';
import { parseFullPageCommand } from '../shared/messaging';

/**
 * Agente de la captura de página completa. Solo ejecuta órdenes del worker de esta extensión
 * (mismo id, sin pestaña de origen y con el requestId de la operación) y lo deja todo como estaba
 * al terminar, cancelar, fallar o si el worker deja de dar señales.
 */
const cleanupKey = '__dotsnapFullPageCleanup';
const WATCHDOG_MS = 20_000;
const MAX_SCAN = 30_000;
const IMAGE_WAIT_MS = 1500;
const SETTLE_MS = 150;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

interface Hidden {
  el: HTMLElement;
  /** Atributo `style` original tal cual (null si no tenía): se restaura exacto, sin re-serializar. */
  style: string | null;
}

function install(requestId: string): void {
  const g = globalThis as unknown as Record<string, (() => void) | undefined>;
  const doc = document.documentElement;
  const original = { x: window.scrollX, y: window.scrollY };
  const hidden: Hidden[] = [];
  let finished = false;
  let watchdog = 0;

  const scroller = () => document.scrollingElement ?? doc;
  const maxScroll = () =>
    Math.max(0, scroller().scrollHeight - doc.clientHeight);

  /** Oculta (visibility, sin tocar el layout) los elementos fixed y sticky; se restaura al final. */
  const hideFloating = () => {
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
    let scanned = 0;
    for (
      let node = walker.currentNode as Element | null;
      node && scanned < MAX_SCAN;
      node = walker.nextNode() as Element | null, scanned++
    ) {
      if (!(node instanceof HTMLElement) || hidden.some((h) => h.el === node))
        continue;
      const position = getComputedStyle(node).position;
      if (position !== 'fixed' && position !== 'sticky') continue;
      hidden.push({ el: node, style: node.getAttribute('style') });
      node.style.setProperty('visibility', 'hidden', 'important');
    }
  };

  const restore = () => {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    for (const { el, style } of hidden.splice(0))
      if (style === null) el.removeAttribute('style');
      else el.setAttribute('style', style);
    window.scrollTo({
      left: original.x,
      top: original.y,
      behavior: 'instant' as ScrollBehavior,
    });
    chrome.runtime.onMessage.removeListener(onCommand);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pagehide', restore, true);
    delete g[cleanupKey];
  };
  const arm = () => {
    clearTimeout(watchdog);
    watchdog = window.setTimeout(restore, WATCHDOG_MS);
  };

  /** Deja pintar y cargar el contenido perezoso visible antes de capturar. */
  const settle = async () => {
    await frames();
    const pending = Array.from(document.images).filter((img) => {
      if (img.complete) return false;
      const r = img.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    });
    if (pending.length)
      await Promise.race([
        Promise.all(pending.map((img) => img.decode().catch(() => {}))),
        wait(IMAGE_WAIT_MS),
      ]);
    await wait(SETTLE_MS);
    await frames();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    try {
      void chrome.runtime
        .sendMessage({ version: 1, type: 'fullpage-cancel', requestId })
        .catch(() => {});
    } catch {
      /* contexto invalidado */
    }
  };

  const onCommand = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    respond: (response: unknown) => void,
  ): boolean | undefined => {
    // Solo el worker de esta extensión (sin pestaña de origen) y la operación en curso.
    if (sender.id !== chrome.runtime.id || sender.tab) return;
    const command = parseFullPageCommand(message);
    if (!command || command.requestId !== requestId || finished) return;
    arm();
    if (command.type === 'fp-measure') {
      respond({
        ok: true,
        scrollHeight: Math.ceil(scroller().scrollHeight),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        clientWidth: doc.clientWidth,
        clientHeight: doc.clientHeight,
        scrollY: window.scrollY,
      });
      return;
    }
    if (command.type === 'fp-finish') {
      restore();
      respond({ ok: true });
      return;
    }
    void (async () => {
      if (command.hideFloating) hideFloating();
      window.scrollTo({
        left: original.x,
        top: command.y,
        behavior: 'instant' as ScrollBehavior,
      });
      await settle();
      respond({ ok: true, scrollY: window.scrollY, maxScroll: maxScroll() });
    })();
    return true;
  };

  g[cleanupKey] = restore;
  chrome.runtime.onMessage.addListener(onCommand);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pagehide', restore, true);
  arm();
}

export default defineContentScript({
  registration: 'runtime',
  async main() {
    const g = globalThis as unknown as Record<string, (() => void) | undefined>;
    g[cleanupKey]?.();
    try {
      const response = (await chrome.runtime.sendMessage({
        version: 1,
        type: 'fullpage-ready',
      })) as { ok?: unknown; requestId?: unknown } | undefined;
      if (response?.ok === true && typeof response.requestId === 'string')
        install(response.requestId);
    } catch {
      /* sin respuesta del worker: no se instala nada */
    }
  },
});
