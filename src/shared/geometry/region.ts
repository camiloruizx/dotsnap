import type { Rectangle, Size } from './crop';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type Hit = Handle | 'inside' | 'outside';
export interface Pt {
  x: number;
  y: number;
}

/** Tamaño mínimo (px CSS) para que una región cuente como selección. */
export const MIN_REGION = 4;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Rectángulo normalizado entre dos puntos, limitado al viewport. */
export function rectFromPoints(a: Pt, b: Pt, viewport: Size): Rectangle {
  const x1 = clamp(Math.min(a.x, b.x), 0, viewport.width);
  const y1 = clamp(Math.min(a.y, b.y), 0, viewport.height);
  const x2 = clamp(Math.max(a.x, b.x), 0, viewport.width);
  const y2 = clamp(Math.max(a.y, b.y), 0, viewport.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** Limita un rectángulo al viewport sin cambiar su tamaño salvo que no quepa. */
export function clampRect(rect: Rectangle, viewport: Size): Rectangle {
  const width = Math.min(rect.width, viewport.width);
  const height = Math.min(rect.height, viewport.height);
  return {
    x: clamp(rect.x, 0, viewport.width - width),
    y: clamp(rect.y, 0, viewport.height - height),
    width,
    height,
  };
}

export const moveRect = (
  rect: Rectangle,
  dx: number,
  dy: number,
  viewport: Size,
): Rectangle =>
  clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, viewport);

/** Redimensiona arrastrando un tirador; los bordes se cruzan sin voltear mal el rectángulo. */
export function resizeRect(
  rect: Rectangle,
  handle: Handle,
  to: Pt,
  viewport: Size,
): Rectangle {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle.includes('w')) left = to.x;
  if (handle.includes('e')) right = to.x;
  if (handle.includes('n')) top = to.y;
  if (handle.includes('s')) bottom = to.y;
  return rectFromPoints({ x: left, y: top }, { x: right, y: bottom }, viewport);
}

/** Qué hay bajo el puntero: un tirador, el interior o fuera. `tolerance` en px CSS. */
export function hitTest(rect: Rectangle, p: Pt, tolerance: number): Hit {
  const l = rect.x;
  const t = rect.y;
  const r = rect.x + rect.width;
  const b = rect.y + rect.height;
  const cx = l + rect.width / 2;
  const cy = t + rect.height / 2;
  const near = (a: number, c: number) => Math.abs(a - c) <= tolerance;
  const handles: [Handle, number, number][] = [
    ['nw', l, t],
    ['ne', r, t],
    ['se', r, b],
    ['sw', l, b],
    ['n', cx, t],
    ['s', cx, b],
    ['w', l, cy],
    ['e', r, cy],
  ];
  for (const [name, hx, hy] of handles)
    if (near(p.x, hx) && near(p.y, hy)) return name;
  return p.x >= l && p.x <= r && p.y >= t && p.y <= b ? 'inside' : 'outside';
}

/** Teclado: flechas mueven; con `resize` cambian ancho/alto desde la esquina inferior derecha. */
export function nudgeRect(
  rect: Rectangle,
  key: string,
  step: number,
  resize: boolean,
  viewport: Size,
): Rectangle {
  const d = (
    {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    } as Record<string, [number, number]>
  )[key];
  if (!d) return rect;
  if (!resize) return moveRect(rect, d[0] * step, d[1] * step, viewport);
  return clampRect(
    {
      ...rect,
      width: Math.max(MIN_REGION, rect.width + d[0] * step),
      height: Math.max(MIN_REGION, rect.height + d[1] * step),
    },
    viewport,
  );
}

/** Rectángulo de un elemento recortado al viewport; null si queda fuera o vacío. */
export function visibleRect(rect: Rectangle, viewport: Size): Rectangle | null {
  const x1 = clamp(rect.x, 0, viewport.width);
  const y1 = clamp(rect.y, 0, viewport.height);
  const x2 = clamp(rect.x + rect.width, 0, viewport.width);
  const y2 = clamp(rect.y + rect.height, 0, viewport.height);
  return x2 - x1 >= 1 && y2 - y1 >= 1
    ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
    : null;
}
