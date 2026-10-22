export type SelectionMode = 'region' | 'element';
export const isSelectionMode = (value: unknown): value is SelectionMode =>
  value === 'region' || value === 'element';
export type Request =
  | { version: 1; type: 'health' }
  | { version: 1; type: 'capture-visible' }
  | { version: 1; type: 'start-selection'; mode: SelectionMode };

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
  if (data.version !== 1) return null;
  const keys = Object.keys(data).length;
  if (keys === 3 && data.type === 'start-selection')
    return isSelectionMode(data.mode)
      ? { version: 1, type: 'start-selection', mode: data.mode }
      : null;
  if (keys !== 2) return null;
  return data.type === 'health' || data.type === 'capture-visible'
    ? { version: 1, type: data.type }
    : null;
}

/** Mensajes del content script (menos confiable): esquema exacto y números finitos acotados. */
export type SelectionMessage =
  | { version: 1; type: 'selection-ready' }
  | { version: 1; type: 'selection-cancel'; requestId: string }
  | {
      version: 1;
      type: 'selection-done';
      requestId: string;
      rect: { x: number; y: number; width: number; height: number };
      viewport: { width: number; height: number };
    };
const maxCss = 100_000;
const finite = (v: unknown, lo: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= maxCss;
const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hasKeys = (o: Record<string, unknown>, keys: string[]) =>
  Object.keys(o).length === keys.length && keys.every((k) => k in o);
export function parseSelectionMessage(value: unknown): SelectionMessage | null {
  if (typeof value !== 'object' || value === null) return null;
  const d = value as Record<string, unknown>;
  if (d.version !== 1) return null;
  if (d.type === 'selection-ready')
    return hasKeys(d, ['version', 'type'])
      ? { version: 1, type: 'selection-ready' }
      : null;
  if (typeof d.requestId !== 'string' || !requestIdPattern.test(d.requestId))
    return null;
  if (d.type === 'selection-cancel')
    return hasKeys(d, ['version', 'type', 'requestId'])
      ? { version: 1, type: 'selection-cancel', requestId: d.requestId }
      : null;
  if (
    d.type !== 'selection-done' ||
    !hasKeys(d, ['version', 'type', 'requestId', 'rect', 'viewport'])
  )
    return null;
  const r = d.rect as Record<string, unknown> | null;
  const v = d.viewport as Record<string, unknown> | null;
  if (
    typeof r !== 'object' ||
    r === null ||
    typeof v !== 'object' ||
    v === null ||
    !hasKeys(r, ['x', 'y', 'width', 'height']) ||
    !hasKeys(v, ['width', 'height']) ||
    !finite(r.x, 0) ||
    !finite(r.y, 0) ||
    !finite(r.width, 1) ||
    !finite(r.height, 1) ||
    !finite(v.width, 1) ||
    !finite(v.height, 1)
  )
    return null;
  return {
    version: 1,
    type: 'selection-done',
    requestId: d.requestId,
    rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    viewport: { width: v.width, height: v.height },
  };
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
