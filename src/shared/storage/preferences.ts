export type LanguagePreference = 'system' | 'es' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';
export interface Preferences {
  language: LanguagePreference;
  theme: ThemePreference;
}
export const defaults: Readonly<Preferences> = {
  language: 'system',
  theme: 'system',
};
export const preferencesKey = 'preferences.v1';

export function parsePreferences(value: unknown): Preferences {
  const data = (
    typeof value === 'object' && value !== null ? value : {}
  ) as Record<string, unknown>;
  return {
    language:
      data.language === 'es' || data.language === 'en'
        ? data.language
        : 'system',
    theme:
      data.theme === 'light' || data.theme === 'dark' ? data.theme : 'system',
  };
}
export async function readPreferences(): Promise<Preferences> {
  const data = await chrome.storage.local.get(preferencesKey);
  return parsePreferences(data[preferencesKey]);
}
export async function writePreferences(value: Preferences): Promise<void> {
  await chrome.storage.local.set({ [preferencesKey]: parsePreferences(value) });
}
