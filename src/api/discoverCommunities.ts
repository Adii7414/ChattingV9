import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { parseCommunity } from '../lib/community';

const pub = (raw: unknown) => { const s = parseCommunity(raw); return JSON.stringify({ icon: s.icon, banner: s.banner, accent: s.accent, tagline: s.tagline, tags: s.tags, joinMode: s.joinMode, rules: s.rules }); };

export default createEndpoint({
  description: 'Lists public communities the signed-in user can discover and join',
  authenticated: true,
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ communities: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string().nullable(), description: z.string().nullable(), memberCount: z.number(), joined: z.boolean(), settings: z.string(), verified: z.boolean() })) }),
  execute: async ({ input, context }) => {
    await requireActive(context.user.id);
    const r = await zite.sql({
      query: `SELECT id, "name", "emoji", "description", "settings", COALESCE(jsonb_array_length("members"), 0) AS n,
                COALESCE("members", '[]'::jsonb) @> jsonb_build_array($1::text) AS joined, COALESCE("verificationStatus",'') = 'Verified' AS verified
              FROM "Communities"
              WHERE COALESCE("isPublic", true) AND COALESCE("settings", '') NOT LIKE '%"joinMode":"invite"%' AND ($2 = '' OR "name" ILIKE '%' || $2 || '%' OR "description" ILIKE '%' || $2 || '%' OR "settings" ILIKE '%"tags":[%' || $2 || '%]%')
              ORDER BY verified DESC, n DESC, "name" LIMIT 50`,
      params: [context.user.id, input.query.trim()],
    });
    return {
      communities: r.rows.map((x) => ({
        id: String(x.id), name: String(x.name ?? 'Community'), emoji: x.emoji ? String(x.emoji) : null,
        description: x.description ? String(x.description) : null, memberCount: Number(x.n), joined: Boolean(x.joined), settings: pub(x.settings), verified: Boolean(x.verified),
      })),
    };
  },
});
