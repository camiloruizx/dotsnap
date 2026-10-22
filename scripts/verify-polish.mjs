// Verificación de 0.4.1: créditos, fuente del texto, cierre de la pestaña al descartar.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolve } from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
await mkdir(resolve('.browser-profile'), { recursive: true });
const server = http.createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<body style="margin:0;background:#fff"><h1>Prueba</h1></body>');
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}/`;
const context = await chromium.launchPersistentContext(
  await mkdtemp(resolve('.browser-profile/polish-')),
  {
    executablePath: process.env.DOTSNAP_CHROME,
    headless: true,
    viewport: { width: 1000, height: 600 },
    args: [
      `--disable-extensions-except=${output}`,
      `--load-extension=${output}`,
    ],
  },
);
const errors = [];
context.on('page', (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
});
try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  const id = new URL(worker.url()).host;
  const base = `chrome-extension://${id}`;
  const tab = await context.newPage();
  await tab.goto(origin);
  const popup = await context.newPage();
  await popup.goto(`${base}/popup.html`);
  await popup.locator('.credits').waitFor();
  const links = await popup
    .locator('.credits a')
    .evaluateAll((a) =>
      a.map((x) => [x.textContent.trim(), x.href, x.target, x.rel]),
    );
  assert.deepEqual(
    links.map((l) => l[1]),
    [
      'https://acrocode.dev/',
      'https://github.com/camiloruizx',
      'https://ko-fi.com/camiloruizx',
    ],
  );
  assert.ok(
    links.every((l) => l[2] === '_blank' && l[3].includes('noreferrer')),
  );
  assert.match(await popup.locator('.credits').innerText(), /Camilo Ruiz/);
  console.log(
    'créditos OK',
    links.map((l) => l[0]),
  );

  // Fallo de página completa: el popup explica la causa.
  await popup.evaluate(() =>
    chrome.storage.session.set({
      'fullpage.lastFailure': {
        code: 'tabChanged',
        detail: 'send:fp-scroll:x',
        at: Date.now(),
      },
    }),
  );
  await popup.reload();
  await popup.locator('text=send:fp-scroll').waitFor();
  console.log('último fallo visible en el popup OK');

  await tab.bringToFront();
  const editorPromise = context.waitForEvent('page', {
    predicate: (p) => p.url().includes('editor.html'),
  });
  const r = await popup.evaluate(() =>
    chrome.runtime.sendMessage({ version: 1, type: 'capture-visible' }),
  );
  assert.equal(r.ok, true);
  const editor = await editorPromise;
  await editor.waitForSelector('.canvas-host canvas');
  const lang = await editor.evaluate(() => document.documentElement.lang);
  const T =
    lang === 'es'
      ? { text: 'Texto', discard: 'Descartar' }
      : { text: 'Text', discard: 'Discard' };
  assert.equal(
    await editor.locator('select:has(option[value="mono"])').count(),
    0,
  );
  await editor
    .getByRole('button', { name: T.text, exact: true })
    .first()
    .click();
  const fontSelect = editor.locator('select:has(option[value="mono"])');
  await fontSelect.waitFor();
  assert.equal(await fontSelect.locator('option').count(), 9);
  await fontSelect.selectOption('mono');
  const canvas = editor.locator('.canvas-host canvas').last();
  const box = await canvas.boundingBox();
  await editor.mouse.click(box.x + 100, box.y + 100);
  const area = editor.locator('textarea.text-editor');
  await area.waitFor();
  assert.match(
    await area.evaluate((e) => getComputedStyle(e).fontFamily),
    /Courier/,
  );
  await area.fill('Hola');
  await editor.keyboard.press('Enter');
  // Seleccionar el texto: el combo aparece con su fuente y cambiarla lo actualiza.
  await editor
    .getByRole('button', {
      name: lang === 'es' ? 'Seleccionar' : 'Select',
      exact: true,
    })
    .first()
    .click();
  await editor.mouse.click(box.x + 110, box.y + 110);
  await fontSelect.waitFor();
  assert.equal(await fontSelect.inputValue(), 'mono');
  await fontSelect.selectOption('serif');
  await editor.waitForTimeout(150);
  assert.equal(await fontSelect.inputValue(), 'serif');
  await editor.keyboard.press('Control+z');
  await editor.waitForTimeout(150);
  assert.equal(
    await fontSelect.inputValue(),
    'mono',
    'deshacer devuelve la fuente',
  );
  console.log('fuente OK (nuevo texto, selección, deshacer)');

  // Descartar cierra la pestaña.
  const discard = editor
    .getByRole('button', { name: new RegExp(T.discard) })
    .first();
  await discard.click();
  const closed = editor.waitForEvent('close', { timeout: 5000 });
  await discard.click();
  await closed;
  console.log('descartar cierra la pestaña OK');
  assert.deepEqual(errors, []);
  console.log('0 errores de consola');
} finally {
  await context.close();
  server.close();
}
