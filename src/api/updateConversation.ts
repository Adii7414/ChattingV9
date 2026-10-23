import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireAdmin, requireMember } from '../server/chat';

/** One endpoint for everything you can change about a group or channel. */
export default createEndpoint({
  description: 'Updates a conversation: details, members, admins, pin/mute, or leaving it',
  authenticated: true,
  inputSchema: z.object({
    conversationId: z.string(),
    action: z.enum(['details', 'addMembers', 'removeMember', 'toggleAdmin', 'pin', 'mute', 'archive', 'leave']),
    name: z.string().max(80).optional(),
    description: z.string().max(500).optional(),
    emoji: z.string().max(16).optional(),
    userIds: z.array(z.string()).max(100).optional(),
    userId: z.string().optional(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const id = input.conversationId;
    const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

    if (input.action === 'pin' || input.action === 'mute' || input.action === 'archive') {
      const c = await requireMember(id, me);
      const field = input.action === 'pin' ? 'pinnedBy' : input.action === 'mute' ? 'mutedBy' : 'archivedBy';
      await zite.conversations.update({ id, record: { [field]: toggle(ids(c[field]), me) } as never });
      return { ok: true };
    }
    if (input.action === 'leave') {
      const c = await requireMember(id, me);
      if (!c.isGroup) throw fail('You can’t leave a direct message');
      if (c.communityId) throw fail('Leave the community to leave its channels');
      const members = ids(c.members).filter((m) => m !== me);
      const admins = ids(c.admins).filter((m) => m !== me);
      const owner = ids(c.owner)[0] === me ? (admins[0] ?? members[0] ?? null) : ids(c.owner)[0] ?? null;
      await zite.conversations.update({ id, record: { members, admins, owner } as never });
      return { ok: true };
    }

    const c = await requireAdmin(id, me);
    if (!c.isGroup) throw fail('Only groups can be changed');
    const members = ids(c.members);
    switch (input.action) {
      case 'details':
        await zite.conversations.update({ id, record: {
          ...(input.name !== undefined && { name: input.name.trim() || null }),
          ...(input.description !== undefined && { description: input.description.trim() || null }),
          ...(input.emoji !== undefined && { emoji: input.emoji.trim() || null }),
        } as never });
        break;
      case 'addMembers': {
        if (c.communityId) throw fail('Channel members come from the community');
        const add = (input.userIds ?? []).filter((u) => !members.includes(u));
        await zite.conversations.update({ id, record: { members: [...members, ...add] } as never });
        break;
      }
      case 'removeMember': {
        const u = input.userId!;
        if (u === ids(c.owner)[0]) throw fail('The owner can’t be removed');
        if (c.communityId) throw fail('Channel members come from the community');
        await zite.conversations.update({ id, record: { members: members.filter((m) => m !== u), admins: ids(c.admins).filter((m) => m !== u) } as never });
        break;
      }
      case 'toggleAdmin': {
        const u = input.userId!;
        if (!members.includes(u)) throw fail('Not a member');
        await zite.conversations.update({ id, record: { admins: toggle(ids(c.admins), u) } as never });
        break;
      }
    }
    return { ok: true };
  },
});
