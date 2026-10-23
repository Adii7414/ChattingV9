import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Reads or saves your unsent draft for a chat, so it follows you across devices',
  authenticated: true,
  inputSchema: z.object({ conversationId: z.string(), body: z.string().max(5000).optional() }),
  outputSchema: z.object({ body: z.string() }),
  execute: async ({ input, context }) => {
    await requireActive(context.user.id, { allowSuspended: true });
    const key = `${input.conversationId}:${context.user.id}`;
    if (input.body !== undefined) {
      await zite.drafts.bulkCreate({ records: [{ key, owner: context.user.id, conversationId: input.conversationId, body: input.body }], matchOn: ['key'] });
      return { body: input.body };
    }
    const d = await zite.drafts.findOne({ filters: { key } });
    return { body: String(d?.body ?? '') };
  },
});
