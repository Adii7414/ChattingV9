import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';

const item = z.object({ id: z.string(), body: z.string(), sendAt: z.string() });

export default createEndpoint({
  description: 'Schedules a message to send later, lists your scheduled messages for a chat, or cancels one',
  authenticated: true,
  inputSchema: z.object({
    conversationId: z.string(),
    action: z.enum(['list', 'create', 'cancel']),
    body: z.string().max(5000).optional(),
    sendAt: z.string().optional(),
    id: z.string().optional(),
  }),
  outputSchema: z.object({ items: z.array(item) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const cid = input.conversationId;
    await requireMember(cid, me);
    if (input.action === 'create') {
      const body = (input.body ?? '').trim();
      const at = new Date(input.sendAt ?? '');
      if (!body) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Empty', userFacingMessage: 'Write a message first.' });
      if (isNaN(+at) || +at < Date.now() + 30_000) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Bad time', userFacingMessage: 'Pick a time at least a minute from now.' });
      await zite.scheduledMessages.create({ record: { body, conversationId: cid, sender: me, sendAt: at.toISOString(), status: 'Scheduled' } });
    }
    if (input.action === 'cancel' && input.id) {
      const s = await zite.scheduledMessages.findOne({ id: input.id });
      if (s && s.conversationId === cid && ids(s.sender as string | string[]).includes(me)) await zite.scheduledMessages.delete({ id: input.id });
    }
    const r = await zite.sql({
      query: `SELECT id, "body", "sendAt" FROM "ScheduledMessages" WHERE "conversationId" = $1 AND "sender" @> jsonb_build_array($2::text) AND "status" = 'Scheduled' ORDER BY "sendAt"`,
      params: [cid, me],
    });
    return { items: r.rows.map((x) => ({ id: String(x.id), body: String(x.body ?? ''), sendAt: new Date(String(x.sendAt)).toISOString() })) };
  },
});
