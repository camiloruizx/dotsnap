import { describe, expect, it } from 'vitest';
import {
  History,
  addCommand,
  buildFileName,
  clampPoint,
  defaultSizes,
  isMeaningfulArrow,
  isMeaningfulRect,
  normalizeRect,
  removeCommand,
  type Annotation,
  type RectAnnotation,
} from '../src/editor/model';
import { decodeDataUrl } from '../src/shared/capture/dataUrl';
import {
  mapCaptureError,
  maxCaptureArea,
  withinBudget,
} from '../src/shared/capture/errors';
import { isCaptureId } from '../src/shared/storage/captures';
import { parseCaptureResponse, parseRequest } from '../src/shared/messaging';

const rect = (id: string, x = 0): RectAnnotation => ({
  id,
  type: 'rect',
  x,
  y: 0,
  width: 10,
  height: 10,
  color: '#e5484d',
  strokeWidth: 4,
});

describe('historial por comandos', () => {
  it('deshace y rehace altas, cambios y borrados conservando el orden de capas', () => {
    const history = new History();
    const a = rect('a');
    const b = rect('b', 20);
    history.execute(addCommand(history.doc, a));
    history.execute(addCommand(history.doc, b));
    history.execute({ kind: 'update', before: a, after: { ...a, x: 99 } });
    history.execute(removeCommand(history.doc, 'a')!);
    expect(history.doc.annotations.map((x) => x.id)).toEqual(['b']);
    history.undo();
    expect(history.doc.annotations.map((x) => x.id)).toEqual(['a', 'b']);
    expect((history.doc.annotations[0] as RectAnnotation).x).toBe(99);
    history.undo();
    expect((history.doc.annotations[0] as RectAnnotation).x).toBe(0);
    history.redo();
    expect((history.doc.annotations[0] as RectAnnotation).x).toBe(99);
    while (history.undo());
    expect(history.doc.annotations).toEqual([]);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });
  it('una acción nueva descarta el rehacer y el límite acota la pila', () => {
    const history = new History({ annotations: [] }, 3);
    for (const id of ['a', 'b', 'c', 'd'])
      history.execute(addCommand(history.doc, rect(id)));
    let undone = 0;
    while (history.undo()) undone += 1;
    expect(undone).toBe(3);
    history.redo();
    history.execute(addCommand(history.doc, rect('z')));
    expect(history.canRedo).toBe(false);
  });
  it('no duplica ids ni falla al borrar uno inexistente', () => {
    const history = new History();
    const a: Annotation = rect('a');
    history.execute(addCommand(history.doc, a));
    history.execute(addCommand(history.doc, a));
    expect(history.doc.annotations).toHaveLength(1);
    expect(removeCommand(history.doc, 'nope')).toBeUndefined();
  });
});

describe('geometría de dibujo', () => {
  it('normaliza arrastres en cualquier dirección y filtra clics accidentales', () => {
    expect(normalizeRect({ x: 50, y: 40 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 20,
    });
    expect(isMeaningfulRect({ width: 3, height: 50 })).toBe(false);
    expect(isMeaningfulRect({ width: 4, height: 4 })).toBe(true);
    expect(isMeaningfulArrow({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(false);
    expect(clampPoint({ x: -5, y: 900 }, 100, 50)).toEqual({ x: 0, y: 50 });
  });
  it('escala grosor y texto con el ancho real del bitmap', () => {
    expect(defaultSizes(1000)).toEqual({ strokeWidth: 3, fontSize: 22 });
    expect(defaultSizes(2000).strokeWidth).toBeGreaterThan(
      defaultSizes(1000).strokeWidth,
    );
  });
});

describe('nombre de descarga', () => {
  it('usa fecha local y solo caracteres seguros', () => {
    const date = new Date(2026, 9, 21, 16, 5, 9);
    expect(buildFileName('DotSnap', date)).toBe('dotsnap-20261021-160509.png');
    expect(buildFileName('../..\\evil name', date)).toBe(
      'evilname-20261021-160509.png',
    );
    expect(buildFileName('***', date)).toBe('captura-20261021-160509.png');
  });
});

describe('captura: datos y errores', () => {
  const png1x1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  it('decodifica solo PNG en base64, sin fetch', async () => {
    const blob = decodeDataUrl(`data:image/png;base64,${png1x1}`);
    expect(blob.type).toBe('image/png');
    expect(new Uint8Array(await blob.arrayBuffer()).slice(0, 4)).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );
  });
  it('rechaza prefijos, base64 y contenido que no son PNG', () => {
    for (const bad of [
      'data:image/jpeg;base64,' + png1x1,
      'data:image/png;base64,@@@',
      'https://example.com/a.png',
      'data:image/png;base64,' + btoa('no es png'),
    ])
      expect(() => decodeDataUrl(bad)).toThrow(RangeError);
  });
  it('clasifica errores de Chrome sin exponer su texto', () => {
    expect(
      mapCaptureError(
        'This request exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota.',
      ),
    ).toBe('quota');
    expect(
      mapCaptureError(
        'Cannot access contents of the page. Extension manifest must request permission to access the respective host.',
      ),
    ).toBe('restricted');
    expect(
      mapCaptureError(
        "The 'activeTab' permission is not in effect because this extension has not been in invoked.",
      ),
    ).toBe('restricted');
    expect(mapCaptureError('algo raro')).toBe('failed');
  });
  it('aplica el presupuesto de píxeles', () => {
    expect(withinBudget(1920, 1080)).toBe(true);
    expect(withinBudget(7680, 4320)).toBe(true);
    expect(withinBudget(8193, 10)).toBe(false);
    expect(withinBudget(8192, 8192)).toBe(false);
    expect(8192 * 8192).toBeGreaterThan(maxCaptureArea);
    expect(withinBudget(0, 10)).toBe(false);
    expect(withinBudget(10.5, 10)).toBe(false);
  });
  it('valida ids de captura y el esquema de mensajes', () => {
    expect(isCaptureId(crypto.randomUUID())).toBe(true);
    for (const bad of ['', '../x', 'A'.repeat(36), undefined, 5])
      expect(isCaptureId(bad)).toBe(false);
    expect(parseRequest({ version: 1, type: 'capture-visible' })).toEqual({
      version: 1,
      type: 'capture-visible',
    });
    for (const bad of [
      { version: 1, type: 'capture-visible', tabId: 7 },
      { version: 2, type: 'capture-visible' },
      { version: 1, type: 'other' },
      null,
    ])
      expect(parseRequest(bad)).toBeNull();
    expect(parseCaptureResponse({ version: 1, ok: true })).toEqual({
      version: 1,
      ok: true,
    });
    expect(
      parseCaptureResponse({ version: 1, ok: false, code: 'busy' }),
    ).toEqual({ version: 1, ok: false, code: 'busy' });
    expect(parseCaptureResponse({ version: 1, ok: false, code: 'x' })).toEqual({
      version: 1,
      ok: false,
      code: 'failed',
    });
    expect(parseCaptureResponse(undefined).ok).toBe(false);
  });
});

describe('fuentes del texto', () => {
  it('cada fuente tiene id único y pila no vacía; lo desconocido cae en la predeterminada', async () => {
    const { FONTS, fontStack, isFontId, DEFAULT_FONT } =
      await import('../src/editor/model');
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length);
    expect(FONTS.every((f) => f.stack.length > 0)).toBe(true);
    expect(isFontId('mono')).toBe(true);
    expect(isFontId('comic')).toBe(false);
    expect(fontStack(undefined)).toBe(fontStack(DEFAULT_FONT));
    expect(fontStack('mono')).toContain('Courier');
  });
});
