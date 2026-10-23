import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireCommunityMember } from '../server/chat';

export default createEndpoint({
  description: 'Activity stats for a community: messages per day, top posters and busiest channels',
  authenticated: true,
  inputSchema: z.object({ communityId: z.string() }),
  outputSchema: z.object({
    members: z.number(), messages30d: z.number(), activePosters30d: z.number(),
    daily: z.array(z.object({ day: z.string(), count: z.number() })),
    topPosters: z.array(z.object({ userId: z.string(), name: z.string(), count: z.number() })),
    channels: z.array(z.object({ name: z.string(), count: z.number() })),
    hours: z.array(z.number()),
  }),
  execute: async ({ input, context }) => {
    const c = await requireCommunityMember(input.communityId, context.user.id);
    const base = `FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id JOIN "Conversations" c ON c.id = l."conversationsId"
                  WHERE c."communityId" = $1 AND m.created_at > now() - interval '30 days'`;
    const [tot, daily, top, chans, hrs] = await Promise.all([
      zite.sql({ query: `SELECT COUNT(*)::int AS n, COUNT(DISTINCT m."sender"->>0)::int AS p ${base}`, params: [input.communityId] }),
      zite.sql({ query: `SELECT to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n ${base} GROUP BY 1 ORDER BY 1`, params: [input.communityId] }),
      zite.sql({ query: `SELECT m."sender"->>0 AS u, COALESCE(MAX(z."name"), 'Someone') AS name, COUNT(*)::int AS n ${base.replace('WHERE', 'LEFT JOIN "ziteUsers" z ON z.id::text = m."sender"->>0 WHERE')} GROUP BY 1 ORDER BY n DESC LIMIT 10`, params: [input.communityId] }),
      zite.sql({ query: `SELECT c."name", COUNT(*)::int AS n ${base} GROUP BY c.id, c."name" ORDER BY n DESC LIMIT 6`, params: [input.communityId] }),
      zite.sql({ query: `SELECT EXTRACT(HOUR FROM m.created_at)::int AS h, COUNT(*)::int AS n ${base} GROUP BY 1`, params: [input.communityId] }),
    ]);
    const counts = new Map(daily.rows.map((r) => [String(r.day), Number(r.n)]));
    const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10); return { day: d, count: counts.get(d) ?? 0 }; });
    return {
      members: Array.isArray(c.members) ? c.members.length : 1,
      messages30d: Number(tot.rows[0]?.n ?? 0), activePosters30d: Number(tot.rows[0]?.p ?? 0),
      daily: days,
      topPosters: top.rows.map((r) => ({ userId: String(r.u), name: String(r.name), count: Number(r.n) })),
      hours: Array.from({ length: 24 }, (_, h) => Number(hrs.rows.find((r) => Number(r.h) === h)?.n ?? 0)),
      channels: chans.rows.map((r) => ({ name: String(r.name ?? 'channel'), count: Number(r.n) })),
    };
  },
});
