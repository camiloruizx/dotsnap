import type { ExportFormat } from '../export/formats';
import { DEFAULT_FILE_TEMPLATE, isValidFileTemplate } from '../../editor/model';

export type LanguagePreference = 'system' | 'es' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';
export type RetentionDays = 1 | 7 | 30;
export const RETENTION_OPTIONS: readonly RetentionDays[] = [1, 7, 30];
export interface Preferences {
  language: LanguagePreference;
  theme: ThemePreference;
  /** Guardar las capturas recientes (y sus anotaciones) para reabrirlas. */
  historyEnabled: boolean;
  retentionDays: RetentionDays;
  defaultFormat: ExportFormat;
  /** 5–100 */
  defaultQuality: number;
  fileNameTemplate: string;
}
export const defaults: Readonly<Preferences> = {
  language: 'system',
  theme: 'system',
  historyEnabled: true,
  retentionDays: 7,
  defaultFormat: 'png',
  defaultQuality: 92,
  fileNameTemplate: DEFAULT_FILE_TEMPLATE,
};
export const preferencesKey = 'preferences.v1';

export function parsePreferences(value: unknown): Preferences {
  const data = (
    typeof value === 'object' && value !== null ? value : {}
  ) as Record<string, unknown>;
  const format = data.defaultFormat;
  const quality = data.defaultQuality;
  const template = data.fileNameTemplate;
  return {
    language:
      data.language === 'es' || data.language === 'en'
        ? data.language
        : 'system',
    theme:
      data.theme === 'light' || data.theme === 'dark' ? data.theme : 'system',
    historyEnabled:
      typeof data.historyEnabled === 'boolean' ? data.historyEnabled : true,
    retentionDays:
      data.retentionDays === 1 || data.retentionDays === 30
        ? data.retentionDays
        : 7,
    defaultFormat:
      format === 'jpeg' || format === 'webp' || format === 'pdf'
        ? format
        : 'png',
    defaultQuality:
      typeof quality === 'number' &&
      Number.isFinite(quality) &&
      quality >= 5 &&
      quality <= 100
        ? Math.round(quality)
        : 92,
    fileNameTemplate:
      typeof template === 'string' && isValidFileTemplate(template)
        ? template
        : DEFAULT_FILE_TEMPLATE,
  };
}
export async function readPreferences(): Promise<Preferences> {
  const data = await chrome.storage.local.get(preferencesKey);
  return parsePreferences(data[preferencesKey]);
}
export async function writePreferences(value: Preferences): Promise<void> {
  await chrome.storage.local.set({ [preferencesKey]: parsePreferences(value) });
}
