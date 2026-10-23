import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';
import { ids } from './chat';
import { canSeeChannel, parseChannel, parseCommunity, permsOf, type CommunitySettings, type Perm } from '../lib/community';

const deny = (msg: string) => { const e = new ZiteError(msg); e.userFacingMessage = msg; return e; };

export async function loadCommunity(communityId: string) {
  const c = await zite.communities.findOne({ id: communityId });
  if (!c) throw deny('Community not found');
  const s = parseCommunity(c.settings);
  const ownerId = ids(c.owner)[0] ?? null;
  return { c, s, ownerId, members: ids(c.members) };
}

export async function requirePerm(communityId: string, userId: string, perm: Perm) {
  const ctx = await loadCommunity(communityId);
  if (!ctx.members.includes(userId)) throw deny('Join this community first.');
  if (!permsOf(ctx.s, ctx.ownerId, userId).has(perm)) throw deny('You don’t have permission to do that.');
  return ctx;
}

export const withAudit = (s: CommunitySettings, by: string, text: string): CommunitySettings =>
  ({ ...s, audit: [{ at: new Date().toISOString(), by, text }, ...s.audit].slice(0, 150) });

export const saveSettings = (communityId: string, s: CommunitySettings, extra: Record<string, unknown> = {}) =>
  zite.communities.update({ id: communityId, record: { settings: JSON.stringify(s), ...extra } as never });

/** Re-derives every channel's member list from community membership + role-gated access. */
export async function syncChannels(communityId: string) {
  const { s, ownerId, members } = await loadCommunity(communityId);
  const chans = await zite.sql({ query: `SELECT id, "members", "settings" FROM "Conversations" WHERE "communityId" = $1`, params: [communityId] });
  await Promise.all(chans.rows.map((r) => {
    const ch = parseChannel(r.settings);
    const want = members.filter((m) => canSeeChannel(ch, s, ownerId, m));
    const have = Array.isArray(r.members) ? (r.members as string[]) : [];
    if (want.length === have.length && want.every((m) => have.includes(m))) return null;
    return zite.conversations.update({ id: String(r.id), record: { members: want, admins: ownerId ? [ownerId] : [] } as never });
  }));
}

/** Posts a message into a channel as if from `senderId` (used for welcome messages). */
export async function postInto(channelId: string, senderId: string, body: string) {
  const now = new Date().toISOString();
  await Promise.all([
    zite.messages.create({ record: { body, conversation: channelId, sender: senderId, attachments: null, reactions: null, parentMessageId: null, replyToId: null, editedAt: null } as never }),
    zite.conversations.update({ id: channelId, record: { lastMessageAt: now, lastMessagePreview: body.slice(0, 140) } as never }),
  ]);
}

/** The community's custom rules for a channel, and whether `userId` bypasses them (null for non-community chats). */
export async function customFor(conversationId: string, userId: string) {
  const conv = await zite.conversations.findOne({ id: conversationId });
  if (!conv?.communityId) return null;
  const { s, ownerId } = await loadCommunity(conv.communityId);
  return { custom: s.custom, bypass: permsOf(s, ownerId, userId).has('bypassSlowmode'), ownerId };
}
