# EPP public contracts

Public schemas for EPP mini-program APIs and browser login tickets. MIT licensed.

```js
const { miniProgramSceneSchema } = require('@epp/contracts/mini-program');
miniProgramSceneSchema.parse('AAAAAAAAAAAAAAAAAAAAAAAAAA');
```

Node consumers use compiled CommonJS; Web and native bundlers use the ESM export. Both are generated from the same schemas and share TypeScript declarations. Native WeChat clients bundle the mini-program entry together with Zod and parse with `{ jitless: true }`. Consumers pin exact package versions.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm test
npm pack --dry-run
npm pack
```

No private EPP checkout, database, credentials or live service is required for tests. Interface changes require a compatibility review and coordinated consumer upgrades; strict schemas can reject newly added response fields.

This is a source release candidate. No npm version has been published; the planned @epp scope still requires ownership and publishing setup. Review the exact tarball before a release.
