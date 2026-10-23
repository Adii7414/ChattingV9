import { zite } from 'zitejs/db';

export type Official = 'Chatting' | 'Chatting Support' | 'Chatting Moderation';
export const OFFICIALS: Official[] = ['Chatting', 'Chatting Support', 'Chatting Moderation'];
export const OFFICIAL_ID: Record<Official, string> = { Chatting: 'official:chatting', 'Chatting Support': 'official:support', 'Chatting Moderation': 'official:moderation' };
export const officialOf = (v: unknown): Official | null => (OFFICIALS.includes(v as Official) ? (v as Official) : null);

// Same mark as the app logo: a speech bubble with a small teal dot in the corner.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f4f1ea"/><path d="M32 12a20 20 0 1 1 0 40H16.5a4.5 4.5 0 0 1-4.5-4.5V32a20 20 0 0 1 20-20z" fill="#121418"/><path d="M45 37h3.5a3.5 3.5 0 0 1 3.5 3.5V44a8 8 0 1 1-7-7z" fill="#149077" stroke="#f4f1ea" stroke-width="3.5"/></svg>`;
export const OFFICIAL_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

export const SUPPORT_OPTIONS = ['Account & login', 'Something’s broken', 'Report abuse', 'Appeal a suspension', 'Billing', 'Feature idea', 'Other'];
export const optionCategory = (o: string): { category: string; tags: string[] } => ({
  'Account & login': { category: 'Account', tags: [] },
  'Something’s broken': { category: 'Bug', tags: [] },
  'Report abuse': { category: 'Abuse', tags: [] },
  'Appeal a suspension': { category: 'Account', tags: ['Appeal'] },
  Billing: { category: 'Billing', tags: [] },
  'Feature idea': { category: 'Feature request', tags: [] },
}[o] ?? { category: 'Other', tags: [] });

/** Finds the user's DM with an official account, optionally creating it. */
export async function findOfficialChat(userId: string, account: Official) {
  const r = await zite.sql({
    query: `SELECT id FROM "Conversations" WHERE "members" @> jsonb_build_array($1::text) AND "officialAccount" = $2 ORDER BY created_at LIMIT 1`,
    params: [userId, account],
  });
  return r.rows[0] ? String(r.rows[0].id) : null;
}

export async function ensureOfficialChat(userId: string, account: Official) {
  const found = await findOfficialChat(userId, account);
  if (found) return { id: found, created: false };
  const c = await zite.conversations.create({ record: { members: [userId], isGroup: false, name: null, officialAccount: account } as never });
  return { id: c.id, created: true };
}

/** Posts a message as an official account. Only server code can do this. */
export async function postOfficial(cid: string, account: Official, body: string, opts: { staffName?: string | null; quickReplies?: string[] } = {}) {
  const now = new Date().toISOString();
  const preview = `${opts.staffName ? `${opts.staffName}: ` : ''}${body}`.replace(/\s+/g, ' ').slice(0, 140);
  const [m] = await Promise.all([
    zite.messages.create({ record: { body, conversation: cid, sender: null, officialSender: account, staffName: opts.staffName ?? null, quickReplies: opts.quickReplies ? JSON.stringify(opts.quickReplies) : null } as never }),
    zite.conversations.update({ id: cid, record: { lastMessageAt: now, lastMessagePreview: preview, archivedBy: [] } as never }),
  ]);
  return m.id;
}

export const SUPPORT_GREETING = 'Welcome to Chatting Support 👋 Please let us know what issue you’re facing:';

/** Sends a moderation notice to a user from the verified Chatting Moderation account. */
export async function notifyModeration(userId: string, body: string) {
  const { id } = await ensureOfficialChat(userId, 'Chatting Moderation');
  await postOfficial(id, 'Chatting Moderation', body);
}

export type Standing = { state: 'Good' | 'Suspended' | 'Banned'; until: string | null; reason: string };

/** The user's current account standing, from the latest Suspend / Ban / Lift action. */
export async function standingOf(userId: string): Promise<Standing> {
  const r = await zite.sql({
    query: `SELECT "action", "expiresAt", COALESCE("reason",'') AS reason FROM "UserActions" WHERE "targetUser"->>0 = $1 AND "action" IN ('Suspend','Ban','Lift') ORDER BY created_at DESC LIMIT 1`,
    params: [userId],
  });
  const a = r.rows[0];
  if (!a || a.action === 'Lift') return { state: 'Good', until: null, reason: '' };
  if (a.action === 'Ban') return { state: 'Banned', until: null, reason: String(a.reason) };
  if (!a.expiresAt || new Date(String(a.expiresAt)).getTime() > Date.now()) return { state: 'Suspended', until: a.expiresAt ? new Date(String(a.expiresAt)).toISOString() : null, reason: String(a.reason) };
  return { state: 'Good', until: null, reason: '' };
}
