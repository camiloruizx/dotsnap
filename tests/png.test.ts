import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  crc32,
  encodeOptimizedPng,
  filterRows,
} from '../src/shared/export/png';

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset);
  const out: Record<string, Uint8Array> = {};
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    const data = png.subarray(at + 8, at + 8 + length);
    expect(view.getUint32(at + 8 + length)).toBe(
      crc32(png.subarray(at + 4, at + 8 + length)),
    );
    out[type] = data;
    at += 12 + length;
  }
  return out;
}

function unfilter(data: Uint8Array, rowBytes: number, bpp: number) {
  const rows = data.length / (rowBytes + 1);
  const out = new Uint8Array(rows * rowBytes);
  for (let y = 0; y < rows; y++) {
    const f = data[y * (rowBytes + 1)]!;
    for (let i = 0; i < rowBytes; i++) {
      const x = data[y * (rowBytes + 1) + 1 + i]!;
      const a = i >= bpp ? out[y * rowBytes + i - bpp]! : 0;
      const b = y > 0 ? out[(y - 1) * rowBytes + i]! : 0;
      const c = i >= bpp && y > 0 ? out[(y - 1) * rowBytes + i - bpp]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const pred =
        f === 0
          ? 0
          : f === 1
            ? a
            : f === 2
              ? b
              : f === 3
                ? (a + b) >> 1
                : pa <= pb && pa <= pc
                  ? a
                  : pb <= pc
                    ? b
                    : c;
      out[y * rowBytes + i] = (x + pred) & 255;
    }
  }
  return out;
}

describe('optimizador de PNG', () => {
  it('crc32 conocido', () => {
    expect(crc32(new TextEncoder().encode('IEND'))).toBe(0xae426082);
  });
  it('los filtros se deshacen a los datos originales', () => {
    const w = 7;
    const h = 5;
    const raw = new Uint8Array(w * 3 * h).map(
      (_, i) => (i * 37 + (i >> 3)) & 255,
    );
    const filtered = filterRows(raw, w * 3, h, 3, true);
    expect(unfilter(filtered, w * 3, 3)).toEqual(raw);
  });
  it('paleta cuando hay pocos colores y RGB cuando hay muchos', async () => {
    const w = 16;
    const h = 16;
    const flat = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      flat.set(i % 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
    }
    const a = chunks(await bytesOf((await encodeOptimizedPng(flat, w, h))!));
    expect(a.IHDR![9]).toBe(3);
    expect(a.PLTE).toHaveLength(6);
    const idx = unfilter(new Uint8Array(inflateSync(a.IDAT!)), w, 1);
    expect([...idx.subarray(0, 4)]).toEqual([0, 1, 0, 1]);

    const nw = 20;
    const noisy = new Uint8ClampedArray(nw * nw * 4);
    for (let i = 0; i < nw * nw; i++)
      noisy.set([i & 255, (i * 7) & 255, i >> 8, 255], i * 4);
    const b = chunks(await bytesOf((await encodeOptimizedPng(noisy, nw, nw))!));
    expect(b.IHDR![9]).toBe(2);
    expect(b.PLTE).toBeUndefined();
    const rgb = unfilter(new Uint8Array(inflateSync(b.IDAT!)), nw * 3, 3);
    expect([...rgb.subarray(0, 6)]).toEqual([0, 0, 0, 1, 7, 0]);
  });
  it('no toca imágenes con transparencia', async () => {
    const px = new Uint8ClampedArray([1, 2, 3, 128]);
    expect(await encodeOptimizedPng(px, 1, 1)).toBeNull();
  });
});
