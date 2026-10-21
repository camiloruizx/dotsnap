import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const output = resolve('.output/chrome-mv3');
const evidence = resolve('docs/evidence');
await mkdir(evidence, { recursive: true });
const manifest = JSON.parse(
  await readFile(resolve(output, 'manifest.json'), 'utf8'),
);
const catalog = JSON.parse(
  await readFile(
    resolve(output, '_locales', manifest.default_locale, 'messages.json'),
    'utf8',
  ),
);
const brandName = catalog.productName.message;
assert.deepEqual(
  manifest.permissions.toSorted(),
  ['activeTab', 'scripting', 'storage'].toSorted(),
);
for (const key of [
  'host_permissions',
  'optional_host_permissions',
  'content_scripts',
  'web_accessible_resources',
  'externally_connectable',
])
  assert.equal(manifest[key], undefined, key);
const report = {
  browser: '',
  extensionId: '',
  checks: [],
  views: [],
  contrastRatios: [],
  consoleErrors: [],
  externalRequests: [],
  extensionErrors: [],
};
await mkdir(resolve('.browser-profile'), { recursive: true });
const profile = await mkdtemp(resolve('.browser-profile/verification-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chrome',
  headless: true,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: ['--enable-unsafe-extension-debugging'],
});
context.on('page', (page) => {
  page.on('pageerror', (error) => report.consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()))
      report.externalRequests.push(request.url());
  });
});
try {
  report.browser = context.browser().version();
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', {
    path: output,
    enableInIncognito: false,
  });
  report.extensionId = id;
  const base = `chrome-extension://${id}`;
  const options = await context.newPage();
  const popup = await context.newPage();
  await options.setViewportSize({ width: 760, height: 650 });
  await popup.setViewportSize({ width: 372, height: 570 });
  await options.goto(`${base}/options.html`);
  await options.locator('#language:enabled').waitFor();
  const setPreference = async (control, value) => {
    await options.locator(`#${control}:enabled`).waitFor();
    await options.locator(`#${control}`).selectOption(value);
    await options.locator(`#${control}:enabled`).waitFor();
    await options.waitForFunction(
      ({ control, value }) =>
        control === 'language'
          ? document.documentElement.lang === value
          : document.documentElement.dataset.theme === value,
      { control, value },
    );
  };
  for (const language of ['es', 'en']) {
    await setPreference('language', language);
    for (const theme of ['light', 'dark']) {
      await setPreference('theme', theme);
      await popup.goto(`${base}/popup.html`);
      await popup.waitForFunction(
        ({ language, theme }) =>
          document.documentElement.lang === language &&
          document.documentElement.dataset.theme === theme,
        { language, theme },
      );
      assert.equal(await popup.locator('button:disabled').count(), 6);
      assert.equal(await popup.locator('button:enabled').count(), 0);
      await popup.keyboard.press('Tab');
      assert.equal(await popup.locator('a:focus').count(), 1);
      assert.equal(
        await popup
          .locator('a:focus')
          .evaluate((element) => getComputedStyle(element).outlineWidth),
        '2px',
      );
      await options.locator('#language').focus();
      await options.keyboard.press('Tab');
      assert.equal(await options.locator('#theme:focus').count(), 1);
      const health = await popup.evaluate(() =>
        chrome.runtime.sendMessage({ version: 1, type: 'health' }),
      );
      assert.deepEqual(health, { version: 1, status: 'foundation' });
      if (language === 'es') {
        const colors = await options.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          return Object.fromEntries(
            [
              'text',
              'muted',
              'surface',
              'surface-card',
              'link',
              'focus',
              'control',
              'control-border',
            ].map((key) => [key, style.getPropertyValue(`--${key}`).trim()]),
          );
        });
        const luminance = (hex) => {
          if (hex.length === 4)
            hex = '#' + [...hex.slice(1)].map((char) => char + char).join('');
          const channels = hex
            .slice(1)
            .match(/../g)
            .map((channel) => {
              const value = parseInt(channel, 16) / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        for (const [foreground, background, minimum] of [
          ['text', 'surface', 4.5],
          ['muted', 'surface-card', 4.5],
          ['link', 'surface', 4.5],
          ['focus', 'surface', 3],
          ['control-border', 'control', 3],
        ]) {
          const values = [
            luminance(colors[foreground]),
            luminance(colors[background]),
          ].sort((a, b) => b - a);
          const ratio = (values[0] + 0.05) / (values[1] + 0.05);
          assert.ok(
            ratio >= minimum,
            `${theme}: ${foreground}/${background}: ${ratio}`,
          );
          report.contrastRatios.push({
            theme,
            foreground,
            background,
            ratio: Number(ratio.toFixed(2)),
            minimum,
          });
        }
      }
      for (const [surface, page] of [
        ['popup', popup],
        ['options', options],
      ]) {
        const accessibility = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          accessibility.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.length,
          })),
          [],
          `${surface}/${language}/${theme}`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          'Horizontal overflow',
        );
        const screenshot = `${surface}-${language}-${theme}.png`;
        await page.screenshot({
          path: resolve(evidence, screenshot),
          fullPage: true,
        });
        report.views.push({
          surface,
          language,
          theme,
          axeViolations: 0,
          screenshot,
        });
      }
    }
  }
  report.checks.push(
    '8 vistas ES/EN × claro/oscuro × popup/opciones; axe WCAG AA sin infracciones; teclado, foco, mensajes health y sin desbordamiento horizontal',
  );
  await options.reload();
  await options.locator('#language:enabled').waitFor();
  assert.equal(await options.locator('#language').inputValue(), 'en');
  assert.equal(await options.locator('#theme').inputValue(), 'dark');
  report.checks.push(
    'Persistencia chrome.storage.local después de recargar opciones',
  );
  const opened = popup.waitForEvent('popup');
  await popup.locator('a.preferences-link').click();
  const linkedOptions = await opened;
  await linkedOptions.locator('#language:enabled').waitFor();
  assert.equal(linkedOptions.url(), `${base}/options.html`);
  await linkedOptions.close();
  report.checks.push('Enlace de preferencias abre la página real de opciones');
  await options.locator('#theme').selectOption('system');
  await options.waitForFunction(
    () => document.documentElement.dataset.theme === 'system',
  );
  await popup.waitForFunction(
    () => document.documentElement.dataset.theme === 'system',
  );
  report.checks.push(
    'storage.onChanged actualiza un popup abierto al cambiar tema desde opciones',
  );
  for (const colorScheme of ['light', 'dark']) {
    await options.emulateMedia({ colorScheme });
    const computed = await options
      .locator('body')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.equal(
      computed,
      colorScheme === 'dark' ? 'rgb(24, 24, 24)' : 'rgb(245, 246, 248)',
    );
  }
  await options.locator('#language').selectOption('system');
  await options.waitForFunction(
    () =>
      document.documentElement.lang ===
      (/^es(?:-|$)/i.test(chrome.i18n.getUILanguage()) ? 'es' : 'en'),
  );
  report.checks.push(
    'Tema Sistema responde a prefers-color-scheme e idioma Sistema a chrome.i18n.getUILanguage',
  );
  const extensions = await context.newPage();
  await extensions.goto('chrome://extensions');
  await extensions
    .locator('extensions-item')
    .filter({ hasText: brandName })
    .waitFor();
  const info = await extensions.evaluate(async (extensionId) => {
    const entries = await chrome.developerPrivate.getExtensionsInfo({
      includeDisabled: true,
      includeTerminated: true,
    });
    const entry = entries.find((item) => item.id === extensionId);
    if (!entry) throw new Error('Extension missing from chrome://extensions');
    return {
      name: entry.name,
      state: entry.state,
      location: entry.location,
      runtimeErrors: entry.runtimeErrors,
      manifestErrors: entry.manifestErrors,
    };
  }, id);
  assert.equal(info.state, 'ENABLED');
  assert.deepEqual(info.runtimeErrors ?? [], []);
  assert.deepEqual(info.manifestErrors ?? [], []);
  report.extensionErrors = [
    ...(info.runtimeErrors ?? []),
    ...(info.manifestErrors ?? []),
  ];
  report.checks.push(
    `chrome://extensions: ${info.name}, ${info.state}, ${info.location}; 0 errores de runtime/manifest`,
  );
  await extensions.screenshot({
    path: resolve(evidence, 'chrome-extensions.png'),
    fullPage: true,
  });
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.externalRequests, []);
  report.checks.push(
    '0 errores de consola y 0 peticiones HTTP(S) desde popup/opciones durante la prueba',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(
    resolve(evidence, 'browser-report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await context.close();
}
