import { describe, expect, it } from 'vitest';
import {
  buildFileName,
  isValidFileTemplate,
  parseAnnotations,
  History,
  type Annotation,
} from '../src/editor/model';
import { parsePreferences } from '../src/shared/storage/preferences';
import {
  ProjectError,
  parseProject,
  serializeProject,
} from '../src/shared/export/project';

const arrow: Annotation = {
  id: 'a1',
  type: 'arrow',
  x1: 1,
  y1: 2,
  x2: 30,
  y2: 40,
  color: '#e5484d',
  strokeWidth: 4,
};
const full: Annotation[] = [
  arrow,
  {
    id: 'r1',
    type: 'rect',
    x: 1,
    y: 1,
    width: 20,
    height: 10,
    color: '#0078d4',
    strokeWidth: 3,
  },
  {
    id: 't1',
    type: 'text',
    x: 5,
    y: 6,
    text: 'Hola',
    color: '#000000',
    fontSize: 24,
    fontFamily: 'mono',
  },
  {
    id: 't2',
    type: 'text',
    x: 5,
    y: 6,
    text: 'Sin fuente',
    color: '#000000',
    fontSize: 24,
  },
  { id: 'x1', type: 'redact', mode: 'blur', x: 0, y: 0, width: 5, height: 5 },
];

describe('validación de anotaciones guardadas', () => {
  it('acepta anotaciones válidas y las devuelve iguales', () => {
    expect(parseAnnotations(JSON.parse(JSON.stringify(full)))).toEqual(full);
  });
  it('rechaza lo que no sea una lista de anotaciones exactas', () => {
    const bad: unknown[] = [
      'x',
      {},
      [null],
      [{ ...arrow, type: 'circle' }],
      [{ ...arrow, color: 'red' }],
      [{ ...arrow, x1: Infinity }],
      [{ ...arrow, x1: 1e9 }],
      [{ ...arrow, extra: 1 }],
      [{ ...arrow, id: '' }],
      [arrow, arrow],
      [
        {
          id: 'r',
          type: 'rect',
          x: 1,
          y: 1,
          width: -1,
          height: 2,
          color: '#000000',
          strokeWidth: 2,
        },
      ],
      [
        {
          id: 't',
          type: 'text',
          x: 1,
          y: 1,
          text: 'a',
          color: '#000000',
          fontSize: 20,
          fontFamily: 'comic',
        },
      ],
      [
        {
          id: 't',
          type: 'text',
          x: 1,
          y: 1,
          text: 'a'.repeat(2001),
          color: '#000000',
          fontSize: 20,
        },
      ],
      [
        {
          id: 'x',
          type: 'redact',
          mode: 'sepia',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ],
      Array.from({ length: 501 }, (_, i) => ({ ...arrow, id: `i${i}` })),
    ];
    for (const value of bad) expect(parseAnnotations(value)).toBeNull();
  });
  it('History.load sustituye el documento y vacía deshacer', () => {
    const h = new History();
    h.execute({ kind: 'add', item: arrow, index: 0 });
    h.load({ annotations: full });
    expect(h.doc.annotations).toHaveLength(full.length);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});

describe('plantilla del nombre de archivo', () => {
  const date = new Date(2026, 9, 22, 12, 5, 9);
  it('predeterminada y con extensión', () => {
    expect(buildFileName('DotSnap', date)).toBe('dotsnap-20261022-120509.png');
    expect(buildFileName('DotSnap', date, 'pdf')).toBe(
      'dotsnap-20261022-120509.pdf',
    );
  });
  it('usa {app}, {date} y {time} y limpia el resto', () => {
    expect(buildFileName('DotSnap', date, 'png', 'Mi captura {date}')).toBe(
      'mi-captura-20261022.png',
    );
    expect(buildFileName('DotSnap', date, 'png', '../../{time}\\x')).toBe(
      'time'.length ? '120509x.png' : '',
    );
    expect(buildFileName('DotSnap', date, 'png', '{app}_{time}')).toBe(
      'dotsnap_120509.png',
    );
  });
  it('una plantilla vacía o imposible cae en la predeterminada', () => {
    expect(buildFileName('DotSnap', date, 'png', '***')).toBe(
      'dotsnap-20261022-120509.png',
    );
    expect(isValidFileTemplate('')).toBe(false);
    expect(isValidFileTemplate('***')).toBe(false);
    expect(isValidFileTemplate('a'.repeat(61))).toBe(false);
    expect(isValidFileTemplate('{app}-{date}')).toBe(true);
  });
});

describe('preferencias ampliadas', () => {
  it('usa los valores por defecto ante datos ausentes o inválidos', () => {
    const d = parsePreferences(undefined);
    expect(d).toMatchObject({
      historyEnabled: true,
      retentionDays: 7,
      defaultFormat: 'png',
      defaultQuality: 92,
    });
    const bad = parsePreferences({
      historyEnabled: 'sí',
      retentionDays: 365,
      defaultFormat: 'bmp',
      defaultQuality: 400,
      fileNameTemplate: '***',
    });
    expect(bad).toEqual(d);
  });
  it('conserva valores válidos y preferencias antiguas siguen siendo válidas', () => {
    expect(
      parsePreferences({
        language: 'en',
        historyEnabled: false,
        retentionDays: 30,
        defaultFormat: 'webp',
        defaultQuality: 60,
        fileNameTemplate: '{app}-{date}',
      }),
    ).toMatchObject({
      language: 'en',
      historyEnabled: false,
      retentionDays: 30,
      defaultFormat: 'webp',
      defaultQuality: 60,
      fileNameTemplate: '{app}-{date}',
    });
    expect(parsePreferences({ language: 'es', theme: 'dark' })).toMatchObject({
      language: 'es',
      theme: 'dark',
      historyEnabled: true,
    });
  });
});

const png = new Blob([
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
]);
describe('proyecto editable', () => {
  it('ida y vuelta: imagen y anotaciones idénticas', async () => {
    const file = await serializeProject(png, full, 10, 20);
    const parsed = parseProject(await file.text());
    expect(parsed.annotations).toEqual(full);
    expect([parsed.width, parsed.height]).toEqual([10, 20]);
    expect(new Uint8Array(await parsed.image.arrayBuffer())).toEqual(
      new Uint8Array(await png.arrayBuffer()),
    );
  });
  const base = async () =>
    JSON.parse(await (await serializeProject(png, full, 10, 20)).text());
  const code = (text: string) => {
    try {
      parseProject(text);
      return 'ok';
    } catch (e) {
      return e instanceof ProjectError ? e.code : 'other';
    }
  };
  it('rechaza archivos que no son un proyecto válido', async () => {
    expect(code('no es json')).toBe('invalid');
    expect(code('[]')).toBe('invalid');
    const b = await base();
    expect(code(JSON.stringify({ ...b, format: 'otro' }))).toBe('invalid');
    expect(code(JSON.stringify({ ...b, version: 2 }))).toBe('newer');
    expect(code(JSON.stringify({ ...b, version: 0 }))).toBe('invalid');
    expect(code(JSON.stringify({ ...b, width: 0 }))).toBe('invalid');
    expect(code(JSON.stringify({ ...b, width: 1.5 }))).toBe('invalid');
    expect(
      code(JSON.stringify({ ...b, image: 'data:text/html;base64,AAAA' })),
    ).toBe('invalid');
    expect(
      code(JSON.stringify({ ...b, image: 'data:image/png;base64,@@@' })),
    ).toBe('invalid');
    expect(
      code(JSON.stringify({ ...b, annotations: [{ type: 'script' }] })),
    ).toBe('invalid');
    expect(code(JSON.stringify({ ...b, annotations: 'x' }))).toBe('invalid');
  });
});
