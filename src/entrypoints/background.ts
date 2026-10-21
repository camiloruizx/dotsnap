import { defineBackground } from 'wxt/utils/define-background';
import { isTrustedUi, parseRequest } from '../shared/messaging';
import { captureVisible } from '../shared/capture/visible';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (!isTrustedUi(sender, chrome.runtime.id, chrome.runtime.getURL('/')))
      return;
    const request = parseRequest(message);
    if (!request) return;
    if (request.type === 'health') {
      respond({ version: 1, status: 'foundation' });
      return;
    }
    void captureVisible().then(respond);
    return true;
  });
});
