import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requirePerm, saveSettings, withAudit } from '../server/community';
import { mintSigningSecret, mintToken } from '../server/bots';
import { audit } from '../server/audit';
import { fail } from '../server/errors';
import { BOT_EVENTS, BOT_KINDS, BOT_PERMS } from '../lib/bots';

const bot = z.object({
  id: z.string(), name: z.string(), avatar: z.string().nullable(), description: z.string(), kind: z.string(), enabled: z.boolean(),
  permissions: z.array(z.string()), eventTypes: z.array(z.string()), eventsUrl: z.string().nullable(), signingSecret: z.string().nullable(),
  tokenHint: z.string().nullable(), config: z.record(z.unknown()), apiCalls: z.number(), lastActiveAt: z.string().nullable(),
  recentEvents: z.array(z.object({ id: z.string(), type: z.string(), status: z.string(), code: z.number().nullable(), error: z.string().nullable(), at: z.string() })),
});

export default createEndpoint({
  description: 'Lists, adds, configures, rotates keys for and removes bots in a community',
  authenticated: true,
  inputSchema: z.object({
    communityId: z.string(),
    action: z.enum(['list', 'create', 'update', 'delete', 'rotateToken', 'rotateSecret']),
    botId: z.string().optional(),
    kind: z.enum(['Custom', 'Welcome', 'Moderator', 'Levels', 'Giveaway', 'Reminder']).optional(),
    patch: z.object({
      name: z.string().min(1).max(40).optional(), avatar: z.string().max(500).nullable().optional(), description: z.string().max(300).optional(),
      enabled: z.boolean().optional(), permissions: z.array(z.enum(BOT_PERMS)).optional(), eventTypes: z.array(z.enum(BOT_EVENTS)).optional(),
      eventsUrl: z.string().url().max(500).nullable().optional(), config: z.record(z.unknown()).optional(),
    }).optional(),
  }),
  outputSchema: z.object({ bots: z.array(bot), token: z.string().nullable() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const ctx = await requirePerm(input.communityId, me, 'manageCommunity');
    const cid = input.communityId;
    let token: string | null = null;
    const own = async () => {
      const b = input.botId ? await zite.bots.findOne({ id: input.botId }) : undefined;
      if (!b || b.communityId !== cid) throw fail('Bot not found');
      return b;
    };
    const log = (summary: string, action: string, targetId: string | null, details?: Record<string, unknown>) => Promise.all([
      saveSettings(cid, withAudit(ctx.s, me, summary)),
      audit({ summary, category: 'Bot', action, actorType: 'User', actorId: me, actorLabel: context.user.email, targetType: 'Bot', targetId, communityId: cid, details }),
    ]);

    if (input.action === 'create') {
      const k = BOT_KINDS.find((x) => x.kind === (input.kind ?? 'Custom'))!;
      const { records } = await zite.bots.findAll({ filters: { communityId: cid }, limit: 60 });
      if (records.length >= 25) throw fail('A community can have up to 25 bots.');
      if (k.kind !== 'Custom' && records.some((r) => r.kind === k.kind)) throw fail(`${k.name} is already added to this community.`);
      const b = await zite.bots.create({ record: {
        name: input.patch?.name ?? k.name, avatar: input.patch?.avatar ?? null, description: input.patch?.description ?? k.blurb, owner: me, communityId: cid, kind: k.kind,
        permissions: input.patch?.permissions ?? k.perms, tokenHash: null, tokenHint: null, config: JSON.stringify(input.patch?.config ?? {}),
        eventsUrl: null, eventTypes: k.kind === 'Custom' ? ['MESSAGE_CREATE', 'INTERACTION_CREATE', 'MEMBER_JOIN'] : [], signingSecret: mintSigningSecret(), enabled: true, lastActiveAt: null, apiCalls: 0,
      } });
      if (k.kind === 'Custom') {
        const t = await mintToken(b.id);
        await zite.bots.update({ id: b.id, record: { tokenHash: t.tokenHash, tokenHint: t.tokenHint } });
        token = t.token;
      }
      await log(`Added bot ${b.name}`, 'bot.create', b.id, { kind: k.kind });
    } else if (input.action === 'update') {
      const b = await own();
      const p = input.patch ?? {};
      await zite.bots.update({ id: b.id, record: {
        ...(p.name !== undefined && { name: p.name }), ...(p.avatar !== undefined && { avatar: p.avatar }), ...(p.description !== undefined && { description: p.description }),
        ...(p.enabled !== undefined && { enabled: p.enabled }), ...(p.permissions && { permissions: p.permissions }), ...(p.eventTypes && { eventTypes: p.eventTypes }),
        ...(p.eventsUrl !== undefined && { eventsUrl: p.eventsUrl }), ...(p.config && { config: JSON.stringify(p.config) }),
      } as never });
      await log(`Updated bot ${p.name ?? b.name}`, 'bot.update', b.id, { changed: Object.keys(p) });
    } else if (input.action === 'delete') {
      const b = await own();
      await zite.bots.delete({ id: b.id });
      await log(`Removed bot ${b.name}`, 'bot.delete', b.id);
    } else if (input.action === 'rotateToken') {
      const b = await own();
      const t = await mintToken(b.id);
      await zite.bots.update({ id: b.id, record: { tokenHash: t.tokenHash, tokenHint: t.tokenHint } });
      token = t.token;
      await log(`Reset the API key for ${b.name}`, 'bot.token.rotate', b.id);
    } else if (input.action === 'rotateSecret') {
      const b = await own();
      await zite.bots.update({ id: b.id, record: { signingSecret: mintSigningSecret() } });
      await log(`Reset the signing secret for ${b.name}`, 'bot.secret.rotate', b.id);
    }

    const [{ records }, ev] = await Promise.all([
      zite.bots.findAll({ filters: { communityId: cid }, limit: 60 }),
      zite.sql({ query: `SELECT * FROM (SELECT id, "botId", "eventType", "deliveryStatus", "responseCode", "error", created_at, ROW_NUMBER() OVER (PARTITION BY "botId" ORDER BY created_at DESC) rn FROM "BotEvents" WHERE "communityId" = $1) t WHERE rn <= 8`, params: [cid] }),
    ]);
    return {
      token,
      bots: records.map((b) => ({
        id: b.id, name: b.name ?? 'Bot', avatar: b.avatar ?? null, description: b.description ?? '', kind: b.kind ?? 'Custom', enabled: b.enabled !== false,
        permissions: (b.permissions ?? []) as string[], eventTypes: (b.eventTypes ?? []) as string[], eventsUrl: b.eventsUrl ?? null, signingSecret: b.signingSecret ?? null,
        tokenHint: b.tokenHint ?? null, config: (() => { try { return JSON.parse(b.config || '{}'); } catch { return {}; } })(), apiCalls: Number(b.apiCalls ?? 0), lastActiveAt: b.lastActiveAt ?? null,
        recentEvents: ev.rows.filter((e) => e.botId === b.id).map((e) => ({ id: String(e.id), type: String(e.eventType), status: String(e.deliveryStatus ?? ''), code: e.responseCode == null ? null : Number(e.responseCode), error: e.error ? String(e.error) : null, at: new Date(String(e.created_at)).toISOString() })),
      })),
    };
  },
});
