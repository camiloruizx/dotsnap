/**
 * Optimizador de PNG sin pérdida y sin dependencias: elige el filtro de cada fila,
 * usa paleta cuando hay ≤256 colores y comprime con el deflate del navegador.
 * Solo se usa si el resultado es menor y descodifica a las mismas dimensiones.
 */
const MAX_PIXELS = 16_000_000;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    c = crcTable[(c ^ data[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Filtra cada fila con el método de menor suma de valores absolutos (heurística de libpng). */
export function filterRows(
  raw: Uint8Array,
  rowBytes: number,
  height: number,
  bpp: number,
  adaptive: boolean,
): Uint8Array {
  const out = new Uint8Array((rowBytes + 1) * height);
  const candidates = [0, 1, 2, 3, 4].map(() => new Uint8Array(rowBytes));
  const zero = new Uint8Array(rowBytes);
  for (let y = 0; y < height; y++) {
    const row = raw.subarray(y * rowBytes, (y + 1) * rowBytes);
    const prev = y > 0 ? raw.subarray((y - 1) * rowBytes, y * rowBytes) : zero;
    let best = 0;
    if (!adaptive) candidates[0]!.set(row);
    else {
      let bestScore = Infinity;
      for (let f = 0; f < 5; f++) {
        const target = candidates[f]!;
        let score = 0;
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? row[i - bpp]! : 0;
          const b = prev[i]!;
          const c = i >= bpp ? prev[i - bpp]! : 0;
          const predicted =
            f === 0
              ? 0
              : f === 1
                ? a
                : f === 2
                  ? b
                  : f === 3
                    ? (a + b) >> 1
                    : paeth(a, b, c);
          const v = (row[i]! - predicted) & 255;
          target[i] = v;
          score += v < 128 ? v : 256 - v;
        }
        if (score < bestScore) {
          bestScore = score;
          best = f;
        }
      }
    }
    out[y * (rowBytes + 1)] = best;
    out.set(candidates[best]!, y * (rowBytes + 1) + 1);
  }
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Codifica RGBA opaco como PNG (RGB o paleta). Devuelve null si hay transparencia. */
export async function encodeOptimizedPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob | null> {
  const count = width * height;
  if (rgba.length !== count * 4 || count === 0) return null;
  const palette = new Map<number, number>();
  let paletted = true;
  const indices = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (rgba[i * 4 + 3] !== 255) return null;
    if (!paletted) continue;
    const key =
      (rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!;
    let index = palette.get(key);
    if (index === undefined) {
      if (palette.size === 256) {
        paletted = false;
        continue;
      }
      index = palette.size;
      palette.set(key, index);
    }
    indices[i] = index;
  }
  let raw: Uint8Array;
  let colorType: number;
  let bpp: number;
  if (paletted) {
    raw = indices;
    colorType = 3;
    bpp = 1;
  } else {
    raw = new Uint8Array(count * 3);
    for (let i = 0, j = 0; i < count; i++, j += 3) {
      raw[j] = rgba[i * 4]!;
      raw[j + 1] = rgba[i * 4 + 1]!;
      raw[j + 2] = rgba[i * 4 + 2]!;
    }
    colorType = 2;
    bpp = 3;
  }
  const filtered = filterRows(raw, width * bpp, height, bpp, !paletted);
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  header[8] = 8;
  header[9] = colorType;
  const parts: Uint8Array[] = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
  ];
  if (paletted) {
    const plte = new Uint8Array(palette.size * 3);
    for (const [key, index] of palette) {
      plte[index * 3] = (key >> 16) & 255;
      plte[index * 3 + 1] = (key >> 8) & 255;
      plte[index * 3 + 2] = key & 255;
    }
    parts.push(chunk('PLTE', plte));
  }
  parts.push(
    chunk('IDAT', await deflate(filtered)),
    chunk('IEND', new Uint8Array()),
  );
  return new Blob(parts as BlobPart[], { type: 'image/png' });
}

/** Devuelve el PNG más pequeño entre el del navegador y el optimizado (verificado al descodificar). */
export async function optimizePng(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  baseline: Blob,
): Promise<Blob> {
  const { width, height } = canvas;
  if (width * height > MAX_PIXELS) return baseline;
  try {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return baseline;
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const optimized = await encodeOptimizedPng(rgba, width, height);
    if (!optimized || optimized.size >= baseline.size) return baseline;
    const check = await createImageBitmap(optimized);
    const same = check.width === width && check.height === height;
    check.close();
    return same ? optimized : baseline;
  } catch {
    return baseline;
  }
}
