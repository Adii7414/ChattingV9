// Shared (frontend + backend) shapes for bots, rich embeds and interactive components.

export const BOT_PERMS = ['Read Messages', 'Send Messages', 'Add Reactions', 'Manage Messages', 'Manage Roles', 'Moderate Members', 'Manage Channels', 'View Members'] as const;
export type BotPerm = (typeof BOT_PERMS)[number];

export const BOT_EVENTS = ['MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE', 'MEMBER_JOIN', 'MEMBER_LEAVE', 'REACTION_ADD', 'REACTION_REMOVE', 'INTERACTION_CREATE'] as const;
export type BotEventType = (typeof BOT_EVENTS)[number];

export type BotKind = 'Custom' | 'Welcome' | 'Moderator' | 'Levels' | 'Giveaway' | 'Reminder';

export const BOT_KINDS: { kind: BotKind; name: string; emoji: string; blurb: string; perms: BotPerm[] }[] = [
  { kind: 'Welcome', name: 'Welcome Bot', emoji: '👋', blurb: 'Greets new members and hands out starter roles.', perms: ['Send Messages', 'Manage Roles', 'View Members'] },
  { kind: 'Moderator', name: 'Mod Bot', emoji: '🛡️', blurb: 'Deletes spam, warns, and times out repeat offenders.', perms: ['Read Messages', 'Send Messages', 'Manage Messages', 'Moderate Members'] },
  { kind: 'Levels', name: 'Level Bot', emoji: '⭐', blurb: 'Congratulates people when they level up.', perms: ['Read Messages', 'Send Messages'] },
  { kind: 'Giveaway', name: 'Giveaway Bot', emoji: '🎁', blurb: 'Runs /giveaway and /poll, then picks random winners.', perms: ['Read Messages', 'Send Messages', 'Add Reactions'] },
  { kind: 'Reminder', name: 'Reminder Bot', emoji: '⏰', blurb: 'Answers /remind me 2h check the oven.', perms: ['Read Messages', 'Send Messages'] },
  { kind: 'Custom', name: 'Custom bot', emoji: '🤖', blurb: 'Your own code, via the Bot API and event webhooks.', perms: ['Read Messages', 'Send Messages', 'Add Reactions'] },
];

export type EmbedField = { name: string; value: string; inline?: boolean };
export type Embed = {
  title?: string; description?: string; url?: string; color?: string;
  author?: { name: string; iconUrl?: string }; fields?: EmbedField[];
  image?: string; thumbnail?: string; footer?: string; timestamp?: string;
};

export type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger' | 'link';
export type Button = { type: 'button'; id: string; label: string; style?: ButtonStyle; emoji?: string; url?: string; disabled?: boolean };
export type SelectOption = { label: string; value: string; emoji?: string; description?: string };
export type Select = { type: 'select'; id: string; placeholder?: string; options: SelectOption[]; minValues?: number; maxValues?: number };
export type Component = Button | Select;
/** Rows of components (max 5 rows, 5 buttons or 1 select per row). */
export type ComponentRow = Component[];

/** Built-in component ids that the app handles itself (no bot code needed):
 *  role:<roleId>        toggle that role for the clicker
 *  roles                (select) set the clicker's roles to the selected role ids
 *  rules:accept         records that the clicker accepted the rules
 *  giveaway:<id>        enter / leave a giveaway */
export const BUILTIN_PREFIXES = ['role:', 'roles', 'rules:accept', 'giveaway:'];

const json = (raw: unknown): unknown => {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

export function parseEmbeds(raw: unknown): Embed[] {
  const v = json(raw);
  return Array.isArray(v) ? (v.filter((e) => e && typeof e === 'object') as Embed[]).slice(0, 10) : [];
}

export function parseComponents(raw: unknown): ComponentRow[] {
  const v = json(raw);
  if (!Array.isArray(v)) return [];
  return v.map((row) => (Array.isArray(row) ? row : [row]).filter((c) => c && typeof c === 'object' && (c.type === 'button' || c.type === 'select')) as Component[]).filter((r) => r.length).slice(0, 5);
}

/** "2h", "30m", "1d", "45s", "1h30m" → milliseconds (null when unparsable). */
export function parseDuration(s: string): number | null {
  const re = /(\d+)\s*(d|h|m|s)/gi;
  let total = 0; let m: RegExpExecArray | null; let any = false;
  while ((m = re.exec(s))) { any = true; total += Number(m[1]) * { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000 }[m[2].toLowerCase() as 'd']; }
  return any && total > 0 ? total : null;
}

/** Level from message count: level n needs 5·n² messages (1→5, 2→20, 3→45 …). */
export const levelFor = (messages: number) => Math.floor(Math.sqrt(messages / 5));

/** "<t:ISO>" inside bot text renders as the reader's local date/time. */
export const withTimes = (s: string) => s.replace(/<t:([^>]+)>/g, (_, iso: string) => { const d = new Date(iso); return isNaN(+d) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); });
