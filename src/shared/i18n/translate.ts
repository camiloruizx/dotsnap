import es from './es.json';
import en from './en.json';
import type { Preferences } from '../storage/preferences';

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
