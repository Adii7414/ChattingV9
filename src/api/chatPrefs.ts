import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { isAdmin, requireMember, requireActive } from '../server/chat';

export default createEndpoint({
  description: 'Per-chat actions: mark unread from a message, or set disappearing messages',
  authenticated: true,
  inputSchema: z.object({
    conversationId: z.string(),
    action: z.enum(['markUnread', 'disappear']),
    sentAt: z.string().optional(),
    seconds: z.number().int().min(0).max(60 * 60 * 24 * 90).optional(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireActive(context.user.id, { allowSuspended: true });
    const me = context.user.id;
    const cid = input.conversationId;
    const c = await requireMember(cid, me);
    if (input.action === 'markUnread') {
      const at = new Date(new Date(input.sentAt ?? Date.now()).getTime() - 1).toISOString();
      await zite.readReceipts.bulkCreate({ records: [{ key: `${cid}:${me}`, conversation: cid, reader: me, lastReadAt: at }], matchOn: ['key'] });
      return { ok: true };
    }
    if (c.isGroup && !isAdmin(c, me)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Not admin', userFacingMessage: 'Only admins can change disappearing messages here.' });
    await zite.conversations.update({ id: cid, record: { disappearAfter: input.seconds || null } as never });
    return { ok: true };
  },
});
