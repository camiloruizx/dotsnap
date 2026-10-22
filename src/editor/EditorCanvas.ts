import Konva from 'konva';
import {
  History,
  addCommand,
  clampPoint,
  DEFAULT_FONT,
  defaultSizes,
  fontStack,
  isMeaningfulArrow,
  isMeaningfulRect,
  normalizeRect,
  removeCommand,
  type Annotation,
  type FontId,
  type Point,
  type RedactMode,
  type Tool,
} from './model';
import { createNode } from './nodes';
import { optimizePng } from '../shared/export/png';

/** Colores de la interfaz de selección; nunca se exportan (la exportación usa otro stage). */
const SELECTION = '#3794ff';

export interface CanvasEvents {
  onChange(): void;
  onSelection(id: string | null): void;
}

export class EditorCanvas {
  readonly width: number;
  readonly height: number;
  private readonly stage: Konva.Stage;
  private readonly layer = new Konva.Layer();
  private readonly uiLayer = new Konva.Layer();
  private readonly transformer = new Konva.Transformer({
    rotateEnabled: false,
    flipEnabled: false,
    borderStroke: SELECTION,
    anchorStroke: SELECTION,
    anchorFill: '#ffffff',
    anchorSize: 9,
  });
  private handles: Konva.Circle[] = [];
  private tool: Tool = 'select';
  private colorValue = '#e5484d';
  private fontValue: FontId = DEFAULT_FONT;
  private redactMode: RedactMode = 'solid';
  private selectedId: string | null = null;
  private stepPoint: Point | null = null;
  private draft: { start: Point; node: Konva.Shape | Konva.Group } | null =
    null;
  private textarea: HTMLTextAreaElement | null = null;
  private textPoint: Point | null = null;
  private scale = 1;
  private readonly sizes: { strokeWidth: number; fontSize: number };
  private readonly observer: ResizeObserver;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly bitmap: ImageBitmap,
    readonly history: History,
    private readonly events: CanvasEvents,
  ) {
    this.width = bitmap.width;
    this.height = bitmap.height;
    this.sizes = defaultSizes(this.width);
    this.scale = this.fitScale();
    this.stage = new Konva.Stage({
      container,
      width: Math.round(this.width * this.scale),
      height: Math.round(this.height * this.scale),
    });
    this.stage.scale({ x: this.scale, y: this.scale });
    const imageLayer = new Konva.Layer({ listening: false });
    imageLayer.add(
      new Konva.Image({
        image: bitmap,
        width: this.width,
        height: this.height,
      }),
    );
    this.uiLayer.add(this.transformer);
    this.stage.add(imageLayer, this.layer, this.uiLayer);
    this.stage.on('mousedown touchstart', () => this.pointerDown());
    this.stage.on('mousemove touchmove', () => this.pointerMove());
    this.stage.on('mouseup touchend', () => this.pointerUp(true));
    this.stage.on('mouseleave', () => this.pointerUp(false));
    this.transformer.on('transformend', () => this.transformEnd());
    this.stage.container().addEventListener('dblclick', this.onDoubleClick);
    // Se difiere a un frame: cambiar el tamaño dentro del callback re-dispara el observer
    // ("ResizeObserver loop completed with undelivered notifications").
    this.observer = new ResizeObserver(() => this.scheduleRefit());
    this.observer.observe(container.parentElement ?? container);
    this.sync();
  }

  /** Doble clic del DOM: Konva no lo emite de forma fiable con el transformador encima. */
  private readonly onDoubleClick = (event: MouseEvent): void => {
    if (this.tool !== 'select') return;
    this.stage.setPointersPositions(event);
    const position = this.stage.getPointerPosition();
    const shape = position ? this.stage.getIntersection(position) : null;
    // Con el transformador activo, el objeto bajo el cursor es el propio marco: se usa la selección.
    const id =
      shape?.getParent() === this.transformer ? this.selectedId : shape?.id();
    const target = id ? this.find(id) : undefined;
    if (target?.type === 'text') this.editText(target.id);
  };

  // --- estado público ---------------------------------------------------
  setTool(tool: Tool): void {
    this.cancelTransient();
    this.tool = tool;
    if (tool !== 'select') this.select(null);
    this.stage.container().style.cursor =
      tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
    this.sync();
  }
  setRedactMode(mode: RedactMode): void {
    this.redactMode = mode;
  }
  setColor(value: string): void {
    this.colorValue = value;
  }
  /** Fuente para el texto nuevo; si hay un texto seleccionado, también se la aplica. */
  setFont(value: FontId): void {
    this.fontValue = value;
    const target = this.selectedId ? this.find(this.selectedId) : undefined;
    if (
      target?.type !== 'text' ||
      (target.fontFamily ?? DEFAULT_FONT) === value
    )
      return;
    this.history.execute({
      kind: 'update',
      before: target,
      after: { ...target, fontFamily: value },
    });
    this.changed();
  }
  get selectedTextFont(): FontId | null {
    const target = this.selectedId ? this.find(this.selectedId) : undefined;
    return target?.type === 'text' ? (target.fontFamily ?? DEFAULT_FONT) : null;
  }
  get selection(): string | null {
    return this.selectedId;
  }
  undo(): void {
    this.cancelTransient();
    if (this.history.undo()) this.changed();
  }
  redo(): void {
    this.cancelTransient();
    if (this.history.redo()) this.changed();
  }
  deleteSelected(): void {
    if (!this.selectedId) return;
    const command = removeCommand(this.history.doc, this.selectedId);
    if (!command) return;
    this.history.execute(command);
    this.select(null);
    this.changed();
  }
  /** Escape: cancela lo que esté en curso; devuelve true si había algo que cancelar. */
  cancel(): boolean {
    const busy = this.draft !== null || this.textarea !== null;
    this.cancelTransient();
    if (!busy && this.selectedId) {
      this.select(null);
      return true;
    }
    return busy;
  }
  destroy(): void {
    this.cancelTransient();
    this.observer.disconnect();
    if (this.refitFrame) cancelAnimationFrame(this.refitFrame);
    this.stage.container().removeEventListener('dblclick', this.onDoubleClick);
    this.stage.destroy();
  }

  /**
   * Exporta a PNG a tamaño nativo con un stage aparte: sin selección, asas ni
   * transformador. Las censuras se dibujan opacas sobre los píxeles originales, por lo que
   * el PNG resultante no contiene los píxeles ocultos.
   */
  async exportPng(optimize = false): Promise<Blob> {
    const canvas = await this.exportCanvas();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob || blob.type !== 'image/png') throw new Error('export');
    return optimize ? optimizePng(canvas, blob) : blob;
  }

  /** Lienzo aplanado a tamaño nativo (sin selección ni asas), base de todos los formatos. */
  async exportCanvas(): Promise<HTMLCanvasElement> {
    const host = document.createElement('div');
    const stage = new Konva.Stage({
      container: host,
      width: this.width,
      height: this.height,
    });
    try {
      const layer = new Konva.Layer();
      layer.add(
        new Konva.Image({
          image: this.bitmap,
          width: this.width,
          height: this.height,
        }),
      );
      for (const a of this.history.doc.annotations)
        layer.add(createNode(a, this.bitmap));
      stage.add(layer);
      layer.draw();
      return stage.toCanvas({ pixelRatio: 1 }) as HTMLCanvasElement;
    } finally {
      stage.destroy();
    }
  }

  // --- internos ---------------------------------------------------------
  private fitScale(): number {
    const available = (this.container.parentElement ?? this.container)
      .clientWidth;
    return available > 0 ? Math.min(1, available / this.width) : 1;
  }
  private refitFrame = 0;
  private scheduleRefit(): void {
    if (this.refitFrame) return;
    this.refitFrame = requestAnimationFrame(() => {
      this.refitFrame = 0;
      this.refit();
    });
  }
  private refit(): void {
    const next = this.fitScale();
    if (Math.abs(next - this.scale) < 0.001) return;
    this.cancelTransient();
    this.scale = next;
    this.stage.size({
      width: Math.round(this.width * next),
      height: Math.round(this.height * next),
    });
    this.stage.scale({ x: next, y: next });
    this.sync();
  }
  private changed(): void {
    if (this.selectedId && !this.find(this.selectedId)) this.selectedId = null;
    this.sync();
    this.events.onChange();
    this.events.onSelection(this.selectedId);
  }
  private find(id: string): Annotation | undefined {
    return this.history.doc.annotations.find((a) => a.id === id);
  }
  private select(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    // Sin reconstruir los nodos: hacerlo en mousedown cancelaría el arrastre que empieza.
    this.refreshSelectionUi();
    this.events.onSelection(id);
  }
  private pointer(): Point | null {
    const p = this.layer.getRelativePointerPosition();
    return p ? clampPoint(p, this.width, this.height) : null;
  }
  private cancelTransient(): void {
    this.textPoint = null;
    this.stepPoint = null;
    this.draft?.node.destroy();
    this.draft = null;
    this.closeTextarea();
  }

  private sync(): void {
    this.layer.destroyChildren();
    for (const a of this.history.doc.annotations) {
      const shape = createNode(a, this.bitmap);
      const node: Konva.Node = shape;
      node.draggable(this.tool === 'select');
      node.on('mousedown touchstart', (event) => {
        if (this.tool !== 'select') return;
        event.cancelBubble = true;
        this.select(a.id);
      });
      node.on('dragend', () => this.dragEnd(a.id, node));
      this.layer.add(shape);
    }
    this.refreshSelectionUi();
    // draw() y no batchDraw(): el lienzo de detección de clics debe estar al día antes del siguiente evento.
    this.layer.draw();
  }

  private refreshSelectionUi(): void {
    for (const handle of this.handles) handle.destroy();
    this.handles = [];
    const selected = this.selectedId ? this.find(this.selectedId) : undefined;
    const node = selected
      ? (this.layer.findOne(`#${selected.id}`) ?? null)
      : null;
    if (!selected || !node || this.tool !== 'select') {
      this.transformer.nodes([]);
    } else if (selected.type === 'arrow' || selected.type === 'line') {
      this.transformer.nodes([]);
      const radius = 7 / this.scale;
      const ends: [Point, 'start' | 'end'][] = [
        [{ x: selected.x1, y: selected.y1 }, 'start'],
        [{ x: selected.x2, y: selected.y2 }, 'end'],
      ];
      for (const [point, which] of ends) {
        const handle = new Konva.Circle({
          x: point.x,
          y: point.y,
          radius,
          fill: '#ffffff',
          stroke: SELECTION,
          strokeWidth: 2 / this.scale,
          draggable: true,
        });
        handle.on('dragmove', () =>
          this.moveHandle(selected.id, node, which, handle),
        );
        handle.on('dragend', () => this.commitHandle(selected.id, node));
        this.uiLayer.add(handle);
        this.handles.push(handle);
      }
    } else {
      this.transformer.nodes([node]);
      const keep = selected.type === 'text' || selected.type === 'step';
      this.transformer.keepRatio(keep);
      this.transformer.enabledAnchors(
        keep
          ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
          : undefined,
      );
    }
    this.uiLayer.batchDraw();
  }

  private moveHandle(
    id: string,
    node: Konva.Node,
    which: 'start' | 'end',
    handle: Konva.Circle,
  ): void {
    const arrow = node as Konva.Line;
    const p = clampPoint(handle.position(), this.width, this.height);
    handle.position(p);
    const points = [...arrow.points()];
    if (which === 'start') [points[0], points[1]] = [p.x, p.y];
    else [points[2], points[3]] = [p.x, p.y];
    arrow.points(points);
    this.layer.batchDraw();
    void id;
  }
  private commitHandle(id: string, node: Konva.Node): void {
    const before = this.find(id);
    if (before?.type !== 'arrow' && before?.type !== 'line') return;
    const [x1, y1, x2, y2] = (node as Konva.Line).points() as [
      number,
      number,
      number,
      number,
    ];
    if (!isMeaningfulArrow({ x: x1, y: y1 }, { x: x2, y: y2 })) {
      this.sync();
      return;
    }
    this.history.execute({
      kind: 'update',
      before,
      after: { ...before, x1, y1, x2, y2 },
    });
    this.changed();
  }

  private dragEnd(id: string, node: Konva.Node): void {
    const before = this.find(id);
    if (!before) return;
    const dx = node.x();
    const dy = node.y();
    let after: Annotation;
    if (before.type === 'arrow' || before.type === 'line')
      after = {
        ...before,
        x1: before.x1 + dx,
        y1: before.y1 + dy,
        x2: before.x2 + dx,
        y2: before.y2 + dy,
      };
    else if (before.type === 'ellipse')
      after = {
        ...before,
        x: node.x() - before.width / 2,
        y: node.y() - before.height / 2,
      };
    else after = { ...before, x: node.x(), y: node.y() };
    this.history.execute({ kind: 'update', before, after });
    this.changed();
  }

  private transformEnd(): void {
    const node = this.transformer.nodes()[0];
    const before = this.selectedId ? this.find(this.selectedId) : undefined;
    if (!node || !before || before.type === 'arrow' || before.type === 'line')
      return;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scale({ x: 1, y: 1 });
    let after: Annotation;
    if (before.type === 'text')
      after = {
        ...before,
        x: node.x(),
        y: node.y(),
        fontSize: Math.max(8, Math.round(before.fontSize * sy)),
      };
    else if (before.type === 'step')
      after = {
        ...before,
        x: node.x(),
        y: node.y(),
        radius: Math.min(500, Math.max(6, Math.round(before.radius * sx))),
      };
    else if (before.type === 'ellipse') {
      const width = Math.max(4, node.width() * sx);
      const height = Math.max(4, node.height() * sy);
      after = {
        ...before,
        x: node.x() - width / 2,
        y: node.y() - height / 2,
        width,
        height,
      };
    } else
      after = {
        ...before,
        x: node.x(),
        y: node.y(),
        width: Math.max(4, node.width() * sx),
        height: Math.max(4, node.height() * sy),
      };
    this.history.execute({ kind: 'update', before, after });
    this.changed();
  }

  // --- dibujo -----------------------------------------------------------
  private pointerDown(): void {
    if (this.textarea) return;
    const start = this.pointer();
    if (!start) return;
    if (this.tool === 'select') {
      if (this.stage.getPointerPosition() && this.hitEmpty()) this.select(null);
      return;
    }
    if (this.tool === 'step') {
      this.stepPoint = start;
      return;
    }
    if (this.tool === 'text') {
      // El campo se abre al soltar: el foco por defecto del clic ocurre tras mousedown y lo cerraría.
      this.textPoint = start;
      return;
    }
    this.draft = { start, node: this.preview(start, start) };
    this.layer.add(this.draft.node);
  }
  private hitEmpty(): boolean {
    const pos = this.stage.getPointerPosition();
    return !pos || !this.stage.getIntersection(pos);
  }
  private pointerMove(): void {
    if (!this.draft) return;
    const end = this.pointer();
    if (!end) return;
    this.draft.node.destroy();
    this.draft.node = this.preview(this.draft.start, end);
    this.layer.add(this.draft.node);
    this.layer.batchDraw();
  }
  private pointerUp(released: boolean): void {
    if (this.stepPoint) {
      const at = this.stepPoint;
      this.stepPoint = null;
      if (released) this.addStep(at);
      return;
    }
    if (this.textPoint) {
      const at = this.textPoint;
      this.textPoint = null;
      if (released) this.editText(null, at);
      return;
    }
    if (!this.draft) return;
    const { start, node } = this.draft;
    const end = this.pointer() ?? start;
    node.destroy();
    this.draft = null;
    const item = this.build(start, end, crypto.randomUUID());
    if (item) {
      this.history.execute(addCommand(this.history.doc, item));
      this.changed();
    } else this.layer.batchDraw();
  }
  private addStep(at: Point): void {
    const next =
      this.history.doc.annotations.reduce(
        (max, a) => (a.type === 'step' ? Math.max(max, a.number) : max),
        0,
      ) + 1;
    if (next > 999) return;
    this.history.execute(
      addCommand(this.history.doc, {
        id: crypto.randomUUID(),
        type: 'step',
        x: at.x,
        y: at.y,
        number: next,
        radius: Math.round(Math.max(12, this.sizes.strokeWidth * 4.5)),
        color: this.colorValue,
      }),
    );
    this.changed();
  }
  private preview(a: Point, b: Point): Konva.Shape | Konva.Group {
    const node = createNode(
      this.build(a, b, 'preview', true) ?? this.stub(a),
      this.bitmap,
    );
    node.listening(false);
    return node;
  }
  private stub(a: Point): Annotation {
    return {
      id: 'preview',
      type: 'redact',
      mode: 'solid',
      x: a.x,
      y: a.y,
      width: 0,
      height: 0,
    };
  }
  private build(
    a: Point,
    b: Point,
    id: string,
    preview = false,
  ): Annotation | null {
    const color = this.colorValue;
    const { strokeWidth } = this.sizes;
    if (this.tool === 'arrow' || this.tool === 'line')
      return preview || isMeaningfulArrow(a, b)
        ? {
            id,
            type: this.tool,
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            color,
            strokeWidth,
          }
        : null;
    const r = normalizeRect(a, b);
    if (!preview && !isMeaningfulRect(r)) return null;
    if (this.tool === 'rect' || this.tool === 'ellipse')
      return { id, type: this.tool, ...r, color, strokeWidth };
    if (this.tool === 'highlight')
      return { id, type: 'highlight', ...r, color };
    if (this.tool === 'redact')
      return { id, type: 'redact', mode: this.redactMode, ...r };
    return null;
  }

  // --- texto ------------------------------------------------------------
  private editText(existingId: string | null, at?: Point): void {
    this.closeTextarea();
    const existing = existingId ? this.find(existingId) : undefined;
    if (existingId && existing?.type !== 'text') return;
    const origin =
      existing?.type === 'text' ? { x: existing.x, y: existing.y } : at;
    if (!origin) return;
    const fontSize =
      existing?.type === 'text' ? existing.fontSize : this.sizes.fontSize;
    const color = existing?.type === 'text' ? existing.color : this.colorValue;
    const font =
      existing?.type === 'text'
        ? (existing.fontFamily ?? DEFAULT_FONT)
        : this.fontValue;
    if (existingId) this.layer.findOne(`#${existingId}`)?.hide();
    this.layer.batchDraw();
    const area = document.createElement('textarea');
    area.className = 'text-editor';
    area.value = existing?.type === 'text' ? existing.text : '';
    area.setAttribute(
      'aria-label',
      this.container.dataset.textLabel ?? 'Texto',
    );
    area.style.left = `${origin.x * this.scale}px`;
    area.style.top = `${origin.y * this.scale}px`;
    area.style.fontSize = `${fontSize * this.scale}px`;
    area.style.color = color;
    area.style.fontFamily = fontStack(font);
    this.container.appendChild(area);
    this.textarea = area;
    area.focus();
    area.select();
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      const value = area.value.replace(/\s+$/g, '');
      this.closeTextarea();
      if (existingId) this.layer.findOne(`#${existingId}`)?.show();
      if (commit)
        this.commitText(existing, origin, value, fontSize, color, font);
      else this.layer.batchDraw();
    };
    area.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') finish(false);
      else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        finish(true);
      }
    });
    area.addEventListener('blur', () => finish(true));
  }
  private closeTextarea(): void {
    const area = this.textarea;
    this.textarea = null;
    if (area?.isConnected) area.remove();
  }
  private commitText(
    existing: Annotation | undefined,
    origin: Point,
    value: string,
    fontSize: number,
    color: string,
    font: FontId,
  ): void {
    if (existing?.type === 'text') {
      if (value === '') {
        const command = removeCommand(this.history.doc, existing.id);
        if (command) this.history.execute(command);
      } else if (value !== existing.text)
        this.history.execute({
          kind: 'update',
          before: existing,
          after: { ...existing, text: value },
        });
      else return this.sync();
      this.changed();
      return;
    }
    if (value === '') return this.sync();
    this.history.execute(
      addCommand(this.history.doc, {
        id: crypto.randomUUID(),
        type: 'text',
        x: origin.x,
        y: origin.y,
        text: value,
        color,
        fontSize,
        fontFamily: font,
      }),
    );
    this.changed();
  }
}
