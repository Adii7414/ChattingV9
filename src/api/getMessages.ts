import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { iso, requireMember } from '../server/chat';
import { parseComponents, parseEmbeds } from '../lib/bots';
import { maybeTick } from '../server/bots';

const message = z.object({
  id: z.string(), body: z.string(), senderId: z.string(), sentAt: z.string(), editedAt: z.string().nullable(),
  attachments: z.array(z.object({ url: z.string(), name: z.string(), mimeType: z.string() })),
  reactions: z.array(z.object({ emoji: z.string(), userIds: z.array(z.string()) })),
  replyCount: z.number(), lastReplyAt: z.string().nullable(),
  replyTo: z.object({ id: z.string(), body: z.string(), senderId: z.string() }).nullable(),
  pinned: z.boolean(), starred: z.boolean(),
  poll: z.object({ question: z.string(), multi: z.boolean(), options: z.array(z.object({ text: z.string(), votes: z.array(z.string()) })) }).nullable(),
  expiresAt: z.string().nullable(),
  staffName: z.string().nullable().optional(), quickReplies: z.array(z.string()).optional(),
  bot: z.object({ id: z.string(), name: z.string(), avatar: z.string().nullable() }).nullable().optional(),
  embeds: z.array(z.any()).optional(), components: z.array(z.array(z.any())).optional(),
});

export default createEndpoint({
  description: 'Loads a conversation (or one thread) with reactions, read receipts and who is typing',
  authenticated: true,
  inputSchema: z.object({ conversationId: z.string(), parentMessageId: z.string().optional(), markRead: z.boolean().optional() }),
  outputSchema: z.object({
    messages: z.array(message),
    reads: z.array(z.object({ userId: z.string(), lastReadAt: z.string() })),
    myLastReadAt: z.string().nullable(),
    typing: z.array(z.string()),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const cid = input.conversationId;
    const parent = input.parentMessageId ?? null;
    const conv = await requireMember(cid, me);
    maybeTick();
    // Reading a message request doesn't send a read receipt until you accept it.
    const silent = conv.requestStatus === 'Pending' && !(Array.isArray(conv.requestedBy) ? conv.requestedBy : [conv.requestedBy]).includes(me);

    const [msgs, reacts, reads, typing] = await Promise.all([
      zite.sql({
        query: `
          SELECT * FROM (
            SELECT m.id, m."body", COALESCE(CASE m."officialSender" WHEN 'Chatting' THEN 'official:chatting' WHEN 'Chatting Support' THEN 'official:support' WHEN 'Chatting Moderation' THEN 'official:moderation' END, CASE WHEN m."botId" IS NOT NULL AND m."botId" <> '' THEN 'bot:' || m."botId" END, m."sender"->>0) AS "senderId", m."botId", bt."name" AS "botName", bt."avatar" AS "botAvatar", m."embeds", m."components", m."staffName", m."quickReplies", m."attachments", m.created_at AS "sentAt", m."editedAt", m."poll", m."expiresAt",
              COALESCE(m."isPinned", false) AS pinned,
              COALESCE(m."starredBy", '[]'::jsonb) @> jsonb_build_array($3::text) AS starred,
              q.id AS "qId", q."body" AS "qBody", q."sender"->>0 AS "qSender",
              (SELECT COUNT(*) FROM "Messages" r WHERE r."parentMessageId" = m.id::text) AS "replyCount",
              (SELECT MAX(r.created_at) FROM "Messages" r WHERE r."parentMessageId" = m.id::text) AS "lastReplyAt"
            FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id
            LEFT JOIN "Messages" q ON q.id::text = m."replyToId"
            LEFT JOIN "Bots" bt ON bt.id::text = m."botId"
            WHERE l."conversationsId" = $1::uuid
              AND (m."expiresAt" IS NULL OR m."expiresAt" > now())
              AND NOT EXISTS (SELECT 1 FROM "Profiles" bp WHERE bp."userKey" = $3 AND COALESCE(bp."blocked", '[]'::jsonb) @> jsonb_build_array(m."sender"->>0))
              AND (CASE WHEN $2::text IS NULL THEN NULLIF(m."parentMessageId", '') IS NULL
                        ELSE (m.id::text = $2 OR m."parentMessageId" = $2) END)
            ORDER BY m.created_at DESC LIMIT 300
          ) t ORDER BY t."sentAt" ASC`,
        params: [cid, parent, me],
      }),
      zite.sql({
        query: `
          SELECT r."emoji", COALESCE(r."reactor"->>0, 'bot:' || r."botId") AS "userId", lm."messagesId" AS "messageId"
          FROM "Reactions" r
          JOIN "ConversationsReactions" lc ON lc."reactionsId" = r.id
          JOIN "MessagesReactions" lm ON lm."reactionsId" = r.id
          WHERE lc."conversationsId" = $1::uuid`,
        params: [cid],
      }),
      zite.sql({
        query: `SELECT r."reader"->>0 AS "userId", r."lastReadAt", COALESCE(p."sendReadReceipts", true) AS share FROM "ReadReceipts" r
                LEFT JOIN "Profiles" p ON p."userKey" = r."reader"->>0
                WHERE r."key" LIKE $1`,
        params: [`${cid}:%`],
      }),
      zite.sql({
        query: `SELECT "userKey" FROM "Presence" WHERE "typingIn" = $1 AND "typingAt" > now() - interval '6 seconds' AND "userKey" <> $2`,
        params: [parent ? `${cid}:${parent}` : cid, me],
      }),
    ]);

    // Only write the read marker when the client says there's something new — polling stays read-only.
    if (!parent && input.markRead && !silent) {
      await zite.readReceipts.bulkCreate({
        records: [{ key: `${cid}:${me}`, conversation: cid, reader: me, lastReadAt: new Date().toISOString() }],
        matchOn: ['key'],
      });
    }

    const byMsg = new Map<string, Map<string, string[]>>();
    for (const r of reacts.rows) {
      const mid = String(r.messageId);
      const m = byMsg.get(mid) ?? new Map<string, string[]>();
      const e = String(r.emoji);
      m.set(e, [...(m.get(e) ?? []), String(r.userId)]);
      byMsg.set(mid, m);
    }
    const mine = reads.rows.find((r) => r.userId === me);

    return {
      messages: msgs.rows.map((r) => {
        const atts = Array.isArray(r.attachments) ? (r.attachments as Record<string, unknown>[]) : [];
        return {
          id: String(r.id),
          body: String(r.body ?? ''),
          senderId: String(r.senderId ?? ''),
          sentAt: iso(r.sentAt) ?? new Date().toISOString(),
          editedAt: iso(r.editedAt),
          attachments: atts.map((a) => ({ url: String(a.url ?? ''), name: String(a.originalName ?? a.filename ?? 'File'), mimeType: String(a.mimeType ?? a.type ?? '') })),
          reactions: [...(byMsg.get(String(r.id)) ?? new Map()).entries()].map(([emoji, userIds]) => ({ emoji, userIds })),
          replyCount: Number(r.replyCount ?? 0),
          lastReplyAt: iso(r.lastReplyAt),
          replyTo: r.qId ? { id: String(r.qId), body: String(r.qBody ?? ''), senderId: String(r.qSender ?? '') } : null,
          pinned: Boolean(r.pinned),
          starred: Boolean(r.starred),
          poll: parsePoll(r.poll),
          expiresAt: iso(r.expiresAt),
          staffName: r.staffName ? String(r.staffName) : null,
          bot: r.botId ? { id: String(r.botId), name: String(r.botName ?? 'Bot'), avatar: r.botAvatar ? String(r.botAvatar) : null } : null,
          embeds: parseEmbeds(r.embeds), components: parseComponents(r.components),
          quickReplies: r.quickReplies ? (() => { try { return JSON.parse(String(r.quickReplies)) as string[]; } catch { return []; } })() : [],
        };
      }),
      reads: reads.rows
        .filter((r) => r.userId && r.userId !== me && r.lastReadAt && r.share)
        .map((r) => ({ userId: String(r.userId), lastReadAt: iso(r.lastReadAt)! })),
      myLastReadAt: mine ? iso(mine.lastReadAt) : null,
      typing: typing.rows.map((r) => String(r.userKey)),
    };
  },
});

function parsePoll(raw: unknown) {
  if (!raw) return null;
  try {
    const p = JSON.parse(String(raw)) as { question: string; options: string[]; multi?: boolean; votes?: Record<string, number[]> };
    const votes = p.votes ?? {};
    return {
      question: p.question, multi: !!p.multi,
      options: p.options.map((text, i) => ({ text, votes: Object.keys(votes).filter((u) => votes[u].includes(i)) })),
    };
  } catch { return null; }
}
