import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, isAdmin, requireActive } from '../server/chat';
import { loadCommunity } from '../server/community';
import { permsOf } from '../lib/community';

export default createEndpoint({
  description: 'Deletes a message — your own, or anyone’s if you moderate the chat',
  authenticated: true,
  inputSchema: z.object({ messageId: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const msg = await zite.messages.findOne({ id: input.messageId });
    if (!msg) return { ok: true };
    if (!ids(msg.sender).includes(me)) {
      const conv = await zite.conversations.findOne({ id: ids(msg.conversation)[0] ?? '' });
      let allowed = false;
      if (conv?.communityId) { const { s, ownerId } = await loadCommunity(conv.communityId); allowed = permsOf(s, ownerId, me).has('manageMessages'); }
      else if (conv?.isGroup) allowed = isAdmin(conv, me);
      if (!allowed) throw fail('You can only delete your own messages');
    }
    const r = await zite.sql({
      query: `SELECT "reactionsId" AS id FROM "MessagesReactions" WHERE "messagesId" = $1::uuid`,
      params: [input.messageId],
    });
    await Promise.all(r.rows.map((x) => zite.reactions.delete({ id: String(x.id) })));
    await zite.messages.delete({ id: input.messageId });
    return { ok: true };
  },
});
