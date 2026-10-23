import { z } from 'zod';

import { starMapListQuerySchema, starMapReadFields } from './fields.js';

const timestamp = z.string().datetime();
const uuid = starMapReadFields.id;
const bearer = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
const version = z.string().min(1).max(64);
const deviceHint = z.string().min(1).max(100);
const verificationLabel = z.string().length(4);
const returnTo = z.string().max(2_048).default('/');
// Native WeChat has no URL global; accept a conservative ASCII host subset here.
const isAllowedUrl = (value: string, originOnly: boolean, allowLocalPath = false) => {
  const match =
    /^(https|http):\/\/(\[::1\]|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*)(?::([1-9][0-9]{0,4}))?([/?#][^\s\\]*)?$/.exec(
      value,
    );
  if (!match || /[\u0000-\u0020\u007f]/.test(value)) return false;
  const [, protocol, host, port, suffix] = match;
  if (host.length > 253 || host.split('.').some((label) => label.length > 63)) return false;
  if (/^[0-9.]+$/.test(host) && !/^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/.test(host))
    return false;
  if (/^[0-9.]+$/.test(host) && host.split('.').some((part) => Number(part) > 255)) return false;
  if (port && Number(port) > 65_535) return false;
  if (originOnly && (suffix || port === (protocol === 'https' ? '443' : '80'))) return false;
  if (protocol === 'https') return true;
  return (originOnly || allowLocalPath) && ['localhost', '127.0.0.1', '[::1]'].includes(host);
};
const siteOrigin = z
  .string()
  .refine(
    (value) => isAllowedUrl(value, true),
    'Must be an HTTPS origin or local HTTP loopback origin.',
  );

// 128 bits occupy 26 Base32 symbols; the final two padding bits must be zero.
export const miniProgramSceneSchema = z.string().regex(/^[A-Z2-7]{25}[AEIMQUY4]$/);
export const miniProgramUserSchema = z
  .object({ id: uuid, displayName: z.string().min(1).max(100) })
  .strict();
export const miniProgramAccountHintSchema = z
  .object({
    displayName: miniProgramUserSchema.shape.displayName,
    accountHint: z.string().min(1).max(64),
  })
  .strict();
export const miniProgramSessionViewSchema = z
  .object({ id: uuid, user: miniProgramUserSchema, expiresAt: timestamp, idleExpiresAt: timestamp })
  .strict();
export const miniProgramListRowSchema = z
  .object({
    id: starMapReadFields.id,
    canonicalForm: starMapReadFields.canonicalForm,
    meaningZh: starMapReadFields.meaningZh,
    updatedAt: starMapReadFields.updatedAt,
  })
  .strict();
export const miniProgramUnitDetailSchema = miniProgramListRowSchema
  .extend({
    forms: z.array(starMapReadFields.form).min(1),
    languageFunction: starMapReadFields.languageFunction,
    usageBoundary: starMapReadFields.usageBoundary,
    example: starMapReadFields.example,
  })
  .strict();
export const miniProgramListQuerySchema = starMapListQuerySchema;
export const miniProgramListResponseSchema = z
  .object({
    data: z.array(miniProgramListRowSchema).max(100),
    nextCursor: z.string().min(1).max(512).nullable(),
  })
  .strict();
export const miniProgramUnitResponseSchema = z
  .object({ unit: miniProgramUnitDetailSchema })
  .strict();
export const miniProgramTicketPurposeSchema = z.enum(['login', 'link', 'account_disposal_reauth']);
export const miniProgramTicketStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'CONSUMED',
  'CANCELLED',
  'EXPIRED',
]);
const ticketView = z
  .object({
    requestId: uuid,
    status: miniProgramTicketStatusSchema,
    siteOrigin,
    deviceHint,
    verificationLabel,
    createdAt: timestamp,
    expiresAt: timestamp,
  })
  .strict();
export const miniProgramTicketViewSchema = z.discriminatedUnion('purpose', [
  ticketView.extend({ purpose: z.literal('login') }).strict(),
  ticketView
    .extend({ purpose: z.literal('link'), targetAccount: miniProgramAccountHintSchema })
    .strict(),
  ticketView
    .extend({
      purpose: z.literal('account_disposal_reauth'),
      targetAccount: miniProgramAccountHintSchema,
    })
    .strict(),
]);
export const miniProgramPrivacyNoticeSchema = z
  .object({
    version,
    text: z.string().min(1).max(20_000),
    supportContact: z.string().min(1).max(256),
    accountActionsUrl: z
      .string()
      .refine((value) => isAllowedUrl(value, false, true))
      .nullable(),
  })
  .strict();
export const miniProgramConfigResponseSchema = z
  .object({
    apiVersion: z.literal('mini-program.v1'),
    serviceName: z.literal('EPP'),
    siteOrigin,
    queryEnabled: z.boolean(),
    webTicketEnabled: z.boolean(),
    privacy: miniProgramPrivacyNoticeSchema,
    serverTime: timestamp,
  })
  .strict();
export const miniProgramExchangeRequestSchema = z
  .object({ code: z.string().min(1).max(512), noticeVersion: version })
  .strict();
export const miniProgramRegisterRequestSchema = z.object({ noticeVersion: version }).strict();
export const miniProgramAuthenticatedResponseSchema = z
  .object({
    status: z.literal('authenticated'),
    token: bearer,
    session: miniProgramSessionViewSchema,
    serverTime: timestamp,
  })
  .strict();
export const miniProgramExchangeResponseSchema = z.discriminatedUnion('status', [
  miniProgramAuthenticatedResponseSchema,
  z
    .object({
      status: z.literal('unbound'),
      identityToken: bearer,
      expiresAt: timestamp,
      serverTime: timestamp,
    })
    .strict(),
]);
export const miniProgramSessionResponseSchema = z
  .object({ session: miniProgramSessionViewSchema, serverTime: timestamp })
  .strict();
export const miniProgramLogoutRequestSchema = z.object({}).strict();
export const miniProgramRevokeResponseSchema = z.object({ status: z.literal('revoked') }).strict();
export const miniProgramTicketInspectRequestSchema = z
  .object({ scene: miniProgramSceneSchema })
  .strict();
export const miniProgramTicketInspectResponseSchema = z
  .object({ ticket: miniProgramTicketViewSchema, serverTime: timestamp })
  .strict();
export const miniProgramTicketConfirmRequestSchema = miniProgramTicketInspectRequestSchema
  .extend({ requestId: uuid, expectedPurpose: miniProgramTicketPurposeSchema })
  .strict();
export const miniProgramTicketCancelRequestSchema = miniProgramTicketConfirmRequestSchema;
export const miniProgramTicketConfirmResponseSchema = z
  .object({ requestId: uuid, status: z.literal('CONFIRMED'), serverTime: timestamp })
  .strict();
export const miniProgramTicketCancelResponseSchema = z
  .object({ requestId: uuid, status: z.literal('CANCELLED'), serverTime: timestamp })
  .strict();
export const miniProgramProviderResponseSchema = z
  .object({
    miniProgram: z
      .object({
        providerKey: z.literal('wechat-mini-program'),
        mode: z.enum(['fake', 'wechat']),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const miniProgramWebTicketCreateRequestSchema = z
  .object({ purpose: miniProgramTicketPurposeSchema, returnTo, disposalRequestId: uuid.optional() })
  .strict();
const codeImage = z
  .object({
    mimeType: z.literal('image/png'),
    base64: z
      .string()
      .min(4)
      .max(349_528)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
      .refine(
        (value) =>
          (value.length / 4) * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0) <=
          256 * 1_024,
      ),
  })
  .strict();
export const miniProgramWebTicketCreateResponseSchema = z
  .object({
    requestId: uuid,
    purpose: miniProgramTicketPurposeSchema,
    scene: miniProgramSceneSchema,
    codeImage,
    expiresAt: timestamp,
    serverTime: timestamp,
    verificationLabel,
    ticketCsrf: z.string().min(1).max(256),
  })
  .strict();
export const miniProgramWebTicketRequestSchema = z.object({ requestId: uuid }).strict();
export const miniProgramWebTicketStatusResponseSchema = z
  .object({
    requestId: uuid,
    purpose: miniProgramTicketPurposeSchema,
    status: miniProgramTicketStatusSchema,
    expiresAt: timestamp,
    serverTime: timestamp,
  })
  .strict();
export const miniProgramWebTicketConsumeResponseSchema = z.discriminatedUnion('purpose', [
  z
    .object({
      purpose: z.literal('account_disposal_reauth'),
      status: z.literal('CONSUMED'),
      verifiedUntil: timestamp,
    })
    .strict(),
  z
    .object({
      purpose: z.literal('login'),
      status: z.literal('CONSUMED'),
      user: miniProgramUserSchema,
      returnTo,
    })
    .strict(),
  z
    .object({ purpose: z.literal('link'), status: z.literal('CONSUMED'), linked: z.literal(true) })
    .strict(),
]);
export const miniProgramReauthenticateRequestSchema = z
  .object({ currentPassword: z.string().min(1).max(128) })
  .strict();
export const miniProgramReauthenticateResponseSchema = z
  .object({ authenticatedAt: timestamp })
  .strict();
export const miniProgramSessionListResponseSchema = z
  .object({
    data: z
      .array(
        z
          .object({
            id: uuid,
            createdAt: timestamp,
            lastSeenAt: timestamp,
            expiresAt: timestamp,
            idleExpiresAt: timestamp,
            deviceHint,
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export type MiniProgramUser = z.infer<typeof miniProgramUserSchema>;
export type MiniProgramAccountHint = z.infer<typeof miniProgramAccountHintSchema>;
export type MiniProgramScene = z.infer<typeof miniProgramSceneSchema>;
export type MiniProgramSessionView = z.infer<typeof miniProgramSessionViewSchema>;
export type MiniProgramListRow = z.infer<typeof miniProgramListRowSchema>;
export type MiniProgramUnitDetail = z.infer<typeof miniProgramUnitDetailSchema>;
export type MiniProgramListQuery = z.infer<typeof miniProgramListQuerySchema>;
export type MiniProgramListResponse = z.infer<typeof miniProgramListResponseSchema>;
export type MiniProgramUnitResponse = z.infer<typeof miniProgramUnitResponseSchema>;
export type MiniProgramTicketPurpose = z.infer<typeof miniProgramTicketPurposeSchema>;
export type MiniProgramTicketStatus = z.infer<typeof miniProgramTicketStatusSchema>;
export type MiniProgramTicketView = z.infer<typeof miniProgramTicketViewSchema>;
export type MiniProgramPrivacyNotice = z.infer<typeof miniProgramPrivacyNoticeSchema>;
export type MiniProgramConfigResponse = z.infer<typeof miniProgramConfigResponseSchema>;
export type MiniProgramExchangeRequest = z.infer<typeof miniProgramExchangeRequestSchema>;
export type MiniProgramRegisterRequest = z.infer<typeof miniProgramRegisterRequestSchema>;
export type MiniProgramAuthenticatedResponse = z.infer<
  typeof miniProgramAuthenticatedResponseSchema
>;
export type MiniProgramExchangeResponse = z.infer<typeof miniProgramExchangeResponseSchema>;
export type MiniProgramSessionResponse = z.infer<typeof miniProgramSessionResponseSchema>;
export type MiniProgramLogoutRequest = z.infer<typeof miniProgramLogoutRequestSchema>;
export type MiniProgramRevokeResponse = z.infer<typeof miniProgramRevokeResponseSchema>;
export type MiniProgramTicketInspectRequest = z.infer<typeof miniProgramTicketInspectRequestSchema>;
export type MiniProgramTicketInspectResponse = z.infer<
  typeof miniProgramTicketInspectResponseSchema
>;
export type MiniProgramTicketConfirmRequest = z.infer<typeof miniProgramTicketConfirmRequestSchema>;
export type MiniProgramTicketCancelRequest = z.infer<typeof miniProgramTicketCancelRequestSchema>;
export type MiniProgramTicketConfirmResponse = z.infer<
  typeof miniProgramTicketConfirmResponseSchema
>;
export type MiniProgramTicketCancelResponse = z.infer<typeof miniProgramTicketCancelResponseSchema>;
export type MiniProgramProviderResponse = z.infer<typeof miniProgramProviderResponseSchema>;
export type MiniProgramWebTicketCreateRequest = z.infer<
  typeof miniProgramWebTicketCreateRequestSchema
>;
export type MiniProgramWebTicketCreateResponse = z.infer<
  typeof miniProgramWebTicketCreateResponseSchema
>;
export type MiniProgramWebTicketRequest = z.infer<typeof miniProgramWebTicketRequestSchema>;
export type MiniProgramWebTicketStatusResponse = z.infer<
  typeof miniProgramWebTicketStatusResponseSchema
>;
export type MiniProgramWebTicketConsumeResponse = z.infer<
  typeof miniProgramWebTicketConsumeResponseSchema
>;
export type MiniProgramReauthenticateRequest = z.infer<
  typeof miniProgramReauthenticateRequestSchema
>;
export type MiniProgramReauthenticateResponse = z.infer<
  typeof miniProgramReauthenticateResponseSchema
>;
export type MiniProgramSessionListResponse = z.infer<typeof miniProgramSessionListResponseSchema>;
