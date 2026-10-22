import { describe, expect, it } from 'vitest';
import {
  MIN_REGION,
  clampRect,
  hitTest,
  moveRect,
  nudgeRect,
  rectFromPoints,
  resizeRect,
  visibleRect,
} from '../src/shared/geometry/region';
import { captureScale, toPixelCrop } from '../src/shared/geometry/crop';
import { parseRequest, parseSelectionMessage } from '../src/shared/messaging';

const vp = { width: 1000, height: 600 };
const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

describe('geometría de región', () => {
  it('normaliza puntos en cualquier orden y limita al viewport', () => {
    expect(rectFromPoints({ x: 300, y: 250 }, { x: 200, y: 150 }, vp)).toEqual({
      x: 200,
      y: 150,
      width: 100,
      height: 100,
    });
    expect(rectFromPoints({ x: -50, y: -50 }, { x: 2000, y: 700 }, vp)).toEqual(
      {
        x: 0,
        y: 0,
        width: 1000,
        height: 600,
      },
    );
  });
  it('mover no saca el rectángulo del viewport ni lo deforma', () => {
    const r = { x: 900, y: 500, width: 80, height: 60 };
    expect(moveRect(r, 500, 500, vp)).toEqual({
      x: 920,
      y: 540,
      width: 80,
      height: 60,
    });
    expect(moveRect(r, -5000, -5000, vp)).toEqual({
      x: 0,
      y: 0,
      width: 80,
      height: 60,
    });
    expect(clampRect({ x: 0, y: 0, width: 5000, height: 5000 }, vp)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 600,
    });
  });
  it('redimensiona por tiradores y tolera cruzar el borde opuesto', () => {
    const r = { x: 200, y: 150, width: 100, height: 100 };
    expect(resizeRect(r, 'se', { x: 360, y: 310 }, vp)).toMatchObject({
      width: 160,
      height: 160,
    });
    expect(resizeRect(r, 'e', { x: 100, y: 999 }, vp)).toEqual({
      x: 100,
      y: 150,
      width: 100,
      height: 100,
    });
    expect(resizeRect(r, 'nw', { x: 250, y: 200 }, vp)).toEqual({
      x: 250,
      y: 200,
      width: 50,
      height: 50,
    });
  });
  it('detecta tiradores, interior y exterior', () => {
    const r = { x: 200, y: 150, width: 100, height: 100 };
    expect(hitTest(r, { x: 201, y: 151 }, 8)).toBe('nw');
    expect(hitTest(r, { x: 300, y: 200 }, 8)).toBe('e');
    expect(hitTest(r, { x: 250, y: 200 }, 8)).toBe('inside');
    expect(hitTest(r, { x: 500, y: 500 }, 8)).toBe('outside');
  });
  it('teclado: flechas mueven y Ctrl redimensiona con mínimo', () => {
    const r = { x: 10, y: 10, width: 50, height: 50 };
    expect(nudgeRect(r, 'ArrowRight', 1, false, vp).x).toBe(11);
    expect(nudgeRect(r, 'ArrowDown', 10, false, vp).y).toBe(20);
    expect(nudgeRect(r, 'ArrowRight', 5, true, vp).width).toBe(55);
    expect(nudgeRect(r, 'ArrowLeft', 500, true, vp).width).toBe(MIN_REGION);
    expect(nudgeRect(r, 'a', 1, false, vp)).toBe(r);
  });
  it('recorta elementos al viewport y descarta los vacíos o fuera', () => {
    expect(visibleRect({ x: -20, y: 50, width: 100, height: 100 }, vp)).toEqual(
      {
        x: 0,
        y: 50,
        width: 80,
        height: 100,
      },
    );
    expect(visibleRect({ x: 0, y: 0, width: 0, height: 100 }, vp)).toBeNull();
    expect(
      visibleRect({ x: 2000, y: 0, width: 50, height: 50 }, vp),
    ).toBeNull();
  });
  it('la región en px CSS recorta bien con escala medida 1, 1.25 y 2', () => {
    for (const s of [1, 2]) {
      const bitmap = { width: 1000 * s, height: 600 * s };
      const crop = toPixelCrop(
        { x: 450, y: 80, width: 300, height: 240 },
        captureScale(bitmap, vp),
        bitmap,
      );
      expect(crop).toEqual({
        x: 450 * s,
        y: 80 * s,
        width: 300 * s,
        height: 240 * s,
      });
    }
  });
});

describe('recorte con escala fraccionaria', () => {
  it('cubre el píxel parcial (no recorta de menos) con escala 1.25', () => {
    const bitmap = { width: 1250, height: 750 };
    expect(
      toPixelCrop(
        { x: 450, y: 80, width: 300, height: 240 },
        captureScale(bitmap, vp),
        bitmap,
      ),
    ).toEqual({ x: 562, y: 100, width: 376, height: 300 });
  });
});

describe('mensajes de selección', () => {
  it('acepta solo start-selection con modo conocido y claves exactas', () => {
    expect(
      parseRequest({ version: 1, type: 'start-selection', mode: 'region' }),
    ).toEqual({
      version: 1,
      type: 'start-selection',
      mode: 'region',
    });
    expect(
      parseRequest({ version: 1, type: 'start-selection', mode: 'x' }),
    ).toBeNull();
    expect(parseRequest({ version: 1, type: 'start-selection' })).toBeNull();
    expect(
      parseRequest({
        version: 1,
        type: 'start-selection',
        mode: 'element',
        extra: 1,
      }),
    ).toBeNull();
    expect(
      parseRequest({ version: 1, type: 'capture-visible', mode: 'region' }),
    ).toBeNull();
  });
  const done = {
    version: 1,
    type: 'selection-done',
    requestId: id,
    rect: { x: 1, y: 2, width: 30, height: 40 },
    viewport: { width: 1000, height: 600 },
  };
  it('valida selection-done: id, números finitos, tamaños y claves', () => {
    expect(parseSelectionMessage(done)).toEqual(done);
    expect(parseSelectionMessage({ ...done, requestId: 'x' })).toBeNull();
    expect(
      parseSelectionMessage({ ...done, rect: { ...done.rect, width: 0 } }),
    ).toBeNull();
    expect(
      parseSelectionMessage({ ...done, rect: { ...done.rect, x: NaN } }),
    ).toBeNull();
    expect(
      parseSelectionMessage({ ...done, rect: { ...done.rect, width: 1e9 } }),
    ).toBeNull();
    expect(
      parseSelectionMessage({ ...done, viewport: { width: 1000 } }),
    ).toBeNull();
    expect(parseSelectionMessage({ ...done, tabId: 7 })).toBeNull();
  });
  it('valida ready y cancel', () => {
    expect(
      parseSelectionMessage({ version: 1, type: 'selection-ready' }),
    ).toEqual({
      version: 1,
      type: 'selection-ready',
    });
    expect(
      parseSelectionMessage({ version: 1, type: 'selection-ready', tabId: 1 }),
    ).toBeNull();
    expect(
      parseSelectionMessage({
        version: 1,
        type: 'selection-cancel',
        requestId: id,
      }),
    ).toEqual({
      version: 1,
      type: 'selection-cancel',
      requestId: id,
    });
    expect(
      parseSelectionMessage({ version: 2, type: 'selection-ready' }),
    ).toBeNull();
    expect(parseSelectionMessage(null)).toBeNull();
  });
});
