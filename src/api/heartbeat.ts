import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Marks the signed-in user as online',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ context }) => {
    await requireActive(context.user.id, { allowSuspended: true });
    await zite.presence.bulkCreate({
      records: [{ userKey: context.user.id, person: context.user.id, lastSeenAt: new Date().toISOString() }],
      matchOn: ['userKey'],
    });
    return { ok: true };
  },
});
