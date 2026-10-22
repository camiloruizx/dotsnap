import {
  parseSelectionMessage,
  type CaptureResponse,
  type SelectionMode,
} from '../messaging';
import { readPreferences } from '../storage/preferences';
import { resolveLanguage, translate, type MessageKey } from '../i18n/translate';
import { captureVisible } from './visible';

const stateKey = 'selection.state';
/** Una selección abandonada caduca sola. */
const ttlMs = 2 * 60 * 1000;
/** Margen para que el navegador pinte la página sin overlay antes de capturar. */
const repaintMs = 120;

interface State {
  requestId: string;
  tabId: number;
  mode: SelectionMode;
  createdAt: number;
}
interface Sender {
  id?: string | undefined;
  url?: string | undefined;
  frameId?: number | undefined;
  tab?: { id?: number | undefined } | undefined;
}

const fail = (code: Extract<CaptureResponse, { ok: false }>['code']) =>
  ({ version: 1, ok: false, code }) as const;

async function readState(): Promise<State | undefined> {
  const stored = (await chrome.storage.session.get(stateKey))[stateKey] as
    State | undefined;
  if (!stored || Date.now() - stored.createdAt > ttlMs) return undefined;
  return stored;
}
const clearState = () => chrome.storage.session.remove(stateKey);

/** Inicia la selección en la pestaña activa: inyecta el script solo ahí y solo ahora. */
export async function startSelection(
  mode: SelectionMode,
): Promise<CaptureResponse> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (tab?.id === undefined) return fail('noTab');
    const state: State = {
      requestId: crypto.randomUUID(),
      tabId: tab.id,
      mode,
      createdAt: Date.now(),
    };
    await chrome.storage.session.set({ [stateKey]: state });
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/selection.js'],
      });
    } catch {
      await clearState();
      return fail('restricted');
    }
    return { version: 1, ok: true };
  } catch {
    return fail('failed');
  }
}

const labelKeys = [
  'selectHintRegion',
  'selectHintElement',
  'selectConfirm',
  'selectCancel',
  'selectIframe',
] as const satisfies readonly MessageKey[];

/** Mensaje de la propia pestaña ligada a la selección, en el marco principal. */
function fromBoundTab(sender: Sender, state: State, extensionId: string) {
  return (
    sender.id === extensionId &&
    sender.tab?.id === state.tabId &&
    sender.frameId === 0
  );
}

/**
 * Atiende los mensajes del content script. Nunca confía en un tabId del mensaje: la pestaña
 * sale del estado guardado al iniciar y se compara con el remitente real.
 */
export async function handleSelectionMessage(
  message: unknown,
  sender: Sender,
  extensionId: string,
): Promise<unknown> {
  const parsed = parseSelectionMessage(message);
  const state = await readState();
  if (!parsed || !state || !fromBoundTab(sender, state, extensionId))
    return fail('failed');
  if (parsed.type === 'selection-ready') {
    const language = resolveLanguage(
      (await readPreferences()).language,
      chrome.i18n.getUILanguage(),
    );
    return {
      version: 1,
      ok: true,
      requestId: state.requestId,
      mode: state.mode,
      labels: Object.fromEntries(
        labelKeys.map((key) => [key, translate(language, key)]),
      ),
    };
  }
  if (parsed.requestId !== state.requestId) return fail('failed');
  await clearState();
  if (parsed.type === 'selection-cancel') return { version: 1, ok: true };
  await new Promise((resolve) => setTimeout(resolve, repaintMs));
  return captureVisible({
    tabId: state.tabId,
    crop: { region: parsed.rect, viewport: parsed.viewport },
  });
}
