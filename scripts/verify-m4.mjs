// Verificación de M4: JPEG, WebP, PDF, escala y peso objetivo con archivos reales descargados.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
const evidence = resolve('docs/evidence/m4');
await mkdir(evidence, { recursive: true });
await mkdir(resolve('.browser-profile'), { recursive: true });
const band = (i) => `hsl(${(i * 37) % 360} 70% 50%)`;
const pages = {
  '/noise': `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><canvas id="c" width="1000" height="600"></canvas>
<script>const c=document.getElementById('c').getContext('2d');let s=12345;const r=()=>((s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff);const d=c.createImageData(1000,600);for(let i=0;i<d.data.length;i+=4){const x=(i/4)%1000,y=(i/4/1000)|0;d.data[i]=(r()*60+x/4)|0;d.data[i+1]=(r()*60+y/3)|0;d.data[i+2]=(r()*60+128)|0;d.data[i+3]=255}c.putImageData(d,0,0)</script></body>`,
  '/tall': `<!doctype html><meta charset="utf-8"><body style="margin:0">${Array.from(
    { length: 30 },
    (_, i) => `<div style="height:100px;background:${band(i)}"></div>`,
  ).join('')}</body>`,
};
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') return res.writeHead(204).end();
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pages[req.url] ?? '');
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const dir = await mkdtemp(resolve('.browser-profile/m4-'));
const context = await chromium.launchPersistentContext(dir, {
  executablePath: process.env.DOTSNAP_CHROME,
  headless: true,
  viewport: { width: 1000, height: 600 },
  acceptDownloads: true,
  args: [`--disable-extensions-except=${output}`, `--load-extension=${output}`],
});
const errors = [];
const external = [];
context.on('page', (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(origin))
      external.push(r.url());
  });
});
const report = { checks: [] };
const ok = (m) => {
  report.checks.push(m);
  console.log('OK', m);
};
const py = (code, ...args) =>
  execFileSync('python3', ['-c', code, ...args], { encoding: 'utf8' }).trim();
const info = (file) =>
  JSON.parse(
    py(
      'import sys,json;from PIL import Image;i=Image.open(sys.argv[1]);print(json.dumps({"f":i.format,"w":i.width,"h":i.height}))',
      file,
    ),
  );

try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  const tab = await context.newPage();
  const popup = await context.newPage();
  await popup.goto(`${base}/popup.html`);
  const msg = (m) => popup.evaluate((x) => chrome.runtime.sendMessage(x), m);

  const openEditor = async (path, type) => {
    await tab.goto(origin + path);
    await tab.bringToFront();
    const waiter = context.waitForEvent('page', {
      predicate: (p) => p.url().includes('editor.html'),
      timeout: 60000,
    });
    const r = await msg({ version: 1, type });
    assert.equal(r.ok, true);
    const editor = await waiter;
    await editor.waitForSelector('.canvas-host canvas');
    await editor
      .getByRole('button', { name: /Exportar…|Export…/ })
      .first()
      .click();
    await editor.locator('.export-panel').waitFor();
    return editor;
  };
  const settled = async (editor) => {
    await editor.waitForFunction(
      () =>
        /(Exportado|Exported):/.test(
          document.querySelector('.export-result')?.textContent ?? '',
        ),
      null,
      { timeout: 60000 },
    );
  };
  const pick = async (editor, label, value) => {
    await editor
      .locator(`.export-grid label:has-text("${label}") select`)
      .selectOption(value);
  };
  const download = async (editor, name) => {
    await settled(editor);
    const [dl] = await Promise.all([
      editor.waitForEvent('download'),
      editor.locator('.export-actions .primary').click(),
    ]);
    const file = resolve(dir, `${name}-${dl.suggestedFilename()}`);
    await dl.saveAs(file);
    return { file, name: dl.suggestedFilename(), bytes: await readFile(file) };
  };
  const resultText = (editor) => editor.locator('.export-result').innerText();

  // --- imagen con ruido: PNG, JPEG, WebP, escala, peso objetivo
  const editor = await openEditor('/noise', 'capture-visible');
  const png = await download(editor, 'png');
  assert.match(png.name, /^dotsnap-\d{8}-\d{6}\.png$/);
  assert.equal(info(png.file).f, 'PNG');
  assert.deepEqual([info(png.file).w, info(png.file).h], [1000, 600]);
  ok(`PNG real 1000×600, ${png.bytes.length} B`);

  await pick(editor, 'Formato', 'jpeg').catch(() =>
    pick(editor, 'Format', 'jpeg'),
  );
  const jpg = await download(editor, 'jpg');
  assert.match(jpg.name, /\.jpg$/);
  assert.equal(info(jpg.file).f, 'JPEG');
  assert.ok(
    jpg.bytes.length < png.bytes.length,
    'JPEG pesa menos que PNG con ruido',
  );
  assert.match(
    await resultText(editor),
    new RegExp(`${Math.max(1, Math.round(jpg.bytes.length / 1024))} KB`),
  );
  ok(
    `JPEG real, ${jpg.bytes.length} B (< PNG ${png.bytes.length} B); el peso mostrado coincide con el archivo`,
  );

  await pick(editor, 'Formato', 'webp').catch(() =>
    pick(editor, 'Format', 'webp'),
  );
  const webp = await download(editor, 'webp');
  assert.equal(info(webp.file).f, 'WEBP');
  assert.match(webp.name, /\.webp$/);
  ok(`WebP real, ${webp.bytes.length} B`);

  await editor
    .locator(
      '.export-grid label:has-text("Calidad"), .export-grid label:has-text("Quality")',
    )
    .locator('input[type=range]')
    .fill('20');
  const low = await download(editor, 'webp-q20');
  assert.ok(low.bytes.length < webp.bytes.length, 'menos calidad pesa menos');
  ok(
    `calidad 20 % pesa menos (${low.bytes.length} B < ${webp.bytes.length} B)`,
  );

  await pick(editor, 'Formato', 'jpeg').catch(() =>
    pick(editor, 'Format', 'jpeg'),
  );
  await pick(editor, 'Escala', '50').catch(() => pick(editor, 'Scale', '50'));
  const half = await download(editor, 'jpg50');
  assert.deepEqual([info(half.file).w, info(half.file).h], [500, 300]);
  assert.ok(half.bytes.length < jpg.bytes.length);
  ok('escala 50 % → 500×300 y menos peso');
  await pick(editor, 'Escala', '100').catch(() => pick(editor, 'Scale', '100'));

  const target = editor.locator('.export-grid input[type=number]');
  await target.fill('60');
  const fit = await download(editor, 'fit');
  assert.ok(
    fit.bytes.length <= 60 * 1024,
    `cabe en 60 KB: ${fit.bytes.length}`,
  );
  assert.match(await resultText(editor), /objetivo alcanzado|target met/);
  assert.ok(
    fit.bytes.length > 20 * 1024,
    'usa la mayor calidad que cabe, no la mínima',
  );
  ok(`peso objetivo 60 KB alcanzado con ${fit.bytes.length} B`);
  await target.fill('1');
  await settled(editor);
  const miss = await download(editor, 'miss');
  assert.ok(miss.bytes.length > 1024);
  assert.match(await resultText(editor), /no se alcanzó|not reached/);
  ok(
    `objetivo imposible (1 KB): se declara no alcanzado y se entrega el mínimo (${miss.bytes.length} B)`,
  );
  await target.fill('');

  // --- PDF de una página
  await pick(editor, 'Formato', 'pdf').catch(() =>
    pick(editor, 'Format', 'pdf'),
  );
  const pdf1 = await download(editor, 'pdf1');
  assert.match(pdf1.name, /\.pdf$/);
  const pi1 = execFileSync('pdfinfo', [pdf1.file], { encoding: 'utf8' });
  assert.match(pi1, /Pages:\s+1\b/);
  assert.match(pi1, /Page size:\s+595\.28 x 841\.89/);
  ok('PDF A4 de una página válido (pdfinfo)');
  await editor.screenshot({ path: resolve(evidence, 'panel-pdf.png') });

  // --- PDF multipágina desde una página larga
  const tall = await openEditor('/tall', 'capture-fullpage');
  await pick(tall, 'Formato', 'pdf').catch(() => pick(tall, 'Format', 'pdf'));
  const pdfN = await download(tall, 'pdfN');
  const piN = execFileSync('pdfinfo', [pdfN.file], { encoding: 'utf8' });
  const nPages = Number(/Pages:\s+(\d+)/.exec(piN)[1]);
  assert.ok(nPages >= 2, `varias páginas: ${nPages}`);
  const rows = execFileSync('pdfimages', ['-list', pdfN.file], {
    encoding: 'utf8',
  })
    .split('\n')
    .slice(2)
    .filter(Boolean)
    .map((l) => l.trim().split(/\s+/));
  assert.equal(rows.length, nPages);
  assert.equal(
    rows.reduce((a, r) => a + Number(r[4]), 0),
    3000,
    'las franjas suman las 3000 filas sin perder ni repetir',
  );
  // El color de la franja i (100 px) debe verse en el PDF rasterizado: primera y última página.
  const ppm = resolve(dir, 'pdfN');
  execFileSync('pdftoppm', ['-r', '72', '-png', pdfN.file, ppm]);
  const sample = py(
    'import sys,json,glob;from PIL import Image\nfs=sorted(glob.glob(sys.argv[1]+"-*.png"))\nA=Image.open(fs[0]).convert("RGB");B=Image.open(fs[-1]).convert("RGB")\nprint(json.dumps({"n":len(fs),"first":A.getpixel((A.width//2,int(A.height*0.05))),"last":B.getpixel((B.width//2,int(B.height*0.06)))}))',
    ppm,
  );
  const s = JSON.parse(sample);
  assert.equal(s.n, nPages);
  const hsl = (h) => {
    const c = 0.7 * (1 - Math.abs(2 * 0.5 - 1));
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = 0.5 - c / 2;
    const [r, g, b] =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
    return [r, g, b].map((v) => Math.round((v + m) * 255));
  };
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 6);
  assert.ok(near(s.first, hsl(0)), `primera página: ${s.first}`);
  assert.ok(near(s.last, hsl((29 * 37) % 360)), `última página: ${s.last}`);
  ok(
    `PDF multipágina (${nPages} páginas A4): filas 3000 exactas; primera y última franja con el color correcto al rasterizar`,
  );

  // --- portapapeles (el permiso depende del navegador; se informa, no se asume)
  await editor.bringToFront();
  const copy = editor.getByRole('button', { name: /Copiar PNG|Copy PNG/ });
  await copy.click();
  await editor.waitForTimeout(500);
  const status = await editor.locator('.status-line').innerText();
  report.clipboard = status;
  console.log('portapapeles:', status || '(sin mensaje)');

  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  ok('0 errores de consola y 0 peticiones externas');
} finally {
  await writeFile(
    resolve(evidence, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await context.close();
  server.close();
}
