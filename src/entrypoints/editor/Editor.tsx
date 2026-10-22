import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import { product } from '../../shared/config/product';
import { withinBudget } from '../../shared/capture/errors';
import {
  deleteCapture,
  getRecord,
  isCaptureId,
  saveAnnotations,
} from '../../shared/storage/captures';
import { serializeProject } from '../../shared/export/project';
import { Brand } from '../../shared/ui/Brand';
import { useToast } from '../../shared/ui/Toast';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { ColorCombo } from './ColorCombo';
import { ExportPanel } from './ExportPanel';
import type { ExportResult } from '../../shared/export/encode';
import {
  DEFAULT_FONT,
  FONTS,
  fontStack,
  isFontId,
  parseAnnotations,
  type FontId,
} from '../../editor/model';
import { EditorCanvas } from '../../editor/EditorCanvas';
import {
  History,
  PALETTE,
  buildFileName,
  REDACT_MODES,
  isRedactMode,
  type PaletteId,
  type RedactMode,
  type Tool,
} from '../../editor/model';

type Load =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'tooLarge' }
  | { kind: 'discarded' }
  | { kind: 'ready'; bitmap: ImageBitmap };

type ToolItem = { id: Tool; label: MessageKey; icon: IconName };
const toolGroups: { label: MessageKey; items: ToolItem[] }[] = [
  {
    label: 'groupSelect',
    items: [{ id: 'select', label: 'toolSelect', icon: 'select' }],
  },
  {
    label: 'groupShapes',
    items: [
      { id: 'arrow', label: 'toolArrow', icon: 'arrow' },
      { id: 'line', label: 'toolLine', icon: 'line' },
      { id: 'rect', label: 'toolRect', icon: 'rect' },
      { id: 'ellipse', label: 'toolEllipse', icon: 'ellipse' },
    ],
  },
  {
    label: 'groupMarks',
    items: [
      { id: 'highlight', label: 'toolHighlight', icon: 'highlight' },
      { id: 'step', label: 'toolStep', icon: 'step' },
      { id: 'text', label: 'toolText', icon: 'text' },
    ],
  },
  {
    label: 'groupPrivacy',
    items: [{ id: 'redact', label: 'toolRedact', icon: 'redact' }],
  },
];
const redactLabel: Record<RedactMode, MessageKey> = {
  solid: 'redactSolid',
  pixelate: 'redactPixelate',
  blur: 'redactBlur',
};
const fontLabel: Record<FontId, MessageKey> = {
  sans: 'fontSans',
  arial: 'fontArial',
  verdana: 'fontVerdana',
  trebuchet: 'fontTrebuchet',
  serif: 'fontSerif',
  times: 'fontTimes',
  mono: 'fontMono',
  handwriting: 'fontHandwriting',
  impact: 'fontImpact',
};
const colorLabel: Record<PaletteId, MessageKey> = {
  red: 'colorRed',
  blue: 'colorBlue',
  yellow: 'colorYellow',
  green: 'colorGreen',
  black: 'colorBlack',
  white: 'colorWhite',
  orange: 'colorOrange',
  purple: 'colorPurple',
};

/** `part` y `parts` solo se aceptan como enteros pequeños y coherentes; si no, se ignoran. */
function readPart(search: string): { part: number; parts: number } | null {
  const params = new URLSearchParams(search);
  const part = Number(params.get('part'));
  const parts = Number(params.get('parts'));
  return Number.isInteger(part) &&
    Number.isInteger(parts) &&
    parts >= 2 &&
    parts <= 12 &&
    part >= 1 &&
    part <= parts
    ? { part, parts }
    : null;
}

export function Editor() {
  const { t, preferences } = usePreferences();
  const partInfo = readPart(location.search);
  const colorNames = Object.fromEntries(
    PALETTE.map((item) => [item.id, t(colorLabel[item.id])]),
  ) as Record<PaletteId, string>;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<string>(PALETTE[0].value);
  const [redactMode, setRedactMode] = useState<RedactMode>('solid');
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [font, setFont] = useState<FontId>(DEFAULT_FONT);
  const [selectedFont, setSelectedFont] = useState<FontId | null>(null);
  const toast = useToast();
  /** Todo aviso al usuario sale como toast; el de exportación reemplaza al «Generando…». */
  const setStatus = (value: { key: MessageKey; extra?: string }) =>
    toast(
      `${t(value.key)}${value.extra ? ` ${value.extra}` : ''}`,
      /Error/.test(value.key)
        ? 'error'
        : value.key === 'exporting'
          ? 'info'
          : 'success',
      { id: /^export/.test(value.key) ? 'export' : value.key },
    );
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<EditorCanvas | null>(null);
  const idRef = useRef<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef(false);
  const [history] = useState(() => new History());
  const preferencesRef = useRef(preferences);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    document.title = `${product.name} · ${t('editorTitle')}`;
  }, [t]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(location.search);
    const id = params.get('capture');
    idRef.current = isCaptureId(id) ? id : null;
    void (async () => {
      try {
        if (!isCaptureId(id)) throw new Error('missing');
        const record = await getRecord(id);
        if (!record) throw new Error('missing');
        const blob = record.blob;
        blobRef.current = blob;
        // El historial no se guarda en incógnito ni si el usuario lo desactivó.
        persistRef.current =
          preferencesRef.current.historyEnabled &&
          !chrome.extension.inIncognitoContext;
        const saved = parseAnnotations(record.annotations ?? []);
        if (saved) history.load({ annotations: saved });
        const bitmap = await createImageBitmap(blob);
        if (!alive) return void bitmap.close();
        if (!withinBudget(bitmap.width, bitmap.height)) {
          bitmap.close();
          setLoad({ kind: 'tooLarge' });
        } else setLoad({ kind: 'ready', bitmap });
      } catch {
        if (alive) setLoad({ kind: 'missing' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [history]);

  const ready = load.kind === 'ready' ? load.bitmap : null;
  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    host.dataset.textLabel = t('textFieldLabel');
    const canvas = new EditorCanvas(host, ready, history, {
      onChange: () => {
        setTick((value) => value + 1);
        if (persistRef.current && idRef.current) {
          const id = idRef.current;
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            void saveAnnotations(id, history.doc.annotations).catch(() => {});
          }, 600);
        }
        setSelectedFont(canvasRef.current?.selectedTextFont ?? null);
      },
      onSelection: (id) => {
        setSelected(id);
        setSelectedFont(canvasRef.current?.selectedTextFont ?? null);
      },
    });
    canvasRef.current = canvas;
    return () => {
      canvas.destroy();
      canvasRef.current = null;
    };
    // El idioma solo afecta a la etiqueta del campo de texto, que se lee al abrirlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, history]);

  useEffect(() => {
    canvasRef.current?.setTool(tool);
  }, [tool, ready]);
  useEffect(() => {
    canvasRef.current?.setRedactMode(redactMode);
  }, [redactMode, ready]);
  useEffect(() => {
    canvasRef.current?.setColor(color);
  }, [color, ready]);
  useEffect(() => {
    canvasRef.current?.setFont(font);
  }, [font, ready]);

  void tick;

  const onKey = useCallback((event: KeyboardEvent) => {
    const canvas = canvasRef.current;
    const target = event.target as HTMLElement | null;
    if (
      !canvas ||
      target?.tagName === 'TEXTAREA' ||
      target?.tagName === 'INPUT' ||
      target?.closest?.('dialog')
    )
      return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) canvas.redo();
      else canvas.undo();
    } else if (mod && key === 'y') {
      event.preventDefault();
      canvas.redo();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if ((event.target as HTMLElement)?.tagName === 'SELECT') return;
      event.preventDefault();
      canvas.deleteSelected();
    } else if (event.key === 'Escape') {
      if (!canvas.cancel()) setTool('select');
    }
  }, []);
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (history.canUndo) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [history]);

  const getFlat = useCallback(
    () => canvasRef.current?.exportCanvas() ?? null,
    [],
  );
  function saveResult(result: ExportResult) {
    const name = buildFileName(
      product.name,
      new Date(),
      result.extension,
      preferences.fileNameTemplate,
    );
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({
      key: 'exported',
      extra: `${name} · ${result.width} × ${result.height} px · ${(result.blob.size / 1024).toFixed(0)} KB`,
    });
  }
  async function saveProject() {
    const blob = blobRef.current;
    const canvas = canvasRef.current;
    if (!blob || !canvas) return;
    try {
      const project = await serializeProject(
        blob,
        history.doc.annotations,
        canvas.width,
        canvas.height,
      );
      const name = buildFileName(
        product.name,
        new Date(),
        'dotsnap.json',
        preferences.fileNameTemplate,
      );
      const url = URL.createObjectURL(project);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ key: 'projectSaved', extra: name });
    } catch {
      setStatus({ key: 'exportError' });
    }
  }
  async function copyCurrent() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await copyPng(await canvas.exportPng());
    } catch {
      setStatus({ key: 'exportCopyError' });
    }
  }
  async function copyPng(png: Blob) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': png }),
      ]);
      setStatus({ key: 'exportCopied' });
    } catch {
      setStatus({ key: 'exportCopyError' });
    }
  }

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    setExporting(true);
    setStatus({ key: 'exporting' });
    try {
      const blob = await canvas.exportPng(true);
      const name = buildFileName(
        product.name,
        new Date(),
        'png',
        preferences.fileNameTemplate,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({
        key: 'exported',
        extra: `${name} · ${canvas.width} × ${canvas.height} px · ${(blob.size / 1024).toFixed(0)} KB`,
      });
    } catch {
      setStatus({ key: 'exportError' });
    } finally {
      setExporting(false);
    }
  }

  async function discard() {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    canvasRef.current?.destroy();
    canvasRef.current = null;
    if (idRef.current) await deleteCapture(idRef.current).catch(() => {});
    ready?.close();
    // Cierra esta pestaña; si el navegador no lo permite, queda el aviso de descartada.
    try {
      const current = await chrome.tabs.getCurrent();
      if (current?.id !== undefined) {
        await chrome.tabs.remove(current.id);
        return;
      }
    } catch {
      /* se muestra el aviso */
    }
    setLoad({ kind: 'discarded' });
  }

  if (load.kind !== 'ready')
    return (
      <div className="shell options-shell">
        <Brand />
        <main>
          <h1>
            {t(
              load.kind === 'loading'
                ? 'loading'
                : load.kind === 'discarded'
                  ? 'discarded'
                  : load.kind === 'tooLarge'
                    ? 'errorTooLarge'
                    : 'editorMissing',
            )}
          </h1>
          {load.kind !== 'loading' && (
            <p className="hint intro" role="status">
              {t(
                load.kind === 'discarded'
                  ? 'discardedHint'
                  : load.kind === 'tooLarge'
                    ? 'errorTooLargeHint'
                    : 'editorMissingHint',
              )}
            </p>
          )}
        </main>
      </div>
    );

  return (
    <div className="editor-shell">
      <header className="editor-bar">
        <div
          role="toolbar"
          aria-label={t('toolbarLabel')}
          className="bar-tools"
        >
          {toolGroups.map((group) => (
            <div
              key={group.label}
              role="group"
              aria-label={t(group.label)}
              className="btn-group"
            >
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className="icon-only"
                  aria-pressed={tool === item.id}
                  aria-label={t(item.label)}
                  title={t(item.label)}
                  onClick={() => setTool(item.id)}
                >
                  <Icon name={item.icon} />
                </button>
              ))}
            </div>
          ))}
        </div>
        <div
          role="group"
          aria-label={t('groupOptions')}
          className="tool-options"
        >
          <ColorCombo
            label={t('color')}
            customLabel={t('colorCustom')}
            pickLabel={t('colorPick')}
            names={colorNames}
            value={color}
            disabled={tool === 'redact'}
            onChange={setColor}
          />
          {tool === 'text' || selectedFont !== null ? (
            <label className="inline-field">
              <span>{t('font')}</span>
              <select
                value={selectedFont ?? font}
                style={{ fontFamily: fontStack(selectedFont ?? font) }}
                onChange={(event) => {
                  if (!isFontId(event.target.value)) return;
                  setFont(event.target.value);
                  canvasRef.current?.setFont(event.target.value);
                }}
              >
                {FONTS.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                    style={{ fontFamily: item.stack }}
                  >
                    {t(fontLabel[item.id])}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {tool === 'redact' ? (
            <label className="inline-field">
              <span>{t('redactStyle')}</span>
              <select
                value={redactMode}
                onChange={(event) => {
                  if (isRedactMode(event.target.value))
                    setRedactMode(event.target.value);
                }}
              >
                {REDACT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {t(redactLabel[mode])}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="bar-end">
          <div role="group" aria-label={t('groupEdit')} className="btn-group">
            <button
              className="icon-only"
              aria-label={t('undo')}
              title={`${t('undo')} (Ctrl+Z)`}
              disabled={!history.canUndo}
              onClick={() => canvasRef.current?.undo()}
            >
              <Icon name="undo" />
            </button>
            <button
              className="icon-only"
              aria-label={t('redo')}
              title={`${t('redo')} (Ctrl+Y)`}
              disabled={!history.canRedo}
              onClick={() => canvasRef.current?.redo()}
            >
              <Icon name="redo" />
            </button>
          </div>
          <div
            role="group"
            aria-label={t('groupOutput')}
            className="bar-actions"
          >
            <button
              className="icon-only"
              aria-label={t('copyQuick')}
              title={t('copyQuick')}
              disabled={exporting || typeof ClipboardItem === 'undefined'}
              onClick={() => void copyCurrent()}
            >
              <Icon name="copy" />
            </button>
            <button
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((open) => !open)}
            >
              <span>{t('exportOpen')}…</span>
            </button>
            <button
              className="primary"
              disabled={exporting}
              onClick={() => void download()}
            >
              <Icon name="download" />
              <span>{t('downloadPng')}</span>
            </button>
          </div>
          <div
            role="group"
            aria-label={t('groupDanger')}
            className="bar-actions"
          >
            <button
              className="danger icon-only"
              aria-label={t('deleteItem')}
              title={`${t('deleteItem')} (Del)`}
              disabled={!selected}
              onClick={() => canvasRef.current?.deleteSelected()}
            >
              <Icon name="trash" />
            </button>
            <button
              className="danger"
              title={t('discardHint')}
              onClick={() => void discard()}
              onBlur={() => setConfirmDiscard(false)}
            >
              <span>{t(confirmDiscard ? 'discardConfirm' : 'discard')}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="editor-main">
        {exportOpen ? (
          <ExportPanel
            getFlat={getFlat}
            version={history}
            sourceWidth={load.bitmap.width}
            sourceHeight={load.bitmap.height}
            onDownload={saveResult}
            onCopy={(png) => void copyPng(png)}
            onClose={() => setExportOpen(false)}
            onSaveProject={() => void saveProject()}
            hasRedaction={history.doc.annotations.some(
              (a) => a.type === 'redact',
            )}
          />
        ) : null}
        <div className="canvas-frame">
          <div
            ref={hostRef}
            className="canvas-host"
            role="img"
            aria-label={t('canvasLabel')}
          />
        </div>
      </main>
      <footer className="editor-status">
        <span>
          {load.bitmap.width} × {load.bitmap.height} px
          {partInfo
            ? ` · ${t('partOf')
                .replace('{n}', String(partInfo.part))
                .replace('{total}', String(partInfo.parts))}`
            : ''}
        </span>
      </footer>
    </div>
  );
}
