import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { iso, requireMember, requireActive } from '../server/chat';

/** Saved (starred) messages across all chats, or pinned messages / shared files for one chat. */
export default createEndpoint({
  description: 'Lists starred messages, or the pinned messages and shared files of one conversation',
  authenticated: true,
  inputSchema: z.object({ kind: z.enum(['starred', 'pinned', 'media']), conversationId: z.string().optional() }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(), conversationId: z.string(), body: z.string(), senderId: z.string(), sentAt: z.string(),
      attachments: z.array(z.object({ url: z.string(), name: z.string(), mimeType: z.string() })),
    })),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    if (input.kind !== 'starred') await requireMember(input.conversationId ?? '', me);
    const where = input.kind === 'starred'
      ? `c."members" @> jsonb_build_array($1::text) AND COALESCE(m."starredBy", '[]'::jsonb) @> jsonb_build_array($1::text)`
      : input.kind === 'pinned'
        ? `c.id = $1::uuid AND COALESCE(m."isPinned", false)`
        : `c.id = $1::uuid AND m."attachments" IS NOT NULL AND jsonb_array_length(m."attachments") > 0`;
    const r = await zite.sql({
      query: `SELECT m.id, l."conversationsId" AS cid, m."body", m."sender"->>0 AS "senderId", m.created_at AS "sentAt", m."attachments"
              FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id JOIN "Conversations" c ON c.id = l."conversationsId"
              WHERE ${where} ORDER BY m.created_at DESC LIMIT 100`,
      params: input.kind === 'starred' ? [me] : [input.conversationId],
    });
    return {
      items: r.rows.map((x) => ({
        id: String(x.id), conversationId: String(x.cid), body: String(x.body ?? ''), senderId: String(x.senderId ?? ''), sentAt: iso(x.sentAt) ?? '',
        attachments: (Array.isArray(x.attachments) ? (x.attachments as Record<string, unknown>[]) : []).map((a) => ({
          url: String(a.url ?? ''), name: String(a.originalName ?? a.filename ?? 'File'), mimeType: String(a.mimeType ?? ''),
        })),
      })),
    };
  },
});
