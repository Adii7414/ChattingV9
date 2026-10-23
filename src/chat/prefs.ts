import { useSyncExternalStore } from 'react';

/** Personal, per-device preferences (look & feel, sounds, sidebar organisation). */
export type Folder = { id: string; name: string; ids: string[] };
export type Prefs = {
  accent: string | null; // bare HSL triple
  fontSize: 'sm' | 'md' | 'lg';
  compact: boolean;
  wallpaper: 'none' | 'dots' | 'grid' | 'waves' | 'glow' | 'sunset' | 'paper' | 'aurora';
  sound: 'chime' | 'pop' | 'bell' | 'off';
  dnd: boolean;
  quiet: { start: string; end: string } | null; // "22:00" – "07:00"
  reduceMotion: boolean;
  emojiShortcodes: boolean;
  folders: Folder[];
  chatColors: Record<string, string>;
  chatNicknames: Record<string, string>;
  sort: 'recent' | 'unread' | 'az';
  welcomed: string[];
  font: 'default' | 'serif' | 'mono' | 'rounded' | 'readable';
  bubble: 'round' | 'square';
  clock24: boolean;
  hideAvatars: boolean;
  highContrast: boolean;
  linkPreviews: boolean;
  blurMedia: boolean;
  spellCheck: boolean;
  charCounter: boolean;
  sidebarPreviews: boolean;
  privateNotifs: boolean;
  onboarding: string[];
};

const DEFAULTS: Prefs = {
  accent: null, fontSize: 'md', compact: false, wallpaper: 'none', sound: localStorage.getItem('sound') === 'off' ? 'off' : 'chime',
  dnd: false, quiet: null, reduceMotion: false, emojiShortcodes: true, folders: [], chatColors: {}, chatNicknames: {}, sort: 'recent', welcomed: [],
  font: 'default', bubble: 'round', clock24: false, hideAvatars: false, highContrast: false, linkPreviews: true, blurMedia: false,
  spellCheck: true, charCounter: false, sidebarPreviews: true, privateNotifs: false, onboarding: [],
};
const KEY = 'chat:prefs';
let state: Prefs = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULTS; } })();
const subs = new Set<() => void>();

export const getPrefs = () => state;
export function setPrefs(p: Partial<Prefs> | ((s: Prefs) => Partial<Prefs>)) {
  state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
  localStorage.setItem(KEY, JSON.stringify(state));
  subs.forEach((f) => f());
}
export function usePrefs() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, getPrefs);
}

export const ACCENT_CHOICES = [
  { name: 'Teal', v: '174 72% 32%' }, { name: 'Blue', v: '217 85% 52%' }, { name: 'Pink', v: '330 75% 52%' }, { name: 'Orange', v: '22 90% 52%' },
  { name: 'Green', v: '142 65% 36%' }, { name: 'Red', v: '0 75% 52%' }, { name: 'Amber', v: '40 95% 45%' }, { name: 'Slate', v: '215 20% 35%' },
];

/** True when sounds/notifications should be silenced right now (Do Not Disturb or quiet hours). */
export function isQuiet(now = new Date()) {
  const { dnd, quiet } = state;
  if (dnd) return true;
  if (!quiet) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  const toM = (s: string) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };
  const a = toM(quiet.start), b = toM(quiet.end);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

export const WALLPAPERS: Record<Prefs['wallpaper'], React.CSSProperties> = {
  none: {},
  dots: { backgroundImage: 'radial-gradient(hsl(var(--foreground) / 0.08) 1px, transparent 1px)', backgroundSize: '18px 18px' },
  grid: { backgroundImage: 'linear-gradient(hsl(var(--foreground) / 0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.05) 1px, transparent 1px)', backgroundSize: '28px 28px' },
  waves: { backgroundImage: 'repeating-radial-gradient(circle at 0 0, transparent 0, hsl(var(--primary) / 0.04) 24px, transparent 48px)' },
  glow: { backgroundImage: 'radial-gradient(60% 50% at 80% 0%, hsl(var(--primary) / 0.12), transparent), radial-gradient(50% 40% at 0% 100%, hsl(var(--primary) / 0.08), transparent)' },
  sunset: { backgroundImage: 'linear-gradient(180deg, hsl(28 95% 60% / 0.10), hsl(330 80% 60% / 0.08) 60%, transparent)' },
  paper: { backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 27px, hsl(var(--foreground) / 0.05) 27px 28px)' },
  aurora: { backgroundImage: 'radial-gradient(40% 35% at 20% 10%, hsl(160 80% 50% / 0.12), transparent), radial-gradient(45% 40% at 85% 30%, hsl(260 80% 65% / 0.10), transparent)' },
};
export const PERSONAL_FONTS: Record<Prefs['font'], string | undefined> = {
  default: undefined, serif: '"Newsreader", Georgia, serif', mono: '"JetBrains Mono", ui-monospace, monospace',
  rounded: '"Nunito", ui-rounded, system-ui, sans-serif', readable: '"Atkinson Hyperlegible", system-ui, sans-serif',
};
export const timeFmt = () => (state.clock24 ? 'HH:mm' : 'h:mm a');
export const uidFolder = () => Math.random().toString(36).slice(2, 9);
