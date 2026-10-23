import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';
import { standingOf } from './official';
import { fail } from './errors';

export const ids = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

const deny = (msg: string, user: string) => {
  const e = new ZiteError(msg);
  e.userFacingMessage = user;
  return e;
};

/** Loads a conversation and throws unless the user is one of its members. */
export async function requireMember(conversationId: string, userId: string) {
  const [c, st] = await Promise.all([zite.conversations.findOne({ id: conversationId }), standingOf(userId)]);
  if (!c || !ids(c.members).includes(userId)) throw deny('Not a member of this conversation', 'You don’t have access to this conversation.');
  if (st.state === 'Banned') throw fail(BANNED_MSG, 'FORBIDDEN');
  if (st.state === 'Suspended' && !(c as { officialAccount?: string | null }).officialAccount) throw fail(suspendedMsg(st.until), 'FORBIDDEN');
  return c;
}

export const isAdmin = (c: { owner?: string | string[]; admins?: string | string[] }, userId: string) =>
  ids(c.owner).includes(userId) || ids(c.admins).includes(userId);

/** Loads a group/channel and throws unless the user can manage it. */
export async function requireAdmin(conversationId: string, userId: string) {
  const c = await requireMember(conversationId, userId);
  if (!isAdmin(c, userId)) throw deny('Not an admin', 'Only group admins can do that.');
  return c;
}

export async function requireCommunityMember(communityId: string, userId: string) {
  const c = await zite.communities.findOne({ id: communityId });
  if (!c || !ids(c.members).includes(userId)) throw deny('Not a community member', 'Join this community first.');
  return c;
}

export const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

export const APP_ID = '6icyrxg8dk';

export const BANNED_MSG = 'This account has been banned from Chatting.';
export const suspendedMsg = (until: string | null) => `Your account is suspended${until ? ` until ${new Date(until).toUTCString().slice(5, 22)} UTC` : ''}. You can still message Chatting Support to appeal.`;

/** Blocks banned users entirely and suspended users from everything except their official chats. */
export async function requireActive(userId: string, opts: { allowSuspended?: boolean } = {}) {
  const st = await standingOf(userId);
  if (st.state === 'Banned') throw fail(BANNED_MSG, 'FORBIDDEN');
  if (st.state === 'Suspended' && !opts.allowSuspended) throw fail(suspendedMsg(st.until), 'FORBIDDEN');
  return st;
}
