import { zite } from 'zitejs/db';

export const pairKey = (a: string, b: string) => [a, b].sort().join(':');
export type Relation = 'none' | 'friends' | 'outgoing' | 'incoming';

/** How `me` relates to `other`: friends, a pending request either way, or nothing. */
export async function relationOf(me: string, other: string): Promise<Relation> {
  const r = await zite.sql({ query: `SELECT "status", "requester"->>0 AS req FROM "Friendships" WHERE "pairKey" = $1 LIMIT 1`, params: [pairKey(me, other)] });
  const f = r.rows[0];
  if (!f) return 'none';
  if (f.status === 'Accepted') return 'friends';
  return f.req === me ? 'outgoing' : 'incoming';
}

/** Ids of everyone `me` is friends with. */
export async function friendIds(me: string): Promise<string[]> {
  const r = await zite.sql({
    query: `SELECT CASE WHEN "requester"->>0 = $1 THEN "addressee"->>0 ELSE "requester"->>0 END AS id FROM "Friendships" WHERE "status" = 'Accepted' AND ("requester"->>0 = $1 OR "addressee"->>0 = $1)`,
    params: [me],
  });
  return r.rows.map((x) => String(x.id));
}

/** A person's privacy choices for requests. */
export async function requestPrefs(userId: string) {
  const p = await zite.profiles.findOne({ filters: { userKey: userId } });
  return { messagesFrom: (p?.messageRequestsFrom as string) || 'Everyone', allowFriendRequests: p?.allowFriendRequests !== false && (p?.allowFriendRequests as unknown) !== 'false' };
}
