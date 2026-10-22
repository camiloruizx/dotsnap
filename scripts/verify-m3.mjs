// Verificación real de M3 (página completa) en Chromium/Chrome con la variante de pruebas.
// No automatiza el gesto real de la barra de herramientas (activeTab): ver docs/validacion-m3.md.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
const production = resolve('.output/chrome-mv3');
const evidence = resolve('docs/evidence/m3');
await mkdir(evidence, { recursive: true });
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

/** Color único y reproducible de la franja i (cada 100 px de página). */
const band = (i) => [
  ((50 + i * 17) % 200) + 30,
  ((80 + i * 31) % 170) + 40,
  ((110 + i * 47) % 150) + 60,
];
const rgb = (c) => `rgb(${c.join(',')})`;
const LAZY = 18; // franja de imagen perezosa
const bands = (n, lazy) =>
  Array.from({ length: n }, (_, i) =>
    lazy && i === LAZY
      ? '<img id="lazy" data-src="/lazy.svg" width="1000" height="100" style="display:block;background:#888888">'
      : `<div style="height:100px;background:${rgb(band(i))}"></div>`,
  ).join('');

const pages = {
  '/long': `<!doctype html><meta charset="utf-8"><title>Larga</title>
<body style="margin:0;background:#fff">
<div id="sticky" style="position:sticky;top:70px;height:30px;width:100px;background:#00ffff;margin-bottom:-30px;z-index:5"></div>
${bands(30, true)}
<div id="header" style="position:fixed;top:0;left:0;right:0;height:60px;background:#ff00ff"></div>
<div id="footer" style="position:fixed;bottom:0;left:0;right:0;height:40px;background:#ffa500"></div>
<script>new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){e.target.src=e.target.dataset.src;o.unobserve(e.target)}})).observe(document.getElementById('lazy'))</script></body>`,
  '/huge': `<!doctype html><meta charset="utf-8"><body style="margin:0">${Array.from(
    { length: 200 },
    (_, i) =>
      `<div style="height:100px;background:rgb(${i},${255 - i},128)"></div>`,
  ).join('')}</body>`,
  '/cancel': `<!doctype html><meta charset="utf-8"><body style="margin:0">
<div id="header" style="position:fixed;top:0;left:0;right:0;height:40px;background:#ff00ff"></div>${bands(120, false)}</body>`,
  '/toolong': `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="height:100000px;background:#ccc"></div></body>`,
  '/short': `<!doctype html><meta charset="utf-8"><body style="margin:0"><div style="height:300px;background:${rgb(band(3))}"></div></body>`,
};
const lazySvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="100"><rect width="1000" height="100" fill="#00aa00"/></svg>';
const server = http.createServer((req, res) => {
  if (req.url === '/lazy.svg') {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      res.end(lazySvg);
    }, 400);
    return;
  }
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  const body = pages[req.url];
  res.writeHead(body ? 200 : 404, {
    'content-type': 'text/html; charset=utf-8',
  });
  res.end(body ?? '');
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const report = { browser: '', runs: [], checks: [], consoleErrors: [] };
const check = (name) => report.checks.push(name);

async function launch(dpr) {
  const profile = await mkdtemp(resolve('.browser-profile/m3-'));
  const executablePath = process.env.DOTSNAP_CHROME;
  const context = await chromium.launchPersistentContext(profile, {
    ...(executablePath ? { executablePath } : { channel: 'chrome' }),
    headless: true,
    viewport: { width: 1000, height: 600 },
    deviceScaleFactor: dpr,
    acceptDownloads: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: executablePath
      ? [
          `--disable-extensions-except=${output}`,
          `--load-extension=${output}`,
          ...(process.env.DOTSNAP_FORCE_DPR
            ? [`--force-device-scale-factor=${dpr}`]
            : []),
        ]
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
/** Decodifica el PNG en la página y devuelve solo el tamaño y los píxeles pedidos (imágenes enormes). */
async function sample(pg, bytes, points) {
  return pg.evaluate(
    async ([b64, pts]) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(
        new Blob([bin], { type: 'image/png' }),
      );
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      return {
        width: bmp.width,
        height: bmp.height,
        pixels: pts.map(([x, y]) =>
          Array.from(g.getImageData(x, y, 1, 1).data),
        ),
      };
    },
    [bytes.toString('base64'), points],
  );
}
const px = (img, x, y) =>
  Array.from(
    img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4),
  );
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const dpr of (process.env.DOTSNAP_DPRS ?? '1,2').split(',').map(Number)) {
  const { context, id } = await launch(dpr);
  try {
    report.browser = context.browser().version();
    const base = `chrome-extension://${id}`;
    const tab = await context.newPage();
    const popup = await context.newPage();
    await popup.goto(`${base}/popup.html`);
    const msg = (m) => popup.evaluate((x) => chrome.runtime.sendMessage(x), m);
    const startFull = () => msg({ version: 1, type: 'capture-fullpage' });
    const badgeText = () =>
      popup.evaluate(() => chrome.action.getBadgeText({}));
    const stateOf = () =>
      popup.evaluate(
        async () =>
          (await chrome.storage.session.get('fullpage.state'))[
            'fullpage.state'
          ],
      );
    const open = async (path) => {
      await tab.goto(origin + path);
      await tab.bringToFront();
    };
    /** Espera n pestañas del editor y exporta el PNG de cada una, ordenadas por parte. */
    const collectEditors = async (n, trigger) => {
      const editors = [];
      const onPage = (p) => p.url().includes('editor.html') && editors.push(p);
      context.on('page', onPage);
      await trigger();
      const deadline = Date.now() + 120_000;
      while (editors.length < n && Date.now() < deadline) await sleep(200);
      context.off('page', onPage);
      assert.equal(editors.length, n, `se esperaban ${n} editores`);
      const out = [];
      for (const editor of editors) {
        await editor.waitForSelector('.canvas-host canvas');
        const q = new URL(editor.url()).searchParams;
        const status = await editor
          .locator('.editor-status span')
          .first()
          .innerText();
        const [, w, h] = /(\d+) × (\d+) px/.exec(status);
        const download = editor.waitForEvent('download');
        await editor
          .getByRole('button', { name: /Download PNG|Descargar PNG/ })
          .click();
        const file = await download;
        const path = resolve(evidence, `tmp.png`);
        await file.saveAs(path);
        out.push({
          part: Number(q.get('part') ?? 1),
          parts: Number(q.get('parts') ?? 1),
          status,
          width: Number(w),
          height: Number(h),
          bytes: await readFile(path),
        });
        await editor.close();
      }
      await tab.bringToFront();
      return out.sort((a, b) => a.part - b.part);
    };
    report.runs.push({ dpr });

    // --- sin scripts registrados antes de empezar ----------------------------
    assert.deepEqual(
      await popup.evaluate(() =>
        chrome.scripting.getRegisteredContentScripts(),
      ),
      [],
    );

    // --- página larga: fixed, sticky, lazy, costuras y restauración -----------
    await open('/long');
    await tab.evaluate(() => scrollTo(0, 250));
    const dims = await tab.evaluate(() => ({
      cw: document.documentElement.clientWidth,
      ch: document.documentElement.clientHeight,
      sh: document.documentElement.scrollHeight,
    }));
    assert.equal(dims.sh, 3000);
    const styleAttrs = () =>
      tab.evaluate(() =>
        ['header', 'footer', 'sticky'].map((id) =>
          document.getElementById(id).getAttribute('style'),
        ),
      );
    const stylesBefore = await styleAttrs();
    const t0 = Date.now();
    let started;
    const [shot] = await collectEditors(1, async () => {
      started = await startFull();
    });
    const elapsed = Date.now() - t0;
    assert.deepEqual(started, { version: 1, ok: true });
    const tiles = Math.ceil(3000 / dims.ch);
    assert.ok(
      elapsed >= (tiles - 1) * 600,
      `cola ≥600 ms entre capturas (${elapsed} ms para ${tiles} tramos)`,
    );
    check(
      `DPR ${dpr}: ${tiles} tramos en ${elapsed} ms (≥ ${(tiles - 1) * 600} ms: cola de 600 ms respetada)`,
    );
    const img = await decode(popup, shot.bytes);
    const s = img.width / dims.cw;
    assert.equal(img.width, Math.round(dims.cw * s));
    assert.ok(
      Math.abs(img.height - 3000 * s) <= 1,
      `alto ${img.height} ≠ ${3000 * s}`,
    );
    report.runs.at(-1).scale = s;
    check(
      `DPR ${dpr}: imagen ${img.width}×${img.height} = ancho útil × alto de página (escala medida ${s})`,
    );
    const at = (x, y) => px(img, Math.round(x * s), Math.round(y * s));
    // cada franja, en su centro y pegada a sus bordes (incluye las costuras entre tramos)
    for (let i = 0; i < 30; i++) {
      if (i === LAZY) continue;
      const want = [...band(i), 255];
      for (const dy of [50, 2, 97]) {
        const y = i * 100 + dy;
        if (
          y < 60 ||
          (y >= 560 && y < 600) ||
          (y >= 70 && y < 100 && dy !== 97)
        )
          continue; // zona del header/footer/sticky del primer tramo
        assert.deepEqual(at(500, y), want, `franja ${i} en y=${y}`);
      }
    }
    check(
      `DPR ${dpr}: 29 franjas de color correctas en el centro y los bordes, sin huecos ni solapes en las costuras`,
    );
    assert.deepEqual(
      at(500, LAZY * 100 + 50),
      [0, 170, 0, 255],
      'contenido perezoso cargado',
    );
    check(
      `DPR ${dpr}: la imagen perezosa (carga con retraso) aparece cargada, no su marcador gris`,
    );
    // fixed/sticky: una sola vez, en el primer tramo
    assert.deepEqual(
      at(500, 30),
      [255, 0, 255, 255],
      'header en el primer tramo',
    );
    assert.deepEqual(
      at(500, 630),
      [...band(6), 255],
      'header no se repite en el segundo tramo',
    );
    assert.deepEqual(at(500, 1230), [...band(12), 255]);
    assert.deepEqual(
      at(500, 580),
      [255, 165, 0, 255],
      'footer fixed en su posición del primer tramo',
    );
    assert.deepEqual(at(500, 1180), [...band(11), 255], 'footer no se repite');
    let cyanRows = 0;
    let magentaRows = 0;
    for (let y = 0; y < img.height; y++) {
      const p = px(img, Math.round(50 * s), y);
      if (p[0] === 0 && p[1] === 255 && p[2] === 255) cyanRows++;
      const q = px(img, Math.round(500 * s), y);
      if (q[0] === 255 && q[1] === 0 && q[2] === 255) magentaRows++;
    }
    assert.ok(
      cyanRows > 0 && cyanRows <= Math.ceil(31 * s),
      `sticky repetido (${cyanRows} filas)`,
    );
    assert.ok(
      magentaRows > 0 && magentaRows <= Math.ceil(61 * s),
      `header repetido (${magentaRows} filas)`,
    );
    check(
      `DPR ${dpr}: header fixed, footer fixed y sticky aparecen una sola vez (primer tramo), no en cada tramo`,
    );
    await writeFile(resolve(evidence, `long-dpr${dpr}.png`), shot.bytes);
    // restauración
    const after = await tab.evaluate(() => ({
      y: scrollY,
      vis: ['header', 'footer', 'sticky'].map(
        (id) => getComputedStyle(document.getElementById(id)).visibility,
      ),
    }));
    assert.equal(after.y, 250, 'scroll restaurado');
    assert.deepEqual(after.vis, ['visible', 'visible', 'visible']);
    assert.deepEqual(
      await styleAttrs(),
      stylesBefore,
      'estilos en línea restaurados',
    );
    await sleep(300);
    assert.equal(await stateOf(), undefined, 'estado sin limpiar');
    assert.equal(await badgeText(), '');
    check(
      `DPR ${dpr}: scroll (250), visibilidad y estilos en línea restaurados; sin estado ni badge`,
    );

    // --- página corta: un solo tramo -------------------------------------------
    await open('/short');
    const [one] = await collectEditors(1, startFull);
    const shortImg = await decode(popup, one.bytes);
    const shortDims = await tab.evaluate(() => [
      document.documentElement.clientWidth,
      document.documentElement.clientHeight,
    ]);
    assert.equal(shortImg.width, Math.round(shortDims[0] * s));
    assert.ok(Math.abs(shortImg.height - shortDims[1] * s) <= 1);
    check(
      `DPR ${dpr}: página más corta que el viewport → un solo tramo del tamaño del viewport`,
    );

    if (dpr !== 1) continue;

    // --- límite de tramos --------------------------------------------------------
    await open('/toolong');
    await tab.evaluate(() => scrollTo(0, 777));
    const pagesBefore = context.pages().length;
    assert.deepEqual(await startFull(), {
      version: 1,
      ok: false,
      code: 'tooLarge',
    });
    await sleep(300);
    assert.equal(context.pages().length, pagesBefore, 'no se abrió editor');
    assert.equal(await tab.evaluate(() => scrollY), 777, 'scroll intacto');
    assert.equal(await stateOf(), undefined);
    assert.equal(await badgeText(), '!', 'aviso de error en el icono');
    check(
      'página de 100 000 px: se rechaza antes de capturar (tooLarge), sin tocar el scroll y con aviso en el icono',
    );
    // el candado se libera: una captura visible funciona justo después
    await sleep(700);
    const visible = collectEditors(1, () =>
      msg({ version: 1, type: 'capture-visible' }),
    );
    await visible;
    check(
      'el candado se libera tras el rechazo (captura visible posterior correcta)',
    );

    // --- cancelación con Escape y exclusión mutua -----------------------------------
    await open('/cancel');
    await tab.evaluate(() => scrollTo(0, 500));
    const pagesCancel = context.pages().length;
    assert.deepEqual(await startFull(), { version: 1, ok: true });
    await sleep(2000);
    assert.deepEqual(await msg({ version: 1, type: 'capture-visible' }), {
      version: 1,
      ok: false,
      code: 'busy',
    });
    assert.deepEqual(await startFull(), {
      version: 1,
      ok: false,
      code: 'busy',
    });
    assert.match(await badgeText(), /^\d+\/\d+$/, 'progreso en el icono');
    check(
      'durante la captura: progreso en el icono y capturas concurrentes rechazadas con busy',
    );
    await tab.keyboard.press('Escape');
    const deadline = Date.now() + 15_000;
    while ((await stateOf()) !== undefined && Date.now() < deadline)
      await sleep(200);
    assert.equal(await stateOf(), undefined, 'cancelación sin completar');
    await sleep(500);
    assert.equal(
      context.pages().length,
      pagesCancel,
      'la cancelación abrió un editor',
    );
    const cancelled = await tab.evaluate(() => ({
      y: scrollY,
      vis: getComputedStyle(document.getElementById('header')).visibility,
      style: document.getElementById('header').getAttribute('style'),
    }));
    assert.equal(cancelled.y, 500, 'scroll restaurado tras cancelar');
    assert.equal(cancelled.vis, 'visible');
    assert.equal(
      cancelled.style,
      'position:fixed;top:0;left:0;right:0;height:40px;background:#ff00ff',
    );
    assert.equal(await badgeText(), '');
    check(
      'Escape cancela: sin editor, scroll y estilos restaurados, sin estado ni badge',
    );

    // --- navegación durante la captura: se restaura y se informa ------------------------
    await sleep(700);
    await open('/cancel');
    assert.deepEqual(await startFull(), { version: 1, ok: true });
    await sleep(1800);
    await tab.goto(origin + '/short');
    const nav = Date.now() + 20_000;
    while ((await stateOf()) !== undefined && Date.now() < nav)
      await sleep(200);
    assert.equal(await stateOf(), undefined, 'estado tras navegar');
    await sleep(500);
    assert.equal(
      context.pages().filter((p) => p.url().includes('editor.html')).length,
      0,
    );
    assert.equal(await badgeText(), '!', 'aviso tras navegar');
    check(
      'navegar durante la captura la aborta con aviso y sin dejar estado ni editor',
    );

    // --- salida segmentada: 20 000 px → 3 partes sin canvas gigante ------------------------
    await sleep(700);
    await open('/huge');
    const hugeDims = await tab.evaluate(
      () => document.documentElement.clientWidth,
    );
    const parts = await collectEditors(3, startFull);
    assert.equal(parts.length, 3);
    const color = (i) => [i, 255 - i, 128, 255];
    // costuras entre partes: filas globales 8191|8192 y 16383|16384 pertenecen a las franjas 81 y 163;
    // más una fila cada 37 de cada parte, que debe ser la franja que toca (sin saltos ni repeticiones).
    const expectedFor = (pi, r) => color(Math.floor((pi * 8192 + r) / 100));
    const decoded = [];
    for (const [pi, p] of parts.entries()) {
      assert.equal(p.parts, 3);
      const rows = [0, p.height - 1];
      for (let r = 0; r < p.height; r += 37) rows.push(r);
      const result = await sample(
        popup,
        p.bytes,
        rows.map((r) => [500, r]),
      );
      rows.forEach((r, i) =>
        assert.deepEqual(
          result.pixels[i],
          expectedFor(pi, r),
          `parte ${pi + 1}, fila ${r}`,
        ),
      );
      decoded.push({ width: result.width, height: result.height });
    }
    assert.deepEqual(
      decoded.map((d) => d.height),
      [8192, 8192, 3616],
    );
    assert.ok(
      decoded.every(
        (d) => d.width === hugeDims && d.width * 8192 <= 33_177_600,
      ),
    );
    assert.match(parts[1].status, /8192/);
    report.runs.at(-1).parts = decoded.map((d) => `${d.width}×${d.height}`);
    check(
      '20 000 px → 3 partes numeradas (8192 + 8192 + 3616), cada una dentro del presupuesto, con costuras exactas',
    );

    // --- página restringida -----------------------------------------------------------------
    await sleep(700);
    const restricted = await context.newPage();
    await restricted.goto('chrome://version');
    await restricted.bringToFront();
    assert.deepEqual(await startFull(), {
      version: 1,
      ok: false,
      code: 'restricted',
    });
    assert.equal(await stateOf(), undefined);
    await restricted.close();
    check('página restringida (chrome://) → restricted y sin estado');

    // --- mensajes: la UI de extensión no puede suplantar al agente ----------------------------------
    assert.equal(
      await msg({
        version: 1,
        type: 'fullpage-cancel',
        requestId: '00000000-0000-4000-8000-000000000000',
      }),
      undefined,
    );
    check('fullpage-cancel enviado desde la UI de extensión se ignora');
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
