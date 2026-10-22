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
import { SettingsPanel } from '../../shared/ui/SettingsPanel';

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
  const [tab, setTab] = useState<'capture' | 'settings'>('capture');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CaptureErrorCode | null>(null);
  const [lastFailure, setLastFailure] = useState<{
    message: string;
    detail: string;
  } | null>(null);
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
          setLastFailure({
            message: t('lastFailure').replace(
              '{message}',
              t(errorKey[stored.code as CaptureErrorCode]),
            ),
            detail: String(stored.detail ?? '').slice(0, 120) || stored.code,
          });
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
      <nav className="tabs" role="tablist" aria-label={t('phase')}>
        <button
          role="tab"
          id="tab-capture"
          aria-selected={tab === 'capture'}
          aria-controls="panel-capture"
          onClick={() => setTab('capture')}
        >
          <Icon name="visible" />
          <span>{t('captureTab')}</span>
        </button>
        <button role="tab" disabled title={t('soon')}>
          <Icon name="history" />
          <span>{t('history')}</span>
        </button>
        <button
          role="tab"
          id="tab-settings"
          aria-selected={tab === 'settings'}
          aria-controls="panel-settings"
          onClick={() => setTab('settings')}
        >
          <Icon name="settings" />
          <span>{t('configure')}</span>
        </button>
      </nav>
      {tab === 'settings' ? (
        <main
          id="panel-settings"
          role="tabpanel"
          aria-labelledby="tab-settings"
        >
          <SettingsPanel />
        </main>
      ) : (
        <main id="panel-capture" role="tabpanel" aria-labelledby="tab-capture">
          <h1>{t('chooseMode')}</h1>
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
            </button>
          </div>
          <p role="alert" className={error ? 'status error' : 'status'}>
            {error ? t(errorKey[error]) : ''}
          </p>
          {lastFailure && !error ? (
            <div className="hint" role="status">
              <p>{lastFailure.message}</p>
              <p>
                {t('technicalDetail').replace('{detail}', '')}
                <code>{lastFailure.detail}</code>
              </p>
            </div>
          ) : null}
        </main>
      )}
      <footer>
        {t('localOnly')}
        <Credits />
      </footer>
    </div>
  );
}
