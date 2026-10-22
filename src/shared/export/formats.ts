/** Opciones y utilidades puras de exportación (M4): tamaños, firmas reales y ajuste de peso. */
export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'pdf';
export type PdfPreset = 'original' | 'a4' | 'letter';

export interface ExportOptions {
  format: ExportFormat;
  /** 0,05–1; solo JPEG y WebP. */
  quality: number;
  /** Porcentaje del tamaño original, solo reducción (10–100). */
  scalePercent: number;
  /** Fondo con el que se aplana la transparencia (JPEG y PDF). */
  background: string;
  pdfPreset: PdfPreset;
  pdfMarginMm: number;
  /** Peso objetivo en bytes (JPEG/WebP); null = sin objetivo. */
  targetBytes: number | null;
}

export const DEFAULT_OPTIONS: ExportOptions = {
  format: 'png',
  quality: 0.92,
  scalePercent: 100,
  background: '#ffffff',
  pdfPreset: 'a4',
  pdfMarginMm: 10,
  targetBytes: null,
};

export const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};
export const EXTENSION: Record<ExportFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  pdf: 'pdf',
};
export const MIN_QUALITY = 0.05;

export function scaledSize(
  width: number,
  height: number,
  percent: number,
): { width: number; height: number } {
  const p = Math.min(100, Math.max(10, percent)) / 100;
  return {
    width: Math.max(1, Math.round(width * p)),
    height: Math.max(1, Math.round(height * p)),
  };
}

/** Formato real según los primeros bytes: no se fía del tipo MIME que declare el navegador. */
export function sniffFormat(bytes: Uint8Array): ExportFormat | null {
  const at = (i: number, text: string) =>
    [...text].every((c, k) => bytes[i + k] === c.charCodeAt(0));
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    at(1, 'PNG') &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a
  )
    return 'png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes.length > 12 && at(0, 'RIFF') && at(8, 'WEBP')) return 'webp';
  if (bytes.length > 4 && at(0, '%PDF-')) return 'pdf';
  return null;
}

export interface FitResult {
  blob: Blob;
  quality: number;
  /** true si el resultado cabe en el objetivo. */
  reached: boolean;
}

/**
 * Busca la mayor calidad cuyo archivo real cabe en `targetBytes`. Si ni siquiera la calidad
 * mínima lo logra, devuelve esa y `reached: false`: nunca finge haber llegado al objetivo.
 */
export async function fitToTarget(
  encode: (quality: number) => Promise<Blob>,
  targetBytes: number,
  high = 0.95,
  steps = 7,
): Promise<FitResult> {
  const top = await encode(high);
  if (top.size <= targetBytes)
    return { blob: top, quality: high, reached: true };
  const bottom = await encode(MIN_QUALITY);
  if (bottom.size > targetBytes)
    return { blob: bottom, quality: MIN_QUALITY, reached: false };
  let lo = MIN_QUALITY;
  let hi = high;
  let best: FitResult = { blob: bottom, quality: MIN_QUALITY, reached: true };
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const blob = await encode(mid);
    if (blob.size <= targetBytes) {
      best = { blob, quality: mid, reached: true };
      lo = mid;
    } else hi = mid;
  }
  return best;
}
