import { describe, expect, it } from 'vitest';
import {
  maxPartRows,
  nextTile,
  planParts,
  splitTile,
  tileCount,
} from '../src/shared/geometry/stitch';
import {
  parseFullPageCommand,
  parseFullPageMessage,
  parseRequest,
} from '../src/shared/messaging';

const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

/** Simula el bucle del worker sobre una página virtual y comprueba cada fila de la imagen final. */
function simulate(
  pageHeight: number,
  tileHeight: number,
  scale: number,
  partRows: number,
) {
  const totalRows = Math.round(pageHeight * scale);
  const parts = planParts(totalRows, partRows);
  const hits = new Uint8Array(totalRows);
  const maxScroll = Math.max(0, pageHeight - tileHeight);
  let covered = 0;
  for (let k = 0; k < tileCount(pageHeight, tileHeight) + 2; k++) {
    const scrollY = Math.min(covered, maxScroll);
    const tile = nextTile(covered, scrollY, tileHeight, scale);
    if (tile) {
      for (const p of splitTile(tile, parts)) {
        const base = parts[p.part]!.start + p.destY;
        for (let r = 0; r < p.rows; r++) {
          hits[base + r]!++;
          // la fila del bitmap que se copia debe corresponder a la fila global
          expect(p.srcY + r).toBe(base + r - Math.round(scrollY * scale));
        }
      }
    }
    covered = scrollY + tileHeight;
    if (covered >= pageHeight - 0.5 || scrollY >= maxScroll - 0.5) break;
  }
  return { hits, parts, totalRows };
}

describe('composición por tramos', () => {
  const cases: [number, number, number, number][] = [
    [3000, 600, 1, 8192],
    [3001, 600, 1, 8192],
    [2999, 577, 1.25, 1000],
    [10_000, 713, 1.5, 2500],
    [20_000, 600, 1, 8192],
    [1234, 600, 2, 700],
    [500, 600, 1, 8192],
  ];
  for (const [page, tile, scale, part] of cases)
    it(`cubre cada fila exactamente una vez (página ${page}, tramo ${tile}, escala ${scale}, parte ${part})`, () => {
      const { hits, parts, totalRows } = simulate(page, tile, scale, part);
      expect(hits.length).toBe(totalRows);
      expect(Array.from(hits).every((h) => h === 1)).toBe(true);
      expect(parts.at(-1)!.end).toBe(totalRows);
      expect(parts.every((p) => p.end - p.start <= part)).toBe(true);
    });

  it('absorbe un aterrizaje unas fracciones más abajo de lo pedido y rechaza un hueco real', () => {
    // Zoom/alta densidad: pedido 600, aterriza en 600.4 con escala 1.25 → srcY = 750 - 751 = -1.
    expect(nextTile(600, 600.4, 600, 1.25)).toEqual({
      srcY: 0,
      dstY: 750,
      rows: Math.round(1200.4 * 1.25) - 750,
    });
    expect(() => nextTile(600, 640, 600, 1)).toThrow('gap');
  });
  it('la página más corta que el viewport es un único tramo', () => {
    expect(tileCount(300, 600)).toBe(1);
    expect(tileCount(600, 600)).toBe(1);
    expect(tileCount(601, 600)).toBe(2);
    expect(tileCount(0, 600)).toBe(0);
  });
  it('un tramo a caballo entre dos partes se reparte sin perder filas', () => {
    const parts = planParts(1000, 600);
    const pieces = splitTile({ srcY: 100, dstY: 500, rows: 300 }, parts);
    expect(pieces).toEqual([
      { part: 0, srcY: 100, destY: 500, rows: 100 },
      { part: 1, srcY: 200, destY: 0, rows: 200 },
    ]);
  });
  it('sin avance no hay tramo y un hueco se detecta', () => {
    expect(nextTile(600, 0, 600, 1)).toBeNull();
    expect(() => nextTile(100, 500, 600, 1)).toThrow();
  });
});

describe('presupuesto de partes', () => {
  it('respeta lado y área máximos', () => {
    expect(maxPartRows(1000, 8192, 33_177_600)).toBe(8192);
    expect(maxPartRows(8192, 8192, 33_177_600)).toBe(4050);
    expect(maxPartRows(9000, 8192, 33_177_600)).toBe(0);
    expect(maxPartRows(0, 8192, 33_177_600)).toBe(0);
    expect(planParts(20_000, 8192)).toEqual([
      { start: 0, end: 8192 },
      { start: 8192, end: 16384 },
      { start: 16384, end: 20000 },
    ]);
    expect(planParts(100, 0)).toEqual([]);
  });
});

describe('mensajes de página completa', () => {
  it('capture-fullpage exige claves exactas', () => {
    expect(parseRequest({ version: 1, type: 'capture-fullpage' })).toEqual({
      version: 1,
      type: 'capture-fullpage',
    });
    expect(
      parseRequest({ version: 1, type: 'capture-fullpage', x: 1 }),
    ).toBeNull();
  });
  it('mensajes del agente', () => {
    expect(
      parseFullPageMessage({ version: 1, type: 'fullpage-ready' }),
    ).not.toBeNull();
    expect(
      parseFullPageMessage({ version: 1, type: 'fullpage-ready', tabId: 1 }),
    ).toBeNull();
    expect(
      parseFullPageMessage({
        version: 1,
        type: 'fullpage-cancel',
        requestId: id,
      }),
    ).not.toBeNull();
    expect(
      parseFullPageMessage({
        version: 1,
        type: 'fullpage-cancel',
        requestId: 'x',
      }),
    ).toBeNull();
  });
  it('órdenes al agente', () => {
    expect(
      parseFullPageCommand({ version: 1, type: 'fp-measure', requestId: id }),
    ).not.toBeNull();
    expect(
      parseFullPageCommand({
        version: 1,
        type: 'fp-scroll',
        requestId: id,
        y: 600,
        hideFloating: true,
      }),
    ).not.toBeNull();
    expect(
      parseFullPageCommand({
        version: 1,
        type: 'fp-scroll',
        requestId: id,
        y: -1,
        hideFloating: true,
      }),
    ).toBeNull();
    expect(
      parseFullPageCommand({
        version: 1,
        type: 'fp-scroll',
        requestId: id,
        y: NaN,
        hideFloating: false,
      }),
    ).toBeNull();
    expect(
      parseFullPageCommand({
        version: 1,
        type: 'fp-scroll',
        requestId: id,
        y: 1,
        hideFloating: 'si',
      }),
    ).toBeNull();
    expect(
      parseFullPageCommand({ version: 1, type: 'fp-finish', requestId: 'zz' }),
    ).toBeNull();
    expect(
      parseFullPageCommand({ version: 1, type: 'fp-evil', requestId: id }),
    ).toBeNull();
  });
});
