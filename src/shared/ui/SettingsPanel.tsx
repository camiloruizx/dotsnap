import { useEffect, useState } from 'react';
import { usePreferences } from '../i18n';
import {
  RETENTION_OPTIONS,
  writePreferences,
  type Preferences,
} from '../storage/preferences';
import { buildFileName, isValidFileTemplate } from '../../editor/model';
import { product } from '../config/product';
import { useToast } from './Toast';
import type { ExportFormat } from '../export/formats';

const FORMATS: ExportFormat[] = ['png', 'jpeg', 'webp', 'pdf'];
const FORMAT_LABEL: Record<ExportFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
  pdf: 'PDF',
};

function Shortcuts() {
  const { t } = usePreferences();
  const [commands, setCommands] = useState<
    { name: string; description: string; shortcut: string }[]
  >([]);
  useEffect(() => {
    let alive = true;
    void chrome.commands
      .getAll()
      .then((all) => {
        if (alive)
          setCommands(
            all
              .filter((c) => c.name && c.description)
              .map((c) => ({
                name: c.name!,
                description: c.description!,
                shortcut: c.shortcut ?? '',
              })),
          );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <>
      <h2 className="settings-section">{t('settingsShortcuts')}</h2>
      <section className="card" aria-label={t('settingsShortcuts')}>
        {commands.map((c) => (
          <div key={c.name} className="shortcut-row">
            <span>{c.description}</span>
            <kbd>{c.shortcut || t('shortcutsNone')}</kbd>
          </div>
        ))}
        <button
          onClick={() =>
            void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
          }
        >
          {t('shortcutsChange')}
        </button>
      </section>
    </>
  );
}

/** Idioma y tema: se usa en la pestaña Configurar del popup y en la página de opciones. */
export function SettingsPanel() {
  const { t, preferences, ready, error, reload } = usePreferences();
  const [status, setStatus] = useState<'saved' | 'saving' | 'saveError'>(
    'saved',
  );
  const toast = useToast();
  const [templateText, setTemplateText] = useState<string | null>(null);
  const template = templateText ?? preferences.fileNameTemplate;
  const templateOk = isValidFileTemplate(template);
  async function update(value: Partial<Preferences>) {
    setStatus('saving');
    try {
      await writePreferences({ ...preferences, ...value });
      setStatus('saved');
      toast(t('toastSaved'), 'success', { id: 'settings' });
    } catch {
      setStatus('saveError');
      toast(t('saveError'), 'error', { id: 'settings' });
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
      <h2 className="settings-section">{t('settingsHistory')}</h2>
      <section className="card" aria-label={t('settingsHistory')}>
        <div className="field">
          <label>
            <input
              id="history-enabled"
              type="checkbox"
              disabled={!ready || error || status === 'saving'}
              checked={preferences.historyEnabled}
              onChange={(event) =>
                void update({ historyEnabled: event.target.checked })
              }
            />{' '}
            {t('settingsHistoryOn')}
          </label>
        </div>
        <div className="field">
          <label htmlFor="retention">{t('settingsRetention')}</label>
          <select
            id="retention"
            disabled={!ready || error || status === 'saving'}
            value={preferences.retentionDays}
            onChange={(event) =>
              void update({
                retentionDays: Number(
                  event.target.value,
                ) as Preferences['retentionDays'],
              })
            }
          >
            {RETENTION_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days === 1
                  ? t('retentionDay')
                  : t('retentionDays').replace('{n}', String(days))}
              </option>
            ))}
          </select>
        </div>
      </section>
      <h2 className="settings-section">{t('settingsExport')}</h2>
      <section className="card" aria-label={t('settingsExport')}>
        <div className="field">
          <label htmlFor="default-format">{t('settingsDefaultFormat')}</label>
          <select
            id="default-format"
            disabled={!ready || error || status === 'saving'}
            value={preferences.defaultFormat}
            onChange={(event) =>
              void update({ defaultFormat: event.target.value as ExportFormat })
            }
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="default-quality">
            {t('settingsDefaultQuality')}: {preferences.defaultQuality} %
          </label>
          <input
            id="default-quality"
            type="range"
            min={5}
            max={100}
            disabled={!ready || error}
            value={preferences.defaultQuality}
            onChange={(event) =>
              void update({ defaultQuality: Number(event.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="file-template">{t('settingsFileName')}</label>
          <input
            id="file-template"
            type="text"
            maxLength={60}
            disabled={!ready || error}
            aria-invalid={!templateOk}
            aria-describedby="file-template-hint"
            value={template}
            onChange={(event) => setTemplateText(event.target.value)}
            onBlur={() => {
              if (templateOk && template !== preferences.fileNameTemplate)
                void update({ fileNameTemplate: template });
              setTemplateText(null);
            }}
          />
          <p id="file-template-hint" className="hint">
            {t('settingsFileNameHint')}{' '}
            <code>
              {templateOk
                ? buildFileName(product.name, new Date(), 'png', template)
                : '—'}
            </code>
          </p>
        </div>
      </section>
      <Shortcuts />
    </>
  );
}
