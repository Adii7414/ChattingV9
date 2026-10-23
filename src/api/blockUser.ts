import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireActive } from '../server/chat';

export default createEndpoint({
  description: 'Lists the people you have blocked, and optionally blocks or unblocks someone',
  authenticated: true,
  inputSchema: z.object({ userId: z.string().optional() }),
  outputSchema: z.object({ blocked: z.array(z.string()) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const p = await zite.profiles.findOne({ filters: { userKey: me } });
    let blocked = ids(p?.blocked as string[] | undefined);
    if (input.userId && input.userId !== me) {
      blocked = blocked.includes(input.userId) ? blocked.filter((b) => b !== input.userId) : [...blocked, input.userId];
      await zite.profiles.bulkCreate({ records: [{ userKey: me, person: me, blocked } as never], matchOn: ['userKey'] });
    }
    return { blocked };
  },
});
