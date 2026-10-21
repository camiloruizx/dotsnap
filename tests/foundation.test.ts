import { describe, expect, it } from 'vitest';
import { toPixelCrop } from '../src/shared/geometry/crop';
import { isHealthRequest, isTrustedUi } from '../src/shared/messaging';
import { parsePreferences } from '../src/shared/storage/preferences';
import { resolveLanguage } from '../src/shared/i18n';
import es from '../src/shared/i18n/es.json';
import en from '../src/shared/i18n/en.json';

describe('geometría de recorte CSS → píxeles', () => {
  it('redondea hacia fuera con DPR fraccionario y limita al bitmap', () => {
    expect(
      toPixelCrop({ x: 1.2, y: -2, width: 100, height: 20 }, 1.25, {
        width: 100,
        height: 50,
      }),
    ).toEqual({ x: 1, y: 0, width: 99, height: 23 });
  });
  it('admite regiones fuera del bitmap y áreas vacías sin píxeles fantasma', () => {
    expect(
      toPixelCrop({ x: 120, y: 120, width: 10, height: 10 }, 2, {
        width: 100,
        height: 100,
      }),
    ).toEqual({ x: 100, y: 100, width: 0, height: 0 });
    expect(
      toPixelCrop({ x: 1.2, y: 1.2, width: 0, height: 0 }, 1.25, {
        width: 100,
        height: 100,
      }).width,
    ).toBe(0);
  });
  it('rechaza geometría no válida', () => {
    for (const dpr of [0, -1, NaN, Infinity])
      expect(() =>
        toPixelCrop({ x: 0, y: 0, width: 1, height: 1 }, dpr, {
          width: 100,
          height: 100,
        }),
      ).toThrow(RangeError);
  });
});
describe('límites de confianza', () => {
  it('rechaza mensajes desconocidos, con datos extra y remitentes de páginas', () => {
    expect(
      isTrustedUi(
        { id: 'id', url: 'chrome-extension://id/options.html', tab: {} },
        'id',
        'chrome-extension://id/',
      ),
    ).toBe(true);
    expect(isHealthRequest({ version: 1, type: 'health' })).toBe(true);
    for (const data of [
      null,
      'health',
      { version: 2, type: 'health' },
      { version: 1, type: 'health', url: 'https://example.com' },
    ])
      expect(isHealthRequest(data)).toBe(false);
    expect(
      isTrustedUi(
        { id: 'id', url: 'chrome-extension://id/popup.html' },
        'id',
        'chrome-extension://id/',
      ),
    ).toBe(true);
    expect(
      isTrustedUi(
        { id: 'other', url: 'chrome-extension://id/popup.html' },
        'id',
        'chrome-extension://id/',
      ),
    ).toBe(false);
    expect(
      isTrustedUi(
        { id: 'id', url: 'https://example.com', tab: {} },
        'id',
        'chrome-extension://id/',
      ),
    ).toBe(false);
  });
  it('normaliza preferencias corruptas sin propagar datos extra', () => {
    expect(
      parsePreferences({ language: 'fr', theme: '<script>', extra: true }),
    ).toEqual({ language: 'system', theme: 'system' });
    expect(parsePreferences({ language: 'en', theme: 'dark' })).toEqual({
      language: 'en',
      theme: 'dark',
    });
  });
});
it('mantiene paridad ES/EN y resuelve las variantes del sistema', () => {
  expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  expect(resolveLanguage('system', 'es-MX')).toBe('es');
  expect(resolveLanguage('system', 'fr')).toBe('en');
  expect(resolveLanguage('en', 'es')).toBe('en');
});
