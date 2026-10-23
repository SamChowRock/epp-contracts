import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { it } from 'vitest';

const root = resolve(__dirname, '..');

it('loads published entry points from CommonJS and ESM', () => {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    for (const entry of ['@szepp/contracts', '@szepp/contracts/mini-program', '@szepp/contracts/fields']) {
      const cjs = require(entry);
      const esm = await import(entry);
      if (entry.endsWith('/fields')) {
        assert.deepEqual(cjs.starMapListQuerySchema.parse({}), { limit: 20 });
        assert.deepEqual(esm.starMapListQuerySchema.parse({}), { limit: 20 });
      } else {
        assert.equal(cjs.miniProgramSceneSchema.parse('A'.repeat(26)), 'A'.repeat(26));
        assert.equal(esm.miniProgramSceneSchema.parse('A'.repeat(26)), 'A'.repeat(26));
      }
    }
  `], { cwd: root, stdio: 'pipe', timeout: 30_000 });
});

it('provides typed entry points to CommonJS and ESM Node consumers', () => {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    '-p', 'tests/fixtures/tsconfig.json',
  ], { cwd: root, stdio: 'pipe', timeout: 30_000 });
});
