// Compila la variante de pruebas (.output-test) sin depender de la sintaxis de variables de entorno del shell.
import { spawnSync } from 'node:child_process';
const result = spawnSync(
  process.execPath,
  ['node_modules/wxt/bin/wxt.mjs', 'build'],
  { stdio: 'inherit', env: { ...process.env, DOTSNAP_TEST_BUILD: '1' } },
);
process.exit(result.status ?? 1);
