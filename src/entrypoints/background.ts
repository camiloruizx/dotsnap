import { defineBackground } from 'wxt/utils/define-background';
import { isTrustedUi, parseRequest, type Delay } from '../shared/messaging';
import { countdown } from '../shared/capture/delay';
import { captureVisible } from '../shared/capture/visible';
import {
  handleFullPageMessage,
  startFullPage,
} from '../shared/capture/fullpage';
import {
  handleSelectionMessage,
  startSelection,
} from '../shared/capture/selection';

/** Atajos de teclado: Chrome concede activeTab a la pestaña activa al pulsarlos. */
const shortcuts: Record<string, () => Promise<unknown>> = {
  'capture-visible': () => captureVisible(),
  'capture-region': () => startSelection('region'),
  'capture-element': () => startSelection('element'),
  'capture-fullpage': () => startFullPage(),
};

/** Ejecuta la captura tras la cuenta regresiva; responde de inmediato para que el popup se cierre. */
function afterDelay(
  delay: Delay,
  run: () => Promise<unknown>,
  respond: (response: unknown) => void,
): void {
  respond({ version: 1, ok: true });
  void (async () => {
    const ok = await countdown(delay, {
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      badge: async (text) => {
        await chrome.action.setBadgeBackgroundColor({ color: '#0078d4' });
        await chrome.action.setBadgeText({ text });
      },
    }).catch(() => false);
    if (ok) await run().catch(() => {});
  })();
}

export default defineBackground(() => {
  chrome.commands.onCommand.addListener((command) => {
    void shortcuts[command]?.().catch(() => {});
  });
  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    // Mensajes del content script (la página no puede enviarlos): remitente ligado a la pestaña de la selección.
    if (
      sender.tab &&
      sender.id === chrome.runtime.id &&
      !sender.url?.startsWith(chrome.runtime.getURL('/'))
    ) {
      const type = (message as { type?: unknown } | null)?.type;
      const handler =
        typeof type === 'string' && type.startsWith('fullpage-')
          ? handleFullPageMessage
          : handleSelectionMessage;
      void handler(message, sender, chrome.runtime.id).then(respond);
      return true;
    }
    if (!isTrustedUi(sender, chrome.runtime.id, chrome.runtime.getURL('/')))
      return;
    const request = parseRequest(message);
    if (!request) return;
    if (request.type === 'health') {
      respond({ version: 1, status: 'foundation' });
      return;
    }
    if (request.type === 'start-selection') {
      void startSelection(request.mode).then(respond);
      return true;
    }
    if (request.type === 'capture-fullpage') {
      if (request.delay) {
        afterDelay(request.delay, () => startFullPage(), respond);
        return;
      }
      void startFullPage().then(respond);
      return true;
    }
    if (request.delay) {
      afterDelay(request.delay, () => captureVisible(), respond);
      return;
    }
    void captureVisible().then(respond);
    return true;
  });
});
