const prefix = 'data:image/png;base64,';
/** Límite de seguridad del texto base64 (~96 MiB de PNG); el presupuesto de píxeles es aparte. */
const maxLength = 128 * 1024 * 1024;

/**
 * Decodifica el data URL de captureVisibleTab sin fetch (el CSP de producción usa
 * connect-src 'none'). Solo acepta PNG en base64; cualquier otra cosa es RangeError.
 */
export function decodeDataUrl(url: string): Blob {
  if (!url.startsWith(prefix) || url.length > maxLength)
    throw new RangeError('Invalid capture data');
  let binary: string;
  try {
    binary = atob(url.slice(prefix.length));
  } catch {
    throw new RangeError('Invalid capture data');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50)
    throw new RangeError('Invalid capture data');
  return new Blob([bytes], { type: 'image/png' });
}
