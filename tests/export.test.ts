import { describe, expect, it } from 'vitest';
import {
  fitToTarget,
  scaledSize,
  sniffFormat,
} from '../src/shared/export/formats';
import { buildPdf, planPdf } from '../src/shared/export/pdf';

const bytes = (...n: number[]) => new Uint8Array(n);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('formatos', () => {
  it('reconoce el formato real por firma', () => {
    expect(
      sniffFormat(bytes(0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    ).toBe('png');
    expect(sniffFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe('jpeg');
    expect(
      sniffFormat(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBPVP8 '))),
    ).toBe('webp');
    expect(sniffFormat(bytes(...ascii('%PDF-1.4\n')))).toBe('pdf');
    expect(sniffFormat(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13))).toBe(
      null,
    );
  });
  it('un PNG declarado como JPEG se detecta', () => {
    expect(
      sniffFormat(bytes(0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    ).not.toBe('jpeg');
  });
  it('escala solo reduce y respeta la proporción', () => {
    expect(scaledSize(1000, 3000, 50)).toEqual({ width: 500, height: 1500 });
    expect(scaledSize(1001, 333, 25)).toEqual({ width: 250, height: 83 });
    expect(scaledSize(1000, 1000, 400)).toEqual({ width: 1000, height: 1000 });
    expect(scaledSize(1000, 1000, 1)).toEqual({ width: 100, height: 100 });
  });
});

const fake = (perQuality: number) => async (q: number) => {
  const blob = new Blob([new Uint8Array(Math.round(q * perQuality))]);
  return blob;
};

describe('peso objetivo', () => {
  it('devuelve la mayor calidad que cabe y declara que se alcanzó', async () => {
    const r = await fitToTarget(fake(10000), 6000);
    expect(r.reached).toBe(true);
    expect(r.blob.size).toBeLessThanOrEqual(6000);
    expect(r.quality).toBeGreaterThan(0.55);
    expect(r.quality).toBeLessThanOrEqual(0.6);
  });
  it('si cabe con calidad alta no la baja', async () => {
    const r = await fitToTarget(fake(1000), 5000);
    expect(r).toMatchObject({ reached: true, quality: 0.95 });
  });
  it('si no cabe ni con la mínima lo dice y no finge', async () => {
    const r = await fitToTarget(fake(10_000_000), 1000);
    expect(r.reached).toBe(false);
    expect(r.quality).toBe(0.05);
    expect(r.blob.size).toBeGreaterThan(1000);
  });
});

describe('plan del PDF', () => {
  const rowsOf = (p: ReturnType<typeof planPdf>) =>
    p.reduce((a, x) => a + x.rows, 0);
  it('A4: reparte una imagen larga sin perder ni repetir filas', () => {
    const plan = planPdf(1000, 5000, 'a4', 10);
    expect(plan.length).toBeGreaterThan(2);
    expect(rowsOf(plan)).toBe(5000);
    plan.forEach((p, i) => {
      expect(p.srcY).toBe(i === 0 ? 0 : plan[i - 1]!.srcY + plan[i - 1]!.rows);
      expect(p.pageWidth).toBeCloseTo(595.28);
      expect(p.pageHeight).toBeCloseTo(841.89);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y + p.height).toBeLessThanOrEqual(p.pageHeight + 0.01);
      expect(p.x + p.width).toBeLessThanOrEqual(p.pageWidth + 0.01);
    });
  });
  it('A4: una captura pequeña cabe en una página sin ampliarse', () => {
    const plan = planPdf(400, 300, 'a4', 10);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.width).toBeCloseTo(300);
    expect(plan[0]!.x).toBeCloseTo((595.28 - 300) / 2);
  });
  it('Carta usa 612 × 792', () => {
    const plan = planPdf(800, 600, 'letter', 0);
    expect(plan[0]).toMatchObject({ pageWidth: 612, pageHeight: 792 });
  });
  it('tamaño original: la página mide la imagen más el margen', () => {
    const plan = planPdf(800, 1200, 'original', 0);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.pageWidth).toBeCloseTo(600);
    expect(plan[0]!.pageHeight).toBeCloseTo(900);
  });
  it('tamaño original: una imagen enorme se parte por filas exactas', () => {
    const plan = planPdf(1000, 30000, 'original', 0);
    expect(plan.length).toBeGreaterThan(1);
    expect(rowsOf(plan)).toBe(30000);
    expect(plan.every((p) => p.pageHeight <= 14400)).toBe(true);
  });
  it('entradas inválidas no producen páginas', () => {
    expect(planPdf(0, 100, 'a4', 10)).toEqual([]);
  });
});

describe('PDF generado', () => {
  it('tiene estructura válida: cabecera, xref con offsets reales y una página por franja', async () => {
    const plan = planPdf(40, 100, 'a4', 10);
    const pages = plan.map((p) => ({
      plan: p,
      pixelWidth: 40,
      rgb: new Uint8Array(40 * p.rows * 3).fill(200),
    }));
    const blob = await buildPdf(pages);
    const text = new TextDecoder('latin1').decode(
      new Uint8Array(await blob.arrayBuffer()),
    );
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain(`/Count ${plan.length}`);
    const start = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const entries = [...text.slice(start).matchAll(/(\d{10}) 00000 n /g)];
    expect(entries).toHaveLength(2 + 3 * plan.length);
    entries.forEach((m, i) => {
      const at = Number(m[1]);
      expect(text.slice(at, at + String(i + 1).length + 6)).toBe(
        `${i + 1} 0 obj`,
      );
    });
  });
});
