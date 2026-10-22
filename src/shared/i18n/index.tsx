import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  defaults,
  parsePreferences,
  preferencesKey,
  readPreferences,
  type Preferences,
} from '../storage/preferences';

export { resolveLanguage, translate, type MessageKey } from './translate';
import { resolveLanguage, translate, type MessageKey } from './translate';
const Context = createContext({
  preferences: { ...defaults },
  ready: false,
  error: false,
  reload: () => {},
  t: (key: MessageKey) => translate('es', key),
});

/** Aplica tema e idioma al documento; se llama antes del primer render y al cambiar. */
export function applyDocumentPreferences(value: Preferences): void {
  document.documentElement.lang = resolveLanguage(
    value.language,
    chrome.i18n.getUILanguage(),
  );
  document.documentElement.dataset.theme = value.theme;
}

/**
 * Lee las preferencias y las aplica antes de montar React, para que el primer
 * fotograma ya use el tema e idioma elegidos. Si falla, devuelve undefined y el
 * proveedor muestra el error con opción de reintentar.
 */
export async function loadInitialPreferences(): Promise<
  Preferences | undefined
> {
  try {
    const value = await readPreferences();
    applyDocumentPreferences(value);
    return value;
  } catch {
    return undefined;
  }
}

export function PreferencesProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Preferences | undefined;
}) {
  const [preferences, setPreferences] = useState<Preferences>(
    initial ?? { ...defaults },
  );
  const [ready, setReady] = useState(initial !== undefined);
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
    applyDocumentPreferences(preferences);
  }, [preferences]);
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
