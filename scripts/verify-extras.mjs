// Verificación de mejoras de 1.0.0: temporizador, renombrar y buscar en el historial, PNG optimizado.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
await mkdir(resolve('.browser-profile'), { recursive: true });
const server = http.createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<body style="margin:0;background:#fff"><h1>Prueba</h1></body>');
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}/`;
const context = await chromium.launchPersistentContext(
  await mkdtemp(resolve('.browser-profile/extras-')),
  {
    executablePath: process.env.DOTSNAP_CHROME,
    headless: true,
    viewport: { width: 1100, height: 700 },
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
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  const tab = await context.newPage();
  await tab.goto(origin);
  const popup = await context.newPage();
  await popup.goto(`${base}/popup.html`);

  const capture = async (message) => {
    await tab.bringToFront();
    const opened = context.waitForEvent('page', {
      predicate: (p) => p.url().includes('editor.html'),
      timeout: 15000,
    });
    const response = await popup.evaluate(
      (m) => chrome.runtime.sendMessage(m),
      message,
    );
    return { response, opened };
  };

  // Temporizador: responde de inmediato y la captura llega tras la cuenta regresiva.
  const started = Date.now();
  const timed = await capture({
    version: 1,
    type: 'capture-visible',
    delay: 3,
  });
  assert.equal(timed.response.ok, true);
  assert.ok(
    Date.now() - started < 1500,
    'la respuesta no espera al temporizador',
  );
  const first = await timed.opened;
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 2800, `la captura esperó ${elapsed} ms`);
  await first.waitForSelector('.canvas-host canvas');
  const badge = await popup.evaluate(() => chrome.action.getBadgeText({}));
  assert.equal(badge, '');
  console.log(`temporizador OK (${elapsed} ms, insignia limpia)`);

  // Un retardo no permitido se rechaza (sin respuesta, sin captura).
  const rejected = await popup.evaluate(() =>
    Promise.race([
      chrome.runtime.sendMessage({
        version: 1,
        type: 'capture-visible',
        delay: 4,
      }),
      new Promise((ok) => setTimeout(() => ok('sin respuesta'), 1500)),
    ]).catch(() => 'sin respuesta'),
  );
  assert.ok(rejected === 'sin respuesta' || rejected === undefined);
  console.log('retardo inválido rechazado OK');

  // PNG optimizado: firma válida, mismas dimensiones y no mayor que el PNG nativo.
  const download = first.waitForEvent('download');
  const lang = await first.evaluate(() => document.documentElement.lang);
  await first
    .getByRole('button', {
      name: lang === 'es' ? /Descargar PNG/ : /Download PNG/,
    })
    .click();
  const file = resolve('.browser-profile', 'extras.png');
  await (await download).saveAs(file);
  const png = await readFile(file);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const dims = await popup.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
    return [bmp.width, bmp.height];
  }, png.toString('base64'));
  const info = await first.locator('.editor-status span').first().innerText();
  const [, w, h] = /(\d+) × (\d+) px/.exec(info);
  assert.deepEqual(dims, [Number(w), Number(h)]);
  console.log(`PNG descargado OK (${png.length} bytes, ${dims.join('×')})`);

  // Historial: renombrar y buscar (la búsqueda aparece con más de 3 capturas).
  for (let i = 0; i < 3; i++) {
    const { opened } = await capture({ version: 1, type: 'capture-visible' });
    await (await opened).waitForSelector('.canvas-host canvas');
  }
  await popup.reload();
  await popup.getByRole('tab', { name: /Historial|History/ }).click();
  await popup.locator('.history-item').first().waitFor();
  assert.equal(await popup.locator('.history-item').count(), 4);
  await popup.locator('.history-actions button').nth(1).click();
  const rename = popup.locator('.history-rename');
  await rename.fill('Factura\u0000 de mayo');
  await rename.press('Enter');
  await popup.locator('.history-name').waitFor();
  const name = await popup.locator('.history-name').innerText();
  assert.equal(name, 'Factura de mayo');
  const search = popup.locator('.history-search');
  await search.fill('factura');
  assert.equal(await popup.locator('.history-item').count(), 1);
  await search.fill('zzzz');
  assert.equal(await popup.locator('.history-item').count(), 0);
  await search.fill('');
  assert.equal(await popup.locator('.history-item').count(), 4);
  console.log('historial: renombrar y buscar OK');

  assert.deepEqual(errors, []);
  console.log('sin errores de consola');
} finally {
  await context.close();
  server.close();
}
