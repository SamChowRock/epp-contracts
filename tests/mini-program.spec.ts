import * as shared from '../mini-program';
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const id = '00000000-0000-4000-8000-000000000001';
const time = '2026-10-16T00:00:00.000Z';
const row = { id, canonicalForm: 'apart from', meaningZh: '除了', updatedAt: time };
const ticket = {
  requestId: id,
  status: 'PENDING',
  siteOrigin: 'https://example.com',
  deviceHint: '未知设备',
  verificationLabel: '1234',
  createdAt: time,
  expiresAt: time,
};

describe('mini-program contracts', () => {
  it('identifies Fake and WeChat provider modes explicitly', () => {
    for (const mode of ['fake', 'wechat']) {
      expect(shared.miniProgramProviderResponseSchema.parse({
        miniProgram: { providerKey: 'wechat-mini-program', mode },
      }).miniProgram?.mode).toBe(mode);
    }
    expect(shared.miniProgramProviderResponseSchema.safeParse({
      miniProgram: { providerKey: 'wechat-mini-program', mode: 'unknown' },
    }).success).toBe(false);
  });
  it('parses bundled config and privacy without URL or other host globals', () => {
    const root = resolve(__dirname, '..');
    const script = `
      import assert from 'node:assert/strict';
      import vm from 'node:vm';
      import { build } from ${JSON.stringify(resolve(__dirname, '../node_modules/vite/dist/node/index.js'))};
      const result = await build({configFile:false,root:${JSON.stringify(root)},logLevel:'error',resolve:{conditions:['browser','default']},build:{write:false,target:'es2018',lib:{entry:${JSON.stringify(resolve(__dirname, '../mini-program.ts'))},formats:['cjs']}}});
      const chunks = (Array.isArray(result) ? result[0] : result).output.filter(item => item.type === 'chunk');
      assert.equal(chunks.length, 1);
      assert.deepEqual(chunks[0].imports, []);
      assert.deepEqual(chunks[0].dynamicImports, []);
      const module = {exports:{}};
      vm.runInNewContext(chunks[0].code, {module,exports:module.exports,URL:undefined}, {timeout:5000});
      const s = module.exports;
      const privacy = {version:'v1',text:'notice',supportContact:'support',accountActionsUrl:'https://example.com/account?from=mini#actions'};
      const config = {apiVersion:'mini-program.v1',serviceName:'EPP',siteOrigin:'https://example.com',queryEnabled:true,webTicketEnabled:true,privacy,serverTime:'2026-10-16T00:00:00.000Z'};
      for (const siteOrigin of ['https://example.com','https://example.com:8443','http://localhost:3000','http://127.0.0.1:3000','http://[::1]:3000']) assert.equal(s.miniProgramConfigResponseSchema.safeParse({...config,siteOrigin}).success,true,siteOrigin);
      for (const siteOrigin of ['http://localhost.evil.com','http://127.0.0.1.evil.com','http://localhost@evil.com','https://user@example.com','https://example.com:65536','https://example.com:0','https://example.com/path','https://example.com?x=1','https://example.com/','https://127.0.0.999','https://example.com\\\\evil']) assert.equal(s.miniProgramConfigResponseSchema.safeParse({...config,siteOrigin}).success,false,siteOrigin);
      assert.equal(s.miniProgramPrivacyNoticeSchema.safeParse(privacy).success,true);
      for (const accountActionsUrl of ['http://example.com/actions','https://user@example.com/actions','https://example.com:65536/actions','https://example.com/has space','https://example.com\\\\evil']) assert.equal(s.miniProgramPrivacyNoticeSchema.safeParse({...privacy,accountActionsUrl}).success,false,accountActionsUrl);
    `;
    expect(() =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        timeout: 30_000,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
  it('requires canonical 128-bit Base32 scenes without normalizing network input', () => {
    const bytes = Buffer.from(Array.from({ length: 16 }, (_, i) => i * 17));
    const bits = [...bytes]
      .map((byte) => byte.toString(2).padStart(8, '0'))
      .join('')
      .padEnd(130, '0');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const scene = bits
      .match(/.{5}/g)!
      .map((chunk) => alphabet[parseInt(chunk, 2)])
      .join('');
    expect(shared.miniProgramSceneSchema.parse(scene)).toBe(scene);
    for (const value of [
      scene.toLowerCase(),
      `${scene}A`,
      scene.slice(1),
      ` ${scene}`,
      scene.slice(0, 25) + 'B',
      `https://example.com/${scene}`,
    ]) {
      expect(shared.miniProgramSceneSchema.safeParse(value).success).toBe(false);
    }
    for (const last of alphabet) {
      expect(shared.miniProgramSceneSchema.safeParse('A'.repeat(25) + last).success).toBe(
        alphabet.indexOf(last) % 4 === 0,
      );
    }
  });

  it('preserves pagination limits and excludes semantic search and sensitive detail fields', () => {
    expect(shared.miniProgramListQuerySchema.parse({})).toEqual({ limit: 20 });
    for (const query of [
      { limit: 0 },
      { limit: 101 },
      { q: 'x'.repeat(201) },
      { cursor: 'x'.repeat(513) },
      { mode: 'semantic' },
    ]) {
      expect(shared.miniProgramListQuerySchema.safeParse(query).success).toBe(false);
    }
    expect(shared.miniProgramListRowSchema.parse(row)).toEqual(row);
    const detail = {
      ...row,
      forms: ['apart from'],
      languageFunction: '排除',
      usageBoundary: '不含某项',
      example: 'Apart from this, all is well.',
    };
    expect(shared.miniProgramUnitDetailSchema.parse(detail)).toEqual(detail);
    for (const extra of [
      { structuredSources: [] },
      { anchors: [] },
      { practiceActive: true },
      { forms: [{ id, form: 'apart from' }] },
    ]) {
      expect(shared.miniProgramUnitDetailSchema.safeParse({ ...detail, ...extra }).success).toBe(
        false,
      );
    }
  });

  it('separates unbound identity from authenticated sessions and rejects forged identity', () => {
    const unbound = {
      status: 'unbound',
      identityToken: 'A'.repeat(43),
      expiresAt: time,
      serverTime: time,
    };
    expect(shared.miniProgramExchangeResponseSchema.parse(unbound)).toEqual(unbound);
    expect(
      shared.miniProgramExchangeResponseSchema.safeParse({ ...unbound, token: 'A'.repeat(43) })
        .success,
    ).toBe(false);
    expect(
      shared.miniProgramExchangeResponseSchema.safeParse({
        ...unbound,
        identityToken: 'A'.repeat(42) + 'B',
      }).success,
    ).toBe(false);
    expect(
      shared.miniProgramExchangeRequestSchema.safeParse({
        code: 'code',
        noticeVersion: 'v1',
        openId: 'forged',
      }).success,
    ).toBe(false);
    expect(
      shared.miniProgramReauthenticateRequestSchema.safeParse({ currentPassword: 'pw', userId: id })
        .success,
    ).toBe(false);
  });

  it('keeps link account hints out of login tickets and session data out of link consumption', () => {
    const hint = { displayName: '微信用户', accountHint: '1234' };
    expect(
      shared.miniProgramTicketViewSchema.safeParse({ ...ticket, purpose: 'login' }).success,
    ).toBe(true);
    expect(
      shared.miniProgramTicketViewSchema.safeParse({
        ...ticket,
        purpose: 'login',
        targetAccount: hint,
      }).success,
    ).toBe(false);
    expect(
      shared.miniProgramTicketViewSchema.safeParse({
        ...ticket,
        purpose: 'link',
        targetAccount: hint,
      }).success,
    ).toBe(true);
    expect(
      shared.miniProgramWebTicketConsumeResponseSchema.safeParse({
        purpose: 'link',
        status: 'CONSUMED',
        linked: true,
        user: { id, displayName: 'name' },
      }).success,
    ).toBe(false);
  });

  it('limits image bytes and rejects remote image URLs', () => {
    const response = {
      requestId: id,
      purpose: 'login',
      scene: 'A'.repeat(26),
      codeImage: { mimeType: 'image/png', base64: Buffer.alloc(262_144).toString('base64') },
      expiresAt: time,
      serverTime: time,
      verificationLabel: '1234',
      ticketCsrf: 'csrf',
    };
    expect(shared.miniProgramWebTicketCreateResponseSchema.safeParse(response).success).toBe(true);
    expect(
      shared.miniProgramWebTicketCreateResponseSchema.safeParse({
        ...response,
        codeImage: { ...response.codeImage, base64: Buffer.alloc(262_145).toString('base64') },
      }).success,
    ).toBe(false);
    expect(
      shared.miniProgramWebTicketCreateResponseSchema.safeParse({
        ...response,
        codeImage: { url: 'https://example.com/image.png' },
      }).success,
    ).toBe(false);
  });

  it('allows secure origins and loopback Fake origins but rejects outside HTTP or URL paths', () => {
    const config = {
      apiVersion: 'mini-program.v1',
      serviceName: 'EPP',
      siteOrigin: 'https://example.com',
      queryEnabled: true,
      webTicketEnabled: false,
      privacy: { version: 'v1', text: '声明', supportContact: 'support', accountActionsUrl: null },
      serverTime: time,
    };
    expect(shared.miniProgramConfigResponseSchema.safeParse(config).success).toBe(true);
    expect(
      shared.miniProgramConfigResponseSchema.safeParse({
        ...config,
        siteOrigin: 'http://localhost:3000',
      }).success,
    ).toBe(true);
    for (const origin of [
      'http://example.com',
      'https://example.com/path',
      'https://user:pass@example.com',
      'https://example.com/',
    ]) {
      expect(
        shared.miniProgramConfigResponseSchema.safeParse({ ...config, siteOrigin: origin }).success,
      ).toBe(false);
    }
    expect(
      shared.miniProgramPrivacyNoticeSchema.safeParse({
        ...config.privacy,
        accountActionsUrl: 'http://example.com',
      }).success,
    ).toBe(false);
  });
});
