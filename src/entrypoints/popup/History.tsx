import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import {
  clearCaptures,
  deleteCapture,
  listHistory,
  putCapture,
  type HistoryItem,
} from '../../shared/storage/captures';
import { ProjectError, parseProject } from '../../shared/export/project';
import { withinBudget } from '../../shared/capture/errors';

const kb = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function Thumb({ blob }: { blob: Blob | undefined }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url ? (
    <img className="history-thumb" src={url} alt="" />
  ) : (
    <div className="history-thumb" aria-hidden="true" />
  );
}

export function History() {
  const { t, preferences, ready } = usePreferences();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const incognito = chrome.extension.inIncognitoContext;
  const enabled = preferences.historyEnabled && !incognito;

  const refresh = useCallback(async () => {
    try {
      setItems(enabled ? await listHistory() : []);
    } catch {
      setItems([]);
    }
  }, [enabled]);
  useEffect(() => {
    if (ready) queueMicrotask(() => void refresh());
  }, [ready, refresh]);

  const open = (id: string) =>
    void chrome.tabs.create({
      url: chrome.runtime.getURL(`/editor.html?capture=${id}`),
    });

  async function importProject(selected: File | undefined) {
    if (!selected) return;
    setMessage(null);
    try {
      const project = parseProject(await selected.text());
      const bitmap = await createImageBitmap(project.image);
      const fits =
        bitmap.width === project.width &&
        bitmap.height === project.height &&
        withinBudget(bitmap.width, bitmap.height);
      bitmap.close();
      if (!fits) throw new ProjectError('invalid');
      const id = await putCapture(project.image, project.annotations);
      open(id);
    } catch (error) {
      setMessage(
        error instanceof ProjectError && error.code === 'newer'
          ? 'projectNewer'
          : error instanceof ProjectError && error.code === 'tooLarge'
            ? 'projectTooLarge'
            : 'projectInvalid',
      );
    } finally {
      if (file.current) file.current.value = '';
    }
  }

  return (
    <main id="panel-history" role="tabpanel" aria-labelledby="tab-history">
      <h1>{t('historyTitle')}</h1>
      <div className="history-tools">
        <button onClick={() => file.current?.click()}>
          {t('openProject')}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void importProject(e.target.files?.[0])}
        />
        {items && items.length > 0 ? (
          <button
            onClick={async () => {
              if (!confirmClear) return setConfirmClear(true);
              await clearCaptures().catch(() => {});
              setConfirmClear(false);
              void refresh();
            }}
            onBlur={() => setConfirmClear(false)}
          >
            {t(confirmClear ? 'historyClearConfirm' : 'historyClear')}
          </button>
        ) : null}
      </div>
      <p role="alert" className={message ? 'status error' : 'status'}>
        {message ? t(message) : ''}
      </p>
      {items === null ? null : items.length === 0 ? (
        <p className="hint">
          {t(
            incognito
              ? 'historyIncognito'
              : !preferences.historyEnabled
                ? 'historyOff'
                : 'historyEmpty',
          )}
        </p>
      ) : (
        <>
          <ul className="history-list">
            {items.map((item) => (
              <li key={item.id} className="history-item">
                <Thumb blob={item.thumb} />
                <div className="history-meta">
                  <span>
                    {new Date(item.updatedAt).toLocaleString(
                      document.documentElement.lang,
                      { dateStyle: 'short', timeStyle: 'short' },
                    )}
                  </span>
                  <span className="hint">
                    {item.width} × {item.height} px · {kb(item.bytes)}
                    {item.edited ? ` · ${t('historyEdited')}` : ''}
                  </span>
                  <div className="history-actions">
                    <button onClick={() => open(item.id)}>
                      {t('historyOpen')}
                    </button>
                    <button
                      onClick={async () => {
                        await deleteCapture(item.id).catch(() => {});
                        void refresh();
                      }}
                    >
                      {t('historyDelete')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="hint">
            {t('historyRetention').replace(
              '{days}',
              String(preferences.retentionDays),
            )}
          </p>
        </>
      )}
    </main>
  );
}
