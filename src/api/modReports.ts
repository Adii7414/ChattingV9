import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';

const Report = z.object({
  id: z.string(), reason: z.string(), messageBody: z.string(), messageId: z.string(), status: z.string(), createdAt: z.string(),
  reportedId: z.string(), reportedName: z.string(), reporterName: z.string(), communityName: z.string(), priorReports: z.number(),
});

export default createEndpoint({
  authenticated: true,
  description: 'Lists user reports and applies moderator decisions to them',
  inputSchema: z.object({
    status: z.enum(['Open', 'Resolved', 'Dismissed', 'All']).default('Open'),
    search: z.string().optional(),
    act: z.object({ reportId: z.string(), decision: z.enum(['Resolve', 'Dismiss', 'DeleteMessage', 'Reopen']) }).optional(),
  }),
  outputSchema: z.object({ reports: z.array(Report) }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    if (input.act) {
      const rep = await zite.reports.findOne({ id: input.act.reportId });
      if (rep) {
        if (input.act.decision === 'DeleteMessage' && rep.messageId) {
          const m = await zite.messages.findOne({ id: rep.messageId });
          if (m) await zite.messages.delete({ id: m.id });
        }
        const status = input.act.decision === 'Dismiss' ? 'Dismissed' : input.act.decision === 'Reopen' ? 'Open' : 'Resolved';
        await zite.reports.update({ id: rep.id, record: { status } });
      }
    }
    const r = await zite.sql({
      query: `SELECT r.id, COALESCE(r."reason",'') AS reason, COALESCE(r."messageBody",'') AS "messageBody", COALESCE(r."messageId",'') AS "messageId",
          COALESCE(r."status",'Open') AS status, r.created_at AS "createdAt", COALESCE(r."reportedUser"->>0,'') AS "reportedId",
          COALESCE(ru."name",'Unknown') AS "reportedName", COALESCE(pu."name",'Unknown') AS "reporterName", COALESCE(c."name",'Direct / group chat') AS "communityName",
          (SELECT COUNT(*) FROM "Reports" r2 WHERE r2."reportedUser"->>0 = r."reportedUser"->>0 AND r2.id <> r.id) AS "priorReports"
        FROM "Reports" r
        LEFT JOIN "ziteUsers" ru ON ru.id = r."reportedUser"->>0
        LEFT JOIN "ziteUsers" pu ON pu.id = r."reporter"->>0
        LEFT JOIN "Communities" c ON c.id::text = r."communityId"
        WHERE ($1 = 'All' OR COALESCE(r."status",'Open') = $1)
          AND ($2 = '' OR r."messageBody" ILIKE '%' || $2 || '%' OR r."reason" ILIKE '%' || $2 || '%' OR ru."name" ILIKE '%' || $2 || '%')
        ORDER BY r.created_at DESC LIMIT 200`,
      params: [input.status, input.search?.trim() ?? ''],
    });
    return { reports: r.rows.map((x) => ({ id: String(x.id), reason: String(x.reason), messageBody: String(x.messageBody), messageId: String(x.messageId), status: String(x.status), createdAt: String(x.createdAt), reportedId: String(x.reportedId), reportedName: String(x.reportedName), reporterName: String(x.reporterName), communityName: String(x.communityName), priorReports: Number(x.priorReports) })) };
  },
});
