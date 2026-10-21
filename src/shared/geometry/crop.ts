export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface Scale {
  x: number;
  y: number;
}

/**
 * Escala real píxeles-de-bitmap por píxel CSS, medida y no supuesta: con zoom del
 * navegador, barras de desplazamiento o pellizco el bitmap de captureVisibleTab no
 * siempre mide innerWidth × devicePixelRatio. Los ejes se calculan por separado.
 */
export function captureScale(bitmap: Size, viewport: Size): Scale {
  if (
    ![bitmap.width, bitmap.height, viewport.width, viewport.height].every(
      Number.isFinite,
    ) ||
    bitmap.width <= 0 ||
    bitmap.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    throw new RangeError('Invalid geometry');
  return {
    x: bitmap.width / viewport.width,
    y: bitmap.height / viewport.height,
  };
}

/** Utilidad pura, sin captura: cubre los píxeles de una región CSS y limita al bitmap. */
export function toPixelCrop(
  region: Rectangle,
  scale: Scale,
  bitmap: Size,
): Rectangle {
  if (
    ![
      region.x,
      region.y,
      region.width,
      region.height,
      scale.x,
      scale.y,
      bitmap.width,
      bitmap.height,
    ].every(Number.isFinite) ||
    scale.x <= 0 ||
    scale.y <= 0 ||
    region.width < 0 ||
    region.height < 0 ||
    bitmap.width < 0 ||
    bitmap.height < 0 ||
    !Number.isInteger(bitmap.width) ||
    !Number.isInteger(bitmap.height)
  )
    throw new RangeError('Invalid geometry');
  const x = Math.min(bitmap.width, Math.max(0, Math.floor(region.x * scale.x)));
  const y = Math.min(
    bitmap.height,
    Math.max(0, Math.floor(region.y * scale.y)),
  );
  const right = Math.min(
    bitmap.width,
    Math.max(x, Math.ceil((region.x + region.width) * scale.x)),
  );
  const bottom = Math.min(
    bitmap.height,
    Math.max(y, Math.ceil((region.y + region.height) * scale.y)),
  );
  return {
    x,
    y,
    width: region.width === 0 ? 0 : right - x,
    height: region.height === 0 ? 0 : bottom - y,
  };
}
