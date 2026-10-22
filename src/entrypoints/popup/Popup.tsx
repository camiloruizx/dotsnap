import { useEffect, useState } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import { product } from '../../shared/config/product';
import {
  parseCaptureResponse,
  type CaptureErrorCode,
  type SelectionMode,
} from '../../shared/messaging';
import { Brand } from '../../shared/ui/Brand';
import { Icon } from '../../shared/ui/Icon';

const futureModes = ['fullPage'] as const;
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
  useEffect(() => {
    document.title = product.name;
  }, []);

  async function run(
    request:
      | { version: 1; type: 'capture-visible' }
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
          {futureModes.map((mode) => (
            <button
              key={mode}
              className="mode"
              disabled
              aria-describedby="availability"
              title={t('soon')}
            >
              <Icon name={mode} />
              <span className="mode-title">{t(mode)}</span>
              <span className="hint">{t(`${mode}Hint` as MessageKey)}</span>
              <span className="soon">{t('soon')}</span>
            </button>
          ))}
        </div>
        <p role="alert" className={error ? 'status error' : 'status'}>
          {error ? t(errorKey[error]) : ''}
        </p>
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
      <footer>{t('localOnly')}</footer>
    </div>
  );
}
