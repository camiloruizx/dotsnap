// Verificación real de M2 (región y elemento inteligente) en Chromium/Chrome con la variante de pruebas.
// No automatiza el gesto real de la barra de herramientas (activeTab): ver docs/validacion-m2.md.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
const production = resolve('.output/chrome-mv3');
const evidence = resolve('docs/evidence/m2');
await mkdir(evidence, { recursive: true });

// Producción: sin content_scripts ni hosts; el script solo se inyecta bajo demanda.
const prod = JSON.parse(
  await readFile(resolve(production, 'manifest.json'), 'utf8'),
);
assert.equal(prod.content_scripts, undefined, 'content_scripts permanentes');
assert.equal(
  prod.host_permissions,
  undefined,
  'host_permissions en producción',
);
assert.deepEqual(prod.permissions.toSorted(), [
  'activeTab',
  'scripting',
  'storage',
]);

const page = `<!doctype html><meta charset="utf-8"><title>Prueba M2</title>
<body style="margin:0;background:#fff;font:20px sans-serif">
<div id="card" style="position:absolute;left:80px;top:80px;width:340px;height:240px;background:#dddddd">
<div id="red" style="position:absolute;left:20px;top:20px;width:300px;height:200px;background:#ff0000"></div></div>
<div id="blue" style="position:absolute;left:500px;top:100px;width:200px;height:200px;background:#0000ff"></div>
<iframe id="frame" src="__FRAME__" style="position:absolute;left:750px;top:350px;width:200px;height:150px;border:0"></iframe>
<div style="position:absolute;top:1500px;left:0;width:10px;height:10px"></div>
<script>window.__clicks=0;addEventListener('click',()=>window.__clicks++)</script></body>`;
const frame = `<!doctype html><body style="margin:0;background:#ffff00">marco</body>`;
let origin;
let frameOrigin;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(
    req.url === '/frame'
      ? frame
      : page.replace('__FRAME__', `${frameOrigin}frame`),
  );
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
origin = `http://127.0.0.1:${server.address().port}/`;
frameOrigin = `http://localhost:${server.address().port}/`;

const report = { browser: '', runs: [], checks: [], consoleErrors: [] };
const check = (name) => report.checks.push(name);
const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≉ ${b}`);

async function launch(dpr) {
  const profile = await mkdtemp(resolve('.browser-profile/m2-'));
  const executablePath = process.env.DOTSNAP_CHROME;
  const context = await chromium.launchPersistentContext(profile, {
    ...(executablePath ? { executablePath } : { channel: 'chrome' }),
    headless: true,
    viewport: { width: 1000, height: 600 },
    deviceScaleFactor: dpr,
    acceptDownloads: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: executablePath
      ? [`--disable-extensions-except=${output}`, `--load-extension=${output}`]
      : ['--enable-unsafe-extension-debugging'],
  });
  let id;
  if (executablePath) {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    id = new URL(worker.url()).host;
  } else {
    const cdp = await context.browser().newBrowserCDPSession();
    ({ id } = await cdp.send('Extensions.loadUnpacked', {
      path: output,
      enableInIncognito: false,
    }));
  }
  context.on('page', (p) => {
    p.on('pageerror', (e) => report.consoleErrors.push(e.message));
    p.on(
      'console',
      (m) => m.type() === 'error' && report.consoleErrors.push(m.text()),
    );
  });
  return { context, id };
}

async function decode(pg, bytes) {
  return pg.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const { data } = g.getImageData(0, 0, bmp.width, bmp.height);
    return { width: bmp.width, height: bmp.height, data: Array.from(data) };
  }, bytes.toString('base64'));
}
const px = (img, x, y) =>
  img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4);

for (const dpr of [1, 2]) {
  const { context, id } = await launch(dpr);
  try {
    report.browser = context.browser().version();
    const base = `chrome-extension://${id}`;
    const tab = await context.newPage();
    await tab.goto(origin);
    const popup = await context.newPage();
    await popup.goto(`${base}/popup.html`);
    await tab.bringToFront();
    const vp = await tab.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    const overlay = tab.locator('dotsnap-selection');
    const part = (role) => tab.locator(`dotsnap-selection [data-role=${role}]`);
    const bodyHtml = () =>
      tab.evaluate(() => document.head.outerHTML + document.body.outerHTML);
    const start = async (mode) => {
      await tab.bringToFront();
      const response = await popup.evaluate(
        (m) =>
          chrome.runtime.sendMessage({
            version: 1,
            type: 'start-selection',
            mode: m,
          }),
        mode,
      );
      assert.deepEqual(response, { version: 1, ok: true });
      await overlay.waitFor({ state: 'attached' });
      await part('hint').waitFor();
    };
    const boxOf = async () => part('box').boundingBox();
    const drag = async (from, to) => {
      await tab.mouse.move(...from);
      await tab.mouse.down();
      await tab.mouse.move(...to, { steps: 6 });
      await tab.mouse.up();
    };
    const sessionState = () =>
      popup.evaluate(
        async () =>
          (await chrome.storage.session.get('selection.state'))[
            'selection.state'
          ],
      );
    const pagesBefore = () => context.pages().length;
    /** Confirma con Enter y devuelve el PNG exportado desde el editor que se abre. */
    const confirmAndExport = async (action) => {
      const editorPromise = context.waitForEvent('page', {
        predicate: (p) => p.url().includes('editor.html'),
      });
      await action();
      const editor = await editorPromise;
      await editor.waitForSelector('.canvas-host canvas');
      const info = await editor
        .locator('.editor-status span')
        .first()
        .innerText();
      const [, w, h] = /(\d+) × (\d+) px/.exec(info);
      const download = editor.waitForEvent('download');
      await editor
        .getByRole('button', { name: /Download PNG|Descargar PNG/ })
        .click();
      const file = await download;
      const path = resolve(evidence, `tmp-${dpr}.png`);
      await file.saveAs(path);
      const bytes = await readFile(path);
      await editor.close();
      await tab.bringToFront();
      return { bytes, width: Number(w), height: Number(h) };
    };
    report.runs.push({ dpr, viewport: vp });

    // --- inyección bajo demanda: sin scripts registrados -------------------
    const registered = await popup.evaluate(() =>
      chrome.scripting.getRegisteredContentScripts(),
    );
    assert.deepEqual(registered, []);
    assert.equal(await overlay.count(), 0, 'overlay antes de empezar');
    check(
      `DPR ${dpr}: sin content scripts registrados ni overlay antes de iniciar`,
    );

    // --- región: dibujar, resize, mover, teclado ----------------------------
    const before = await bodyHtml();
    await start('region');
    assert.equal(await sessionState().then((s) => s.mode), 'region');
    await drag([200, 150], [300, 250]);
    let box = await boxOf();
    near(box.x, 200, 2, 'x');
    near(box.y, 150, 2, 'y');
    near(box.width, 100, 2, 'ancho');
    near(box.height, 100, 2, 'alto');
    assert.match(await part('label').innerText(), /100 × 100 px/);
    check(
      `DPR ${dpr}: región dibujada con arrastre y lectura de tamaño en px CSS`,
    );
    await drag([300, 250], [360, 310]); // tirador SE
    box = await boxOf();
    near(box.width, 160, 2, 'resize ancho');
    near(box.height, 160, 2, 'resize alto');
    await drag([280, 230], [300, 250]); // mover +20,+20
    box = await boxOf();
    near(box.x, 220, 2, 'mover x');
    near(box.y, 170, 2, 'mover y');
    await tab.keyboard.press('ArrowRight');
    await tab.keyboard.press('Shift+ArrowDown');
    box = await boxOf();
    near(box.x, 221, 1, 'flecha x');
    near(box.y, 180, 1, 'Shift+flecha y');
    await tab.keyboard.press('Control+ArrowRight');
    box = await boxOf();
    near(box.width, 161, 1, 'Ctrl+flecha ancho');
    check(`DPR ${dpr}: tiradores, mover, flechas y Ctrl+flechas`);
    assert.equal(
      await bodyHtml(),
      before,
      'el DOM de la página cambió con el overlay',
    );
    // Escape limpia todo y no abre editor ni deja estado
    const pages = pagesBefore();
    await tab.keyboard.press('Escape');
    await overlay.waitFor({ state: 'detached' });
    assert.equal(pagesBefore(), pages);
    assert.equal(await bodyHtml(), before);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(
      await sessionState(),
      undefined,
      'estado de selección sin limpiar',
    );
    check(
      `DPR ${dpr}: Escape limpia overlay y estado, sin editor ni cambios en la página`,
    );

    // --- región: el recorte coincide con la selección ----------------------
    await start('region');
    await drag([450, 80], [750, 320]);
    const regionShot = await confirmAndExport(() =>
      tab.keyboard.press('Enter'),
    );
    const s = regionShot.width / 300;
    near(regionShot.height / 240, s, 0.02, 'escala por eje');
    near(s, regionShot.width / 300, 0.001, 'escala');
    const img = await decode(popup, regionShot.bytes);
    assert.equal(img.width, regionShot.width);
    const at = (cx, cy) => px(img, Math.round(cx * s), Math.round(cy * s));
    assert.deepEqual(at(100, 100), [0, 0, 255, 255], 'azul en el interior');
    assert.deepEqual(at(10, 10), [255, 255, 255, 255], 'blanco fuera del azul');
    assert.deepEqual(
      at(280, 100),
      [255, 255, 255, 255],
      'blanco a la derecha del azul',
    );
    // bordes: x local 50 es el borde izquierdo del bloque azul (500 - 450)
    assert.deepEqual(
      at(48, 100),
      [255, 255, 255, 255],
      'borde izquierdo exacto (fuera)',
    );
    assert.deepEqual(
      at(52, 100),
      [0, 0, 255, 255],
      'borde izquierdo exacto (dentro)',
    );
    report.runs.at(-1).regionScale = s;
    check(
      `DPR ${dpr}: recorte de región ${regionShot.width}×${regionShot.height} coincide con la selección (escala medida ${s})`,
    );
    await writeFile(
      resolve(evidence, `region-dpr${dpr}.png`),
      regionShot.bytes,
    );

    // --- scroll cancela la región -----------------------------------------
    await start('region');
    await drag([200, 150], [300, 250]);
    const pagesScroll = pagesBefore();
    await tab.mouse.wheel(0, 200);
    await overlay.waitFor({ state: 'detached' });
    assert.equal(pagesBefore(), pagesScroll);
    await tab.evaluate(() => scrollTo(0, 0));
    check(`DPR ${dpr}: el scroll cancela la región sin capturar`);

    // --- elemento inteligente ----------------------------------------------
    const layoutBefore = await tab.evaluate(() => {
      const r = document.getElementById('red').getBoundingClientRect();
      return [
        r.x,
        r.y,
        r.width,
        r.height,
        document.documentElement.scrollHeight,
      ];
    });
    const htmlBefore = await bodyHtml();
    await start('element');
    await tab.mouse.move(200, 200);
    await tab.mouse.move(210, 205);
    box = await boxOf();
    near(box.x, 100, 2, 'elemento x');
    near(box.y, 100, 2, 'elemento y');
    near(box.width, 300, 2, 'elemento ancho');
    near(box.height, 200, 2, 'elemento alto');
    assert.match(await part('label').innerText(), /div#red/);
    assert.deepEqual(
      await tab.evaluate(() => {
        const r = document.getElementById('red').getBoundingClientRect();
        return [
          r.x,
          r.y,
          r.width,
          r.height,
          document.documentElement.scrollHeight,
        ];
      }),
      layoutBefore,
      'el hover alteró el layout',
    );
    assert.equal(await bodyHtml(), htmlBefore, 'el hover alteró el DOM');
    check(`DPR ${dpr}: el hover resalta el elemento sin alterar layout ni DOM`);
    await tab.keyboard.press('ArrowUp');
    box = await boxOf();
    near(box.x, 80, 2, 'padre x');
    near(box.width, 340, 2, 'padre ancho');
    assert.match(await part('label').innerText(), /div#card/);
    await tab.keyboard.press('ArrowDown');
    box = await boxOf();
    near(box.width, 300, 2, 'hijo vuelve');
    check(`DPR ${dpr}: ↑ elige el padre y ↓ vuelve al hijo`);
    const elementShot = await confirmAndExport(() => tab.mouse.click(210, 205));
    const es = elementShot.width / 300;
    near(elementShot.height / 200, es, 0.02, 'escala elemento');
    const eimg = await decode(popup, elementShot.bytes);
    const mid = px(eimg, Math.round(150 * es), Math.round(100 * es));
    assert.deepEqual(mid, [255, 0, 0, 255], 'centro rojo');
    assert.deepEqual(px(eimg, 1, 1), [255, 0, 0, 255], 'esquina roja');
    assert.equal(
      await tab.evaluate(() => window.__clicks),
      0,
      'la página recibió el clic',
    );
    check(
      `DPR ${dpr}: elemento ${elementShot.width}×${elementShot.height} recortado exacto; la página no recibe el clic`,
    );
    await writeFile(
      resolve(evidence, `element-dpr${dpr}.png`),
      elementShot.bytes,
    );

    // --- iframe: se selecciona el marco completo y se avisa del límite -------
    await start('element');
    await tab.mouse.move(850, 420);
    await tab.mouse.move(855, 425);
    box = await boxOf();
    near(box.x, 750, 2, 'iframe x');
    near(box.width, 200, 2, 'iframe ancho');
    near(box.height, 150, 2, 'iframe alto');
    const text = await part('label').innerText();
    assert.match(text, /iframe/);
    assert.match(text, /Embedded frame|Marco incrustado/);
    if (dpr === 1)
      await tab.screenshot({ path: resolve(evidence, 'overlay-iframe.png') });
    await tab.keyboard.press('Escape');
    await overlay.waitFor({ state: 'detached' });
    check(
      `DPR ${dpr}: iframe de otro origen se selecciona completo y muestra el límite`,
    );

    // --- mensajes: un remitente de extensión no puede suplantar al content script ---
    const forged = await popup.evaluate(() =>
      chrome.runtime.sendMessage({
        version: 1,
        type: 'selection-done',
        requestId: '00000000-0000-4000-8000-000000000000',
        rect: { x: 0, y: 0, width: 10, height: 10 },
        viewport: { width: 100, height: 100 },
      }),
    );
    assert.equal(forged, undefined);
    check(
      `DPR ${dpr}: mensaje selection-done desde la UI de extensión se ignora`,
    );

    // --- página restringida --------------------------------------------------
    if (dpr === 1) {
      const restricted = await context.newPage();
      await restricted.goto('chrome://version');
      await restricted.bringToFront();
      const res = await popup.evaluate(() =>
        chrome.runtime.sendMessage({
          version: 1,
          type: 'start-selection',
          mode: 'region',
        }),
      );
      assert.deepEqual(res, { version: 1, ok: false, code: 'restricted' });
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(await sessionState(), undefined);
      await restricted.close();
      check('página restringida (chrome://) → restricted y sin estado');
    }
  } finally {
    await context.close();
  }
}
server.close();
assert.deepEqual(report.consoleErrors, [], 'errores de consola');
check('0 errores de consola');
await writeFile(
  resolve(evidence, 'report.json'),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
