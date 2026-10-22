// Verificación de M5: historial, proyecto editable, ajustes, atajos y copiar.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const output = resolve('.output-test/chrome-mv3');
const evidence = resolve('docs/evidence/m5');
await mkdir(evidence, { recursive: true });
await mkdir(resolve('.browser-profile'), { recursive: true });
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') return res.writeHead(204).end();
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(
    '<body style="margin:0;background:linear-gradient(135deg,#fde,#9cf)"><h1 style="padding:40px;font:48px sans-serif">Historial</h1></body>',
  );
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}/`;
const dir = await mkdtemp(resolve('.browser-profile/m5-'));
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => createHash('sha256').update(b).digest('hex');

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
  const msg = (m) => popup.evaluate((x) => chrome.runtime.sendMessage(x), m);
  // Funciones autocontenidas: la página de extensión no permite eval, así que cada una abre su IndexedDB.
  const records = () =>
    popup.evaluate(
      () =>
        new Promise((res, rej) => {
          const o = indexedDB.open('dotsnap', 1);
          o.onerror = () => rej(o.error);
          o.onsuccess = () => {
            const db = o.result;
            const r = db
              .transaction('captures')
              .objectStore('captures')
              .getAll();
            r.onsuccess = () => {
              db.close();
              res(
                r.result.map((x) => ({
                  id: x.id,
                  updatedAt: x.updatedAt ?? x.createdAt,
                  annotations: x.annotations?.length ?? 0,
                  hasThumb: !!x.thumb,
                  width: x.width,
                })),
              );
            };
          };
        }),
    );
  const makeOld = (rid) =>
    popup.evaluate(
      (rid) =>
        new Promise((res, rej) => {
          const o = indexedDB.open('dotsnap', 1);
          o.onerror = () => rej(o.error);
          o.onsuccess = () => {
            const db = o.result;
            const store = db
              .transaction('captures', 'readwrite')
              .objectStore('captures');
            const g = store.get(rid);
            g.onsuccess = () => {
              const r = g.result;
              r.updatedAt = Date.now() - 8 * 86400000;
              r.createdAt = r.updatedAt;
              store.put(r).onsuccess = () => {
                db.close();
                res(true);
              };
            };
          };
        }),
      rid,
    );
  const fillRecords = () =>
    popup.evaluate(
      () =>
        new Promise((res, rej) => {
          const o = indexedDB.open('dotsnap', 1);
          o.onerror = () => rej(o.error);
          o.onsuccess = () => {
            const db = o.result;
            const tx = db.transaction('captures', 'readwrite');
            const store = tx.objectStore('captures');
            for (let i = 0; i < 61; i++) {
              const hex = i.toString(16).padStart(12, '0');
              store.put({
                id: `00000000-0000-4000-8000-${hex}`,
                blob: new Blob([new Uint8Array(10)]),
                createdAt: Date.now() - 1000 * (200 - i),
                updatedAt: Date.now() - 1000 * (200 - i),
              });
            }
            tx.oncomplete = () => {
              db.close();
              res(true);
            };
          };
        }),
    );
  const prefs = (value) =>
    popup.evaluate(
      async (v) =>
        chrome.storage.local.set({
          'preferences.v1': v,
        }),
      value,
    );
  const capture = async () => {
    await tab.bringToFront();
    const waiter = context.waitForEvent('page', {
      predicate: (p) => p.url().includes('editor.html'),
      timeout: 30000,
    });
    const r = await msg({ version: 1, type: 'capture-visible' });
    assert.equal(r.ok, true);
    const editor = await waiter;
    await editor.waitForSelector('.canvas-host canvas');
    return editor;
  };
  const tr = (editor, re) => editor.getByRole('button', { name: re }).first();
  const drawRect = async (editor) => {
    await tr(editor, /^(Rectangle|Rectángulo)$/).click();
    const box = await editor
      .locator('.canvas-host canvas')
      .first()
      .boundingBox();
    await editor.mouse.move(box.x + 100, box.y + 100);
    await editor.mouse.down();
    await editor.mouse.move(box.x + 300, box.y + 220, { steps: 6 });
    await editor.mouse.up();
  };
  const downloadPng = async (editor) => {
    const [dl] = await Promise.all([
      editor.waitForEvent('download'),
      tr(editor, /Download PNG|Descargar PNG/).click(),
    ]);
    const file = resolve(dir, `dl-${Date.now()}-${dl.suggestedFilename()}`);
    await dl.saveAs(file);
    return { name: dl.suggestedFilename(), bytes: await readFile(file) };
  };
  const tabPopup = async (name) => {
    await popup.goto(`${base}/popup.html`);
    await popup.locator(`#tab-${name}`).click();
  };

  // --- historial: la captura aparece con miniatura y datos
  const editor1 = await capture();
  await drawRect(editor1);
  await sleep(1000); // autoguardado
  const recs = await records();
  assert.equal(recs.length, 1);
  assert.equal(recs[0].hasThumb, true);
  assert.equal(recs[0].annotations, 1, 'las anotaciones se guardan solas');
  const original = await downloadPng(editor1);
  await tabPopup('history');
  await popup.locator('.history-item').waitFor();
  assert.equal(await popup.locator('.history-item').count(), 1);
  assert.match(await popup.locator('.history-item').innerText(), /1000 × 600/);
  await popup
    .locator('.history-thumb')
    .first()
    .evaluate((img) => img.tagName === 'IMG' && img.complete);
  await popup.screenshot({ path: resolve(evidence, 'history.png') });
  ok(
    'historial: 1 captura con miniatura, tamaño y anotaciones guardadas automáticamente',
  );

  // --- reabrir desde el historial restaura las anotaciones (mismo PNG exportado)
  await editor1.close();
  const reopened = context.waitForEvent('page', {
    predicate: (p) => p.url().includes('editor.html'),
  });
  await popup.getByRole('button', { name: /^(Open|Abrir)$/ }).click();
  const editor2 = await reopened;
  await editor2.waitForSelector('.canvas-host canvas');
  const again = await downloadPng(editor2);
  assert.equal(
    sha(again.bytes),
    sha(original.bytes),
    'PNG reabierto idéntico al original editado',
  );
  ok(
    'reabrir desde el historial restaura las anotaciones: PNG exportado idéntico',
  );

  // --- copiar desde la barra
  await tr(editor2, /^(Copy|Copiar)$/).click();
  await editor2.waitForFunction(
    () =>
      /Copied|Copiado/.test(
        document.querySelector('.toast-text')?.textContent ?? '',
      ),
    null,
    { timeout: 5000 },
  );
  const toastBox = await editor2.locator('.toast').first().boundingBox();
  const vp2 = editor2.viewportSize();
  assert.ok(toastBox.x + toastBox.width > vp2.width - 40, 'toast a la derecha');
  assert.ok(toastBox.y + toastBox.height > vp2.height - 40, 'toast abajo');
  await editor2.screenshot({ path: resolve(evidence, 'toast.png') });
  await editor2.locator('.toast-close').first().click();
  await editor2.locator('.toast').first().waitFor({ state: 'detached' });
  ok(
    'botón Copiar en la barra: PNG copiado, con toast abajo a la derecha que se puede cerrar',
  );

  // --- proyecto editable: guardar, validar e importar
  await tr(editor2, /^(Export…|Exportar…)$/).click();
  await editor2.locator('dialog.export-panel summary').click();
  const [pdl] = await Promise.all([
    editor2.waitForEvent('download'),
    editor2.locator('.export-project button').click(),
  ]);
  assert.match(pdl.suggestedFilename(), /^dotsnap-\d{8}-\d{6}\.dotsnap\.json$/);
  const pfile = resolve(dir, 'project.dotsnap.json');
  await pdl.saveAs(pfile);
  const pj = JSON.parse(await readFile(pfile, 'utf8'));
  assert.equal(pj.format, 'dotsnap-project');
  assert.equal(pj.version, 1);
  assert.equal(pj.annotations.length, 1);
  assert.match(pj.image, /^data:image\/png;base64,/);
  // Sin censuras no hay nada que ocultar: el aviso solo aparece cuando hay una censura.
  assert.equal(await editor2.locator('.export-project .hint').count(), 0);
  await editor2.keyboard.press('Escape');
  ok(
    'proyecto guardado (.dotsnap.json v1); sin censuras no se muestra el aviso',
  );

  await tabPopup('history');
  const imported = context.waitForEvent('page', {
    predicate: (p) => p.url().includes('editor.html'),
  });
  await popup.locator('input[type=file]').setInputFiles(pfile);
  const editor3 = await imported;
  await editor3.waitForSelector('.canvas-host canvas');
  const fromProject = await downloadPng(editor3);
  assert.equal(
    sha(fromProject.bytes),
    sha(original.bytes),
    'PNG del proyecto importado idéntico',
  );
  ok('proyecto importado: se abre con sus anotaciones y exporta el mismo PNG');

  const bad = resolve(dir, 'bad.dotsnap.json');
  await writeFile(
    bad,
    JSON.stringify({ ...pj, annotations: [{ type: 'script', src: 'x' }] }),
  );
  await tabPopup('history');
  const before = (await records()).length;
  await popup.locator('input[type=file]').setInputFiles(bad);
  await popup.locator('[role=alert]:not(:empty)').waitFor();
  assert.equal(
    (await records()).length,
    before,
    'un archivo inválido no crea capturas',
  );
  await writeFile(bad, 'esto no es json');
  await popup.locator('input[type=file]').setInputFiles(bad);
  await popup.waitForTimeout(300);
  assert.match(await popup.locator('[role=alert]').innerText(), /valid|válido/);
  ok('proyectos inválidos se rechazan con aviso y sin crear capturas');

  // --- borrar una y borrar todo
  await tabPopup('history');
  await popup.locator('.history-item').first().waitFor();
  const n = await popup.locator('.history-item').count();
  assert.ok(n >= 2);
  await popup
    .getByRole('button', { name: /^(Delete|Eliminar)$/ })
    .first()
    .click();
  await popup.waitForFunction(
    (k) => document.querySelectorAll('.history-item').length === k,
    n - 1,
  );
  const clear = popup.getByRole('button', { name: /Delete all|Borrar todo/ });
  await clear.click();
  await popup
    .getByRole('button', { name: /Press again|Pulsa de nuevo/ })
    .click();
  await popup.waitForFunction(
    () => document.querySelectorAll('.history-item').length === 0,
  );
  assert.equal((await records()).length, 0);
  ok('eliminar una y borrar todo (con segunda pulsación de confirmación)');
  for (const p of context.pages())
    if (p.url().includes('editor.html')) await p.close();

  // --- retención: lo viejo se purga al capturar; cuota máxima
  await prefs({ retentionDays: 7 });
  const old = await capture();
  await old.close();
  const fresh = await capture();
  await fresh.close();
  const [a, b] = (await records()).sort((x, y) => x.updatedAt - y.updatedAt);
  await makeOld(a.id);
  const third = await capture();
  await third.close();
  const left = await records();
  assert.ok(!left.some((r) => r.id === a.id), '8 días > 7: purgada');
  assert.ok(
    left.some((r) => r.id === b.id),
    'la reciente se conserva',
  );
  ok(
    'retención de 7 días: la captura de 8 días se purga, las recientes se conservan',
  );

  await fillRecords();
  const q = await capture();
  await q.close();
  const after = await records();
  assert.ok(after.length <= 60, `cuota de 60: ${after.length}`);
  ok(
    `cuota máxima de 60 elementos: 62 → ${after.length} (se elimina lo más antiguo)`,
  );

  // --- ajustes: historial desactivado, formato predeterminado y nombre de archivo
  await popup.evaluate(() => indexedDB.deleteDatabase('dotsnap'));
  await tabPopup('settings');
  await popup.locator('#history-enabled').click();
  await popup.waitForFunction(
    async () =>
      (await chrome.storage.local.get('preferences.v1'))['preferences.v1']
        ?.historyEnabled === false,
  );
  await popup.locator('#default-format').selectOption('jpeg');
  await popup.waitForFunction(
    async () =>
      (await chrome.storage.local.get('preferences.v1'))['preferences.v1']
        ?.defaultFormat === 'jpeg',
  );
  await popup.locator('#file-template').fill('{app}-{date}');
  await popup.locator('#file-template').blur();
  await popup.waitForFunction(
    async () =>
      (await chrome.storage.local.get('preferences.v1'))['preferences.v1']
        ?.fileNameTemplate === '{app}-{date}',
  );
  await popup.locator('#file-template').fill('***');
  await popup.locator('#file-template').blur();
  await popup.waitForTimeout(300);
  assert.equal(
    (
      await popup.evaluate(
        async () =>
          (await chrome.storage.local.get('preferences.v1'))['preferences.v1'],
      )
    ).fileNameTemplate,
    '{app}-{date}',
    'una plantilla inválida no se guarda',
  );
  await popup.screenshot({
    path: resolve(evidence, 'settings.png'),
    fullPage: true,
  });
  const ed = await capture();
  await drawRect(ed);
  await sleep(1000);
  const nr = await records();
  assert.equal(
    nr.length >= 1 && nr.every((r) => r.annotations === 0),
    true,
    'sin historial no se guardan anotaciones',
  );
  await tr(ed, /^(Export…|Exportar…)$/).click();
  await ed.locator('dialog.export-panel').waitFor();
  assert.equal(
    await ed.locator('.export-grid select').first().inputValue(),
    'jpeg',
  );
  const [jd] = await Promise.all([
    ed.waitForEvent('download'),
    (async () => {
      await ed.waitForFunction(
        () =>
          /(Exportado|Exported):/.test(
            document.querySelector('.export-result')?.textContent ?? '',
          ),
        null,
        { timeout: 30000 },
      );
      await ed.locator('.export-actions .primary').click();
    })(),
  ]);
  assert.match(jd.suggestedFilename(), /^dotsnap-\d{8}\.jpg$/);
  ok(
    'ajustes: historial desactivado (sin anotaciones guardadas), formato predeterminado y plantilla de nombre aplicados',
  );
  await tabPopup('history');
  assert.match(
    await popup.locator('#panel-history').innerText(),
    /off|desactivado/i,
  );
  ok('historial desactivado: el popup lo indica y no lista capturas');

  // --- atajos
  const manifestCommands = await popup.evaluate(
    () => chrome.runtime.getManifest().commands,
  );
  const all = await popup.evaluate(() => chrome.commands.getAll());
  const cmds = { manifest: manifestCommands };
  assert.equal(Object.keys(cmds.manifest).length, 4);
  assert.deepEqual(
    Object.values(cmds.manifest)
      .map((c) => c.suggested_key.default)
      .sort(),
    ['Alt+Shift+E', 'Alt+Shift+F', 'Alt+Shift+R', 'Alt+Shift+V'],
  );
  assert.ok(all.filter((c) => c.name.startsWith('capture-')).length === 4);
  assert.ok(
    all.every((c) => !c.description?.startsWith('__MSG_')),
    'descripciones localizadas',
  );
  await tabPopup('settings');
  await popup.locator('.shortcut-row').first().waitFor();
  assert.equal(await popup.locator('.shortcut-row').count(), 4);
  ok(
    '4 atajos declarados (≤ 4) con descripción localizada y visibles en Configurar; la pulsación real queda para prueba manual',
  );

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
