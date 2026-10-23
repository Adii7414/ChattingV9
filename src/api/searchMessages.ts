import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { iso, requireActive } from '../server/chat';

export default createEndpoint({
  description: 'Searches messages across the signed-in user’s conversations',
  authenticated: true,
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ results: z.array(z.object({ id: z.string(), conversationId: z.string(), body: z.string(), senderId: z.string(), sentAt: z.string() })) }),
  execute: async ({ input, context }) => {
    await requireActive(context.user.id);
    const q = input.query.trim();
    if (q.length < 2) return { results: [] };
    const r = await zite.sql({
      query: `
        SELECT m.id, l."conversationsId" AS "conversationId", m."body", m."sender"->>0 AS "senderId", m.created_at AS "sentAt"
        FROM "Messages" m
        JOIN "ConversationsMessages" l ON l."messagesId" = m.id
        JOIN "Conversations" c ON c.id = l."conversationsId"
        WHERE c."members" @> jsonb_build_array($1::text) AND m."body" ILIKE $2
        ORDER BY m.created_at DESC LIMIT 30`,
      params: [context.user.id, `%${q.replace(/[%_]/g, '\\$&')}%`],
    });
    return {
      results: r.rows.map((x) => ({
        id: String(x.id), conversationId: String(x.conversationId), body: String(x.body ?? ''),
        senderId: String(x.senderId ?? ''), sentAt: iso(x.sentAt) ?? '',
      })),
    };
  },
});
