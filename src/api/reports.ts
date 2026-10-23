import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';
import { requirePerm } from '../server/community';

const report = z.object({ id: z.string(), reason: z.string(), body: z.string(), reportedUser: z.string(), reporter: z.string(), conversationId: z.string(), messageId: z.string(), createdAt: z.string() });

export default createEndpoint({
  description: 'Reports a message to moderators, or lets moderators list and resolve reports',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['report', 'list', 'resolve', 'dismiss']),
    messageId: z.string().optional(),
    reason: z.string().max(500).optional(),
    communityId: z.string().optional(),
    reportId: z.string().optional(),
  }),
  outputSchema: z.object({ reports: z.array(report) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    if (input.action === 'report') {
      const msg = await zite.messages.findOne({ id: input.messageId ?? '' });
      if (!msg) throw new ZiteError({ code: 'BAD_REQUEST', message: 'No message', userFacingMessage: 'That message no longer exists.' });
      const cid = ids(msg.conversation)[0] ?? '';
      const conv = await requireMember(cid, me);
      await zite.reports.create({ record: {
        reason: (input.reason ?? '').trim() || 'No reason given', messageId: msg.id, conversationId: cid, communityId: conv.communityId ?? '',
        messageBody: String(msg.body ?? '').slice(0, 2000), reportedUser: ids(msg.sender)[0], reporter: me, status: 'Open',
      } as never });
      return { reports: [] };
    }
    const comm = input.communityId ?? '';
    await requirePerm(comm, me, 'manageMessages');
    if ((input.action === 'resolve' || input.action === 'dismiss') && input.reportId) {
      const r = await zite.reports.findOne({ id: input.reportId });
      if (r && r.communityId === comm) await zite.reports.update({ id: r.id, record: { status: input.action === 'resolve' ? 'Resolved' : 'Dismissed' } });
    }
    const rows = await zite.sql({
      query: `SELECT id, "reason", "messageBody", "reportedUser"->>0 AS ru, "reporter"->>0 AS rp, "conversationId", "messageId", created_at FROM "Reports" WHERE "communityId" = $1 AND "status" = 'Open' ORDER BY created_at DESC LIMIT 50`,
      params: [comm],
    });
    return { reports: rows.rows.map((x) => ({
      id: String(x.id), reason: String(x.reason ?? ''), body: String(x.messageBody ?? ''), reportedUser: String(x.ru ?? ''), reporter: String(x.rp ?? ''),
      conversationId: String(x.conversationId ?? ''), messageId: String(x.messageId ?? ''), createdAt: new Date(String(x.created_at)).toISOString(),
    })) };
  },
});
