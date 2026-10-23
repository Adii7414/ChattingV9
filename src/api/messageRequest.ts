import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';
import { fail } from '../server/errors';

export default createEndpoint({
  description: 'Accepts or declines a message request someone sent you',
  authenticated: true,
  inputSchema: z.object({ conversationId: z.string(), action: z.enum(['accept', 'decline']) }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const c = await requireMember(input.conversationId, me);
    if (c.requestStatus !== 'Pending') throw fail('This conversation isn’t a message request.');
    if (ids(c.requestedBy as string | string[] | null).includes(me)) throw fail('Only the person you messaged can answer this request.');
    if (input.action === 'accept') await zite.conversations.update({ id: c.id, record: { requestStatus: 'Accepted' } });
    else await zite.conversations.delete({ id: c.id });
    return { ok: true };
  },
});
