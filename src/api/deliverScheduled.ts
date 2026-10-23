import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids } from '../server/chat';

/**
 * Housekeeping meant to run every minute: sends scheduled messages that are due and
 * deletes disappearing messages that have expired. (Needs a schedule to run on its own.)
 */
export default createEndpoint({
  description: 'Sends due scheduled messages and clears expired disappearing messages',
  inputSchema: z.object({}),
  outputSchema: z.object({ sent: z.number(), cleared: z.number() }),
  execute: async () => {
    const due = await zite.sql({
      query: `SELECT id, "body", "conversationId", "sender"->>0 AS sender FROM "ScheduledMessages" WHERE "status" = 'Scheduled' AND "sendAt" <= now() ORDER BY "sendAt" LIMIT 100`,
    });
    let sent = 0;
    for (const r of due.rows) {
      const cid = String(r.conversationId), me = String(r.sender), body = String(r.body);
      const conv = await zite.conversations.findOne({ id: cid });
      if (!conv || !ids(conv.members).includes(me)) { await zite.scheduledMessages.update({ id: String(r.id), record: { status: 'Failed' } }); continue; }
      const ttl = Number(conv.disappearAfter ?? 0);
      const now = new Date().toISOString();
      await Promise.all([
        zite.messages.create({ record: { body, conversation: cid, sender: me, expiresAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null } as never }),
        zite.conversations.update({ id: cid, record: { lastMessageAt: now, lastMessagePreview: body.slice(0, 140) } as never }),
        zite.scheduledMessages.update({ id: String(r.id), record: { status: 'Sent' } }),
      ]);
      sent++;
    }
    const old = await zite.sql({ query: `SELECT id FROM "Messages" WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= now() LIMIT 100` });
    await Promise.all(old.rows.map((r) => zite.messages.delete({ id: String(r.id) })));
    return { sent, cleared: old.rows.length };
  },
});
