import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Publishes the signed-in user’s public encryption key, or fetches another person’s',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['publish', 'get']),
    publicKey: z.string().max(200).optional(),
    userId: z.string().optional(),
  }),
  outputSchema: z.object({ publicKey: z.string().nullable() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    if (input.action === 'publish') {
      if (!input.publicKey) return { publicKey: null };
      await zite.profiles.bulkCreate({ records: [{ userKey: me, person: me, e2EPublicKey: input.publicKey } as never], matchOn: ['userKey'] });
      return { publicKey: input.publicKey };
    }
    const r = await zite.sql({ query: `SELECT "e2EPublicKey" AS k FROM "Profiles" WHERE "userKey" = $1 LIMIT 1`, params: [input.userId ?? me] });
    return { publicKey: (r.rows[0]?.k as string | null) ?? null };
  },
});
