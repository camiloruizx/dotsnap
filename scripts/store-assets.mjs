// Genera los recursos gráficos de la ficha de la Chrome Web Store (ES y EN) con la variante de pruebas.
// Uso: npm run build:test && DOTSNAP_CHROME=... node scripts/store-assets.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, copyFile } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
const out = resolve('store/screenshots');
await mkdir(resolve('.browser-profile'), { recursive: true });

// Página de demostración neutra (marca y datos ficticios), con posiciones absolutas conocidas.
const demo = (lang) => `<!doctype html><meta charset="utf-8"><title>Demo</title>
<style>
body{margin:0;width:1280px;height:620px;position:relative;background:#f3f5f9;font:15px system-ui,Segoe UI,Arial,sans-serif;color:#1d2b40;overflow:hidden}
.top{position:absolute;left:0;top:0;width:1280px;height:60px;background:#1d2b40;color:#fff;font-size:20px;line-height:60px;text-indent:40px}
.card{position:absolute;background:#fff;border-radius:10px;box-shadow:0 1px 3px #0002;padding:18px 22px;box-sizing:border-box}
.big{font-size:38px;font-weight:700;margin-top:8px;color:#0b5cad}
.bar{position:absolute;bottom:34px;width:46px;background:#3794ff;border-radius:6px 6px 0 0}
table{width:100%;border-collapse:collapse;margin-top:10px}td{padding:11px 4px;border-bottom:1px solid #e3e8f0}
</style>
<div class="top">${lang === 'es' ? 'Panel de ventas' : 'Sales dashboard'}</div>
<div class="card" style="left:40px;top:90px;width:380px;height:140px">${lang === 'es' ? 'Ingresos del mes' : 'Monthly revenue'}<div class="big">$ 48,200</div></div>
<div class="card" style="left:450px;top:90px;width:380px;height:140px">${lang === 'es' ? 'Pedidos nuevos' : 'New orders'}<div class="big">1,284</div></div>
<div class="card" style="left:860px;top:90px;width:380px;height:140px">${lang === 'es' ? 'Clientes activos' : 'Active customers'}<div class="big">3,906</div></div>
<div class="card" style="left:40px;top:260px;width:720px;height:330px">${lang === 'es' ? 'Ventas por semana' : 'Weekly sales'}
${[90, 130, 110, 170, 150, 230, 200, 260].map((h, i) => `<div class="bar" style="left:${40 + i * 80}px;height:${h}px"></div>`).join('')}</div>
<div class="card" style="left:790px;top:260px;width:450px;height:330px">${lang === 'es' ? 'Últimos pedidos' : 'Latest orders'}
<table><tr><td>#1042</td><td>Ana Pérez</td><td>$ 320</td></tr>
<tr><td>#1043</td><td>ana.perez@example.com</td><td>$ 95</td></tr>
<tr><td>#1044</td><td>Luis Gómez</td><td>$ 410</td></tr>
<tr><td>#1045</td><td>Marta Ruiz</td><td>$ 150</td></tr></table></div>`;

const names = {
  es: {
    arrow: 'Flecha',
    rect: 'Rectángulo',
    ellipse: 'Elipse',
    hl: 'Resaltador',
    step: 'Paso',
    text: 'Texto',
    redact: 'Censurar',
    expo: /^Exportar…$/,
    hist: /Historial/,
    cap: /Captura/,
  },
  en: {
    arrow: 'Arrow',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    hl: 'Highlighter',
    step: 'Step',
    text: 'Text',
    redact: 'Redact',
    expo: /^Export…$/,
    hist: /History/,
    cap: /Capture/,
  },
};
const labelsTop = {
  es: [
    'Captura, anota y exporta',
    'Todo en tu dispositivo, sin cuentas ni red',
  ],
  en: [
    'Capture, annotate and export',
    'All on your device, no accounts or network',
  ],
};

let current = null;
for (const lang of ['es', 'en']) {
  const N = names[lang];
  let server;
  let context;
  try {
    server = http.createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(demo(lang));
    });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    const origin = `http://127.0.0.1:${server.address().port}/`;
    context = await chromium.launchPersistentContext(
      await mkdtemp(resolve(`.browser-profile/store-${lang}-`)),
      {
        executablePath: process.env.DOTSNAP_CHROME,
        headless: true,
        viewport: { width: 1280, height: 620 },
        args: [
          `--disable-extensions-except=${output}`,
          `--load-extension=${output}`,
        ],
      },
    );
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const base = `chrome-extension://${new URL(worker.url()).host}`;
    const tab = await context.newPage();
    await tab.goto(origin);
    const popup = await context.newPage();
    await popup.goto(`${base}/popup.html`);
    await popup.evaluate(
      (l) =>
        chrome.storage.local.set({
          'preferences.v1': { language: l, theme: 'light' },
        }),
      lang,
    );
    await popup.reload();
    await mkdir(resolve(out, lang), { recursive: true });
    const dir = resolve(out, lang);

    // 1 y 2: editor con anotaciones y panel de exportación.
    await tab.bringToFront();
    const opened = context.waitForEvent('page', {
      predicate: (p) => p.url().includes('editor.html'),
    });
    await popup.evaluate(() =>
      chrome.runtime.sendMessage({ version: 1, type: 'capture-visible' }),
    );
    const editor = await opened;
    await editor.setViewportSize({ width: 1280, height: 800 });
    await editor.waitForSelector('.canvas-host canvas');
    await editor.waitForTimeout(400);
    const box = await editor
      .locator('.canvas-host canvas')
      .last()
      .boundingBox();
    const at = (x, y) => [
      box.x + (box.width * x) / 1280,
      box.y + (box.height * y) / 620,
    ];
    const tool = (n) =>
      editor.getByRole('button', { name: n, exact: true }).first().click();
    const drag = async (a, b) => {
      await editor.mouse.move(...at(...a));
      await editor.mouse.down();
      await editor.mouse.move(...at(...b), { steps: 8 });
      await editor.mouse.up();
    };
    await tool(N.rect);
    await drag([36, 86], [424, 234]);
    await tool(N.ellipse);
    await drag([560, 300], [760, 380]);
    await tool(N.arrow);
    await drag([640, 200], [860, 300]);
    await tool(N.hl);
    await drag([800, 330], [1230, 372]);
    await tool(N.redact);
    await editor
      .locator('select:has(option[value="pixelate"])')
      .selectOption('pixelate');
    await drag([830, 372], [1150, 408]);
    await tool(N.step);
    await editor.mouse.click(...at(70, 110));
    await editor.mouse.click(...at(1215, 350));
    await tool(N.text);
    await editor.mouse.click(...at(480, 430));
    await editor.keyboard.type(
      lang === 'es' ? 'Mejor semana del mes' : 'Best week of the month',
    );
    await editor.keyboard.press('Enter');
    await editor
      .getByRole('button', {
        name: lang === 'es' ? 'Seleccionar' : 'Select',
        exact: true,
      })
      .first()
      .click();
    await editor.mouse.click(10, 10);
    await editor.waitForTimeout(500);
    await editor.screenshot({ path: resolve(dir, '01-editor.png') });
    await editor.getByRole('button', { name: N.expo }).click();
    await editor.locator('dialog.export-panel').waitFor();
    await editor.waitForTimeout(900);
    await editor.screenshot({ path: resolve(dir, '02-export.png') });
    await editor.keyboard.press('Escape');

    // 3: historial dentro del popup (se captura el popup sobre un fondo de marca).
    for (let i = 0; i < 2; i++) {
      await tab.bringToFront();
      const again = context.waitForEvent('page', {
        predicate: (p) => p.url().includes('editor.html'),
      });
      await popup.evaluate(() =>
        chrome.runtime.sendMessage({ version: 1, type: 'capture-visible' }),
      );
      await (await again).waitForSelector('.canvas-host canvas');
    }
    await popup.setViewportSize({ width: 380, height: 560 });
    await popup.reload();
    await popup.screenshot({ path: resolve(dir, '_popup-capture.png') });
    await popup.getByRole('tab', { name: N.hist }).click();
    await popup.locator('.history-item').first().waitFor();
    await popup.waitForTimeout(300);
    await popup.screenshot({ path: resolve(dir, '_popup-history.png') });

    // Composición 1280×800 con el popup centrado sobre el color de marca.
    const composer = await context.newPage();
    await composer.setViewportSize({ width: 1280, height: 800 });
    for (const [file, final, i] of [
      ['_popup-capture.png', '03-popup.png', 0],
      ['_popup-history.png', '04-historial.png', 1],
    ]) {
      const b64 = (await readFile(resolve(dir, file))).toString('base64');
      await composer.setContent(`<body style="margin:0;width:1280px;height:800px;background:#1d2b40;display:flex;align-items:center;justify-content:center;gap:70px;font:600 40px system-ui,Segoe UI,Arial,sans-serif;color:#fff">
        <div style="max-width:520px;line-height:1.25">${labelsTop[lang][0]}<div style="font-weight:400;font-size:24px;color:#75beff;margin-top:20px">${labelsTop[lang][1]}</div></div>
        <img src="data:image/png;base64,${b64}" style="height:640px;border-radius:12px;box-shadow:0 12px 40px #0008"></body>`);
      await composer.screenshot({ path: resolve(dir, final) });
      void i;
    }
    // Mosaicos promocionales (sin captura de pantalla de terceros: solo marca y lema).
    const icon = (await readFile(resolve('assets/dotsnap-icon.svg'))).toString(
      'base64',
    );
    for (const [w, h, name, size] of [
      [440, 280, 'promo-small', 34],
      [1400, 560, 'promo-marquee', 62],
    ]) {
      await composer.setViewportSize({ width: w, height: h });
      await composer.setContent(`<body style="margin:0;width:${w}px;height:${h}px;background:#1d2b40;display:flex;align-items:center;justify-content:center;gap:${size}px;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#fff">
        <img src="data:image/svg+xml;base64,${icon}" style="width:${h * 0.42}px;height:${h * 0.42}px">
        <div><div style="font-weight:700;font-size:${size * 1.5}px">DotSnap</div><div style="font-size:${size * 0.55}px;color:#75beff;margin-top:8px;max-width:${w * 0.5}px">${labelsTop[lang][0]}</div></div></body>`);
      await composer.screenshot({ path: resolve(dir, `${name}.png`) });
    }
    current = lang;
  } finally {
    await context?.close();
    server?.close();
  }
}
await copyFile(resolve('public/icon/128.png'), resolve('store/icon-128.png'));
console.log('recursos generados para', current);
