import { describe, expect, it } from 'vitest';
import {
  contrastOn,
  parseAnnotations,
  type Annotation,
} from '../src/editor/model';

const items: Annotation[] = [
  {
    id: 'l',
    type: 'line',
    x1: 1,
    y1: 2,
    x2: 30,
    y2: 40,
    color: '#e5484d',
    strokeWidth: 4,
  },
  {
    id: 'e',
    type: 'ellipse',
    x: 5,
    y: 6,
    width: 50,
    height: 20,
    color: '#0078d4',
    strokeWidth: 3,
  },
  {
    id: 'h',
    type: 'highlight',
    x: 0,
    y: 0,
    width: 80,
    height: 12,
    color: '#f5c542',
  },
  {
    id: 's',
    type: 'step',
    x: 9,
    y: 9,
    number: 3,
    radius: 14,
    color: '#30a46c',
  },
];

describe('herramientas nuevas', () => {
  it('se validan y conservan', () => {
    expect(parseAnnotations(JSON.parse(JSON.stringify(items)))).toEqual(items);
  });
  it('rechazan claves de más, números inválidos y colores ajenos', () => {
    const bad = [
      { ...items[2], strokeWidth: 3 },
      { ...items[3], number: 0 },
      { ...items[3], number: 1.5 },
      { ...items[3], radius: 1 },
      { ...items[2], color: 'yellow' },
      { ...items[1], width: -1 },
      { ...items[0], extra: 1 },
    ];
    for (const b of bad) expect(parseAnnotations([b])).toBeNull();
  });
  it('contraste del número del paso', () => {
    expect(contrastOn('#ffffff')).toBe('#000000');
    expect(contrastOn('#000000')).toBe('#ffffff');
    expect(contrastOn('#e5484d')).toBe('#ffffff');
  });
});

import { countdown } from '../src/shared/capture/delay';
import { parseRequest } from '../src/shared/messaging';
import { parsePreferences } from '../src/shared/storage/preferences';
import { cleanName, matchesQuery } from '../src/shared/storage/captures';

describe('temporizador', () => {
  it('cuenta hacia atrás y limpia la insignia', async () => {
    const log: string[] = [];
    const ok = await countdown(3, {
      sleep: async () => {},
      badge: (t) => void log.push(t),
    });
    expect(ok).toBe(true);
    expect(log).toEqual(['3', '2', '1', '']);
  });
  it('se puede cancelar', async () => {
    const log: string[] = [];
    let n = 0;
    const ok = await countdown(
      5,
      { sleep: async () => {}, badge: (t) => void log.push(t) },
      () => ++n > 2,
    );
    expect(ok).toBe(false);
    expect(log.at(-1)).toBe('');
  });
  it('el mensaje solo admite esperas conocidas', () => {
    expect(
      parseRequest({ version: 1, type: 'capture-visible', delay: 5 }),
    ).toEqual({ version: 1, type: 'capture-visible', delay: 5 });
    for (const delay of [0, 4, 99, '5', null, -1])
      expect(
        parseRequest({ version: 1, type: 'capture-fullpage', delay }),
      ).toBeNull();
    expect(parseRequest({ version: 1, type: 'health', delay: 3 })).toBeNull();
    expect(parseRequest({ version: 1, type: 'capture-visible' })).toEqual({
      version: 1,
      type: 'capture-visible',
    });
  });
  it('la preferencia se sanea', () => {
    expect(parsePreferences({ captureDelay: 10 }).captureDelay).toBe(10);
    expect(parsePreferences({ captureDelay: 7 }).captureDelay).toBe(0);
    expect(parsePreferences({}).captureDelay).toBe(0);
  });
});

describe('nombres del historial', () => {
  it('limpia controles, espacios y longitud', () => {
    expect(cleanName('  a\u0000b\n  c  ')).toBe('a b c');
    expect(cleanName('x'.repeat(100))).toHaveLength(60);
    expect(cleanName('   ')).toBe('');
  });
  it('busca por nombre o fecha', () => {
    const item = { name: 'Factura mayo', updatedAt: Date.UTC(2026, 4, 3, 12) };
    expect(matchesQuery(item, 'factura', 'es')).toBe(true);
    expect(matchesQuery(item, 'zzz', 'es')).toBe(false);
    expect(matchesQuery(item, '  ', 'es')).toBe(true);
    expect(matchesQuery({ ...item, name: undefined }, 'factura', 'es')).toBe(
      false,
    );
  });
});
