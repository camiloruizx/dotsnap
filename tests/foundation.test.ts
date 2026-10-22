import { describe, expect, it } from 'vitest';
import { captureScale, toPixelCrop } from '../src/shared/geometry/crop';
import { isHealthRequest, isTrustedUi } from '../src/shared/messaging';
import { parsePreferences } from '../src/shared/storage/preferences';
import { resolveLanguage } from '../src/shared/i18n';
import es from '../src/shared/i18n/es.json';
import en from '../src/shared/i18n/en.json';

describe('geometría de recorte CSS → píxeles', () => {
  it('redondea hacia fuera con DPR fraccionario y limita al bitmap', () => {
    expect(
      toPixelCrop(
        { x: 1.2, y: -2, width: 100, height: 20 },
        { x: 1.25, y: 1.25 },
        {
          width: 100,
          height: 50,
        },
      ),
    ).toEqual({ x: 1, y: 0, width: 99, height: 23 });
  });
  it('admite regiones fuera del bitmap y áreas vacías sin píxeles fantasma', () => {
    expect(
      toPixelCrop(
        { x: 120, y: 120, width: 10, height: 10 },
        { x: 2, y: 2 },
        {
          width: 100,
          height: 100,
        },
      ),
    ).toEqual({ x: 100, y: 100, width: 0, height: 0 });
    expect(
      toPixelCrop(
        { x: 1.2, y: 1.2, width: 0, height: 0 },
        { x: 1.25, y: 1.25 },
        {
          width: 100,
          height: 100,
        },
      ).width,
    ).toBe(0);
  });
  it('rechaza geometría no válida', () => {
    for (const bad of [0, -1, NaN, Infinity])
      expect(() =>
        toPixelCrop(
          { x: 0, y: 0, width: 1, height: 1 },
          { x: bad, y: 1 },
          { width: 100, height: 100 },
        ),
      ).toThrow(RangeError);
    expect(() =>
      toPixelCrop(
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 1, y: 0 },
        { width: 100, height: 100 },
      ),
    ).toThrow(RangeError);
  });
  it('usa escalas distintas por eje cuando el bitmap no es proporcional al viewport', () => {
    expect(
      toPixelCrop(
        { x: 10, y: 10, width: 20, height: 20 },
        { x: 2, y: 1.5 },
        { width: 400, height: 300 },
      ),
    ).toEqual({ x: 20, y: 15, width: 40, height: 30 });
  });
});
describe('escala medida del bitmap', () => {
  it('deriva la escala de bitmap y viewport, sin asumir devicePixelRatio', () => {
    expect(
      captureScale({ width: 1000, height: 600 }, { width: 800, height: 600 }),
    ).toEqual({ x: 1.25, y: 1 });
    expect(
      captureScale(
        { width: 1920, height: 1080 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 1, y: 1 });
  });
  it('rechaza viewport o bitmap vacíos y valores no finitos', () => {
    for (const [bitmap, viewport] of [
      [
        { width: 0, height: 10 },
        { width: 10, height: 10 },
      ],
      [
        { width: 10, height: 10 },
        { width: 0, height: 10 },
      ],
      [
        { width: NaN, height: 10 },
        { width: 10, height: 10 },
      ],
      [
        { width: 10, height: 10 },
        { width: 10, height: Infinity },
      ],
    ] as const)
      expect(() => captureScale(bitmap, viewport)).toThrow(RangeError);
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
    ).toMatchObject({ language: 'system', theme: 'system' });
    expect(
      Object.keys(
        parsePreferences({ language: 'fr', theme: '<script>', extra: true }),
      ).sort(),
    ).toEqual(
      [
        'language',
        'theme',
        'historyEnabled',
        'retentionDays',
        'defaultFormat',
        'defaultQuality',
        'fileNameTemplate',
        'captureDelay',
      ].sort(),
    );
    expect(parsePreferences({ language: 'en', theme: 'dark' })).toMatchObject({
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
