import type { CaptureErrorCode } from '../messaging';

/** Presupuesto de producto (supuesto, no medido): ver docs/riesgos-y-limites-api.md. */
export const maxCaptureSide = 8192;
export const maxCaptureArea = 33_177_600;

export function withinBudget(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= maxCaptureSide &&
    height <= maxCaptureSide &&
    width * height <= maxCaptureArea
  );
}

/** Traduce el mensaje de error de Chrome a un código propio; nunca se registra ni muestra el original. */
export function mapCaptureError(message: string): CaptureErrorCode {
  if (/MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND|quota/i.test(message))
    return 'quota';
  if (
    /cannot access|activeTab|permission|not allowed|extensions gallery|chrome:\/\//i.test(
      message,
    )
  )
    return 'restricted';
  return 'failed';
}
