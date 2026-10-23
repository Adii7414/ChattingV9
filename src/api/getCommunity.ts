import { z } from 'zod';
import { fail } from '../server/errors';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { loadCommunity } from '../server/community';
import { permsOf } from '../lib/community';

const person = z.object({ id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable() });

export default createEndpoint({
  description: 'Loads a community’s full settings, members, channels and requests for its settings page',
  authenticated: true,
  inputSchema: z.object({ communityId: z.string() }),
  outputSchema: z.object({
    name: z.string(), description: z.string(), emoji: z.string(), isPublic: z.boolean(), ownerId: z.string().nullable(), verified: z.boolean(),
    settings: z.string(), myPerms: z.array(z.string()),
    members: z.array(person), pending: z.array(person), banned: z.array(person),
    channels: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string(), settings: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const { c, s, ownerId, members } = await loadCommunity(input.communityId);
    if (!members.includes(me)) throw fail('Join this community first');
    const everyone = [...new Set([...members, ...s.pending, ...s.banned])];
    const [users, chans] = await Promise.all([
      zite.sql({ query: `SELECT id::text AS id, "name", "email", "image" FROM "ziteUsers" WHERE id::text = ANY($1::text[])`, params: [everyone] }),
      zite.sql({ query: `SELECT id, "name", "emoji", "settings" FROM "Conversations" WHERE "communityId" = $1 ORDER BY created_at`, params: [input.communityId] }),
    ]);
    const map = new Map(users.rows.map((u) => [String(u.id), { id: String(u.id), name: String(u.name || u.email || 'Someone'), email: String(u.email ?? ''), image: u.image ? String(u.image) : null }]));
    const get = (id: string) => map.get(id) ?? { id, name: 'Someone', email: '', image: null };
    const perms = permsOf(s, ownerId, me);
    const mod = perms.has('ban');
    return {
      name: String(c.name ?? ''), description: String(c.description ?? ''), emoji: String(c.emoji ?? ''), isPublic: c.isPublic !== false, ownerId, verified: c.verificationStatus === 'Verified',
      settings: JSON.stringify(perms.size ? s : { ...s, audit: [], bannedWords: [] }), myPerms: [...perms],
      members: members.map(get), pending: mod ? s.pending.map(get) : [], banned: mod ? s.banned.map(get) : [],
      channels: chans.rows.map((r) => ({ id: String(r.id), name: String(r.name ?? ''), emoji: String(r.emoji ?? ''), settings: String(r.settings ?? '') })),
    };
  },
});
