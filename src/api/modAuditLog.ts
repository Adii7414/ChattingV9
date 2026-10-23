import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';

export default createEndpoint({
  description: 'Searches the platform-wide audit log with filters, for staff',
  authenticated: true,
  inputSchema: z.object({
    search: z.string().max(200).optional(), category: z.string().max(40).optional(), severity: z.string().max(20).optional(), actorType: z.string().max(20).optional(),
    from: z.string().optional(), to: z.string().optional(), userId: z.string().optional(), communityId: z.string().optional(),
    offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(200).optional(),
  }),
  outputSchema: z.object({
    total: z.number(),
    entries: z.array(z.object({ id: z.string(), at: z.string(), summary: z.string(), category: z.string(), action: z.string(), actorType: z.string(), actorLabel: z.string(), actorId: z.string().nullable(), targetType: z.string(), targetId: z.string(), targetLabel: z.string(), targetUserId: z.string().nullable(), targetUserName: z.string(), communityId: z.string(), communityName: z.string(), severity: z.string(), details: z.string(), sessionKey: z.string() })),
    byCategory: z.array(z.object({ category: z.string(), n: z.number() })),
    bySeverity: z.array(z.object({ severity: z.string(), n: z.number() })),
  }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    const where = `WHERE ($1 = '' OR a."summary" ILIKE '%' || $1 || '%' OR a."action" ILIKE '%' || $1 || '%' OR a."actorLabel" ILIKE '%' || $1 || '%' OR a."targetLabel" ILIKE '%' || $1 || '%' OR a."details" ILIKE '%' || $1 || '%')
      AND ($2 = '' OR a."category" = $2) AND ($3 = '' OR a."severity" = $3) AND ($4 = '' OR a."actorType" = $4)
      AND ($5::timestamptz IS NULL OR a.created_at >= $5::timestamptz) AND ($6::timestamptz IS NULL OR a.created_at <= $6::timestamptz)
      AND ($7 = '' OR a."targetUser"->>0 = $7 OR a."actor"->>0 = $7) AND ($8 = '' OR a."communityId" = $8)`;
    const params = [input.search?.trim() ?? '', input.category ?? '', input.severity ?? '', input.actorType ?? '', input.from || null, input.to || null, input.userId ?? '', input.communityId ?? ''];
    const [rows, count, cats, sevs] = await Promise.all([
      zite.sql({ query: `SELECT a.*, a.created_at AS at, a."actor"->>0 AS "actorId", a."targetUser"->>0 AS "targetUserId", tu."name" AS "targetUserName", c."name" AS "communityName"
          FROM "AuditLogs" a LEFT JOIN "ziteUsers" tu ON tu.id = a."targetUser"->>0 LEFT JOIN "Communities" c ON c.id::text = a."communityId"
          ${where} ORDER BY a.created_at DESC OFFSET $9 LIMIT $10`, params: [...params, input.offset ?? 0, input.limit ?? 50] }),
      zite.sql({ query: `SELECT COUNT(*) AS n FROM "AuditLogs" a ${where}`, params }),
      zite.sql({ query: `SELECT COALESCE("category", 'Other') AS category, COUNT(*) AS n FROM "AuditLogs" WHERE created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 2 DESC` }),
      zite.sql({ query: `SELECT COALESCE("severity", 'Info') AS severity, COUNT(*) AS n FROM "AuditLogs" WHERE created_at > now() - interval '7 days' GROUP BY 1` }),
    ]);
    const s = (v: unknown) => (v == null ? '' : String(v));
    return {
      total: Number(count.rows[0]?.n ?? 0),
      entries: rows.rows.map((r) => ({ id: s(r.id), at: new Date(String(r.at)).toISOString(), summary: s(r.summary), category: s(r.category), action: s(r.action), actorType: s(r.actorType), actorLabel: s(r.actorLabel), actorId: r.actorId ? s(r.actorId) : null, targetType: s(r.targetType), targetId: s(r.targetId), targetLabel: s(r.targetLabel), targetUserId: r.targetUserId ? s(r.targetUserId) : null, targetUserName: s(r.targetUserName), communityId: s(r.communityId), communityName: s(r.communityName), severity: s(r.severity) || 'Info', details: s(r.details), sessionKey: s(r.sessionKey) })),
      byCategory: cats.rows.map((r) => ({ category: s(r.category), n: Number(r.n) })),
      bySeverity: sevs.rows.map((r) => ({ severity: s(r.severity), n: Number(r.n) })),
    };
  },
});
