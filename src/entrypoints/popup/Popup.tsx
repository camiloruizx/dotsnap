import { useEffect, useState } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import { product } from '../../shared/config/product';
import {
  parseCaptureResponse,
  type CaptureErrorCode,
  type SelectionMode,
} from '../../shared/messaging';
import { Brand } from '../../shared/ui/Brand';
import { Credits } from '../../shared/ui/Credits';
import { Icon } from '../../shared/ui/Icon';

const selectionModes = ['region', 'element'] as const;
const errorKey: Record<CaptureErrorCode, MessageKey> = {
  restricted: 'errorRestricted',
  quota: 'errorQuota',
  busy: 'errorBusy',
  tabChanged: 'errorTabChanged',
  noTab: 'errorNoTab',
  tooLarge: 'errorTooLarge',
  failed: 'errorFailed',
};

export function Popup() {
  const { t } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CaptureErrorCode | null>(null);
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  useEffect(() => {
    document.title = product.name;
    // Un fallo de página completa ocurre con el popup cerrado: aquí se explica la causa.
    void (async () => {
      try {
        const key = 'fullpage.lastFailure';
        const stored = (await chrome.storage.session.get(key))[key] as
          { code?: unknown; detail?: unknown; at?: unknown } | undefined;
        if (
          typeof stored?.code === 'string' &&
          typeof stored.at === 'number' &&
          Date.now() - stored.at < 600_000 &&
          stored.code in errorKey
        )
          setLastFailure(
            t('lastFailure')
              .replace(
                '{message}',
                t(errorKey[stored.code as CaptureErrorCode]),
              )
              .replace(
                '{detail}',
                String(stored.detail ?? '').slice(0, 120) || stored.code,
              ),
          );
      } catch {
        /* sin almacenamiento de sesión */
      }
    })();
  }, [t]);

  async function run(
    request:
      | { version: 1; type: 'capture-visible' }
      | { version: 1; type: 'capture-fullpage' }
      | { version: 1; type: 'start-selection'; mode: SelectionMode },
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = parseCaptureResponse(
        await chrome.runtime.sendMessage(request),
      );
      if (response.ok) window.close();
      else setError(response.code);
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <Brand />
      <main>
        <h1>{t('chooseMode')}</h1>
        <p id="availability" className="hint intro">
          {t('unavailable')}
        </p>
        <div className="mode-grid">
          <button
            className="mode"
            disabled={busy}
            title={t('visibleHint')}
            onClick={() => void run({ version: 1, type: 'capture-visible' })}
          >
            <Icon name="visible" />
            <span className="mode-title">{t('visible')}</span>
            <span className="hint">{t('visibleHint')}</span>
            <span className="soon">{t(busy ? 'capturing' : 'available')}</span>
          </button>
          {selectionModes.map((mode) => (
            <button
              key={mode}
              className="mode"
              disabled={busy}
              title={t(`${mode}Hint` as MessageKey)}
              onClick={() =>
                void run({ version: 1, type: 'start-selection', mode })
              }
            >
              <Icon name={mode} />
              <span className="mode-title">{t(mode)}</span>
              <span className="hint">{t(`${mode}Hint` as MessageKey)}</span>
              <span className="soon">{t('available')}</span>
            </button>
          ))}
          <button
            className="mode"
            disabled={busy}
            title={t('fullPageHint')}
            onClick={() => void run({ version: 1, type: 'capture-fullpage' })}
          >
            <Icon name="fullPage" />
            <span className="mode-title">{t('fullPage')}</span>
            <span className="hint">{t('fullPageHint')}</span>
            <span className="soon">{t('available')}</span>
          </button>
        </div>
        <p role="alert" className={error ? 'status error' : 'status'}>
          {error ? t(errorKey[error]) : ''}
        </p>
        {lastFailure && !error ? (
          <p className="hint" role="status">
            {lastFailure}
          </p>
        ) : null}
        <nav className="future-nav" aria-label={t('phase')}>
          {(['settings', 'history'] as const).map((item) => (
            <button key={item} disabled title={t('soon')}>
              <Icon name={item} />
              <span>{t(item)}</span>
              <span className="soon">{t('soon')}</span>
            </button>
          ))}
        </nav>
        <a
          className="preferences-link"
          href="options.html"
          target="_blank"
          rel="noreferrer"
          title={t('openPreferencesHint')}
        >
          {t('openPreferences')}
          <span aria-hidden="true">↗</span>
        </a>
      </main>
      <footer>
        {t('localOnly')}
        <Credits />
      </footer>
    </div>
  );
}
