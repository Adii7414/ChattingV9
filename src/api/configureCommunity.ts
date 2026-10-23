import { z } from 'zod';
import { fail } from '../server/errors';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { loadCommunity, postInto, requirePerm, saveSettings, syncChannels, withAudit } from '../server/community';
import { ALL_PERMS, parseChannel, permsOf, type CommunitySettings } from '../lib/community';

const role = z.object({ id: z.string(), name: z.string().min(1).max(40), color: z.string().max(20), perms: z.array(z.enum(ALL_PERMS as [string, ...string[]])), hoist: z.boolean() });

export default createEndpoint({
  description: 'Changes a community’s look, roles, members, channels and moderation settings',
  authenticated: true,
  inputSchema: z.object({
    communityId: z.string(),
    action: z.enum(['profile', 'moderation', 'roles', 'assignRoles', 'nickname', 'kick', 'ban', 'unban', 'approve', 'deny', 'transfer', 'channel', 'deleteChannel', 'layout', 'customise']),
    custom: z.object({
      font: z.enum(['default', 'serif', 'mono', 'rounded']), bubble: z.enum(['round', 'square', 'minimal']),
      wallpaper: z.enum(['none', 'dots', 'grid', 'waves', 'glow', 'sunset', 'paper', 'aurora']), useAccent: z.boolean(), showBannerStrip: z.boolean(),
      announcement: z.string().max(300), announcementColor: z.string().max(20), placeholder: z.string().max(80), emptyText: z.string().max(200),
      memberLabel: z.string().max(24), guidelinesUrl: z.string().max(300), showRoleTags: z.boolean(), allowGifs: z.boolean(), allowFiles: z.boolean(),
      allowPolls: z.boolean(), allowReactions: z.boolean(), allowThreads: z.boolean(), allowEdits: z.boolean(), minLength: z.number().min(0).max(500),
      blockCaps: z.boolean(), maxMentions: z.number().min(0).max(50), maxEmoji: z.number().min(0).max(100),
      autoReplies: z.array(z.object({ trigger: z.string().min(1).max(60), reply: z.string().min(1).max(500) })).max(25),
    }).optional(),
    profile: z.object({
      name: z.string().min(2).max(60), description: z.string().max(500), emoji: z.string().max(16), isPublic: z.boolean(),
      icon: z.string().nullable(), banner: z.string().nullable(), accent: z.string().max(20), tagline: z.string().max(120),
      tags: z.array(z.string().max(24)).max(8), vanity: z.string().max(32).nullable(), quickReactions: z.array(z.string().max(16)).max(10),
    }).optional(),
    moderation: z.object({
      joinMode: z.enum(['open', 'approval', 'invite']), bannedWords: z.array(z.string().max(40)).max(200), blockLinks: z.boolean(),
      maxLength: z.number().min(50).max(5000), welcome: z.string().max(500), systemChannel: z.string().nullable(), rules: z.array(z.string().max(300)).max(20),
    }).optional(),
    roles: z.array(role).max(30).optional(),
    userId: z.string().optional(),
    roleIds: z.array(z.string()).optional(),
    nickname: z.string().max(32).optional(),
    channel: z.object({
      id: z.string(), name: z.string().min(1).max(60), emoji: z.string().max(16), topic: z.string().max(300), category: z.string().nullable(),
      slowmode: z.number().min(0).max(21600), announcement: z.boolean(), voice: z.boolean().optional(), allowedRoles: z.array(z.string()),
    }).optional(),
    layout: z.object({ categories: z.array(z.object({ id: z.string(), name: z.string().min(1).max(40) })).max(30), channelOrder: z.array(z.string()) }).optional(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const cid = input.communityId;
    const ok = { ok: true };
    const need = (u = input.userId) => { if (!u) throw fail('Pick a member'); return u; };
    const save = (s: CommunitySettings, text: string, extra?: Record<string, unknown>) => saveSettings(cid, withAudit(s, me, text), extra);

    switch (input.action) {
      case 'profile': {
        const p = input.profile; if (!p) throw fail('Missing details');
        const { s } = await requirePerm(cid, me, 'manageCommunity');
        const vanity = p.vanity?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null;
        if (vanity && vanity !== s.vanity) {
          const taken = await zite.sql({ query: `SELECT id FROM "Communities" WHERE "settings" LIKE $1 AND id <> $2::uuid LIMIT 1`, params: [`%"vanity":${JSON.stringify(vanity)}%`, cid] });
          if (taken.rows.length) throw fail('That invite link is already taken');
        }
        await save({ ...s, icon: p.icon, banner: p.banner, accent: p.accent, tagline: p.tagline.trim(), tags: p.tags, vanity, quickReactions: p.quickReactions }, 'updated the community profile',
          { name: p.name.trim(), description: p.description.trim() || null, emoji: p.emoji.trim() || null, isPublic: p.isPublic });
        return ok;
      }
      case 'moderation': {
        const m = input.moderation; if (!m) throw fail('Missing settings');
        const { s } = await requirePerm(cid, me, 'manageCommunity');
        await save({ ...s, ...m, bannedWords: m.bannedWords.map((w) => w.trim().toLowerCase()).filter(Boolean), rules: m.rules.map((r) => r.trim()).filter(Boolean) }, 'updated moderation & welcome settings');
        return ok;
      }
      case 'roles': {
        const { s } = await requirePerm(cid, me, 'manageRoles');
        const roles = (input.roles ?? []) as CommunitySettings['roles'];
        const keep = new Set(roles.map((r) => r.id));
        const memberRoles = Object.fromEntries(Object.entries(s.memberRoles).map(([u, r]) => [u, r.filter((x) => keep.has(x))]));
        await save({ ...s, roles, memberRoles }, `updated roles (${roles.length})`);
        await syncChannels(cid);
        return ok;
      }
      case 'assignRoles': {
        const { s } = await requirePerm(cid, me, 'manageRoles');
        const u = need();
        await save({ ...s, memberRoles: { ...s.memberRoles, [u]: (input.roleIds ?? []).filter((r) => s.roles.some((x) => x.id === r)) } }, `changed roles for a member`);
        await syncChannels(cid);
        return ok;
      }
      case 'nickname': {
        const u = input.userId ?? me;
        const { s, members } = u === me ? await loadCommunity(cid) : await requirePerm(cid, me, 'manageCommunity');
        if (!members.includes(me)) throw fail('Join this community first');
        const nicknames = { ...s.nicknames };
        if (input.nickname?.trim()) nicknames[u] = input.nickname.trim(); else delete nicknames[u];
        await saveSettings(cid, { ...s, nicknames });
        return ok;
      }
      case 'kick': case 'ban': {
        const { s, members, ownerId } = await requirePerm(cid, me, input.action);
        const u = need();
        if (u === ownerId || u === me) throw fail('You can’t remove that member');
        if (permsOf(s, ownerId, u).has('kick') && ownerId !== me) throw fail('Only the owner can remove moderators');
        const { [u]: _r, ...memberRoles } = s.memberRoles;
        const banned = input.action === 'ban' ? [...new Set([...s.banned, u])] : s.banned;
        await save({ ...s, memberRoles, banned, pending: s.pending.filter((x) => x !== u) }, input.action === 'ban' ? 'banned a member' : 'removed a member', { members: members.filter((m) => m !== u) });
        await syncChannels(cid);
        return ok;
      }
      case 'unban': {
        const { s } = await requirePerm(cid, me, 'ban');
        await save({ ...s, banned: s.banned.filter((x) => x !== need()) }, 'unbanned a member');
        return ok;
      }
      case 'approve': case 'deny': {
        const { s, members, ownerId } = await requirePerm(cid, me, 'ban');
        const u = need();
        const pending = s.pending.filter((x) => x !== u);
        if (input.action === 'deny') { await save({ ...s, pending }, 'declined a join request'); return ok; }
        await save({ ...s, pending }, 'approved a join request', { members: [...new Set([...members, u])] });
        await syncChannels(cid);
        if (s.welcome.trim() && s.systemChannel && ownerId) {
          const name = (await zite.sql({ query: `SELECT "firstName", "email" FROM "ziteUsers" WHERE id::text = $1`, params: [u] })).rows[0];
          await postInto(s.systemChannel, ownerId, s.welcome.replace(/\{user\}/g, `@${String(name?.firstName || String(name?.email ?? 'friend').split('@')[0])}`)).catch(() => {});
        }
        return ok;
      }
      case 'transfer': {
        const { s, ownerId, members } = await loadCommunity(cid);
        const u = need();
        if (ownerId !== me) throw fail('Only the owner can transfer ownership');
        if (!members.includes(u)) throw fail('They need to be a member first');
        await save(s, 'transferred ownership', { owner: u });
        const chans = await zite.sql({ query: `SELECT id FROM "Conversations" WHERE "communityId" = $1`, params: [cid] });
        await Promise.all(chans.rows.map((r) => zite.conversations.update({ id: String(r.id), record: { owner: u } as never })));
        await syncChannels(cid);
        return ok;
      }
      case 'channel': {
        const ch = input.channel; if (!ch) throw fail('Missing channel');
        const { s } = await requirePerm(cid, me, 'manageChannels');
        const name = ch.name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'channel';
        const conv = await zite.conversations.findOne({ id: ch.id });
        if (!conv || conv.communityId !== cid) throw fail('Channel not found');
        const cs = { ...parseChannel(conv.settings), topic: ch.topic.trim(), category: ch.category, slowmode: ch.slowmode, announcement: ch.announcement, voice: !!ch.voice, allowedRoles: ch.allowedRoles };
        await zite.conversations.update({ id: ch.id, record: { name, emoji: ch.emoji.trim() || null, description: ch.topic.trim() || null, settings: JSON.stringify(cs) } as never });
        await save(s, `edited #${name}`);
        await syncChannels(cid);
        return ok;
      }
      case 'deleteChannel': {
        const { s } = await requirePerm(cid, me, 'manageChannels');
        const chId = need();
        const conv = await zite.conversations.findOne({ id: chId });
        if (!conv || conv.communityId !== cid) throw fail('Channel not found');
        const count = await zite.sql({ query: `SELECT COUNT(*) AS n FROM "Conversations" WHERE "communityId" = $1`, params: [cid] });
        if (Number(count.rows[0]?.n) <= 1) throw fail('A community needs at least one channel');
        await zite.conversations.delete({ id: chId });
        await save({ ...s, channelOrder: s.channelOrder.filter((x) => x !== chId), systemChannel: s.systemChannel === chId ? null : s.systemChannel }, `deleted #${conv.name}`);
        return ok;
      }
      case 'customise': {
        const c = input.custom; if (!c) throw fail('Missing settings');
        const { s } = await requirePerm(cid, me, 'manageCommunity');
        const url = c.guidelinesUrl.trim();
        if (url && !/^https?:\/\//i.test(url)) throw fail('Guidelines link must start with http:// or https://');
        await save({ ...s, custom: { ...c, guidelinesUrl: url, autoReplies: c.autoReplies.map((a) => ({ trigger: a.trigger.trim().toLowerCase(), reply: a.reply.trim() })) } }, 'customised the community');
        return ok;
      }
      case 'layout': {
        const l = input.layout; if (!l) throw fail('Missing layout');
        const { s } = await requirePerm(cid, me, 'manageChannels');
        await save({ ...s, categories: l.categories, channelOrder: l.channelOrder }, 'reorganised channels');
        return ok;
      }
    }
  },
});
