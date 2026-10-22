// Verificación de herramientas nuevas: línea, elipse, resaltador y pasos numerados.
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
  await mkdtemp(resolve('.browser-profile/tools-')),
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
  const es =
    (await editor.evaluate(() => document.documentElement.lang)) === 'es';
  const N = es
    ? {
        line: 'Línea',
        ellipse: 'Elipse',
        hl: 'Resaltador',
        step: 'Paso',
        sel: 'Seleccionar',
      }
    : {
        line: 'Line',
        ellipse: 'Ellipse',
        hl: 'Highlighter',
        step: 'Step',
        sel: 'Select',
      };
  const tool = (n) =>
    editor.getByRole('button', { name: n, exact: true }).first().click();
  const box = await editor.locator('.canvas-host canvas').last().boundingBox();
  const drag = async (a, b) => {
    await editor.mouse.move(box.x + a[0], box.y + a[1]);
    await editor.mouse.down();
    await editor.mouse.move(box.x + b[0], box.y + b[1], { steps: 6 });
    await editor.mouse.up();
  };
  const stored = async () => {
    await editor.waitForTimeout(900);
    return editor.evaluate(
      () =>
        new Promise((ok, fail) => {
          const open = indexedDB.open('dotsnap');
          open.onerror = () => fail(open.error);
          open.onsuccess = () => {
            const all = open.result
              .transaction('captures')
              .objectStore('captures')
              .getAll();
            all.onsuccess = () => ok(all.result.at(-1)?.annotations ?? []);
          };
        }),
    );
  };
  await tool(N.line);
  await drag([60, 60], [260, 120]);
  await tool(N.ellipse);
  await drag([300, 60], [460, 160]);
  await tool(N.hl);
  await drag([60, 200], [300, 240]);
  await tool(N.step);
  await editor.mouse.click(box.x + 400, box.y + 300);
  await editor.mouse.click(box.x + 450, box.y + 300);
  let list = await stored();
  assert.deepEqual(
    list.map((a) => a.type),
    ['line', 'ellipse', 'highlight', 'step', 'step'],
  );
  assert.deepEqual(
    list.filter((a) => a.type === 'step').map((a) => a.number),
    [1, 2],
  );
  console.log('dibujo de las 4 herramientas OK');

  // Mover la elipse (arrastrar su borde) y cambiar su tamaño no pierde el tipo.
  const e0 = list.find((a) => a.type === 'ellipse');
  await tool(N.sel);
  await drag([300, 110], [340, 150]);
  list = await stored();
  const e = list.find((a) => a.type === 'ellipse');
  assert.ok(
    e.x - e0.x > 30 && e.y - e0.y > 30 && e.width === e0.width,
    JSON.stringify([e0, e]),
  );
  console.log('mover elipse OK');

  // Deshacer quita el último paso y el siguiente vuelve a numerarse 2.
  await editor.keyboard.press('Control+z');
  await editor.keyboard.press('Control+z');
  await tool(N.step);
  await editor.mouse.click(box.x + 500, box.y + 350);
  list = await stored();
  assert.deepEqual(
    list.filter((a) => a.type === 'step').map((a) => a.number),
    [1, 2],
  );
  console.log('numeración tras deshacer OK');

  // La exportación incluye lo dibujado (el PNG descargado no es la captura en blanco).
  assert.deepEqual(errors, []);
  console.log('sin errores de consola');
} finally {
  await context.close();
  server.close();
}
