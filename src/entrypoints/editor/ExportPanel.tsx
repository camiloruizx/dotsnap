import { useEffect, useRef, useState } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import {
  ExportError,
  exportFlat,
  type ExportResult,
} from '../../shared/export/encode';
import {
  DEFAULT_OPTIONS,
  MIME,
  scaledSize,
  type ExportFormat,
  type ExportOptions,
  type PdfPreset,
} from '../../shared/export/formats';

type Preview =
  | { state: 'busy' }
  | { state: 'ok'; result: ExportResult; originalBytes: number }
  | { state: 'error'; code: 'unsupported' | 'failed' };

interface Props {
  /** Lienzo aplanado actual; null si el editor aún no está listo. */
  getFlat: () => Promise<HTMLCanvasElement> | null;
  /** Cambia con cada edición para recalcular el peso real. */
  version: unknown;
  sourceWidth: number;
  sourceHeight: number;
  onDownload: (result: ExportResult) => void;
  onCopy: (png: Blob) => void;
}

const formatLabel: Record<ExportFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
  pdf: 'PDF',
};
const presetLabel: Record<PdfPreset, MessageKey> = {
  original: 'pdfOriginal',
  a4: 'pdfA4',
  letter: 'pdfLetter',
};

const kb = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(2)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function ExportPanel(props: Props) {
  const { t } = usePreferences();
  const { getFlat, version } = props;
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [targetText, setTargetText] = useState('');
  const [preview, setPreview] = useState<Preview>({ state: 'busy' });
  const original = useRef<{ version: unknown; bytes: number } | null>(null);
  const set = (value: Partial<ExportOptions>) =>
    setOptions((previous) => ({ ...previous, ...value }));

  const targetKb = Number(targetText.replace(',', '.'));
  const targetBytes =
    targetText.trim() !== '' && Number.isFinite(targetKb) && targetKb >= 1
      ? Math.round(targetKb * 1024)
      : null;
  const lossy = options.format === 'jpeg' || options.format === 'webp';
  const effective: ExportOptions = {
    ...options,
    targetBytes: lossy ? targetBytes : null,
  };

  useEffect(() => {
    let stale = false;
    queueMicrotask(() => {
      if (!stale) setPreview({ state: 'busy' });
    });
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const flat = await getFlat();
          if (!flat || stale) return;
          let originalBytes = original.current?.bytes ?? 0;
          if (original.current?.version !== version) {
            const png = await exportFlat(flat, {
              ...DEFAULT_OPTIONS,
              format: 'png',
            });
            originalBytes = png.blob.size;
            original.current = { version, bytes: originalBytes };
          }
          const result = await exportFlat(flat, effective);
          if (!stale)
            setPreview({
              state: 'ok',
              result,
              originalBytes,
            });
        } catch (error) {
          if (!stale)
            setPreview({
              state: 'error',
              code: error instanceof ExportError ? error.code : 'failed',
            });
        }
      })();
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // `effective` se deriva de options/targetBytes, que sí se listan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlat, version, options, targetBytes]);

  const ready = preview.state === 'ok' ? preview : null;
  const size = scaledSize(
    props.sourceWidth,
    props.sourceHeight,
    options.scalePercent,
  );

  async function copy() {
    const flat = await getFlat();
    if (!flat) return;
    const png = await exportFlat(flat, {
      ...DEFAULT_OPTIONS,
      format: 'png',
      scalePercent: options.scalePercent,
    });
    props.onCopy(png.blob);
  }

  return (
    <section className="export-panel" aria-label={t('exportTitle')}>
      <div className="export-grid">
        <label>
          {t('exportFormat')}
          <select
            value={options.format}
            onChange={(e) => set({ format: e.target.value as ExportFormat })}
          >
            {(Object.keys(formatLabel) as ExportFormat[]).map((f) => (
              <option key={f} value={f}>
                {formatLabel[f]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('exportScale')}
          <select
            value={options.scalePercent}
            onChange={(e) => set({ scalePercent: Number(e.target.value) })}
          >
            {[100, 75, 50, 25].map((p) => (
              <option key={p} value={p}>
                {p} %
              </option>
            ))}
          </select>
        </label>
        {lossy ? (
          <>
            <label>
              {t('exportQuality')}: {Math.round(options.quality * 100)} %
              <input
                type="range"
                min={5}
                max={100}
                step={1}
                disabled={targetBytes !== null}
                value={Math.round(options.quality * 100)}
                onChange={(e) => set({ quality: Number(e.target.value) / 100 })}
              />
            </label>
            <label>
              {t('exportTarget')}
              <input
                type="number"
                min={1}
                inputMode="decimal"
                placeholder={t('exportTargetNone')}
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
              />
            </label>
          </>
        ) : null}
        {options.format === 'jpeg' || options.format === 'pdf' ? (
          <label>
            {t('exportBackground')}
            <input
              type="color"
              value={options.background}
              onChange={(e) => set({ background: e.target.value })}
            />
          </label>
        ) : null}
        {options.format === 'pdf' ? (
          <>
            <label>
              {t('pdfPage')}
              <select
                value={options.pdfPreset}
                onChange={(e) =>
                  set({ pdfPreset: e.target.value as PdfPreset })
                }
              >
                {(Object.keys(presetLabel) as PdfPreset[]).map((p) => (
                  <option key={p} value={p}>
                    {t(presetLabel[p])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('pdfMargin')}
              <select
                value={options.pdfMarginMm}
                onChange={(e) => set({ pdfMarginMm: Number(e.target.value) })}
              >
                {[0, 10, 20].map((m) => (
                  <option key={m} value={m}>
                    {m} mm
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>
      <p className="hint export-note">
        {options.format === 'png'
          ? t('exportNotePng')
          : options.format === 'pdf'
            ? t('exportNotePdf')
            : t('exportNoteLossy')}
      </p>
      <p role="status" aria-live="polite" className="export-result">
        {preview.state === 'busy'
          ? t('exportCalculating')
          : preview.state === 'error'
            ? t(
                preview.code === 'unsupported'
                  ? 'exportUnsupported'
                  : 'exportError',
              )
            : `${t('exportOriginal')}: ${kb(preview.originalBytes)} (PNG, ${props.sourceWidth} × ${props.sourceHeight} px) → ${t('exportResult')}: ${kb(preview.result.blob.size)} (${formatLabel[preview.result.format]}, ${preview.result.width} × ${preview.result.height} px${preview.result.pages > 1 ? `, ${preview.result.pages} ${t('exportPages')}` : ''}${preview.result.quality !== null ? `, ${t('exportQuality').toLowerCase()} ${Math.round(preview.result.quality * 100)} %` : ''})`}
        {ready && ready.result.reachedTarget === false
          ? ` · ${t('exportTargetMissed')}`
          : ''}
        {ready && ready.result.reachedTarget === true
          ? ` · ${t('exportTargetMet')}`
          : ''}
      </p>
      <div className="export-actions">
        <button
          className="primary"
          disabled={!ready}
          onClick={() => ready && props.onDownload(ready.result)}
        >
          {t('exportDownload')} {formatLabel[options.format]} ({size.width} ×{' '}
          {size.height})
        </button>
        <button
          disabled={typeof ClipboardItem === 'undefined'}
          title={MIME.png}
          onClick={() => void copy()}
        >
          {t('exportCopy')}
        </button>
      </div>
    </section>
  );
}
