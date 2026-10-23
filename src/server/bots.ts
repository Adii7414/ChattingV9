import { zite } from 'zitejs/db';
import { ids } from './chat';
import { loadCommunity, saveSettings, syncChannels, withAudit } from './community';
import { audit } from './audit';
import { levelFor, parseDuration, type BotEventType, type ComponentRow, type Embed } from '../lib/bots';
import type { BotsRecordType } from 'zitejs/db';

export type Bot = BotsRecordType;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const rand = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join(''); };

export async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
}

/** New bot token "cb_<botId>.<secret>". Only its hash is stored. */
export async function mintToken(botId: string) {
  const token = `cb_${botId.replace(/-/g, '')}.${rand(40)}`;
  return { token, tokenHash: await sha256(token), tokenHint: `…${token.slice(-4)}` };
}
export const mintSigningSecret = () => `whsec_${rand(32)}`;

const uuidFrom = (compact: string) => compact.length === 32 ? `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}` : null;

/** Resolves a bot from its token, or null. */
export async function botFromToken(token: string | undefined | null) {
  const m = /^cb_([0-9a-f]{32})\.[A-Za-z0-9]{40}$/.exec(String(token ?? '').trim());
  const id = m && uuidFrom(m[1]);
  if (!id) return null;
  const bot = await zite.bots.findOne({ id });
  if (!bot || bot.tokenHash !== (await sha256(String(token).trim()))) return null;
  return bot;
}

export const botPerms = (b: Bot) => new Set((b.permissions ?? []) as string[]);
export const botConfig = <T extends Record<string, unknown>>(b: Bot): T => { try { return JSON.parse(b.config || '{}') as T; } catch { return {} as T; } };

/** Posts a message into a channel as a bot. */
export async function postAsBot(bot: Pick<Bot, 'id' | 'name'>, channelId: string, msg: { body?: string; embeds?: Embed[]; components?: ComponentRow[]; replyToId?: string | null; parentMessageId?: string | null; poll?: unknown }) {
  const now = new Date().toISOString();
  const body = (msg.body ?? '').slice(0, 4000);
  const preview = `${bot.name}: ${body || msg.embeds?.[0]?.title || msg.embeds?.[0]?.description || 'sent a card'}`.slice(0, 140);
  const [m] = await Promise.all([
    zite.messages.create({ record: {
      body, conversation: channelId, sender: null, botId: bot.id, attachments: null, reactions: null,
      parentMessageId: msg.parentMessageId ?? null, replyToId: msg.replyToId ?? null, editedAt: null,
      embeds: msg.embeds?.length ? JSON.stringify(msg.embeds) : null,
      components: msg.components?.length ? JSON.stringify(msg.components) : null,
      poll: msg.poll ? JSON.stringify(msg.poll) : null,
    } as never }),
    msg.parentMessageId ? null : zite.conversations.update({ id: channelId, record: { lastMessageAt: now, lastMessagePreview: preview } as never }),
  ]);
  return m;
}

export async function botsIn(communityId: string) {
  const { records } = await zite.bots.findAll({ filters: { communityId }, limit: 50 });
  return records.filter((b) => b.enabled !== false);
}

/** Emits a gateway event to every bot in the community that subscribed to it, and runs the ready-made bots. */
export async function emitEvent(communityId: string | null | undefined, type: BotEventType, channelId: string | null, data: Record<string, unknown>) {
  if (!communityId) return;
  try {
    const bots = await botsIn(communityId);
    if (!bots.length) return;
    await Promise.allSettled(bots.map(async (b) => {
      if (b.kind && b.kind !== 'Custom') {
        await runBuiltin(b, type, communityId, channelId, data).catch((e) => console.error('builtin bot', b.kind, e));
        return;
      }
      if (!((b.eventTypes ?? []) as string[]).includes(type)) return;
      if (type === 'MESSAGE_CREATE' && data.botId === b.id) return; // never echo a bot's own messages
      if (type === 'INTERACTION_CREATE' && data.targetBotId && data.targetBotId !== b.id) return; // clicks go only to the bot that posted the message
      const payload = { type, communityId, channelId, timestamp: new Date().toISOString(), data };
      const ev = await zite.botEvents.create({ record: { eventType: type, botId: b.id, communityId, channelId, payload: JSON.stringify(payload), deliveryStatus: 'Polling only', responseCode: null, error: null } });
      if (!b.eventsUrl) return;
      const body = JSON.stringify({ id: ev.id, seq: ev.seq, ...payload });
      const ts = String(Math.floor(Date.now() / 1000));
      let status = 0; let err: string | null = null;
      try {
        const res = await fetch(b.eventsUrl, {
          method: 'POST', body, signal: AbortSignal.timeout(5000),
          headers: { 'content-type': 'application/json', 'user-agent': 'ChattingBot/1.0', 'x-chatting-event': type, 'x-chatting-event-id': ev.id, 'x-chatting-timestamp': ts, 'x-chatting-signature': `v1=${await hmac(b.signingSecret ?? '', `${ts}.${body}`)}` },
        });
        status = res.status;
        if (!res.ok) err = `HTTP ${res.status}`;
      } catch (e) { err = e instanceof Error ? e.message : 'Network error'; }
      await zite.botEvents.update({ id: ev.id, record: { deliveryStatus: err ? 'Failed' : 'Delivered', responseCode: status || null, error: err } });
    }));
  } catch (e) { console.error('emitEvent', e); }
}

const mention = async (userId: string) => {
  const u = await zite.auth.findAllUsers({ filters: { id: userId }, limit: 1 }).catch(() => null);
  const r = u?.records[0];
  return `@${r?.firstName || r?.name || r?.email?.split('@')[0] || 'member'}`;
};

/** The ready-made bots, configured from Community settings → Bots. */
async function runBuiltin(b: Bot, type: BotEventType, communityId: string, channelId: string | null, data: Record<string, unknown>) {
  const cfg = botConfig<Record<string, unknown>>(b);
  const userId = String(data.userId ?? data.authorId ?? '');
  const body = String(data.body ?? '');

  if (b.kind === 'Welcome' && type === 'MEMBER_JOIN' && userId) {
    const ctx = await loadCommunity(communityId);
    const roleIds = ((cfg.roleIds as string[]) ?? []).filter((r) => ctx.s.roles.some((x) => x.id === r));
    if (roleIds.length) {
      const s = { ...ctx.s, memberRoles: { ...ctx.s.memberRoles, [userId]: [...new Set([...(ctx.s.memberRoles[userId] ?? []), ...roleIds])] } };
      await saveSettings(communityId, withAudit(s, b.id, `${b.name} gave starter roles to a new member`));
      await syncChannels(communityId);
    }
    const target = String(cfg.channelId || ctx.s.systemChannel || '');
    const text = String(cfg.message || 'Welcome to {community}, {user}! 👋').replace(/\{user\}/g, await mention(userId)).replace(/\{community\}/g, ctx.c.name ?? 'the community');
    if (target) await postAsBot(b, target, { body: text, components: cfg.rulesButton ? [[{ type: 'button', id: 'rules:accept', label: 'Accept rules', emoji: '✅', style: 'success' }]] : undefined });
    return;
  }

  if (type !== 'MESSAGE_CREATE' || !channelId || data.botId) return;

  if (b.kind === 'Moderator' && userId) {
    const ctx = await loadCommunity(communityId);
    if (ctx.ownerId === userId) return;
    const words = ((cfg.bannedWords as string[]) ?? []).map((w) => w.toLowerCase()).filter(Boolean);
    const lower = body.toLowerCase();
    const reasons: string[] = [];
    if (cfg.blockInvites !== false && /(discord\.gg|chat\.whatsapp\.com|t\.me)\//i.test(body)) reasons.push('posting invite links');
    if (cfg.blockLinks && /(https?:\/\/|www\.)\S+/i.test(body)) reasons.push('posting links');
    if (words.some((w) => lower.includes(w))) reasons.push('using a blocked word');
    if (cfg.blockRepeats !== false && /(.)\1{14,}/.test(body)) reasons.push('spamming repeated characters');
    const mentions = body.match(/@[\w.-]+/g)?.length ?? 0;
    if (Number(cfg.maxMentions ?? 6) > 0 && mentions > Number(cfg.maxMentions ?? 6)) reasons.push('mass-mentioning');
    if (!reasons.length) return;
    await zite.messages.delete({ id: String(data.messageId) });
    const warns = [...(ctx.s.warnings[userId] ?? []), { at: new Date().toISOString(), by: `bot:${b.id}`, reason: `Auto-mod: ${reasons.join(', ')}` }];
    let s = { ...ctx.s, warnings: { ...ctx.s.warnings, [userId]: warns } };
    const after = Number(cfg.timeoutAfter ?? 3);
    let timedOut = false;
    if (after > 0 && warns.length % after === 0) {
      const mins = Number(cfg.timeoutMinutes ?? 10);
      s = { ...s, timeouts: { ...s.timeouts, [userId]: new Date(Date.now() + mins * 60_000).toISOString() } };
      timedOut = true;
    }
    await saveSettings(communityId, withAudit(s, `bot:${b.id}`, `${b.name} removed a message (${reasons.join(', ')})${timedOut ? ' and timed the author out' : ''}`));
    await postAsBot(b, channelId, { body: `⚠️ ${await mention(userId)}, your message was removed for ${reasons.join(', ')}. Warning ${warns.length}${after > 0 ? `/${after}` : ''}.${timedOut ? ` You’re timed out for ${Number(cfg.timeoutMinutes ?? 10)} minutes.` : ''}` });
    await audit({ summary: `${b.name} auto-moderated a message`, category: 'Moderation', action: 'bot.automod', actorType: 'Bot', actorLabel: b.name ?? 'Bot', targetType: 'User', targetUser: userId, communityId, severity: timedOut ? 'Warning' : 'Notice', details: { reasons, warnings: warns.length, timedOut } });
    return;
  }

  if (b.kind === 'Levels' && userId) {
    const r = await zite.sql({
      query: `SELECT COUNT(*) AS n FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id JOIN "Conversations" c ON c.id = l."conversationsId"
              WHERE c."communityId" = $1 AND m."sender" @> jsonb_build_array($2::text)`,
      params: [communityId, userId],
    });
    const n = Number(r.rows[0]?.n ?? 0);
    const lvl = levelFor(n);
    if (lvl > 0 && levelFor(n - 1) < lvl) {
      const text = String(cfg.message || '🎉 GG {user}, you just reached **level {level}**!').replace(/\{user\}/g, await mention(userId)).replace(/\{level\}/g, String(lvl));
      await postAsBot(b, String(cfg.channelId || channelId), { body: text });
    }
    return;
  }

  if (b.kind === 'Giveaway' && userId) {
    const g = /^\/giveaway\s+(\S+)\s+(?:(\d+)w\s+)?(.+)$/i.exec(body.trim());
    if (g) {
      const ms = parseDuration(g[1]);
      if (!ms) { await postAsBot(b, channelId, { body: 'Usage: `/giveaway 1h [3w] Prize name` — e.g. `/giveaway 2d 2w Nitro`' }); return; }
      const winners = Math.min(20, Math.max(1, Number(g[2] ?? 1)));
      const endsAt = new Date(Date.now() + ms).toISOString();
      const gw = await zite.giveaways.create({ record: { prize: g[3].slice(0, 200), communityId, channelId, messageId: null, botId: b.id, endsAt, winnerCount: winners, entrants: [], winners: [], host: userId, status: 'Running' } });
      const m = await postAsBot(b, channelId, {
        embeds: [{ title: `🎁 ${g[3].slice(0, 200)}`, description: `Click **Enter** to join!\nEnds <t:${endsAt}>\nWinners: **${winners}**\nHosted by ${await mention(userId)}`, color: '#f59e0b', footer: 'Giveaway' }],
        components: [[{ type: 'button', id: `giveaway:${gw.id}`, label: 'Enter', emoji: '🎉', style: 'primary' }]],
      });
      await zite.giveaways.update({ id: gw.id, record: { messageId: m.id } });
      return;
    }
    const p = /^\/poll\s+(.+)$/i.exec(body.trim());
    if (p) {
      const [question, ...options] = p[1].split('|').map((x) => x.trim()).filter(Boolean);
      if (!question || options.length < 2) { await postAsBot(b, channelId, { body: 'Usage: `/poll Question | Option A | Option B`' }); return; }
      await postAsBot(b, channelId, { poll: { question: question.slice(0, 300), options: options.slice(0, 10).map((o) => o.slice(0, 120)), multi: false, votes: {} } });
    }
    return;
  }

  if (b.kind === 'Reminder' && userId) {
    const r = /^\/remind\s+(me|here)\s+(?:in\s+)?(\S+)\s+(.+)$/i.exec(body.trim());
    if (!r) { if (/^\/remind\b/i.test(body)) await postAsBot(b, channelId, { body: 'Usage: `/remind me 2h check the oven` (or `/remind here 30m standup`)' }); return; }
    const ms = parseDuration(r[2]);
    if (!ms || ms > 365 * 86_400_000) { await postAsBot(b, channelId, { body: 'I couldn’t read that time — try `10m`, `2h`, `1d` or `1h30m`.' }); return; }
    const dueAt = new Date(Date.now() + ms).toISOString();
    await zite.reminders.create({ record: { text: r[3].slice(0, 500), dueAt, user: userId, channelId: r[1].toLowerCase() === 'here' ? channelId : channelId, botId: b.id, status: 'Pending' } });
    await postAsBot(b, channelId, { body: `⏰ Got it ${await mention(userId)} — I’ll remind you <t:${dueAt}>: “${r[3].slice(0, 200)}”` });
  }
}

/** Finishes due giveaways and sends due reminders (run every minute). */
export async function tickBots() {
  const now = new Date().toISOString();
  const [gws, rems] = await Promise.all([
    zite.giveaways.findAll({ filters: { status: 'Running', endsAt: { lte: now } }, limit: 50 }),
    zite.reminders.findAll({ filters: { status: 'Pending', dueAt: { lte: now } }, limit: 100 }),
  ]);
  await Promise.allSettled([
    ...gws.records.map((g) => endGiveaway(g.id)),
    ...rems.records.map(async (r) => {
      await zite.reminders.update({ id: r.id, record: { status: 'Sent' } });
      const bot = r.botId ? await zite.bots.findOne({ id: r.botId }) : null;
      const uid = ids(r.user)[0];
      if (bot && r.channelId && uid) await postAsBot(bot, r.channelId, { body: `⏰ ${await mention(uid)}, reminder: ${r.text}` });
    }),
  ]);
  return { giveaways: gws.records.length, reminders: rems.records.length };
}

export async function endGiveaway(id: string) {
  const g = await zite.giveaways.findOne({ id });
  if (!g || g.status === 'Ended') return g;
  const pool = [...ids(g.entrants)];
  const winners: string[] = [];
  while (pool.length && winners.length < Number(g.winnerCount ?? 1)) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  await zite.giveaways.update({ id, record: { status: 'Ended', winners } });
  const bot = g.botId ? await zite.bots.findOne({ id: g.botId }) : null;
  if (bot && g.channelId) {
    const names = await Promise.all(winners.map(mention));
    await postAsBot(bot, g.channelId, { body: winners.length ? `🎉 Congratulations ${names.join(', ')} — you won **${g.prize}**!` : `The giveaway for **${g.prize}** ended with no entries.`, replyToId: g.messageId ?? null });
  }
  if (g.messageId) await zite.messages.update({ id: g.messageId, record: { components: JSON.stringify([[{ type: 'button', id: `giveaway:${id}`, label: `Ended · ${ids(g.entrants).length} entries`, emoji: '🎉', style: 'secondary', disabled: true }]]) } });
  return g;
}

let lastTick = 0;
/** Plans don't include schedules, so due giveaways/reminders are processed opportunistically on normal traffic (at most every 30s per worker). */
export function maybeTick() {
  if (Date.now() - lastTick < 30_000) return;
  lastTick = Date.now();
  tickBots().catch((e) => console.error('tickBots', e));
}
