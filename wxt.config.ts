import { defineConfig } from 'wxt';
import { product } from './src/shared/config/product';
import es from './src/shared/i18n/es.json';
import en from './src/shared/i18n/en.json';

/**
 * Variante SOLO para pruebas automatizadas: añade <all_urls> para poder capturar sin el
 * gesto de la barra de herramientas, que Playwright no puede producir. Nunca es el paquete
 * de producción (otro directorio de salida y otro build).
 */
const testBuild = process.env.DOTSNAP_TEST_BUILD === '1';

export default defineConfig({
  srcDir: 'src',
  outDir: testBuild ? '.output-test' : '.output',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ define: { __DOTSNAP_TEST__: JSON.stringify(testBuild) } }),
  imports: false,
  manifest: ({ command }) => ({
    name: '__MSG_productName__',
    description: '__MSG_productDescription__',
    default_locale: 'es',
    minimum_chrome_version: '120',
    permissions: ['activeTab', 'scripting', 'storage'],
    ...(testBuild ? { host_permissions: ['<all_urls>'] } : {}),
    incognito: 'split',
    action: { default_title: '__MSG_productName__' },
    content_security_policy: {
      // Producción: sin conexiones de red. En `wxt` (serve) se omite connect-src
      // para que el HMR de Vite pueda abrir su WebSocket local; WXT añade solo
      // script-src para localhost. Nunca llega al paquete de producción.
      extension_pages:
        command === 'serve'
          ? "script-src 'self'; object-src 'none'; base-uri 'none'"
          : "script-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'none'",
    },
  }),
  hooks: {
    'build:publicAssets': (_wxt, assets) => {
      for (const [locale, messages] of Object.entries({ es, en })) {
        assets.push({
          relativeDest: `_locales/${locale}/messages.json`,
          contents: JSON.stringify(
            { ...messages, productName: { message: product.name } },
            null,
            2,
          ),
        });
      }
    },
  },
});
