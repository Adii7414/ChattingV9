// Shared (frontend + backend) shape of community and channel customisation, stored as JSON.

export const PERMS = {
  manageCommunity: 'Edit community look & settings',
  manageChannels: 'Create, edit, reorder & delete channels',
  manageRoles: 'Create roles and assign them',
  manageMessages: 'Delete & pin anyone’s messages',
  kick: 'Remove members',
  ban: 'Ban members & approve join requests',
  postAnnouncements: 'Post in announcement channels',
  bypassSlowmode: 'Skip slow mode & auto-moderation',
  mentionEveryone: 'Use @everyone',
} as const;
export type Perm = keyof typeof PERMS;
export const ALL_PERMS = Object.keys(PERMS) as Perm[];

export type Role = { id: string; name: string; color: string; perms: Perm[]; hoist: boolean };
export type Category = { id: string; name: string };
export type AuditEntry = { at: string; by: string; text: string };

export type CommunitySettings = {
  icon: string | null;
  banner: string | null;
  accent: string; // hex
  tagline: string;
  tags: string[];
  vanity: string | null;
  categories: Category[];
  channelOrder: string[];
  roles: Role[];
  memberRoles: Record<string, string[]>;
  nicknames: Record<string, string>;
  joinMode: 'open' | 'approval' | 'invite';
  pending: string[];
  banned: string[];
  bannedWords: string[];
  blockLinks: boolean;
  maxLength: number;
  welcome: string;
  systemChannel: string | null;
  rules: string[];
  quickReactions: string[];
  audit: AuditEntry[];
  timeouts: Record<string, string>; // userId -> ISO time the timeout ends
  warnings: Record<string, { at: string; by: string; reason: string }[]>;
  modNotes: Record<string, string>;
  custom: CommunityCustom;
};

export type AutoReply = { trigger: string; reply: string };
/** "Customise" tab: deep look, behaviour and content controls for a community. */
export type CommunityCustom = {
  font: 'default' | 'serif' | 'mono' | 'rounded';
  bubble: 'round' | 'square' | 'minimal';
  wallpaper: 'none' | 'dots' | 'grid' | 'waves' | 'glow' | 'sunset' | 'paper' | 'aurora';
  useAccent: boolean;
  showBannerStrip: boolean;
  announcement: string;
  announcementColor: string;
  placeholder: string;
  emptyText: string;
  memberLabel: string;
  guidelinesUrl: string;
  showRoleTags: boolean;
  allowGifs: boolean;
  allowFiles: boolean;
  allowPolls: boolean;
  allowReactions: boolean;
  allowThreads: boolean;
  allowEdits: boolean;
  minLength: number;
  blockCaps: boolean;
  maxMentions: number;
  maxEmoji: number;
  autoReplies: AutoReply[];
};

export const DEFAULT_CUSTOM: CommunityCustom = {
  font: 'default', bubble: 'round', wallpaper: 'none', useAccent: false, showBannerStrip: false, announcement: '', announcementColor: '#ca8a04',
  placeholder: '', emptyText: '', memberLabel: '', guidelinesUrl: '', showRoleTags: true, allowGifs: true, allowFiles: true, allowPolls: true,
  allowReactions: true, allowThreads: true, allowEdits: true, minLength: 0, blockCaps: false, maxMentions: 0, maxEmoji: 0, autoReplies: [],
};

export const FONT_STACK: Record<CommunityCustom['font'], string | undefined> = {
  default: undefined,
  serif: '"Newsreader", Georgia, serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  rounded: '"Nunito", ui-rounded, system-ui, sans-serif',
};

/** Converts "#rrggbb" to a bare HSL triple for CSS variables. */
export function hexToHsl(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null;
  const n = parseInt(m[1], 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; let h = 0, s = 0;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export type ChannelSettings = {
  topic: string;
  category: string | null;
  slowmode: number; // seconds
  announcement: boolean;
  voice: boolean; // voice channel: shows a drop-in call room
  allowedRoles: string[]; // empty = everyone
};

export const ACCENTS = ['#0f766e', '#2563eb', '#db2777', '#ea580c', '#16a34a', '#7c3aed', '#dc2626', '#ca8a04', '#0891b2', '#475569'];
export const DEFAULT_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '🙏'];

const obj = (raw: unknown) => {
  if (!raw) return {};
  try { const v = typeof raw === 'string' ? JSON.parse(raw) : raw; return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}; } catch { return {}; }
};

export function parseCommunity(raw: unknown): CommunitySettings {
  const s = obj(raw) as Partial<CommunitySettings>;
  return {
    icon: s.icon ?? null, banner: s.banner ?? null, accent: s.accent || ACCENTS[0], tagline: s.tagline ?? '', tags: s.tags ?? [],
    vanity: s.vanity ?? null, categories: s.categories ?? [], channelOrder: s.channelOrder ?? [], roles: s.roles ?? [],
    memberRoles: s.memberRoles ?? {}, nicknames: s.nicknames ?? {}, joinMode: s.joinMode ?? 'open', pending: s.pending ?? [],
    banned: s.banned ?? [], bannedWords: s.bannedWords ?? [], blockLinks: s.blockLinks ?? false, maxLength: s.maxLength ?? 5000,
    welcome: s.welcome ?? '', systemChannel: s.systemChannel ?? null, rules: s.rules ?? [],
    quickReactions: s.quickReactions?.length ? s.quickReactions : DEFAULT_REACTIONS, audit: s.audit ?? [], timeouts: s.timeouts ?? {}, warnings: s.warnings ?? {}, modNotes: s.modNotes ?? {},
    custom: { ...DEFAULT_CUSTOM, ...(s.custom ?? {}) },
  };
}

export function parseChannel(raw: unknown): ChannelSettings {
  const s = obj(raw) as Partial<ChannelSettings>;
  return { topic: s.topic ?? '', category: s.category ?? null, slowmode: s.slowmode ?? 0, announcement: s.announcement ?? false, voice: s.voice ?? false, allowedRoles: s.allowedRoles ?? [] };
}

/** Everything a member may do. The owner can do everything. */
export function permsOf(s: CommunitySettings, ownerId: string | null, userId: string): Set<Perm> {
  if (ownerId === userId) return new Set(ALL_PERMS);
  const mine = new Set(s.memberRoles[userId] ?? []);
  return new Set(s.roles.filter((r) => mine.has(r.id)).flatMap((r) => r.perms));
}

/** The highest-listed role a member holds (used for name colour). */
export function topRole(s: CommunitySettings, userId: string) {
  const mine = new Set(s.memberRoles[userId] ?? []);
  return s.roles.find((r) => mine.has(r.id)) ?? null;
}

export function canSeeChannel(ch: ChannelSettings, s: CommunitySettings, ownerId: string | null, userId: string) {
  if (!ch.allowedRoles.length || ownerId === userId) return true;
  const p = permsOf(s, ownerId, userId);
  if (p.has('manageChannels')) return true;
  return (s.memberRoles[userId] ?? []).some((r) => ch.allowedRoles.includes(r));
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/** ISO end time if the member is currently timed out, else null. */
export const timedOutUntil = (s: CommunitySettings, userId: string) => { const t = s.timeouts[userId]; return t && new Date(t) > new Date() ? t : null; };
