/**
 * PDF mínimo sin dependencias: una imagen RGB sin pérdida (FlateDecode) por página. Las
 * imágenes largas se parten en varias páginas por filas exactas, sin solapes ni huecos.
 */
import type { PdfPreset } from './formats';

const PT_PER_PX = 0.75; // 96 ppp
const PT_PER_MM = 72 / 25.4;
const MAX_PAGE_PT = 14400; // límite práctico de los lectores
const MAX_SLICE_ROWS = 8192;
const SHEETS = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;

export interface PdfPagePlan {
  pageWidth: number;
  pageHeight: number;
  srcY: number;
  rows: number;
  /** Posición y tamaño de la imagen en la página (pt; origen arriba a la izquierda). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export function planPdf(
  imageWidth: number,
  imageHeight: number,
  preset: PdfPreset,
  marginMm: number,
): PdfPagePlan[] {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return [];
  const m = Math.max(0, Math.min(40, marginMm)) * PT_PER_MM;
  let scale = PT_PER_PX;
  let pageWidth: number;
  let pageHeightMax: number;
  if (preset === 'original') {
    pageWidth = imageWidth * PT_PER_PX + 2 * m;
    pageHeightMax = MAX_PAGE_PT;
  } else {
    pageWidth = SHEETS[preset].width;
    pageHeightMax = SHEETS[preset].height;
    scale = Math.min(PT_PER_PX, (pageWidth - 2 * m) / imageWidth);
  }
  const rowsPerPage = Math.max(
    1,
    Math.min(MAX_SLICE_ROWS, Math.floor((pageHeightMax - 2 * m) / scale)),
  );
  const drawWidth = imageWidth * scale;
  const plans: PdfPagePlan[] = [];
  for (let srcY = 0; srcY < imageHeight; srcY += rowsPerPage) {
    const rows = Math.min(rowsPerPage, imageHeight - srcY);
    const height = rows * scale;
    plans.push({
      pageWidth,
      pageHeight: preset === 'original' ? height + 2 * m : pageHeightMax,
      srcY,
      rows,
      x: (pageWidth - drawWidth) / 2,
      y: m,
      width: drawWidth,
      height,
    });
  }
  return plans;
}

export interface PdfPage {
  plan: PdfPagePlan;
  /** Píxeles RGB (3 bytes por píxel) de la franja, ya sobre fondo opaco. */
  rgb: Uint8Array;
  pixelWidth: number;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const enc = new TextEncoder();
const num = (n: number) => String(Math.round(n * 100) / 100);

export async function buildPdf(pages: PdfPage[]): Promise<Blob> {
  if (pages.length === 0) throw new RangeError('empty');
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    size += bytes.length;
  };
  const object = (id: number, body: (Uint8Array | string)[]) => {
    offsets[id] = size;
    push(`${id} 0 obj\n`);
    for (const part of body) push(part);
    push('\nendobj\n');
  };
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  // Ids: 1 catálogo, 2 páginas; por página n: 3+3n página, 4+3n contenido, 5+3n imagen.
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, [
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages
      .map((_, n) => `${3 + 3 * n} 0 R`)
      .join(' ')}] >>`,
  ]);
  for (const [n, page] of pages.entries()) {
    const { plan } = page;
    const content = `q ${num(plan.width)} 0 0 ${num(plan.height)} ${num(plan.x)} ${num(
      plan.pageHeight - plan.y - plan.height,
    )} cm /Im0 Do Q`;
    object(3 + 3 * n, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(plan.pageWidth)} ${num(
        plan.pageHeight,
      )}] /Resources << /XObject << /Im0 ${5 + 3 * n} 0 R >> >> /Contents ${4 + 3 * n} 0 R >>`,
    ]);
    object(4 + 3 * n, [
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ]);
    const data = await deflate(page.rgb);
    object(5 + 3 * n, [
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${plan.rows} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>\nstream\n`,
      data,
      '\nendstream',
    ]);
  }
  const total = 3 + 3 * pages.length;
  const xref = size;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let id = 1; id < total; id++)
    push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(
    `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}
