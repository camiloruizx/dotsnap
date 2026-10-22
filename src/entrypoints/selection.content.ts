import { defineContentScript } from 'wxt/utils/define-content-script';
import type { Rectangle } from '../shared/geometry/crop';
import {
  MIN_REGION,
  hitTest,
  moveRect,
  nudgeRect,
  rectFromPoints,
  resizeRect,
  visibleRect,
  type Handle,
  type Pt,
} from '../shared/geometry/region';

/** true solo en la variante de pruebas: permite a Playwright leer el overlay (shadow DOM abierto). */
declare const __DOTSNAP_TEST__: boolean;

interface Labels {
  selectHintRegion: string;
  selectHintElement: string;
  selectConfirm: string;
  selectCancel: string;
  selectIframe: string;
}
interface Config {
  requestId: string;
  mode: 'region' | 'element';
  labels: Labels;
}
const cleanupKey = '__dotsnapSelectionCleanup';
const ACCENT = '#3794ff';
const TOLERANCE = 8;
const labelKeys: (keyof Labels)[] = [
  'selectHintRegion',
  'selectHintElement',
  'selectConfirm',
  'selectCancel',
  'selectIframe',
];

function parseConfig(value: unknown): Config | null {
  const d = value as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || d.ok !== true) return null;
  if (typeof d.requestId !== 'string') return null;
  if (d.mode !== 'region' && d.mode !== 'element') return null;
  const raw = d.labels as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return null;
  const labels = {} as Labels;
  for (const key of labelKeys) {
    const text = raw[key];
    if (typeof text !== 'string' || text.length > 300) return null;
    labels[key] = text;
  }
  return { requestId: d.requestId, mode: d.mode, labels };
}

/** Estilos por CSSOM (no <style>): una CSP estricta de la página no los bloquea. */
function style<T extends HTMLElement>(
  el: T,
  props: Partial<CSSStyleDeclaration>,
): T {
  Object.assign(el.style, props);
  return el;
}
const make = (tag: string, props: Partial<CSSStyleDeclaration> = {}) =>
  style(document.createElement(tag), props);

const viewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});
const pluralPx = (r: Rectangle) =>
  `${Math.round(r.width)} × ${Math.round(r.height)} px`;

const cursors: Record<Handle | 'inside', string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  inside: 'move',
};

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls =
    typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/)[0]}`
      : '';
  return `${tag}${id}${cls}`.slice(0, 60);
}

function run(config: Config): void {
  const g = globalThis as unknown as Record<string, (() => void) | undefined>;
  const region = config.mode === 'region';

  const host = make('dotsnap-selection', {
    all: 'initial',
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    overflow: 'hidden',
    // También en modo elemento: sobre un iframe el navegador no entrega eventos a la ventana padre.
    pointerEvents: 'auto',
    cursor: region ? 'crosshair' : 'default',
  });
  const shadow = host.attachShadow({
    mode: __DOTSNAP_TEST__ ? 'open' : 'closed',
  });
  const font = '12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif';
  const chip = {
    position: 'absolute',
    background: '#181b20',
    color: '#ffffff',
    font,
    padding: '4px 8px',
    borderRadius: '4px',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    boxShadow: '0 1px 6px rgba(0,0,0,.4)',
  } satisfies Partial<CSSStyleDeclaration>;

  const box = make('div', {
    position: 'absolute',
    boxSizing: 'border-box',
    border: `2px solid ${ACCENT}`,
    pointerEvents: 'none',
    display: 'none',
    ...(region
      ? { boxShadow: '0 0 0 100vmax rgba(0,0,0,.45)' }
      : { background: 'rgba(55,148,255,.18)' }),
  });
  box.dataset.role = 'box';
  const label = make('div', { ...chip, display: 'none' });
  label.dataset.role = 'label';
  const hint = make('div', {
    ...chip,
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: 'calc(100vw - 24px)',
    whiteSpace: 'normal',
    textAlign: 'center',
  });
  hint.dataset.role = 'hint';
  hint.textContent = region
    ? config.labels.selectHintRegion
    : config.labels.selectHintElement;
  const handles = (
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as Handle[]
  ).map((name) => {
    const h = make('div', {
      position: 'absolute',
      width: '10px',
      height: '10px',
      boxSizing: 'border-box',
      background: '#ffffff',
      border: `2px solid ${ACCENT}`,
      borderRadius: '2px',
      pointerEvents: 'none',
      display: 'none',
    });
    h.dataset.handle = name;
    return [name, h] as const;
  });
  const actions = make('div', {
    position: 'absolute',
    display: 'none',
    gap: '6px',
    pointerEvents: 'auto',
    transform: 'translateX(-100%)',
  });
  actions.dataset.role = 'actions';
  const button = (text: string, primary: boolean, onClick: () => void) => {
    const b = make('button', {
      all: 'initial',
      font,
      cursor: 'pointer',
      padding: '5px 12px',
      borderRadius: '4px',
      color: '#ffffff',
      background: primary ? '#0078d4' : '#2a2f36',
      border: `1px solid ${primary ? '#0078d4' : '#555c66'}`,
    });
    (b as HTMLButtonElement).type = 'button';
    b.textContent = text;
    b.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    return b;
  };
  if (region)
    actions.append(
      button(config.labels.selectConfirm, true, () => void confirm()),
      button(config.labels.selectCancel, false, () => void cancel()),
    );
  shadow.append(box, ...handles.map(([, h]) => h), label, hint, actions);
  document.documentElement.append(host);

  let rect: Rectangle | null = null;
  let drag: {
    kind: 'new' | 'move' | Handle;
    start: Pt;
    origin: Rectangle | null;
  } | null = null;
  let current: Element | null = null;
  let stack: Element[] = [];
  let last: Pt | null = null;
  let done = false;

  const render = () => {
    if (!rect) {
      box.style.display = 'none';
      label.style.display = 'none';
      actions.style.display = 'none';
      for (const [, h] of handles) h.style.display = 'none';
      return;
    }
    const vp = viewport();
    Object.assign(box.style, {
      display: 'block',
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const iframe =
      !region && current !== null && /^i?frame$/i.test(current.tagName);
    label.textContent = region
      ? pluralPx(rect)
      : `${current ? describe(current) : ''} · ${pluralPx(rect)}${iframe ? `\n${config.labels.selectIframe}` : ''}`;
    label.style.display = 'block';
    // Se mide el ancho real para que la etiqueta no se salga del viewport.
    label.style.maxWidth = `${Math.max(120, vp.width - 8)}px`;
    const labelWidth = label.offsetWidth;
    Object.assign(label.style, {
      left: `${Math.max(4, Math.min(rect.x, vp.width - labelWidth - 4))}px`,
      top: `${rect.y >= 34 ? rect.y - (iframe ? 46 : 30) : rect.y + 6}px`,
    });
    if (region) {
      const cx = (n: Handle) => {
        const mid = (a: number, b: number) => a + b / 2;
        const l = rect!.x;
        const t = rect!.y;
        const r = rect!.x + rect!.width;
        const b = rect!.y + rect!.height;
        const x = n.includes('w')
          ? l
          : n.includes('e')
            ? r
            : mid(l, rect!.width);
        const y = n.includes('n')
          ? t
          : n.includes('s')
            ? b
            : mid(t, rect!.height);
        return [x, y] as const;
      };
      for (const [name, h] of handles) {
        const [x, y] = cx(name);
        Object.assign(h.style, {
          display: drag ? 'none' : 'block',
          left: `${x - 5}px`,
          top: `${y - 5}px`,
        });
      }
      const below = rect.y + rect.height + 8;
      Object.assign(actions.style, {
        display: drag ? 'none' : 'flex',
        left: `${Math.max(190, Math.min(rect.x + rect.width, vp.width - 4))}px`,
        top: `${below + 34 <= vp.height ? below : Math.max(4, rect.y - 40)}px`,
      });
    }
  };

  const teardown = () => {
    done = true;
    for (const [type, fn, opts] of listeners)
      window.removeEventListener(type, fn, opts);
    host.remove();
    delete g[cleanupKey];
  };
  const send = (message: object) => {
    try {
      void chrome.runtime.sendMessage(message).catch(() => {});
    } catch {
      /* contexto invalidado: nada que hacer */
    }
  };
  async function cancel() {
    if (done) return;
    teardown();
    send({ version: 1, type: 'selection-cancel', requestId: config.requestId });
  }
  async function confirm() {
    if (done || !rect) return;
    if (region && (rect.width < MIN_REGION || rect.height < MIN_REGION)) return;
    const chosen = { ...rect };
    const vp = viewport();
    teardown();
    // El overlay debe haberse pintado como ausente antes de que el worker capture.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 150);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          clearTimeout(timer);
          resolve();
        }),
      );
    });
    send({
      version: 1,
      type: 'selection-done',
      requestId: config.requestId,
      rect: chosen,
      viewport: vp,
    });
  }
  g[cleanupKey] = () => {
    if (!done) teardown();
  };

  const point = (e: MouseEvent): Pt => ({ x: e.clientX, y: e.clientY });
  const overActions = (e: MouseEvent) => {
    if (actions.style.display === 'none') return false;
    const r = actions.getBoundingClientRect();
    return (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    );
  };
  // En pointer events no se cancela: preventDefault suprimiría los mouse events posteriores.
  const stopPointer = (e: PointerEvent) => {
    if (!overActions(e)) e.stopImmediatePropagation();
  };
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  // --- región ---------------------------------------------------------
  const onDown = (e: MouseEvent) => {
    if (region && overActions(e)) return;
    swallow(e);
    if (e.button !== 0 || !region) return;
    const p = point(e);
    const hit = rect ? hitTest(rect, p, TOLERANCE) : 'outside';
    if (rect && hit !== 'outside')
      drag = {
        kind: hit === 'inside' ? 'move' : hit,
        start: p,
        origin: { ...rect },
      };
    else {
      drag = { kind: 'new', start: p, origin: null };
      rect = null;
    }
    render();
  };
  const onMove = (e: MouseEvent) => {
    if (region && overActions(e)) return;
    const p = point(e);
    last = p;
    if (region) {
      const vp = viewport();
      if (drag) {
        swallow(e);
        const { kind, start, origin } = drag;
        if (kind === 'new') rect = rectFromPoints(start, p, vp);
        else if (origin && kind === 'move')
          rect = moveRect(origin, p.x - start.x, p.y - start.y, vp);
        else if (origin && kind !== 'move')
          rect = resizeRect(origin, kind, p, vp);
        render();
      } else {
        const hit = rect ? hitTest(rect, p, TOLERANCE) : 'outside';
        host.style.cursor = hit === 'outside' ? 'crosshair' : cursors[hit];
      }
      return;
    }
    pick(p);
  };
  const onUp = (e: MouseEvent) => {
    if (region && overActions(e)) return;
    swallow(e);
    if (region && drag) {
      drag = null;
      if (rect && (rect.width < MIN_REGION || rect.height < MIN_REGION))
        rect = null;
      render();
    }
  };
  const onClick = (e: MouseEvent) => {
    if (region && overActions(e)) return;
    swallow(e);
    if (!region && e.button === 0) void confirm();
  };

  // --- elemento -------------------------------------------------------
  function pick(p: Pt) {
    const el =
      document.elementsFromPoint(p.x, p.y).find((item) => item !== host) ??
      null;
    if (el === current) return;
    current = el;
    stack = [];
    showElement();
  }
  function showElement() {
    rect = current
      ? visibleRect(
          (({ x, y, width, height }) => ({ x, y, width, height }))(
            current.getBoundingClientRect(),
          ),
          viewport(),
        )
      : null;
    render();
  }

  // --- teclado, scroll y ciclo de vida ----------------------------------
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      swallow(e);
      void cancel();
    } else if (e.key === 'Enter') {
      swallow(e);
      void confirm();
    } else if (region && rect && e.key.startsWith('Arrow')) {
      swallow(e);
      rect = nudgeRect(
        rect,
        e.key,
        e.shiftKey ? 10 : 1,
        e.ctrlKey || e.metaKey,
        viewport(),
      );
      render();
    } else if (!region && e.key === 'ArrowUp' && current) {
      swallow(e);
      // Sube hasta un ancestro con área visible (un contenedor sin alto no sirve de selección).
      let parent = current.parentElement;
      const empty = (el: Element) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return !visibleRect({ x, y, width, height }, viewport());
      };
      while (parent && parent !== document.documentElement && empty(parent))
        parent = parent.parentElement;
      if (parent && parent !== document.documentElement) {
        stack.push(current);
        current = parent;
        showElement();
      }
    } else if (!region && e.key === 'ArrowDown' && stack.length) {
      swallow(e);
      current = stack.pop() ?? current;
      showElement();
    }
  };
  const onScrollOrResize = () => {
    if (region) void cancel();
    else if (last) {
      current = null;
      pick(last);
    }
  };
  const onWheel = () => {
    if (region) void cancel();
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') void cancel();
  };

  const capture = { capture: true } as const;
  const passive = { capture: true, passive: true } as const;
  const listeners: [string, EventListener, AddEventListenerOptions][] = [
    ['mousedown', onDown as EventListener, capture],
    ['mousemove', onMove as EventListener, capture],
    ['mouseup', onUp as EventListener, capture],
    ['click', onClick as EventListener, capture],
    ['dblclick', swallow, capture],
    ['auxclick', swallow, capture],
    ['contextmenu', swallow, capture],
    ['pointerdown', stopPointer as EventListener, capture],
    ['pointerup', stopPointer as EventListener, capture],
    ['keydown', onKey as EventListener, capture],
    ['scroll', onScrollOrResize, passive],
    ['resize', onScrollOrResize, passive],
    ['wheel', onWheel, passive],
    ['visibilitychange', onHide, passive],
    ['pagehide', (() => void cancel()) as EventListener, passive],
  ];
  for (const [type, fn, opts] of listeners)
    window.addEventListener(type, fn, opts);
}

export default defineContentScript({
  registration: 'runtime',
  async main() {
    const g = globalThis as unknown as Record<string, (() => void) | undefined>;
    g[cleanupKey]?.();
    try {
      const config = parseConfig(
        await chrome.runtime.sendMessage({
          version: 1,
          type: 'selection-ready',
        }),
      );
      if (config) run(config);
    } catch {
      /* sin respuesta del worker: no se muestra overlay */
    }
  },
});
