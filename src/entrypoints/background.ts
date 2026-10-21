import { defineBackground } from 'wxt/utils/define-background';
import { isHealthRequest, isTrustedUi } from '../shared/messaging';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (!isTrustedUi(sender, chrome.runtime.id, chrome.runtime.getURL('/')))
      return;
    if (!isHealthRequest(message)) return;
    respond({ version: 1, status: 'foundation' });
  });
});
