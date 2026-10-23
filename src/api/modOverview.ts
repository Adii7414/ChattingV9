import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';

const n = (v: unknown) => Number(v ?? 0);

export default createEndpoint({
  authenticated: true,
  description: 'Platform overview stats for the mod & support dashboard',
  inputSchema: z.object({}),
  outputSchema: z.object({
    stats: z.object({ openReports: z.number(), openTickets: z.number(), urgentTickets: z.number(), messagesToday: z.number(), activeUsers: z.number(), totalUsers: z.number(), communities: z.number(), restricted: z.number(), satisfaction: z.object({ avg: z.number().nullable(), happyPct: z.number().nullable(), count: z.number() }) }),
    daily: z.array(z.object({ date: z.string(), messages: z.number(), reports: z.number(), tickets: z.number() })),
    recentActions: z.array(z.object({ id: z.string(), action: z.string(), reason: z.string(), target: z.string(), staff: z.string(), createdAt: z.string() })),
  }),
  execute: async ({ context }) => {
    requireStaff(context.user);
    const [s, daily, acts] = await Promise.all([
      zite.sql({ query: `SELECT
        (SELECT COUNT(*) FROM "Reports" WHERE COALESCE("status",'Open') = 'Open') AS "openReports",
        (SELECT COUNT(*) FROM "SupportTickets" WHERE COALESCE("status",'Open') IN ('Open','Pending')) AS "openTickets",
        (SELECT COUNT(*) FROM "SupportTickets" WHERE COALESCE("status",'Open') IN ('Open','Pending') AND "priority" = 'Urgent') AS "urgentTickets",
        (SELECT COUNT(*) FROM "Messages" WHERE created_at >= date_trunc('day', now())) AS "messagesToday",
        (SELECT COUNT(*) FROM "Presence" WHERE "lastSeenAt" >= now() - interval '1 day') AS "activeUsers",
        (SELECT COUNT(*) FROM "ziteUsers") AS "totalUsers",
        (SELECT COUNT(*) FROM "Communities") AS "communities",
        (SELECT COUNT(*) FROM (SELECT DISTINCT ON ("targetUser"->>0) "action", "expiresAt" FROM "UserActions" WHERE "action" IN ('Suspend','Ban','Lift') ORDER BY "targetUser"->>0, created_at DESC) x
          WHERE x."action" = 'Ban' OR (x."action" = 'Suspend' AND (x."expiresAt" IS NULL OR x."expiresAt" > now()))) AS "restricted",
        (SELECT AVG("rating") FROM "SupportTickets" WHERE "rating" IS NOT NULL AND "ratedAt" > now() - interval '30 days') AS "satAvg",
        (SELECT COUNT(*) FILTER (WHERE "rating" >= 4) * 100.0 / NULLIF(COUNT(*),0) FROM "SupportTickets" WHERE "rating" IS NOT NULL AND "ratedAt" > now() - interval '30 days') AS "satHappy",
        (SELECT COUNT(*) FROM "SupportTickets" WHERE "rating" IS NOT NULL AND "ratedAt" > now() - interval '30 days') AS "satCount"` }),
      zite.sql({ query: `SELECT to_char(g.d, 'YYYY-MM-DD') AS date,
        (SELECT COUNT(*) FROM "Messages" m WHERE m.created_at::date = g.d::date) AS messages,
        (SELECT COUNT(*) FROM "Reports" r WHERE r.created_at::date = g.d::date) AS reports,
        (SELECT COUNT(*) FROM "SupportTickets" t WHERE t.created_at::date = g.d::date) AS tickets
        FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') g(d) ORDER BY 1` }),
      zite.sql({ query: `SELECT a.id, a."action", COALESCE(a."reason",'') AS reason, a.created_at AS "createdAt", COALESCE(tu."name", 'Unknown') AS target, COALESCE(su."name", 'Staff') AS staff
        FROM "UserActions" a LEFT JOIN "ziteUsers" tu ON tu.id = a."targetUser"->>0 LEFT JOIN "ziteUsers" su ON su.id = a."staff"->>0
        ORDER BY a.created_at DESC LIMIT 8` }),
    ]);
    const r = s.rows[0] ?? {};
    return {
      stats: { openReports: n(r.openReports), openTickets: n(r.openTickets), urgentTickets: n(r.urgentTickets), messagesToday: n(r.messagesToday), activeUsers: n(r.activeUsers), totalUsers: n(r.totalUsers), communities: n(r.communities), restricted: n(r.restricted), satisfaction: { avg: r.satAvg == null ? null : Math.round(n(r.satAvg) * 10) / 10, happyPct: r.satHappy == null ? null : Math.round(n(r.satHappy)), count: n(r.satCount) } },
      daily: daily.rows.map((d) => ({ date: String(d.date), messages: n(d.messages), reports: n(d.reports), tickets: n(d.tickets) })),
      recentActions: acts.rows.map((a) => ({ id: String(a.id), action: String(a.action ?? ''), reason: String(a.reason), target: String(a.target), staff: String(a.staff), createdAt: String(a.createdAt) })),
    };
  },
});
