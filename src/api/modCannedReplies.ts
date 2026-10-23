import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';

export default createEndpoint({
  authenticated: true,
  description: 'Lists, adds and removes saved support replies',
  inputSchema: z.object({
    create: z.object({ title: z.string().min(2).max(100), body: z.string().min(2).max(4000), category: z.enum(['Account', 'Bug', 'Abuse', 'Billing', 'Feature request', 'Other']) }).optional(),
    deleteId: z.string().optional(),
  }),
  outputSchema: z.object({ replies: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), category: z.string() })) }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    if (input.create) await zite.cannedReplies.create({ record: input.create as never });
    if (input.deleteId) await zite.cannedReplies.delete({ id: input.deleteId });
    const r = await zite.sql({ query: `SELECT id, COALESCE("title",'') AS title, COALESCE("body",'') AS body, COALESCE("category",'Other') AS category FROM "CannedReplies" ORDER BY "title"` });
    return { replies: r.rows.map((x) => ({ id: String(x.id), title: String(x.title), body: String(x.body), category: String(x.category) })) };
  },
});
