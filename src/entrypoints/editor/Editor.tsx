import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import { product } from '../../shared/config/product';
import { withinBudget } from '../../shared/capture/errors';
import {
  deleteCapture,
  getCapture,
  isCaptureId,
} from '../../shared/storage/captures';
import { Brand } from '../../shared/ui/Brand';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { EditorCanvas } from '../../editor/EditorCanvas';
import {
  History,
  PALETTE,
  buildFileName,
  isHexColor,
  paletteIdOf,
  type PaletteId,
  type Tool,
} from '../../editor/model';

type Load =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'tooLarge' }
  | { kind: 'discarded' }
  | { kind: 'ready'; bitmap: ImageBitmap };

const tools: { id: Tool; label: MessageKey; icon: IconName }[] = [
  { id: 'select', label: 'toolSelect', icon: 'select' },
  { id: 'arrow', label: 'toolArrow', icon: 'arrow' },
  { id: 'rect', label: 'toolRect', icon: 'rect' },
  { id: 'text', label: 'toolText', icon: 'text' },
  { id: 'redact', label: 'toolRedact', icon: 'redact' },
];
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

export function Editor() {
  const { t } = usePreferences();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<string>(PALETTE[0].value);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    key: MessageKey;
    extra?: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<EditorCanvas | null>(null);
  const idRef = useRef<string | null>(null);
  const [history] = useState(() => new History());

  useEffect(() => {
    document.title = `${product.name} · ${t('editorTitle')}`;
  }, [t]);

  useEffect(() => {
    let alive = true;
    const id = new URLSearchParams(location.search).get('capture');
    idRef.current = isCaptureId(id) ? id : null;
    void (async () => {
      try {
        if (!isCaptureId(id)) throw new Error('missing');
        const blob = await getCapture(id);
        if (!blob) throw new Error('missing');
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
  }, []);

  const ready = load.kind === 'ready' ? load.bitmap : null;
  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    host.dataset.textLabel = t('textFieldLabel');
    const canvas = new EditorCanvas(host, ready, history, {
      onChange: () => setTick((value) => value + 1),
      onSelection: setSelected,
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
    canvasRef.current?.setColor(color);
  }, [color, ready]);

  void tick;
  const currentId = paletteIdOf(color);

  const onKey = useCallback((event: KeyboardEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || (event.target as HTMLElement)?.tagName === 'TEXTAREA')
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

  async function download() {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    setExporting(true);
    setStatus({ key: 'exporting' });
    try {
      const blob = await canvas.exportPng();
      const name = buildFileName(product.name, new Date());
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
        <div role="toolbar" aria-label={t('toolbarLabel')} className="tool-row">
          {tools.map((item) => (
            <button
              key={item.id}
              aria-pressed={tool === item.id}
              title={t(item.label)}
              onClick={() => setTool(item.id)}
            >
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
            </button>
          ))}
          <div
            role="radiogroup"
            aria-label={t('color')}
            className="color-row"
            aria-disabled={tool === 'redact'}
          >
            {PALETTE.map((item) => {
              const name = t(colorLabel[item.id]);
              return (
                <button
                  key={item.id}
                  role="radio"
                  aria-checked={currentId === item.id}
                  className="color-chip"
                  title={name}
                  disabled={tool === 'redact'}
                  onClick={() => setColor(item.value)}
                >
                  <span
                    className="color-swatch"
                    style={{ backgroundColor: item.value }}
                    aria-hidden="true"
                  />
                  <span>{name}</span>
                </button>
              );
            })}
            <label
              className="color-chip color-custom"
              data-active={currentId === null}
              title={t('colorPick')}
            >
              <input
                type="color"
                aria-label={t('colorPick')}
                value={color}
                disabled={tool === 'redact'}
                onChange={(event) => {
                  if (isHexColor(event.target.value))
                    setColor(event.target.value.toLowerCase());
                }}
              />
              <span>
                {currentId === null ? color.toUpperCase() : t('colorCustom')}
              </span>
            </label>
          </div>
        </div>
        <div className="tool-row">
          <button
            title={`${t('undo')} (Ctrl+Z)`}
            disabled={!history.canUndo}
            onClick={() => canvasRef.current?.undo()}
          >
            <Icon name="undo" />
            <span>{t('undo')}</span>
          </button>
          <button
            title={`${t('redo')} (Ctrl+Y)`}
            disabled={!history.canRedo}
            onClick={() => canvasRef.current?.redo()}
          >
            <Icon name="redo" />
            <span>{t('redo')}</span>
          </button>
          <button
            title={`${t('deleteItem')} (Del)`}
            disabled={!selected}
            onClick={() => canvasRef.current?.deleteSelected()}
          >
            <Icon name="trash" />
            <span>{t('deleteItem')}</span>
          </button>
          <button
            className="primary"
            disabled={exporting}
            onClick={() => void download()}
          >
            <Icon name="download" />
            <span>{t('downloadPng')}</span>
          </button>
          <button
            title={t('discardHint')}
            onClick={() => void discard()}
            onBlur={() => setConfirmDiscard(false)}
          >
            <span>{t(confirmDiscard ? 'discardConfirm' : 'discard')}</span>
          </button>
        </div>
      </header>
      <main className="editor-main">
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
          {load.bitmap.width} × {load.bitmap.height} px · {t('redactNote')}
        </span>
        <span role="status" aria-live="polite" className="status-line">
          {status
            ? `${t(status.key)}${status.extra ? ` ${status.extra}` : ''}`
            : ''}
        </span>
      </footer>
    </div>
  );
}
