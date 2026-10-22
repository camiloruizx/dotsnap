import {
  EXTENSION,
  MIME,
  fitToTarget,
  scaledSize,
  sniffFormat,
  type ExportFormat,
  type ExportOptions,
} from './formats';
import { buildPdf, planPdf, type PdfPage } from './pdf';

export interface ExportResult {
  blob: Blob;
  format: ExportFormat;
  extension: string;
  width: number;
  height: number;
  pages: number;
  quality: number | null;
  /** null si no se pidió objetivo; false si no se pudo alcanzar. */
  reachedTarget: boolean | null;
}

export class ExportError extends Error {
  constructor(readonly code: 'unsupported' | 'failed') {
    super(code);
  }
}

function surface(width: number, height: number, background: string | null) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError('failed');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ExportError('failed'))),
      type,
      quality,
    ),
  );
}

async function verified(blob: Blob, format: ExportFormat): Promise<Blob> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (sniffFormat(head) !== format) throw new ExportError('unsupported');
  return blob;
}

/** Exporta el lienzo aplanado en el formato pedido; el tamaño y el peso informados son reales. */
export async function exportFlat(
  flat: HTMLCanvasElement,
  options: ExportOptions,
): Promise<ExportResult> {
  const { width, height } = scaledSize(
    flat.width,
    flat.height,
    options.scalePercent,
  );
  const opaque = options.format === 'jpeg' || options.format === 'pdf';
  const { canvas } = (() => {
    if (width === flat.width && height === flat.height && !opaque)
      return { canvas: flat };
    const s = surface(width, height, opaque ? options.background : null);
    s.ctx.drawImage(flat, 0, 0, width, height);
    return s;
  })();
  const base = { width, height, extension: EXTENSION[options.format] };
  if (options.format === 'pdf') {
    const plans = planPdf(
      width,
      height,
      options.pdfPreset,
      options.pdfMarginMm,
    );
    const pages: PdfPage[] = [];
    for (const plan of plans) {
      const slice = surface(width, plan.rows, options.background);
      slice.ctx.drawImage(
        canvas,
        0,
        plan.srcY,
        width,
        plan.rows,
        0,
        0,
        width,
        plan.rows,
      );
      const rgba = slice.ctx.getImageData(0, 0, width, plan.rows).data;
      const rgb = new Uint8Array(width * plan.rows * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        rgb[j] = rgba[i]!;
        rgb[j + 1] = rgba[i + 1]!;
        rgb[j + 2] = rgba[i + 2]!;
      }
      pages.push({ plan, rgb, pixelWidth: width });
    }
    const blob = await verified(await buildPdf(pages), 'pdf');
    return {
      ...base,
      blob,
      format: 'pdf',
      pages: pages.length,
      quality: null,
      reachedTarget: null,
    };
  }
  if (options.format === 'png') {
    const blob = await verified(await toBlob(canvas, MIME.png), 'png');
    return {
      ...base,
      blob,
      format: 'png',
      pages: 1,
      quality: null,
      reachedTarget: null,
    };
  }
  const mime = MIME[options.format];
  const encode = async (q: number) =>
    verified(await toBlob(canvas, mime, q), options.format);
  if (options.targetBytes !== null) {
    const fit = await fitToTarget(encode, options.targetBytes);
    return {
      ...base,
      blob: fit.blob,
      format: options.format,
      pages: 1,
      quality: fit.quality,
      reachedTarget: fit.reached,
    };
  }
  return {
    ...base,
    blob: await encode(options.quality),
    format: options.format,
    pages: 1,
    quality: options.quality,
    reachedTarget: null,
  };
}
