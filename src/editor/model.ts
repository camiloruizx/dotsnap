export interface Point {
  x: number;
  y: number;
}
export type Tool = 'select' | 'arrow' | 'rect' | 'text' | 'redact';

export const PALETTE = [
  { id: 'red', value: '#e5484d' },
  { id: 'blue', value: '#0078d4' },
  { id: 'yellow', value: '#f5c542' },
  { id: 'green', value: '#30a46c' },
  { id: 'orange', value: '#f76b15' },
  { id: 'purple', value: '#8e4ec6' },
  { id: 'black', value: '#000000' },
  { id: 'white', value: '#ffffff' },
] as const;
export type PaletteId = (typeof PALETTE)[number]['id'];
export const isPaletteId = (value: string): value is PaletteId =>
  PALETTE.some((color) => color.id === value);
export const colorOf = (id: PaletteId): string =>
  PALETTE.find((color) => color.id === id)!.value;
export const isHexColor = (value: string): boolean =>
  /^#[0-9a-f]{6}$/i.test(value);
/** Id de la paleta con ese valor, o null si es un color personalizado. */
export const paletteIdOf = (value: string): PaletteId | null =>
  PALETTE.find((color) => color.value === value.toLowerCase())?.id ?? null;

/** Censura segura: relleno opaco fijo, sin color ni opacidad configurables. */
export const REDACT_FILL = '#000000';

interface Base {
  id: string;
}
export interface ArrowAnnotation extends Base {
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}
export interface RectAnnotation extends Base {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}
/** Fuentes del sistema (sin descargas ni fuentes web): cada una con alternativas por plataforma. */
export const FONTS = [
  { id: 'sans', stack: 'system-ui, "Segoe UI", Roboto, Arial, sans-serif' },
  { id: 'arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'trebuchet', stack: '"Trebuchet MS", Tahoma, sans-serif' },
  { id: 'serif', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'times', stack: '"Times New Roman", Times, serif' },
  { id: 'mono', stack: '"Courier New", Consolas, monospace' },
  {
    id: 'handwriting',
    stack: '"Comic Sans MS", "Segoe Print", "Bradley Hand", cursive',
  },
  { id: 'impact', stack: 'Impact, "Arial Narrow Bold", sans-serif' },
] as const;
export type FontId = (typeof FONTS)[number]['id'];
export const DEFAULT_FONT: FontId = 'sans';
export const isFontId = (value: string): value is FontId =>
  FONTS.some((font) => font.id === value);
export const fontStack = (id: FontId | undefined): string =>
  (FONTS.find((font) => font.id === id) ?? FONTS[0]).stack;
export interface TextAnnotation extends Base {
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  /** Ausente = fuente predeterminada (anotaciones anteriores). */
  fontFamily?: FontId;
}
/** 'solid' es el único modo que no deja rastro; los otros dos conservan una versión borrosa. */
export type RedactMode = 'solid' | 'pixelate' | 'blur';
export const REDACT_MODES: readonly RedactMode[] = [
  'solid',
  'pixelate',
  'blur',
];
export const isRedactMode = (value: string): value is RedactMode =>
  (REDACT_MODES as readonly string[]).includes(value);
export interface RedactAnnotation extends Base {
  type: 'redact';
  mode: RedactMode;
  x: number;
  y: number;
  width: number;
  height: number;
}
export type Annotation =
  ArrowAnnotation | RectAnnotation | TextAnnotation | RedactAnnotation;

export interface Doc {
  annotations: readonly Annotation[];
}

export type Command =
  | { kind: 'add'; item: Annotation; index: number }
  | { kind: 'remove'; item: Annotation; index: number }
  | { kind: 'update'; before: Annotation; after: Annotation };

export function applyCommand(doc: Doc, command: Command): Doc {
  switch (command.kind) {
    case 'add': {
      const list = doc.annotations.filter((a) => a.id !== command.item.id);
      const index = Math.min(Math.max(0, command.index), list.length);
      return {
        annotations: [
          ...list.slice(0, index),
          command.item,
          ...list.slice(index),
        ],
      };
    }
    case 'remove':
      return {
        annotations: doc.annotations.filter((a) => a.id !== command.item.id),
      };
    case 'update':
      return {
        annotations: doc.annotations.map((a) =>
          a.id === command.before.id ? command.after : a,
        ),
      };
  }
}

export function invertCommand(command: Command): Command {
  switch (command.kind) {
    case 'add':
      return { kind: 'remove', item: command.item, index: command.index };
    case 'remove':
      return { kind: 'add', item: command.item, index: command.index };
    case 'update':
      return { kind: 'update', before: command.after, after: command.before };
  }
}

export const addCommand = (doc: Doc, item: Annotation): Command => ({
  kind: 'add',
  item,
  index: doc.annotations.length,
});
export function removeCommand(doc: Doc, id: string): Command | undefined {
  const index = doc.annotations.findIndex((a) => a.id === id);
  const item = doc.annotations[index];
  return item ? { kind: 'remove', item, index } : undefined;
}

/** Historial por comandos: guarda diferencias, nunca copias de la imagen. */
export class History {
  private current: Doc;
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  constructor(
    initial: Doc = { annotations: [] },
    private readonly limit = 200,
  ) {
    this.current = initial;
  }
  get doc(): Doc {
    return this.current;
  }
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  execute(command: Command): void {
    this.current = applyCommand(this.current, command);
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    this.current = applyCommand(this.current, invertCommand(command));
    this.redoStack.push(command);
    return true;
  }
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    this.current = applyCommand(this.current, command);
    this.undoStack.push(command);
    return true;
  }
}

export const MIN_SHAPE = 4;
export function normalizeRect(a: Point, b: Point) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
export const isMeaningfulRect = (r: { width: number; height: number }) =>
  r.width >= MIN_SHAPE && r.height >= MIN_SHAPE;
export const isMeaningfulArrow = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y) >= MIN_SHAPE * 2;
export function clampPoint(p: Point, width: number, height: number): Point {
  return {
    x: Math.min(width, Math.max(0, p.x)),
    y: Math.min(height, Math.max(0, p.y)),
  };
}

/** Grosor y tamaño de texto proporcionales al ancho real del bitmap (DPR 1 → 2 mantiene el aspecto). */
export function defaultSizes(imageWidth: number) {
  return {
    strokeWidth: Math.max(3, Math.round(imageWidth / 320)),
    fontSize: Math.max(16, Math.round(imageWidth / 45)),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Nombre de descarga: solo caracteres seguros, sin rutas ni datos de la página. */
export function buildFileName(prefix: string, date: Date): string {
  const safe =
    prefix
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 24) || 'captura';
  return `${safe}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
}
