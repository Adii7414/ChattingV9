import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';

const standingSql = `(SELECT CASE WHEN a."action" = 'Ban' THEN 'Banned' WHEN a."action" = 'Suspend' AND (a."expiresAt" IS NULL OR a."expiresAt" > now()) THEN 'Suspended' ELSE 'Good' END
  FROM "UserActions" a WHERE a."targetUser"->>0 = u.id AND a."action" IN ('Suspend','Ban','Lift') ORDER BY a.created_at DESC LIMIT 1)`;

export default createEndpoint({
  authenticated: true,
  description: 'Searches Chatting users with activity and standing',
  inputSchema: z.object({ search: z.string().optional(), standing: z.enum(['All', 'Good', 'Suspended', 'Banned']).default('All'), page: z.number().int().min(0).default(0) }),
  outputSchema: z.object({
    users: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable(), joinedAt: z.string(), lastSeenAt: z.string().nullable(), messages: z.number(), reports: z.number(), standing: z.string() })),
    total: z.number(),
  }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    const r = await zite.sql({
      query: `WITH base AS (
          SELECT u.id, u."name" AS name, u."email" AS email, u."image" AS image, u.created_at AS "joinedAt",
            (SELECT MAX(p."lastSeenAt") FROM "Presence" p WHERE p."person"->>0 = u.id) AS "lastSeenAt",
            (SELECT COUNT(*) FROM "Messages" m WHERE m."sender"->>0 = u.id) AS messages,
            (SELECT COUNT(*) FROM "Reports" r WHERE r."reportedUser"->>0 = u.id) AS reports,
            COALESCE(${standingSql}, 'Good') AS standing
          FROM "ziteUsers" u
          WHERE $1 = '' OR u."name" ILIKE '%' || $1 || '%' OR u."email" ILIKE '%' || $1 || '%')
        SELECT *, COUNT(*) OVER () AS total FROM base WHERE $2 = 'All' OR standing = $2
        ORDER BY reports DESC, "joinedAt" DESC LIMIT 50 OFFSET $3`,
      params: [input.search?.trim() ?? '', input.standing, input.page * 50],
    });
    return {
      total: Number(r.rows[0]?.total ?? 0),
      users: r.rows.map((x) => ({ id: String(x.id), name: String(x.name ?? 'Unknown'), email: String(x.email ?? ''), image: x.image ? String(x.image) : null, joinedAt: String(x.joinedAt), lastSeenAt: x.lastSeenAt ? String(x.lastSeenAt) : null, messages: Number(x.messages), reports: Number(x.reports), standing: String(x.standing) })),
    };
  },
});
