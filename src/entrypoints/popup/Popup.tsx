import { useEffect } from 'react';
import { usePreferences, type MessageKey } from '../../shared/i18n';
import { product } from '../../shared/config/product';
import { Brand } from '../../shared/ui/Brand';
import { Icon } from '../../shared/ui/Icon';

const modes = ['visible', 'region', 'element', 'fullPage'] as const;
export function Popup() {
  const { t } = usePreferences();
  useEffect(() => {
    document.title = product.name;
  }, []);
  return (
    <div className="shell">
      <Brand />
      <main>
        <h1>{t('chooseMode')}</h1>
        <p id="availability" className="hint intro">
          {t('unavailable')}
        </p>
        <div className="mode-grid">
          {modes.map((mode) => (
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
