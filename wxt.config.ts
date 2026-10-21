import { defineConfig } from 'wxt';
import { product } from './src/shared/config/product';
import es from './src/shared/i18n/es.json';
import en from './src/shared/i18n/en.json';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: {
    name: '__MSG_productName__',
    description: '__MSG_productDescription__',
    default_locale: 'es',
    minimum_chrome_version: '120',
    permissions: ['activeTab', 'scripting', 'storage'],
    incognito: 'split',
    action: { default_title: '__MSG_productName__' },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'none'",
    },
  },
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
