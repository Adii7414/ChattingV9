import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';

const CHATTING_APP_ID = '6icyrxg8dk';

async function audience() {
  const all: string[] = [];
  for (let offset = 0; ; offset += 2000) {
    const r = await zite.auth.findAllUsers({ appIds: [CHATTING_APP_ID], limit: 2000, offset });
    all.push(...r.records.map((u) => String(u.id)));
    if (!r.hasMore) break;
  }
  const out = await zite.sql({ query: `SELECT "userKey" FROM "Profiles" WHERE COALESCE("updatesOptOut", false) = true` });
  const opted = new Set(out.rows.map((r) => String(r.userKey)));
  return { recipients: all.filter((id) => !opted.has(id)), optedOut: all.filter((id) => opted.has(id)).length };
}

const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export default createEndpoint({
  authenticated: true,
  description: 'Lists past announcements, previews the audience and sends a new update from the verified Chatting account',
  inputSchema: z.object({ send: z.object({ title: z.string().min(3).max(120), body: z.string().min(3).max(3000) }).optional() }),
  outputSchema: z.object({
    recipients: z.number(), optedOut: z.number(),
    announcements: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), recipients: z.number(), sentBy: z.string(), sentAt: z.string() })),
  }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    const aud = await audience();
    if (input.send) {
      if (!aud.recipients.length) throw fail('Nobody to send to');
      const { title, body } = input.send;
      const text = `📣 ${title}\n\n${body}`;
      const now = new Date().toISOString();
      // Find or create each person's Chatting DM.
      const existing = await zite.sql({ query: `SELECT id, "members"->>0 AS uid FROM "Conversations" WHERE "officialAccount" = 'Chatting'` });
      const chatOf = new Map(existing.rows.map((r) => [String(r.uid), String(r.id)]));
      const missing = aud.recipients.filter((u) => !chatOf.has(u));
      for (const batch of chunks(missing, 100)) {
        const res = await zite.conversations.bulkCreate({ records: batch.map((u) => ({ members: [u], isGroup: false, officialAccount: 'Chatting', lastMessageAt: now })) as never });
        res.records.forEach((c, i) => chatOf.set(batch[i], c.id));
      }
      const cids = aud.recipients.map((u) => chatOf.get(u)!).filter(Boolean);
      for (const batch of chunks(cids, 100)) {
        await zite.messages.bulkCreate({ records: batch.map((cid) => ({ body: text, conversation: cid, officialSender: 'Chatting' })) as never });
      }
      const preview = text.replace(/\s+/g, ' ').slice(0, 140);
      for (const batch of chunks(cids, 25)) {
        await Promise.all(batch.map((id) => zite.conversations.update({ id, record: { lastMessageAt: now, lastMessagePreview: preview, archivedBy: [] } as never })));
      }
      await zite.announcements.create({ record: { title, body, recipients: cids.length, sentBy: context.user?.id ?? null } as never });
    }
    const list = await zite.sql({
      query: `SELECT a.id, a."title", a."body", COALESCE(a."recipients", 0) AS recipients, COALESCE(u."name", u."email", 'Staff') AS "sentBy", a.created_at AS "sentAt"
              FROM "Announcements" a LEFT JOIN "ziteUsers" u ON u.id::text = a."sentBy"->>0 ORDER BY a.created_at DESC LIMIT 100`,
    });
    return {
      recipients: aud.recipients.length, optedOut: aud.optedOut,
      announcements: list.rows.map((r) => ({ id: String(r.id), title: String(r.title ?? ''), body: String(r.body ?? ''), recipients: Number(r.recipients), sentBy: String(r.sentBy), sentAt: String(r.sentAt) })),
    };
  },
});
