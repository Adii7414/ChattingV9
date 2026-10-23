import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Live connection: holds the request open until something the user can see changes
 * (a new message anywhere, or an edit / reaction / read / typing in the open chat), then returns at once.
 */
export default createEndpoint({
  description: 'Waits for new activity in your chats and returns the moment something changes',
  authenticated: true,
  inputSchema: z.object({ listSig: z.string().nullable(), convSig: z.string().nullable(), conversationId: z.string().nullable() }),
  outputSchema: z.object({ listSig: z.string(), convSig: z.string() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me, { allowSuspended: true });
    const cid = input.conversationId && /^[0-9a-f-]{36}$/i.test(input.conversationId) ? input.conversationId : '';
    const check = async () => {
      const r = await zite.sql({
        query: `
          SELECT
            (SELECT COUNT(*)::text || '|' || COALESCE(MAX(COALESCE(c."lastMessageAt", c.created_at))::text, '') || '|' || COALESCE(SUM(length(COALESCE(c."settings", '')) + length(c."members"::text)), 0)::text
               FROM "Conversations" c WHERE c."members" @> jsonb_build_array($1::text)) AS list,
            (SELECT COUNT(*)::text || '|' || COALESCE(MAX(m."editedAt")::text, '') || '|' || COUNT(*) FILTER (WHERE m."isPinned")::text || '|' || COALESCE(MAX(m.created_at)::text, '') || '|' || COALESCE(SUM(length(COALESCE(m."poll", ''))), 0)::text
               FROM "ConversationsMessages" l JOIN "Messages" m ON m.id = l."messagesId" WHERE $2 <> '' AND l."conversationsId" = NULLIF($2, '')::uuid) AS msgs,
            (SELECT COUNT(*)::text FROM "ConversationsReactions" lr WHERE $2 <> '' AND lr."conversationsId" = NULLIF($2, '')::uuid) AS reacts,
            (SELECT COALESCE(MAX(r."lastReadAt")::text, '') FROM "ReadReceipts" r WHERE $2 <> '' AND r."key" LIKE $2 || ':%' AND r."key" <> $2 || ':' || $1) AS reads,
            (SELECT COALESCE(string_agg(p."userKey", ',' ORDER BY p."userKey"), '') FROM "Presence" p
               WHERE $2 <> '' AND p."typingIn" LIKE $2 || '%' AND p."typingAt" > now() - interval '6 seconds' AND p."userKey" <> $1) AS typing`,
        params: [me, cid],
      });
      const row = r.rows[0] ?? {};
      return { listSig: String(row.list ?? ''), convSig: [row.msgs, row.reacts, row.reads, row.typing].map((x) => String(x ?? '')).join('#') };
    };
    const deadline = Date.now() + 20_000;
    let now = await check();
    // First call (no signatures yet) just returns the baseline.
    while (input.listSig !== null && now.listSig === input.listSig && now.convSig === (input.convSig ?? now.convSig) && Date.now() < deadline) {
      await sleep(150);
      now = await check();
    }
    return now;
  },
});
