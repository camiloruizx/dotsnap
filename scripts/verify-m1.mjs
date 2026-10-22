// Verificación real de M1: carga la variante de pruebas en Chromium/Chrome, captura una página
// local, anota, exporta y decodifica el PNG descargado para comprobar píxeles.
// No automatiza el gesto real de la barra de herramientas (activeTab): ver docs/validacion-m1.md.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
const evidence = resolve('docs/evidence/m1');
await mkdir(evidence, { recursive: true });
const manifest = JSON.parse(
  await readFile(resolve(output, 'manifest.json'), 'utf8'),
);
assert.deepEqual(manifest.permissions.toSorted(), [
  'activeTab',
  'scripting',
  'storage',
]);
assert.deepEqual(manifest.host_permissions, ['<all_urls>']);

const page = `<!doctype html><meta charset="utf-8"><title>Prueba M1</title>
<body style="margin:0;background:#fff;font:20px sans-serif">
<div id="red" style="position:absolute;left:100px;top:100px;width:300px;height:200px;background:#ff0000"></div>
<div id="blue" style="position:absolute;left:500px;top:100px;width:200px;height:200px;background:#0000ff"></div>
<p style="position:absolute;left:100px;top:400px">DotSnap prueba</p></body>`;
const server = http.createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}/`;

const report = {
  browser: '',
  runs: [],
  checks: [],
  externalRequests: [],
  consoleErrors: [],
};
const check = (name) => report.checks.push(name);

async function launch(dpr) {
  const profile = await mkdtemp(resolve('.browser-profile/m1-'));
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
    p.on('request', (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(origin))
        report.externalRequests.push(r.url());
    });
  });
  return { context, id };
}

/** Decodifica el PNG en una página de la extensión y devuelve funciones de lectura de píxeles. */
async function decode(page, bytes) {
  return page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const { data } = g.getImageData(0, 0, bmp.width, bmp.height);
    return { width: bmp.width, height: bmp.height, data: Array.from(data) };
  }, bytes.toString('base64'));
}
const labels = {
  es: {
    select: 'Seleccionar',
    rect: 'Rectángulo',
    arrow: 'Flecha',
    text: 'Texto',
    redact: 'Censurar',
    download: 'Descargar PNG',
    undo: 'Deshacer',
    redo: 'Rehacer',
    visible: /Área visible/,
    alert: /No se puede capturar esta pestaña/,
  },
  en: {
    select: 'Select',
    rect: 'Rectangle',
    arrow: 'Arrow',
    text: 'Text',
    redact: 'Redact',
    download: 'Download PNG',
    undo: 'Undo',
    redo: 'Redo',
    visible: /Visible area/,
    alert: /This tab can't be captured/,
  },
};
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
    // Medimos, no suponemos: tamaño real del bitmap frente al viewport y DPR.
    const viewport = await tab.evaluate(() => ({
      w: innerWidth,
      h: innerHeight,
      dpr: devicePixelRatio,
    }));

    // Dos capturas simultáneas: una debe rechazarse por candado o intervalo, nunca duplicar.
    const send = () =>
      popup.evaluate(() =>
        chrome.runtime.sendMessage({ version: 1, type: 'capture-visible' }),
      );
    const editorPromise = context.waitForEvent('page', {
      predicate: (p) => p.url().includes('editor.html'),
    });
    editorPromise.catch(() => {});
    const results = await Promise.all([send(), send()]);
    const oks = results.filter((r) => r.ok).length;
    assert.equal(oks, 1, JSON.stringify(results));
    assert.equal(results.find((r) => !r.ok).code, 'busy');
    check(`DPR ${dpr}: dos capturas simultáneas → una ok y otra busy`);

    const editor = await editorPromise;
    await editor.waitForSelector('.canvas-host canvas');
    const info = await editor
      .locator('.editor-status span')
      .first()
      .innerText();
    const [, w, h] = /(\d+) × (\d+) px/.exec(info);
    const imgW = Number(w);
    const imgH = Number(h);
    report.runs.push({
      dpr: viewport.dpr,
      viewport,
      bitmap: { width: imgW, height: imgH },
    });
    // Escala medida (bitmap / viewport): no se asume DPR. Con emulación de DPR 2 el bitmap puede no escalar.
    const s = imgW / viewport.w;
    assert.ok(
      Math.abs(imgH / viewport.h - s) < 0.01,
      'escala distinta por eje',
    );
    report.runs.at(-1).measuredScale = s;
    check(
      `DPR ${dpr}: bitmap ${imgW}×${imgH} para viewport ${viewport.w}×${viewport.h} → escala medida ${s}`,
    );

    const canvas = editor.locator('.canvas-host canvas').last();
    const box = await canvas.boundingBox();
    const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
    const drag = async (from, to) => {
      await editor.mouse.move(...at(...from));
      await editor.mouse.down();
      await editor.mouse.move(...at(...to), { steps: 6 });
      await editor.mouse.up();
    };
    const tool = (name) =>
      editor.getByRole('button', { name, exact: true }).first().click();
    const lang = await editor.evaluate(() => document.documentElement.lang);
    const es = labels[lang];
    const L = es;
    report.runs.at(-1).language = lang;

    // Censura: cubre el bloque rojo (100..400 × 100..300 en px CSS → fracciones del viewport).
    const fr = (x, y) => [x / viewport.w, y / viewport.h];
    await tool(es.redact);
    await drag(fr(90, 90), fr(410, 310));
    await tool(es.rect);
    await drag(fr(480, 80), fr(720, 320));
    await tool(es.arrow);
    await drag(fr(450, 450), fr(650, 520));
    await tool(es.text);
    await editor.mouse.click(...at(...fr(100, 350)));
    await editor.keyboard.type('Hola');
    await editor.keyboard.press('Enter');
    assert.equal(
      await editor.locator('[role=toolbar] [aria-pressed=true]').count(),
      1,
      'más de una herramienta activa',
    );
    await editor.screenshot({
      path: resolve(evidence, `editor-dpr${dpr}.png`),
    });

    const exportPng = async () => {
      const downloadPromise = editor.waitForEvent('download');
      await editor.getByRole('button', { name: L.download }).click();
      const download = await downloadPromise;
      const path = resolve(evidence, `export-dpr${dpr}.png`);
      await download.saveAs(path);
      return {
        bytes: await readFile(path),
        name: download.suggestedFilename(),
      };
    };
    const first = await exportPng();
    assert.match(first.name, /^dotsnap-\d{8}-\d{6}\.png$/);
    assert.deepEqual(
      [...first.bytes.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
    const img = await decode(popup, first.bytes);
    assert.equal(img.width, imgW);
    assert.equal(img.height, imgH);
    check(
      `DPR ${dpr}: PNG real (firma) con dimensiones nativas ${img.width}×${img.height}`,
    );

    const inside = [
      [110, 110],
      [250, 200],
      [395, 295],
      [150, 105],
    ];
    for (const [x, y] of inside)
      assert.deepEqual(
        px(img, Math.round(x * s), Math.round(y * s)),
        [0, 0, 0, 255],
        `censura en ${x},${y}`,
      );
    // Todo el rectángulo censurado debe ser negro opaco: ningún píxel rojo original recuperable.
    let leaked = 0;
    for (let y = Math.round(100 * s); y < Math.round(300 * s); y += 3)
      for (let x = Math.round(100 * s); x < Math.round(400 * s); x += 3) {
        const p = px(img, x, y);
        if (p[0] !== 0 || p[1] !== 0 || p[2] !== 0 || p[3] !== 255) leaked += 1;
      }
    assert.equal(leaked, 0, 'píxeles del bloque rojo visibles bajo la censura');
    check(
      `DPR ${dpr}: censura aplanada, 0 píxeles originales visibles en el área`,
    );
    // Fuera de la censura la captura conserva el contenido (azul) y el fondo.
    assert.deepEqual(
      px(img, Math.round(600 * s), Math.round(200 * s)).slice(0, 3),
      [0, 0, 255],
    );
    assert.deepEqual(
      px(img, Math.round(900 * s), Math.round(550 * s)).slice(0, 3),
      [255, 255, 255],
    );
    // La flecha y el rectángulo dejaron trazo rojo (#e5484d) en algún punto del borde del rectángulo.
    let stroke = 0;
    for (let x = Math.round(480 * s); x < Math.round(720 * s); x += 1) {
      const p = px(img, x, Math.round(80 * s));
      if (Math.abs(p[0] - 0xe5) < 6 && Math.abs(p[1] - 0x48) < 6) stroke += 1;
    }
    assert.ok(stroke > 20, 'trazo del rectángulo ausente');
    check(
      `DPR ${dpr}: contenido bajo/alrededor intacto y anotaciones presentes`,
    );

    // Deshacer ×4 (texto, flecha, rectángulo, censura) devuelve el rojo original.
    await editor.locator('body').click({ position: { x: 5, y: 5 } });
    for (let i = 0; i < 4; i += 1)
      await editor.getByRole('button', { name: L.undo }).click();
    const second = await exportPng();
    const clean = await decode(popup, second.bytes);
    assert.deepEqual(
      px(clean, Math.round(250 * s), Math.round(200 * s)),
      [255, 0, 0, 255],
    );
    check(`DPR ${dpr}: deshacer restaura el píxel original (rojo)`);
    await editor.getByRole('button', { name: L.redo }).click();
    assert.ok(await editor.getByRole('button', { name: L.undo }).isEnabled());

    if (dpr === 1) {
      // Editar lo existente: mover, borrar con teclado y reabrir un texto.
      const sel = L.select;
      await tool(L.rect);
      await drag(fr(780, 400), fr(880, 480));
      await tool(sel);
      await drag(fr(780, 440), fr(780, 500)); // arrastra el borde izquierdo 60 px hacia abajo
      const moved = await decode(popup, (await exportPng()).bytes);
      const red = (p) => p[0] > 200 && p[1] < 120 && p[2] < 120;
      assert.ok(
        red(px(moved, 830, 460)),
        'borde superior debe estar en y=460 tras mover',
      );
      assert.ok(
        !red(px(moved, 830, 400)),
        'ya no debe haber trazo en la posición original',
      );
      check('seleccionar y mover un rectángulo cambia su posición en el PNG');
      await editor.keyboard.press('Delete');
      const deleted = await decode(popup, (await exportPng()).bytes);
      assert.ok(
        !red(px(deleted, 830, 460)),
        'Delete debe eliminar el objeto seleccionado',
      );
      check('Delete elimina el objeto seleccionado');
      await editor.keyboard.press('Control+z');
      const restored = await decode(popup, (await exportPng()).bytes);
      assert.ok(red(px(restored, 830, 460)), 'Ctrl+Z debe devolver el objeto');
      check('Ctrl+Z restaura el objeto eliminado');
      await tool(es.text);
      await editor.mouse.click(...at(...fr(100, 350)));
      await editor.keyboard.type('Hola');
      await editor.keyboard.press('Enter');
      await tool(sel);
      await editor.mouse.dblclick(...at(...fr(120, 360)));
      const area = editor.locator('.text-editor');
      assert.equal(await area.inputValue(), 'Hola');
      await editor.keyboard.press('Control+A');
      await editor.keyboard.type('Adios');
      await editor.keyboard.press('Enter');
      await editor.mouse.dblclick(...at(...fr(120, 360)));
      assert.equal(await area.inputValue(), 'Adios');
      await editor.keyboard.press('Escape');
      check('doble clic reabre el texto y la edición persiste');
    }
    if (dpr === 1) {
      // Censura pixelada y desenfocada sobre bordes reales de la página (azul/blanco).
      await tool(L.redact);
      const style = editor.locator('.inline-field select');
      await style.selectOption('pixelate');
      await drag(fr(460, 150), fr(760, 250));
      await style.selectOption('blur');
      await drag(fr(540, 250), fr(660, 350));
      const soft = await decode(popup, (await exportPng()).bytes);
      const a1 = px(soft, 490, 200);
      const a2 = px(soft, 505, 200);
      assert.deepEqual(a1, a2, 'pixelado: bloque de color uniforme');
      assert.ok(
        a1[0] > 20 && a1[0] < 235 && a1[3] === 255,
        `pixelado: bloque mezcla blanco y azul (${a1})`,
      );
      const above = px(soft, 600, 290);
      const below = px(soft, 600, 310);
      assert.ok(
        above[0] > 5 && below[0] < 250 && above[3] === 255 && below[3] === 255,
        `desenfoque: el borde se difumina (${above} / ${below})`,
      );
      check('censura pixelada y desenfocada: sin borde nítido y opaca');
      // Color: combo con cuadro y nombre, y selector de paleta personalizado.
      await tool(L.rect);
      const combo = editor.locator('.color-combo-button');
      await combo.click();
      await editor.screenshot({ path: resolve(evidence, 'editor-combo.png') });
      const options = editor.getByRole('option');
      assert.equal(await options.count(), 8, 'opciones de color');
      for (const option of await options.all()) {
        assert.ok(
          ((await option.textContent()) ?? '').trim().length > 0,
          'opción sin nombre',
        );
        assert.ok(
          await option.locator('.color-swatch').isVisible(),
          'opción sin cuadro de color',
        );
      }
      await editor.keyboard.press('Escape');
      assert.equal(await options.count(), 0, 'Escape cierra el combo');
      await combo.click();
      await options.nth(1).click();
      assert.equal(await options.count(), 0, 'elegir cierra el combo');
      const blueName =
        (await options.count()) === 0 ? await combo.textContent() : '';
      assert.ok(/Azul|Blue/.test(blueName ?? ''), 'el combo muestra el nombre');
      const near = (img, x, y, ok) => {
        for (let dx = -4; dx <= 4; dx++)
          for (let dy = -4; dy <= 4; dy++)
            if (ok(px(img, x + dx, y + dy))) return true;
        return false;
      };
      await tool(L.rect);
      await drag(fr(900, 60), fr(980, 120));
      await combo.click();
      await editor.locator('input[type=color]').fill('#00c800');
      assert.ok(
        /#00C800/.test((await combo.textContent()) ?? ''),
        'el combo muestra el código personalizado',
      );
      await drag(fr(900, 150), fr(980, 210));
      const colored = await decode(popup, (await exportPng()).bytes);
      assert.ok(
        near(colored, 900, 90, (p) => p[2] > 150 && p[0] < 60),
        'rectángulo azul de la paleta',
      );
      assert.ok(
        near(colored, 900, 180, (p) => p[1] > 150 && p[0] < 60 && p[2] < 60),
        'rectángulo con color personalizado',
      );
      check(
        'color: combo con nombre y cuadro, paleta y color personalizado dibujan',
      );
      await editor.screenshot({ path: resolve(evidence, 'editor-color.png') });
    }
    if (dpr === 1) {
      const axe = await new AxeBuilder({ page: editor })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.equal(
        axe.violations.length,
        0,
        JSON.stringify(axe.violations.map((v) => v.id)),
      );
      check('editor: axe WCAG A/AA sin infracciones');
      // Página restringida: el error real de Chrome se traduce y se muestra en el popup.
      const restricted = await context.newPage();
      await restricted.goto('chrome://version');
      await restricted.bringToFront();
      await popup.bringToFront();
      await popup.evaluate(() => new Promise((r) => setTimeout(r, 800)));
      await restricted.bringToFront();
      const response = await send();
      assert.equal(response.ok, false);
      assert.equal(response.code, 'restricted', JSON.stringify(response));
      check('página restringida (chrome://) → código restricted, sin editor');
      await restricted.bringToFront();
      await popup
        .getByRole('button', { name: L.visible })
        .evaluate((el) => el.click());
      await popup.waitForFunction(
        () => document.querySelector('[role=alert]')?.textContent,
      );
      const alert = await popup.getByRole('alert').innerText();
      assert.match(alert, L.alert);
      check('popup muestra el error accionable');
      await popup.screenshot({ path: resolve(evidence, 'popup-error.png') });
    }
  } finally {
    await context.close();
  }
}
assert.deepEqual(report.externalRequests, []);
assert.deepEqual(report.consoleErrors, []);
check(
  '0 solicitudes a hosts distintos de la página local y 0 errores de consola',
);
server.close();
await writeFile(
  resolve(evidence, 'report.json'),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
