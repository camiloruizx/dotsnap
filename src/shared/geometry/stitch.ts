/**
 * Geometría pura de la captura de página completa: filas de píxeles de la imagen final,
 * reparto en partes que respetan el presupuesto y trozos de cada tramo. Todo en enteros:
 * los bordes se redondean con la misma función en ambos lados para no dejar huecos ni solapes.
 */
export interface PartRange {
  start: number;
  end: number;
}
export interface Tile {
  /** Fila del bitmap capturado desde la que se copia. */
  srcY: number;
  /** Fila global (imagen completa) donde empieza. */
  dstY: number;
  rows: number;
}
export interface Piece {
  part: number;
  srcY: number;
  /** Fila dentro de la parte. */
  destY: number;
  rows: number;
}

/** Filas máximas por parte: lado máximo y área máxima (ancho × alto) del presupuesto. */
export function maxPartRows(
  widthPx: number,
  maxSide: number,
  maxArea: number,
): number {
  if (!(widthPx > 0) || widthPx > maxSide) return 0;
  return Math.max(0, Math.min(maxSide, Math.floor(maxArea / widthPx)));
}

export function planParts(totalRows: number, partRows: number): PartRange[] {
  if (!(totalRows > 0) || !(partRows > 0)) return [];
  const parts: PartRange[] = [];
  for (let start = 0; start < totalRows; start += partRows)
    parts.push({ start, end: Math.min(totalRows, start + partRows) });
  return parts;
}

/**
 * Parte nueva que aporta un tramo capturado con la ventana en `scrollY` (px CSS) cuando ya se
 * cubrió hasta `covered` (px CSS). Devuelve null si no aporta filas nuevas; lanza si hay hueco.
 */
export function nextTile(
  covered: number,
  scrollY: number,
  tileHeight: number,
  scale: number,
): Tile | null {
  const top = Math.round(covered * scale);
  const bottom = Math.round((scrollY + tileHeight) * scale);
  if (bottom <= top) return null;
  const srcY = top - Math.round(scrollY * scale);
  // El navegador puede aterrizar unas fracciones de píxel CSS más abajo de lo pedido (zoom o
  // pantallas de alta densidad): hasta unas filas de desfase se absorben; más es un hueco real.
  const slack = Math.ceil(scale) + 1;
  if (srcY < -slack) throw new RangeError('gap');
  if (srcY < 0) return { srcY: 0, dstY: top, rows: bottom - top };
  return { srcY, dstY: top, rows: bottom - top };
}

/** Reparte un tramo entre las partes que cruza (un tramo puede caer a caballo entre dos). */
export function splitTile(tile: Tile, parts: PartRange[]): Piece[] {
  const pieces: Piece[] = [];
  const end = tile.dstY + tile.rows;
  parts.forEach((range, part) => {
    const from = Math.max(tile.dstY, range.start);
    const to = Math.min(end, range.end);
    if (to > from)
      pieces.push({
        part,
        srcY: tile.srcY + (from - tile.dstY),
        destY: from - range.start,
        rows: to - from,
      });
  });
  return pieces;
}

/** Posiciones de desplazamiento previstas; se limita para acotar el tiempo total. */
export function tileCount(pageHeight: number, tileHeight: number): number {
  if (!(pageHeight > 0) || !(tileHeight > 0)) return 0;
  return Math.max(1, Math.ceil(pageHeight / tileHeight));
}
