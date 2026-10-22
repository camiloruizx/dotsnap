import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import {
  clearCaptures,
  deleteCapture,
  listHistory,
  matchesQuery,
  renameCapture,
  MAX_NAME,
  putCapture,
  type HistoryItem,
} from '../../shared/storage/captures';
import { ProjectError, parseProject } from '../../shared/export/project';
import { useToast } from '../../shared/ui/Toast';
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
  const toast = useToast();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
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
      toast(t('toastProjectOpened'));
      open(id);
    } catch (error) {
      const key: MessageKey =
        error instanceof ProjectError && error.code === 'newer'
          ? 'projectNewer'
          : error instanceof ProjectError && error.code === 'tooLarge'
            ? 'projectTooLarge'
            : 'projectInvalid';
      setMessage(key);
      toast(t(key), 'error');
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
              toast(t('toastCleared'));
              setConfirmClear(false);
              void refresh();
            }}
            onBlur={() => setConfirmClear(false)}
          >
            {t(confirmClear ? 'historyClearConfirm' : 'historyClear')}
          </button>
        ) : null}
      </div>
      {items && items.length > 3 ? (
        <input
          type="search"
          className="history-search"
          aria-label={t('historySearch')}
          placeholder={t('historySearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}
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
            {items
              .filter((item) =>
                matchesQuery(item, query, document.documentElement.lang),
              )
              .map((item) => (
                <li key={item.id} className="history-item">
                  <Thumb blob={item.thumb} />
                  <div className="history-meta">
                    {renaming === item.id ? (
                      <input
                        autoFocus
                        className="history-rename"
                        aria-label={t('historyRename')}
                        defaultValue={item.name ?? ''}
                        maxLength={MAX_NAME}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setRenaming(null);
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        onBlur={async (e) => {
                          const value = e.currentTarget.value;
                          setRenaming(null);
                          await renameCapture(item.id, value).catch(() => {});
                          toast(t('toastRenamed'));
                          void refresh();
                        }}
                      />
                    ) : item.name ? (
                      <strong className="history-name">{item.name}</strong>
                    ) : null}
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
                      <button onClick={() => setRenaming(item.id)}>
                        {t('historyRename')}
                      </button>
                      <button
                        onClick={async () => {
                          await deleteCapture(item.id).catch(() => {});
                          toast(t('toastDeleted'));
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
          {items.length > 0 &&
          !items.some((i) =>
            matchesQuery(i, query, document.documentElement.lang),
          ) ? (
            <p className="hint">{t('historyNoMatch')}</p>
          ) : null}
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
