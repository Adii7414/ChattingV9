import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';

export default createEndpoint({
  description: 'Pins/unpins a message for the conversation, or stars/unstars it for the signed-in user',
  authenticated: true,
  inputSchema: z.object({ messageId: z.string(), action: z.enum(['pin', 'star']) }),
  outputSchema: z.object({ on: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const msg = await zite.messages.findOne({ id: input.messageId });
    const cid = ids(msg?.conversation)[0];
    if (!msg || !cid) throw fail('Message not found');
    await requireMember(cid, me);
    if (input.action === 'pin') {
      const on = !msg.isPinned;
      await zite.messages.update({ id: msg.id, record: { isPinned: on } as never });
      return { on };
    }
    const starred = ids(msg.starredBy);
    const on = !starred.includes(me);
    await zite.messages.update({ id: msg.id, record: { starredBy: on ? [...starred, me] : starred.filter((u) => u !== me) } as never });
    return { on };
  },
});
