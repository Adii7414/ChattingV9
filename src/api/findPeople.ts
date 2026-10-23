import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireActive } from '../server/chat';

export default createEndpoint({
  description: 'Finds people by their exact or partial @username',
  authenticated: true,
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ people: z.array(z.object({ id: z.string(), name: z.string(), username: z.string(), email: z.string(), image: z.string().nullable() })) }),
  execute: async ({ input, context }) => {
    await requireActive(context.user.id);
    const q = input.query.trim().toLowerCase().replace(/^@/, '');
    if (q.length < 2) return { people: [] };
    const r = await zite.sql({
      query: `SELECT u.id::text AS id, u."name", u."image", p."username"
              FROM "Profiles" p JOIN "ziteUsers" u ON u.id::text = p."userKey"
              WHERE p."username" IS NOT NULL AND p."username" <> '' AND LOWER(p."username") LIKE $1 || '%' AND p."userKey" <> $2
                AND NOT (p."blocked" @> jsonb_build_array($2::text))
              ORDER BY (LOWER(p."username") = $1) DESC, LENGTH(p."username") LIMIT 20`,
      params: [q.replace(/[%_\\]/g, '\\$&'), context.user.id],
    });
    // Email is intentionally never returned — people are found by username only.
    return { people: r.rows.map((x) => ({ id: String(x.id), name: String(x.name || x.username), username: String(x.username), email: '', image: x.image ? String(x.image) : null })) };
  },
});
