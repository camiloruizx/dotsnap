import { defineBackground } from 'wxt/utils/define-background';
import { isTrustedUi, parseRequest } from '../shared/messaging';
import { captureVisible } from '../shared/capture/visible';
import {
  handleSelectionMessage,
  startSelection,
} from '../shared/capture/selection';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    // Mensajes del content script (la página no puede enviarlos): remitente ligado a la pestaña de la selección.
    if (
      sender.tab &&
      sender.id === chrome.runtime.id &&
      !sender.url?.startsWith(chrome.runtime.getURL('/'))
    ) {
      void handleSelectionMessage(message, sender, chrome.runtime.id).then(
        respond,
      );
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
    void captureVisible().then(respond);
    return true;
  });
});
