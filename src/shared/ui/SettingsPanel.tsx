import { useState } from 'react';
import { usePreferences } from '../i18n';
import { writePreferences, type Preferences } from '../storage/preferences';

/** Idioma y tema: se usa en la pestaña Configurar del popup y en la página de opciones. */
export function SettingsPanel() {
  const { t, preferences, ready, error, reload } = usePreferences();
  const [status, setStatus] = useState<'saved' | 'saving' | 'saveError'>(
    'saved',
  );
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
    <>
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
        className={error || status === 'saveError' ? 'status error' : 'status'}
      >
        {t(error ? 'loadError' : !ready ? 'loading' : status)}
      </p>
      {error && <button onClick={reload}>{t('retry')}</button>}
    </>
  );
}
