import type { RedactMode } from './model';

export interface RedactRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tamaño de bloque del pixelado: proporcional a la zona, con un mínimo que impide leer texto. */
export function pixelBlock(rect: RedactRect): number {
  return Math.min(
    48,
    Math.max(12, Math.round(Math.min(rect.width, rect.height) / 4)),
  );
}
/** Radio del desenfoque: fuerte, proporcional a la zona. */
export function blurRadius(rect: RedactRect): number {
  return Math.min(
    40,
    Math.max(14, Math.round(Math.min(rect.width, rect.height) / 5)),
  );
}

const canvasOf = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};
const context = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  return ctx;
};

/** Color medio de la zona: base opaca para que ningún borde transparente deje ver el original. */
function averageColor(source: ImageBitmap, rect: RedactRect): string {
  const one = canvasOf(1, 1);
  const ctx = context(one);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

/**
 * Dibuja la zona del bitmap ya pixelada o desenfocada. El resultado es siempre opaco y
 * del tamaño de la zona; se coloca encima de los píxeles originales.
 */
export function renderRedaction(
  source: ImageBitmap,
  rect: RedactRect,
  mode: Exclude<RedactMode, 'solid'>,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const out = canvasOf(w, h);
  const ctx = context(out);
  ctx.fillStyle = averageColor(source, rect);
  ctx.fillRect(0, 0, w, h);
  if (mode === 'pixelate') {
    const block = pixelBlock(rect);
    const small = canvasOf(Math.ceil(w / block), Math.ceil(h / block));
    const sctx = context(small);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(
      source,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      small.width,
      small.height,
    );
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      small,
      0,
      0,
      small.width,
      small.height,
      0,
      0,
      small.width * block,
      small.height * block,
    );
    return out;
  }
  // Desenfoque: se mezcla un margen alrededor y se recorta, para que los bordes no se aclaren.
  const radius = blurRadius(rect);
  const pad = radius * 2;
  const work = canvasOf(w + pad * 2, h + pad * 2);
  const wctx = context(work);
  wctx.fillStyle = ctx.fillStyle;
  wctx.fillRect(0, 0, work.width, work.height);
  wctx.filter = `blur(${radius}px)`;
  wctx.drawImage(
    source,
    rect.x - pad,
    rect.y - pad,
    w + pad * 2,
    h + pad * 2,
    0,
    0,
    work.width,
    work.height,
  );
  ctx.drawImage(work, pad, pad, w, h, 0, 0, w, h);
  return out;
}
