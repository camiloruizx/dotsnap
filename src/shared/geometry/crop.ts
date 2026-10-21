export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Utilidad pura, sin captura: cubre los píxeles de una región CSS y limita al bitmap. */
export function toPixelCrop(
  region: Rectangle,
  dpr: number,
  bitmap: { width: number; height: number },
): Rectangle {
  if (
    ![
      region.x,
      region.y,
      region.width,
      region.height,
      dpr,
      bitmap.width,
      bitmap.height,
    ].every(Number.isFinite) ||
    dpr <= 0 ||
    region.width < 0 ||
    region.height < 0 ||
    bitmap.width < 0 ||
    bitmap.height < 0 ||
    !Number.isInteger(bitmap.width) ||
    !Number.isInteger(bitmap.height)
  )
    throw new RangeError('Invalid geometry');
  const x = Math.min(bitmap.width, Math.max(0, Math.floor(region.x * dpr)));
  const y = Math.min(bitmap.height, Math.max(0, Math.floor(region.y * dpr)));
  const right = Math.min(
    bitmap.width,
    Math.max(x, Math.ceil((region.x + region.width) * dpr)),
  );
  const bottom = Math.min(
    bitmap.height,
    Math.max(y, Math.ceil((region.y + region.height) * dpr)),
  );
  return {
    x,
    y,
    width: region.width === 0 ? 0 : right - x,
    height: region.height === 0 ? 0 : bottom - y,
  };
}
