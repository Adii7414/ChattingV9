import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';
import { loadCommunity, saveSettings, syncChannels, withAudit } from '../server/community';
import { emitEvent } from '../server/bots';
import { fail } from '../server/errors';
import { parseComponents } from '../lib/bots';

export default createEndpoint({
  description: 'Handles a click on a bot message button or dropdown',
  authenticated: true,
  inputSchema: z.object({ messageId: z.string(), componentId: z.string().max(100), values: z.array(z.string().max(100)).max(25).optional() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const msg = await zite.messages.findOne({ id: input.messageId });
    const conversationId = msg ? ids(msg.conversation)[0] : undefined;
    if (!msg || !conversationId || !msg.botId) throw fail('That message is no longer available.');
    const conv = await requireMember(conversationId, me);
    const comp = parseComponents(msg.components).flat().find((c) => c.id === input.componentId);
    if (!comp || (comp.type === 'button' && comp.disabled)) throw fail('That button is no longer active.');
    const id = input.componentId;
    const communityId = conv.communityId ?? null;

    if (id.startsWith('giveaway:')) {
      const g = await zite.giveaways.findOne({ id: id.slice(9) });
      if (!g || g.status !== 'Running') throw fail('This giveaway has ended.');
      const entrants = ids(g.entrants);
      const joined = !entrants.includes(me);
      await zite.giveaways.update({ id: g.id, record: { entrants: joined ? [...entrants, me] : entrants.filter((x) => x !== me) } });
      return { message: joined ? `You’re entered! ${entrants.length + 1} entries so far 🎉` : 'You left the giveaway.' };
    }
    if (communityId && (id.startsWith('role:') || id === 'roles' || id === 'rules:accept')) {
      const ctx = await loadCommunity(communityId);
      const mine = new Set(ctx.s.memberRoles[me] ?? []);
      let text = '';
      if (id === 'rules:accept') {
        text = 'Thanks for accepting the rules ✅';
        const acceptRole = ctx.s.roles.find((r) => /member|verified/i.test(r.name));
        if (acceptRole) mine.add(acceptRole.id);
      } else if (id === 'roles') {
        const offered = comp.type === 'select' ? comp.options.map((o) => o.value) : [];
        offered.forEach((r) => mine.delete(r));
        (input.values ?? []).filter((v) => offered.includes(v) && ctx.s.roles.some((r) => r.id === v)).forEach((r) => mine.add(r));
        text = 'Your roles were updated.';
      } else {
        const rid = id.slice(5);
        const role = ctx.s.roles.find((r) => r.id === rid);
        if (!role) throw fail('That role no longer exists.');
        if (role.perms.length) throw fail('Roles with permissions can’t be self-assigned.');
        const had = mine.has(rid);
        if (had) mine.delete(rid); else mine.add(rid);
        text = had ? `Removed the ${role.name} role.` : `You now have the ${role.name} role.`;
      }
      // Only roles without permissions can ever be self-assigned this way.
      const safe = [...mine].filter((r) => (ctx.s.memberRoles[me] ?? []).includes(r) || !ctx.s.roles.find((x) => x.id === r)?.perms.length);
      await saveSettings(communityId, withAudit({ ...ctx.s, memberRoles: { ...ctx.s.memberRoles, [me]: safe } }, me, `Self-assigned roles via a bot message`));
      await syncChannels(communityId);
      return { message: text };
    }
    await emitEvent(communityId, 'INTERACTION_CREATE', conversationId, { userId: me, userName: context.user.firstName || context.user.email.split('@')[0], messageId: msg.id, channelId: conversationId, componentId: id, values: input.values ?? [], targetBotId: msg.botId });
    return { message: '' };
  },
});
