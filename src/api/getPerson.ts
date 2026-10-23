import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { parseCommunity } from '../lib/community';
import { friendIds, relationOf, requestPrefs } from '../server/friends';

const role = z.object({ name: z.string(), color: z.string() });

export default createEndpoint({
  description: 'Shows another person’s profile card: banner, bio, friendship, shared communities and their roles there',
  authenticated: true,
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({
    profile: z.object({
      id: z.string(), name: z.string(), username: z.string(), email: z.string(), image: z.string().nullable(), bio: z.string(), pronouns: z.string(), statusText: z.string(), statusEmoji: z.string(),
      banner: z.string(), bannerImage: z.string(), accent: z.string(), timeZone: z.string(), lastSeenAt: z.string().nullable(), joinedAt: z.string(),
      relation: z.enum(['none', 'friends', 'outgoing', 'incoming']), acceptsFriendRequests: z.boolean(), acceptsMessages: z.boolean(), mutualFriends: z.number(),
      communities: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string(), verified: z.boolean(), isOwner: z.boolean(), nickname: z.string(), roles: z.array(role) })),
    }).nullable(),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const them = input.userId;
    const [r, comms, relation, prefs, mine, theirs] = await Promise.all([
      zite.sql({
        query: `
          SELECT u.id::text AS id, u."name", u."email", u."image", u.created_at AS "joinedAt", p."username", p."bio", p."pronouns", p."banner", p."bannerImage", p."profileAccent", p."timeZone",
            CASE WHEN p."statusExpiresAt" IS NULL OR p."statusExpiresAt" > now() THEN p."statusText" END AS "statusText",
            CASE WHEN p."statusExpiresAt" IS NULL OR p."statusExpiresAt" > now() THEN p."statusEmoji" END AS "statusEmoji",
            CASE WHEN COALESCE(p."showOnlineStatus", true) THEN pr."lastSeenAt" END AS "lastSeenAt"
          FROM "ziteUsers" u LEFT JOIN "Profiles" p ON p."userKey" = u.id::text LEFT JOIN "Presence" pr ON pr."userKey" = u.id::text
          WHERE u.id::text = $1`,
        params: [them],
      }),
      zite.sql({
        query: `SELECT id, "name", "emoji", "settings", "owner"->>0 AS "ownerId", COALESCE("verificationStatus",'') = 'Verified' AS verified FROM "Communities"
                WHERE "members" @> jsonb_build_array($1::text, $2::text) ORDER BY "name"`,
        params: [me, them],
      }),
      relationOf(me, them),
      requestPrefs(them),
      friendIds(me),
      friendIds(them),
    ]);
    const x = r.rows[0];
    if (!x) return { profile: null };
    const theirSet = new Set(theirs);
    return {
      profile: {
        id: String(x.id), name: String(x.name || x.username || 'Someone'), username: String(x.username ?? ''),
        // Email stays private unless you're friends (or it's you).
        email: relation === 'friends' || them === me ? String(x.email ?? '') : '',
        image: x.image ? String(x.image) : null,
        bio: String(x.bio ?? ''), pronouns: String(x.pronouns ?? ''), statusText: String(x.statusText ?? ''), statusEmoji: String(x.statusEmoji ?? ''),
        banner: String(x.banner ?? ''), bannerImage: String(x.bannerImage ?? ''), accent: String(x.profileAccent ?? ''), timeZone: String(x.timeZone ?? ''),
        lastSeenAt: x.lastSeenAt ? new Date(String(x.lastSeenAt)).toISOString() : null, joinedAt: new Date(String(x.joinedAt)).toISOString(),
        relation, acceptsFriendRequests: prefs.allowFriendRequests, acceptsMessages: relation === 'friends' || prefs.messagesFrom !== 'Friends only',
        mutualFriends: mine.filter((f) => theirSet.has(f)).length,
        communities: comms.rows.map((c) => {
          const s = parseCommunity(c.settings);
          const held = new Set(s.memberRoles[them] ?? []);
          return {
            id: String(c.id), name: String(c.name ?? 'Community'), emoji: String(c.emoji ?? ''), verified: Boolean(c.verified), isOwner: c.ownerId === them,
            nickname: String(s.nicknames?.[them] ?? ''),
            roles: s.roles.filter((ro) => held.has(ro.id)).map((ro) => ({ name: ro.name, color: ro.color })),
          };
        }),
      },
    };
  },
});
