import { Resvg } from '@resvg/resvg-js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const svg = await readFile(
  new URL('../assets/icon-provisional.svg', import.meta.url),
  'utf8',
);
await mkdir(new URL('../public/icon/', import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
  await writeFile(
    new URL(`../public/icon/${size}.png`, import.meta.url),
    image,
  );
}
console.log(
  'Icono provisional original: PNG 16/32/48/128 generados desde SVG local.',
);
