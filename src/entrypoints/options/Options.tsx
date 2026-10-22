import { useEffect, useState } from 'react';
import { usePreferences } from '../../shared/i18n';
import { product } from '../../shared/config/product';
import {
  writePreferences,
  type Preferences,
} from '../../shared/storage/preferences';
import { Brand } from '../../shared/ui/Brand';
import { Credits } from '../../shared/ui/Credits';
export function Options() {
  const { t, preferences, ready, error, reload } = usePreferences();
  const [status, setStatus] = useState<'saved' | 'saving' | 'saveError'>(
    'saved',
  );
  useEffect(() => {
    document.title = `${product.name} · ${t('settingsTitle')}`;
  }, [t]);
  async function update(value: Partial<Preferences>) {
    setStatus('saving');
    try {
      await writePreferences({ ...preferences, ...value });
      setStatus('saved');
    } catch {
      setStatus('saveError');
    }
  }
  return (
    <div className="shell options-shell">
      <Brand />
      <main>
        <h1>{t('appearance')}</h1>
        <p className="hint intro">{t('preferencesHint')}</p>
        <section className="card" aria-label={t('settingsTitle')}>
          <div className="field">
            <label htmlFor="language">{t('language')}</label>
            <select
              id="language"
              aria-describedby="language-hint"
              disabled={!ready || error || status === 'saving'}
              value={preferences.language}
              onChange={(event) =>
                void update({
                  language: event.target.value as Preferences['language'],
                })
              }
            >
              {(['system', 'es', 'en'] as const).map((value, index) => (
                <option key={value} value={value}>
                  {t((['system', 'spanish', 'english'] as const)[index]!)}
                </option>
              ))}
            </select>
            <p id="language-hint" className="hint">
              {t('languageHint')}
            </p>
          </div>
          <div className="field">
            <label htmlFor="theme">{t('theme')}</label>
            <select
              id="theme"
              aria-describedby="theme-hint"
              disabled={!ready || error || status === 'saving'}
              value={preferences.theme}
              onChange={(event) =>
                void update({
                  theme: event.target.value as Preferences['theme'],
                })
              }
            >
              {(['system', 'light', 'dark'] as const).map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
            <p id="theme-hint" className="hint">
              {t('themeHint')}
            </p>
          </div>
        </section>
        <p
          role="status"
          aria-live="polite"
          className={
            error || status === 'saveError' ? 'status error' : 'status'
          }
        >
          {t(error ? 'loadError' : !ready ? 'loading' : status)}
        </p>
        {error && <button onClick={reload}>{t('retry')}</button>}
        <a className="preferences-link" href="popup.html">
          {t('back')}
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
