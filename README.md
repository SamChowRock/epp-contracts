# EPP public contracts

[![npm next](https://img.shields.io/npm/v/%40szepp%2Fcontracts/next)](https://www.npmjs.com/package/@szepp/contracts)

Public schemas for EPP mini-program APIs and browser login tickets. MIT licensed.

```js
const { miniProgramSceneSchema } = require('@szepp/contracts/mini-program');
miniProgramSceneSchema.parse('AAAAAAAAAAAAAAAAAAAAAAAAAA');
```

Node consumers use compiled CommonJS; Web and native bundlers use the ESM export. Both are generated from the same schemas and share TypeScript declarations. Native WeChat clients bundle the mini-program entry together with Zod and parse with `{ jitless: true }`. Consumers pin exact package versions.

The CommonJS build uses Node16 module resolution; the ESM build uses Bundler resolution. CI builds and tests with both the locked TypeScript version and the latest stable release. Fix deprecated compiler options instead of suppressing them with `ignoreDeprecations`.

`npm test` builds the package, type-checks production and test sources, then runs Vitest. Tests have their own `tests/tsconfig.json` with Node types and Bundler resolution for Vitest; editors discover it automatically. Production schemas keep `types: []` so they do not rely on Node globals.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm test
npm pack --dry-run
npm pack
```

No private EPP checkout, database, credentials or live service is required for tests. Interface changes require a compatibility review and coordinated consumer upgrades; strict schemas can reject newly added response fields.

This repository is the public contract source of truth. The public package is named @szepp/contracts under the szepp organization. Consumers pin exact released versions; release candidates use the next dist-tag. Before a registry version is available, consumers may pin a complete public Git commit and allow its reviewed package build in pnpm-workspace.yaml. Review the exact tarball before publishing, then upgrade each consumer and its lockfile to the released version.
