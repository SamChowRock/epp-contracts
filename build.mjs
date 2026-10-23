import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('.', import.meta.url));
const typescriptPackage = require.resolve('typescript/package.json');
const tsc = resolve(dirname(typescriptPackage), require(typescriptPackage).bin.tsc);
for (const args of [[], ['--module', 'ES2022', '--moduleResolution', 'Bundler', '--outDir', 'dist/esm', '--declaration', 'false']]) {
  execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json', ...args], { cwd: root, stdio: 'inherit' });
}
writeFileSync(new URL('./dist/esm/package.json', import.meta.url), JSON.stringify({ type: 'module' }) + '\n');
