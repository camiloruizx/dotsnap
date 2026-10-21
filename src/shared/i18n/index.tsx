import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import es from './es.json';
import en from './en.json';
import {
  defaults,
  parsePreferences,
  preferencesKey,
  readPreferences,
  type Preferences,
} from '../storage/preferences';

export type MessageKey = keyof typeof es;
export function resolveLanguage(
  preference: Preferences['language'],
  system: string,
): 'es' | 'en' {
  return preference === 'system'
    ? /^es(?:-|$)/i.test(system)
      ? 'es'
      : 'en'
    : preference;
}
export function translate(language: 'es' | 'en', key: MessageKey): string {
  return { es, en }[language][key].message;
}
const Context = createContext({
  preferences: { ...defaults },
  ready: false,
  error: false,
  reload: () => {},
  t: (key: MessageKey) => translate('es', key),
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>({ ...defaults });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const language = resolveLanguage(
    preferences.language,
    chrome.i18n.getUILanguage(),
  );
  useEffect(() => {
    let alive = true;
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && changes[preferencesKey])
        setPreferences(parsePreferences(changes[preferencesKey].newValue));
    };
    chrome.storage.onChanged.addListener(changed);
    void readPreferences()
      .then((value) => {
        if (alive) {
          setPreferences(value);
          setReady(true);
          setError(false);
        }
      })
      .catch(() => {
        if (alive) {
          setReady(true);
          setError(true);
        }
      });
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, [attempt]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = preferences.theme;
  }, [language, preferences.theme]);
  return (
    <Context.Provider
      value={{
        preferences,
        ready,
        error,
        reload: () => setAttempt((value) => value + 1),
        t: (key) => translate(language, key),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreferences() {
  return useContext(Context);
}
