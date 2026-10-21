export function isHealthRequest(
  value: unknown,
): value is { version: 1; type: 'health' } {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    Object.keys(data).length === 2 &&
    data.version === 1 &&
    data.type === 'health'
  );
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
