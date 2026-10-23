import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireActive } from '../server/chat';
import { friendIds } from '../server/friends';

const story = z.object({
  id: z.string(), text: z.string(), caption: z.string(), mediaUrl: z.string(), mediaType: z.string(), background: z.string(),
  createdAt: z.string(), expiresAt: z.string(), seen: z.boolean(), viewCount: z.number(), myReaction: z.string().nullable(),
});
const parse = <T,>(v: unknown, d: T): T => { try { return v ? JSON.parse(String(v)) : d; } catch { return d; } };
const bad = (m: string) => new ZiteError({ code: 'BAD_REQUEST', message: m, userFacingMessage: m });

export default createEndpoint({
  description: 'Instagram-style 24-hour stories: list friends’ stories, post, view, react, see viewers and delete',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'create', 'view', 'react', 'viewers', 'delete']),
    id: z.string().optional(),
    text: z.string().max(4000).optional(), caption: z.string().max(300).optional(),
    mediaUrl: z.string().max(2000).optional(), mediaType: z.enum(['image', 'video', 'text']).optional(), background: z.string().max(3000).optional(),
    emoji: z.string().max(16).optional(),
  }),
  outputSchema: z.object({
    authors: z.array(z.object({ userId: z.string(), name: z.string(), username: z.string(), image: z.string().nullable(), allSeen: z.boolean(), stories: z.array(story) })),
    viewers: z.array(z.object({ userId: z.string(), name: z.string(), image: z.string().nullable(), at: z.string(), reaction: z.string().nullable() })),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const empty = { authors: [], viewers: [] } as { authors: never[]; viewers: never[] };
    const own = async () => {
      const s = input.id ? await zite.stories.findOne({ id: input.id }) : null;
      if (!s) throw bad('That story has expired.');
      return s;
    };

    if (input.action === 'create') {
      const type = input.mediaType ?? 'text';
      if (type === 'text' && !input.text?.trim()) throw bad('Write something for your story.');
      if (type !== 'text' && !input.mediaUrl) throw bad('Add a photo or video.');
      await zite.stories.create({ record: {
        caption: input.caption?.trim() ?? '', author: me, authorKey: me, mediaUrl: input.mediaUrl ?? null, mediaType: type, background: input.background ?? '',
        text: input.text?.trim() ?? '', expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(), viewers: '{}', reactions: '{}', audience: 'Friends',
      } as never });
      return empty;
    }
    if (input.action === 'delete') {
      const s = await own();
      if (s.authorKey !== me) throw bad('You can only delete your own stories.');
      await zite.stories.delete({ id: s.id });
      return empty;
    }
    if (input.action === 'view' || input.action === 'react') {
      const s = await own();
      if (s.authorKey === me) return empty;
      const friends = await friendIds(me);
      if (!friends.includes(String(s.authorKey))) throw bad('You can’t see this story.');
      const viewers = parse<Record<string, string>>(s.viewers, {});
      const reactions = parse<Record<string, string>>(s.reactions, {});
      if (input.action === 'view' && viewers[me]) return empty;
      viewers[me] = viewers[me] ?? new Date().toISOString();
      if (input.action === 'react') { if (reactions[me] === input.emoji || !input.emoji) delete reactions[me]; else reactions[me] = input.emoji; }
      await zite.stories.update({ id: s.id, record: { viewers: JSON.stringify(viewers), reactions: JSON.stringify(reactions) } });
      return empty;
    }
    if (input.action === 'viewers') {
      const s = await own();
      if (s.authorKey !== me) throw bad('Only the author can see who viewed a story.');
      const viewers = parse<Record<string, string>>(s.viewers, {});
      const reactions = parse<Record<string, string>>(s.reactions, {});
      const idList = Object.keys(viewers);
      const u = idList.length ? await zite.sql({ query: `SELECT id::text AS id, "name", "image" FROM "ziteUsers" WHERE id::text = ANY($1::text[])`, params: [idList] }) : { rows: [] };
      const info = new Map<string, Record<string, unknown>>(u.rows.map((r) => [String(r.id), r as Record<string, unknown>] as const));
      return { authors: [], viewers: idList.map((id) => ({ userId: id, name: String(info.get(id)?.name ?? 'Someone'), image: info.get(id)?.image ? String(info.get(id)!.image) : null, at: viewers[id], reaction: reactions[id] ?? null })).sort((a, b) => b.at.localeCompare(a.at)) };
    }

    // list: my stories first, then friends with unseen stories, then the rest.
    const who = [me, ...(await friendIds(me))];
    const r = await zite.sql({
      query: `SELECT s.id, s."authorKey", s."text", s."caption", s."mediaUrl", s."mediaType", s."background", s.created_at, s."expiresAt", s."viewers", s."reactions",
                u."name", u."image", p."username"
              FROM "Stories" s JOIN "ziteUsers" u ON u.id::text = s."authorKey" LEFT JOIN "Profiles" p ON p."userKey" = s."authorKey"
              WHERE s."authorKey" = ANY($1::text[]) AND s."expiresAt" > now() ORDER BY s.created_at`,
      params: [who],
    });
    const by = new Map<string, z.infer<typeof story>[]>();
    const meta = new Map<string, Record<string, unknown>>();
    for (const x of r.rows) {
      const a = String(x.authorKey);
      const viewers = parse<Record<string, string>>(x.viewers, {});
      const reactions = parse<Record<string, string>>(x.reactions, {});
      if (!by.has(a)) { by.set(a, []); meta.set(a, x); }
      by.get(a)!.push({
        id: String(x.id), text: String(x.text ?? ''), caption: String(x.caption ?? ''), mediaUrl: String(x.mediaUrl ?? ''), mediaType: String(x.mediaType || 'text'), background: String(x.background ?? ''),
        createdAt: new Date(String(x.created_at)).toISOString(), expiresAt: new Date(String(x.expiresAt)).toISOString(),
        seen: a === me || !!viewers[me], viewCount: Object.keys(viewers).length, myReaction: reactions[me] ?? null,
      });
    }
    const authors = [...by.entries()].map(([userId, stories]) => {
      const m = meta.get(userId)!;
      return { userId, name: String(m.name || m.username || 'Someone'), username: String(m.username ?? ''), image: m.image ? String(m.image) : null, allSeen: stories.every((s) => s.seen), stories };
    }).sort((a, b) => Number(b.userId === me) - Number(a.userId === me) || Number(a.allSeen) - Number(b.allSeen));
    return { authors, viewers: [] };
  },
});
