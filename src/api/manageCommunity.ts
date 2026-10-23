import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireActive } from '../server/chat';
import { loadCommunity, postInto, requirePerm, saveSettings, syncChannels, withAudit } from '../server/community';
import { parseChannel } from '../lib/community';
import { emitEvent } from '../server/bots';

/** Join / leave a community, add a channel, or update it. Channel membership is derived from the community. */
export default createEndpoint({
  description: 'Joins, leaves or manages a community and its channels',
  authenticated: true,
  inputSchema: z.object({
    communityId: z.string(),
    action: z.enum(['join', 'leave', 'createChannel', 'details', 'delete']),
    name: z.string().max(60).optional(),
    description: z.string().max(500).optional(),
    emoji: z.string().max(16).optional(),
    category: z.string().optional(),
  }),
  outputSchema: z.object({ ok: z.boolean(), channelId: z.string().nullable(), status: z.enum(['joined', 'pending', 'done']) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    let cid = input.communityId;

    if (input.action === 'join') {
      // Invite links may use a vanity code instead of the id.
      if (!/^[0-9a-f-]{36}$/i.test(cid)) {
        const v = await zite.sql({ query: `SELECT id FROM "Communities" WHERE "settings" LIKE $1 LIMIT 1`, params: [`%"vanity":${JSON.stringify(cid.toLowerCase())}%`] });
        if (!v.rows[0]) throw fail('That invite link isn’t valid');
        cid = String(v.rows[0].id);
      }
      const { s, members, ownerId } = await loadCommunity(cid);
      const firstChannel = async () => {
        const r = await zite.sql({ query: `SELECT id FROM "Conversations" WHERE "communityId" = $1 AND "members" @> jsonb_build_array($2::text)`, params: [cid, me] });
        const order = s.channelOrder;
        const list = r.rows.map((x) => String(x.id)).sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
        return list[0] ?? null;
      };
      if (members.includes(me)) return { ok: true, channelId: await firstChannel(), status: 'joined' as const };
      if (s.banned.includes(me)) throw fail('You can’t join this community');
      if (s.joinMode === 'approval') {
        if (!s.pending.includes(me)) await saveSettings(cid, { ...s, pending: [...s.pending, me] });
        return { ok: true, channelId: null, status: 'pending' as const };
      }
      await zite.communities.update({ id: cid, record: { members: [...members, me] } as never });
      await syncChannels(cid);
      if (s.welcome.trim() && s.systemChannel && ownerId) {
        const who = context.user.firstName || context.user.email.split('@')[0];
        await postInto(s.systemChannel, ownerId, s.welcome.replace(/\{user\}/g, `@${who}`)).catch(() => {});
      }
      await emitEvent(cid, 'MEMBER_JOIN', null, { userId: me, userName: context.user.firstName || context.user.email.split('@')[0] });
      return { ok: true, channelId: await firstChannel(), status: 'joined' as const };
    }

    const { c, s, ownerId, members } = await loadCommunity(cid);
    if (!members.includes(me)) throw fail('Join this community first');
    if (input.action === 'leave') {
      if (ownerId === me) throw fail('Owners can’t leave — transfer ownership or delete the community instead');
      const { [me]: _r, ...memberRoles } = s.memberRoles;
      await zite.communities.update({ id: cid, record: { members: members.filter((m) => m !== me), settings: JSON.stringify({ ...s, memberRoles }) } as never });
      await syncChannels(cid);
      await emitEvent(cid, 'MEMBER_LEAVE', null, { userId: me, reason: 'left' });
      return { ok: true, channelId: null, status: 'done' as const };
    }
    if (input.action === 'createChannel') {
      await requirePerm(cid, me, 'manageChannels');
      const name = (input.name ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
      if (!name) throw fail('Give the channel a name');
      const ch = await zite.conversations.create({
        record: {
          name, isGroup: true, members: ids(c.members), owner: ownerId, admins: ownerId ? [ownerId] : [], communityId: cid,
          description: input.description?.trim() || null, emoji: input.emoji?.trim() || null, lastMessageAt: new Date().toISOString(),
          lastMessagePreview: null, messages: null, reactions: null, readReceipts: null,
          settings: JSON.stringify({ ...parseChannel(null), category: input.category ?? null }),
        } as never,
      });
      await saveSettings(cid, withAudit({ ...s, channelOrder: [...s.channelOrder, ch.id] }, me, `created #${name}`));
      return { ok: true, channelId: ch.id, status: 'done' as const };
    }
    if (input.action === 'details') {
      await requirePerm(cid, me, 'manageCommunity');
      await zite.communities.update({ id: cid, record: {
        ...(input.name !== undefined && input.name.trim() && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() || null }),
        ...(input.emoji !== undefined && { emoji: input.emoji.trim() || null }),
      } as never });
      return { ok: true, channelId: null, status: 'done' as const };
    }
    if (ownerId !== me) throw fail('Only the owner can delete the community');
    const chans = await zite.sql({ query: `SELECT id FROM "Conversations" WHERE "communityId" = $1`, params: [cid] });
    await Promise.all(chans.rows.map((r) => zite.conversations.delete({ id: String(r.id) })));
    await zite.communities.delete({ id: cid });
    return { ok: true, channelId: null, status: 'done' as const };
  },
});
