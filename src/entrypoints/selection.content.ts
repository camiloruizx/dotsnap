import { defineContentScript } from 'wxt/utils/define-content-script';

/** Se empaqueta para futura inyección explícita; M0 nunca lo inyecta. */
export default defineContentScript({
  registration: 'runtime',
  main() {
    // Sin lectura de DOM, escuchas ni selección hasta M2.
  },
});
