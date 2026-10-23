import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Marks every conversation (or every channel in one community) as read',
  authenticated: true,
  inputSchema: z.object({ communityId: z.string().optional() }),
  outputSchema: z.object({ count: z.number() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const r = await zite.sql({ query: `SELECT id FROM "Conversations" WHERE "members" @> jsonb_build_array($1::text) AND ($2 = '' OR "communityId" = $2)`, params: [me, input.communityId ?? ''] });
    const now = new Date().toISOString();
    const records = r.rows.map((c) => ({ key: `${c.id}:${me}`, conversation: String(c.id), reader: me, lastReadAt: now }));
    for (let i = 0; i < records.length; i += 100) await zite.readReceipts.bulkCreate({ records: records.slice(i, i + 100), matchOn: ['key'] });
    return { count: records.length };
  },
});
