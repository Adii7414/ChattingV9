import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids } from '../server/chat';
import { customFor } from '../server/community';

export default createEndpoint({
  description: 'Edits the text of one of the signed-in user’s own messages',
  authenticated: true,
  inputSchema: z.object({ messageId: z.string(), body: z.string().min(1).max(12000) }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const msg = await zite.messages.findOne({ id: input.messageId });
    if (!msg) throw fail('Message not found');
    if (!ids(msg.sender).includes(context.user.id)) throw fail('You can only edit your own messages');
    const cid = ids(msg.conversation)[0];
    const rules = cid ? await customFor(cid, context.user.id) : null;
    if (rules && !rules.custom.allowEdits && !rules.bypass) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Edits disabled', userFacingMessage: 'Editing messages is turned off in this community.' });
    await zite.messages.update({ id: input.messageId, record: { body: input.body.trim(), editedAt: new Date().toISOString() } });
    return { ok: true };
  },
});
