import { z } from 'zod';
import { fail } from '../server/errors';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { parseCommunity } from '../lib/community';

export default createEndpoint({
  description: 'Creates a community with a #general channel, owned by the signed-in user',
  authenticated: true,
  inputSchema: z.object({ name: z.string().min(2).max(60), description: z.string().max(500).optional(), emoji: z.string().max(16).optional(), isPublic: z.boolean() }),
  outputSchema: z.object({ id: z.string(), channelId: z.string() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const name = input.name.trim();
    if (name.length < 2) throw fail('Give your community a name');
    const comm = await zite.communities.create({
      record: { name, description: input.description?.trim() || null, emoji: input.emoji?.trim() || null, owner: me, members: [me], isPublic: input.isPublic } as never,
    });
    const ch = await zite.conversations.create({
      record: {
        name: 'general', isGroup: true, members: [me], owner: me, admins: [me], communityId: comm.id,
        description: `Everything ${name}`, emoji: null, lastMessageAt: new Date().toISOString(), lastMessagePreview: null,
        messages: null, reactions: null, readReceipts: null,
      } as never,
    });
    await zite.communities.update({ id: comm.id, record: { settings: JSON.stringify({ ...parseCommunity(null), systemChannel: ch.id, channelOrder: [ch.id], welcome: 'Welcome {user}! 👋' }) } as never });
    return { id: comm.id, channelId: ch.id };
  },
});
