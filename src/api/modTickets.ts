import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';
import { chatOf, postAsSupport, requestRating, sweepSupport } from '../server/modOfficial';

const Status = z.enum(['Open', 'Pending', 'Resolved', 'Closed']);
const Priority = z.enum(['Low', 'Normal', 'High', 'Urgent']);
const Category = z.enum(['Account', 'Bug', 'Abuse', 'Billing', 'Feature request', 'Other']);
const TAGS = ['VIP', 'Refund', 'Escalated', 'Needs engineering', 'Appeal', 'Duplicate'] as const;

const Reply = z.object({ id: z.string(), body: z.string(), author: z.string(), fromStaff: z.boolean(), internal: z.boolean(), createdAt: z.string(), images: z.array(z.string()) });
type ThreadT = { id: string; description: string; requesterJoined: string | null; requesterStanding: string; otherTickets: { id: string; subject: string; status: string; createdAt: string }[]; replies: z.infer<typeof Reply>[]; liveChat: boolean; transcript: string; rating: number | null; ratedAt: string | null; awaitingRating: boolean };

export default createEndpoint({
  authenticated: true,
  description: 'Support inbox: lists tickets with SLA stats, shows a conversation, replies and updates ticket fields',
  inputSchema: z.object({
    status: z.enum(['Open', 'Pending', 'Resolved', 'Closed', 'Active', 'All']).default('Active'),
    search: z.string().optional(),
    view: z.enum(['all', 'mine', 'unassigned']).optional(),
    ticketId: z.string().optional(),
    reply: z.object({ body: z.string().min(1).max(4000), internal: z.boolean(), setStatus: Status.optional() }).optional(),
    update: z.object({ status: Status.optional(), priority: Priority.optional(), category: Category.optional(), tags: z.array(z.enum(TAGS)).optional(), assignToMe: z.boolean().optional(), unassign: z.boolean().optional() }).optional(),
    close: z.boolean().optional(),
    bulk: z.object({ ids: z.array(z.string()).min(1).max(100), status: Status.optional(), assignToMe: z.boolean().optional() }).optional(),
  }),
  outputSchema: z.object({
    tickets: z.array(z.object({ id: z.string(), subject: z.string(), category: z.string(), priority: z.string(), status: z.string(), tags: z.array(z.string()), requesterName: z.string(), requesterEmail: z.string(), requesterId: z.string(), assignee: z.string(), lastActivityAt: z.string(), createdAt: z.string(), firstResponseAt: z.string().nullable(), awaitingSince: z.string().nullable(), replies: z.number(), rating: z.number().nullable() })),
    stats: z.object({ active: z.number(), unassigned: z.number(), mine: z.number(), breaching: z.number(), avgFirstResponseHrs: z.number().nullable(), resolved7d: z.number() }),
    thread: z.object({ id: z.string(), description: z.string(), requesterJoined: z.string().nullable(), requesterStanding: z.string(), otherTickets: z.array(z.object({ id: z.string(), subject: z.string(), status: z.string(), createdAt: z.string() })), replies: z.array(Reply), liveChat: z.boolean(), transcript: z.string(), rating: z.number().nullable(), ratedAt: z.string().nullable(), awaitingRating: z.boolean() }).nullable(),
  }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    const me = context.user?.id ?? '';
    const now = new Date().toISOString();
    await sweepSupport().catch((e) => console.error('support sweep failed', e));
    if (input.ticketId && input.reply) {
      const t = await zite.supportTickets.findOne({ id: input.ticketId });
      await zite.ticketReplies.create({ record: { body: input.reply.body, ticket: [input.ticketId], author: me || null, fromStaff: true, internalNote: input.reply.internal } as never });
      const cid = chatOf(t);
      if (cid && !input.reply.internal) await postAsSupport(cid, input.reply.body, context.user?.firstName || context.user?.email?.split('@')[0] || 'Support');
      const status = input.reply.setStatus ?? (input.reply.internal ? undefined : 'Pending');
      await zite.supportTickets.update({ id: input.ticketId, record: { lastActivityAt: now, ...(status ? { status } : {}), ...(me && !t?.assignee?.length ? { assignee: me } : {}), ...(!input.reply.internal && !t?.firstResponseAt ? { firstResponseAt: now } : {}) } as never });
    }
    if (input.ticketId && (input.close || input.update?.status === 'Closed')) await requestRating(input.ticketId);
    if (input.ticketId && input.update) {
      const u = input.update;
      await zite.supportTickets.update({ id: input.ticketId, record: { ...(u.status ? { status: u.status } : {}), ...(u.priority ? { priority: u.priority } : {}), ...(u.category ? { category: u.category } : {}), ...(u.tags ? { tags: u.tags } : {}), ...(u.assignToMe && me ? { assignee: me } : {}), ...(u.unassign ? { assignee: null } : {}), lastActivityAt: now } as never });
    }
    if (input.bulk) {
      const b = input.bulk;
      if (b.status === 'Closed') for (const id of b.ids) await requestRating(id);
      await Promise.all(b.ids.map((id) => zite.supportTickets.update({ id, record: { ...(b.status ? { status: b.status } : {}), ...(b.assignToMe && me ? { assignee: me } : {}), lastActivityAt: now } as never })));
    }

    const [list, st] = await Promise.all([
      zite.sql({
        query: `SELECT t.id, COALESCE(t."subject",'(no subject)') AS subject, COALESCE(t."category",'Other') AS category, COALESCE(t."priority",'Normal') AS priority, COALESCE(t."status",'Open') AS status, COALESCE(t."tags",'[]'::jsonb) AS tags,
            COALESCE(ru."name", t."requesterEmail", 'Unknown') AS "requesterName", COALESCE(t."requesterEmail", ru."email", '') AS "requesterEmail", COALESCE(t."requester"->>0,'') AS "requesterId",
            COALESCE(au."name",'') AS assignee, COALESCE(t."lastActivityAt", t.created_at) AS "lastActivityAt", t.created_at AS "createdAt", t."firstResponseAt", t."rating",
            (SELECT COUNT(*) FROM "SupportTicketsTicketReplies" l WHERE l."supportTicketsId" = t.id) AS replies,
            (SELECT CASE WHEN COALESCE(r."fromStaff",false) THEN NULL ELSE r.created_at END FROM "SupportTicketsTicketReplies" l JOIN "TicketReplies" r ON r.id = l."ticketRepliesId"
              WHERE l."supportTicketsId" = t.id AND COALESCE(r."internalNote",false) = false ORDER BY r.created_at DESC LIMIT 1) AS "awaitingSince"
          FROM "SupportTickets" t LEFT JOIN "ziteUsers" ru ON ru.id = t."requester"->>0 LEFT JOIN "ziteUsers" au ON au.id = t."assignee"->>0
          WHERE ($1 = 'All' OR ($1 = 'Active' AND COALESCE(t."status",'Open') IN ('Open','Pending')) OR COALESCE(t."status",'Open') = $1)
            AND ($2 = '' OR t."subject" ILIKE '%' || $2 || '%' OR ru."name" ILIKE '%' || $2 || '%' OR t."requesterEmail" ILIKE '%' || $2 || '%')
            AND ($3 = 'all' OR ($3 = 'mine' AND t."assignee"->>0 = $4) OR ($3 = 'unassigned' AND COALESCE(t."assignee"->>0,'') = ''))
          ORDER BY CASE COALESCE(t."priority",'Normal') WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END, COALESCE(t."lastActivityAt", t.created_at) DESC LIMIT 300`,
        params: [input.status, input.search?.trim() ?? '', input.view ?? 'all', me],
      }),
      zite.sql({
        query: `SELECT
          COUNT(*) FILTER (WHERE COALESCE("status",'Open') IN ('Open','Pending')) AS active,
          COUNT(*) FILTER (WHERE COALESCE("status",'Open') IN ('Open','Pending') AND COALESCE("assignee"->>0,'') = '') AS unassigned,
          COUNT(*) FILTER (WHERE COALESCE("status",'Open') IN ('Open','Pending') AND "assignee"->>0 = $1) AS mine,
          COUNT(*) FILTER (WHERE COALESCE("status",'Open') = 'Open' AND "firstResponseAt" IS NULL AND created_at < now() - (CASE "priority" WHEN 'Urgent' THEN interval '1 hour' WHEN 'High' THEN interval '4 hours' ELSE interval '24 hours' END)) AS breaching,
          AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - created_at)) / 3600) FILTER (WHERE "firstResponseAt" IS NOT NULL AND created_at > now() - interval '30 days') AS "avgFrt",
          COUNT(*) FILTER (WHERE "status" IN ('Resolved','Closed') AND "lastActivityAt" > now() - interval '7 days') AS resolved7d
          FROM "SupportTickets"`,
        params: [me],
      }),
    ]);

    let thread: ThreadT | null = null;
    if (input.ticketId) {
      const t = await zite.supportTickets.findOne({ id: input.ticketId });
      if (t) {
        const reqId = Array.isArray(t.requester) ? t.requester[0] ?? '' : t.requester ?? '';
        const [rs, other, who] = await Promise.all([
          zite.sql({ query: `SELECT r.id, COALESCE(r."body",'') AS body, COALESCE(r."fromStaff",false) AS "fromStaff", COALESCE(r."internalNote",false) AS internal, r.created_at AS "createdAt", COALESCE(r."attachments",'[]'::jsonb) AS attachments, COALESCE(u."name", CASE WHEN r."fromStaff" THEN 'Staff' ELSE 'Customer' END) AS author
            FROM "SupportTicketsTicketReplies" l JOIN "TicketReplies" r ON r.id = l."ticketRepliesId" LEFT JOIN "ziteUsers" u ON u.id = r."author"->>0
            WHERE l."supportTicketsId" = $1::uuid ORDER BY r.created_at`, params: [t.id] }),
          zite.sql({ query: `SELECT id, COALESCE("subject",'') AS subject, COALESCE("status",'Open') AS status, created_at AS "createdAt" FROM "SupportTickets" WHERE "requester"->>0 = $1 AND id <> $2::uuid ORDER BY created_at DESC LIMIT 10`, params: [reqId, t.id] }),
          zite.sql({ query: `SELECT u.created_at AS joined, (SELECT CASE WHEN a."action" = 'Ban' THEN 'Banned' WHEN a."action" = 'Suspend' AND (a."expiresAt" IS NULL OR a."expiresAt" > now()) THEN 'Suspended' ELSE 'Good' END FROM "UserActions" a WHERE a."targetUser"->>0 = u.id AND a."action" IN ('Suspend','Ban','Lift') ORDER BY a.created_at DESC LIMIT 1) AS standing FROM "ziteUsers" u WHERE u.id = $1`, params: [reqId] }),
        ]);
        thread = {
          id: t.id, description: t.description ?? '',
          requesterJoined: who.rows[0]?.joined ? String(who.rows[0].joined) : null, requesterStanding: String(who.rows[0]?.standing ?? 'Good'),
          otherTickets: other.rows.map((o) => ({ id: String(o.id), subject: String(o.subject), status: String(o.status), createdAt: String(o.createdAt) })),
          liveChat: !!chatOf(t), transcript: t.transcript ?? '', rating: t.rating == null ? null : Number(t.rating), ratedAt: t.ratedAt ?? null, awaitingRating: t.status === 'Closed' && !!chatOf(t) && t.rating == null,
          replies: rs.rows.map((r) => ({ id: String(r.id), body: String(r.body), author: String(r.author), fromStaff: !!r.fromStaff, internal: !!r.internal, createdAt: String(r.createdAt), images: (Array.isArray(r.attachments) ? r.attachments : []).map((a: { url?: string }) => String(a?.url ?? '')).filter(Boolean) })),
        };
      }
    }
    const s = st.rows[0] ?? {};
    return {
      tickets: list.rows.map((x) => ({ id: String(x.id), subject: String(x.subject), category: String(x.category), priority: String(x.priority), status: String(x.status), tags: (Array.isArray(x.tags) ? x.tags : []).map(String), requesterName: String(x.requesterName), requesterEmail: String(x.requesterEmail), requesterId: String(x.requesterId), assignee: String(x.assignee), lastActivityAt: String(x.lastActivityAt), createdAt: String(x.createdAt), firstResponseAt: x.firstResponseAt ? String(x.firstResponseAt) : null, awaitingSince: x.awaitingSince ? String(x.awaitingSince) : null, replies: Number(x.replies), rating: x.rating == null ? null : Number(x.rating) })),
      stats: { active: Number(s.active ?? 0), unassigned: Number(s.unassigned ?? 0), mine: Number(s.mine ?? 0), breaching: Number(s.breaching ?? 0), avgFirstResponseHrs: s.avgFrt == null ? null : Math.round(Number(s.avgFrt) * 10) / 10, resolved7d: Number(s.resolved7d ?? 0) },
      thread,
    };
  },
});
