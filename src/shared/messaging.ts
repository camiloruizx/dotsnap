export type Request =
  { version: 1; type: 'health' } | { version: 1; type: 'capture-visible' };

export const captureErrorCodes = [
  'restricted',
  'quota',
  'busy',
  'tabChanged',
  'noTab',
  'tooLarge',
  'failed',
] as const;
export type CaptureErrorCode = (typeof captureErrorCodes)[number];
export type CaptureResponse =
  { version: 1; ok: true } | { version: 1; ok: false; code: CaptureErrorCode };

/** Esquema exacto: dos claves, versión 1 y un tipo conocido. Todo lo demás se rechaza. */
export function parseRequest(value: unknown): Request | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== 2 || data.version !== 1) return null;
  return data.type === 'health' || data.type === 'capture-visible'
    ? { version: 1, type: data.type }
    : null;
}

export function isHealthRequest(
  value: unknown,
): value is { version: 1; type: 'health' } {
  return parseRequest(value)?.type === 'health';
}

export function parseCaptureResponse(value: unknown): CaptureResponse {
  const failed: CaptureResponse = { version: 1, ok: false, code: 'failed' };
  if (typeof value !== 'object' || value === null) return failed;
  const data = value as Record<string, unknown>;
  if (data.version !== 1) return failed;
  if (data.ok === true && Object.keys(data).length === 2)
    return { version: 1, ok: true };
  if (
    data.ok === false &&
    Object.keys(data).length === 3 &&
    (captureErrorCodes as readonly unknown[]).includes(data.code)
  )
    return { version: 1, ok: false, code: data.code as CaptureErrorCode };
  return failed;
}

export function isTrustedUi(
  sender: { id?: string; url?: string; tab?: unknown },
  extensionId: string,
  baseUrl: string,
): boolean {
  return (
    sender.id === extensionId &&
    [
      new URL('popup.html', baseUrl).href,
      new URL('options.html', baseUrl).href,
    ].includes(sender.url ?? '')
  );
}
