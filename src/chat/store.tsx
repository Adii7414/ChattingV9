import { initE2E } from '../lib/e2e';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { listConversations, myProfile, officialChat, waitForUpdate, type ListConversationsOutputType, type MyProfileOutputType } from 'zitejs/api';
import { getPrefs, isQuiet } from './prefs';
import { parseChannel, parseCommunity, permsOf, type ChannelSettings, type CommunitySettings, type Perm } from '../lib/community';

export type Conversation = ListConversationsOutputType['conversations'][number];
export type Community = ListConversationsOutputType['communities'][number];
export type Person = ListConversationsOutputType['people'][number];
export type Profile = MyProfileOutputType;
export type Me = { id: string; name: string; email: string; image: string | null };

/** Calls fn now and then every `ms`, while the tab is visible. */
export function usePoll(fn: () => unknown, ms: number, deps: unknown[] = []) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    ref.current();
    const t = setInterval(() => { if (!document.hidden) ref.current(); }, ms);
    const onVis = () => { if (!document.hidden) ref.current(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}

let audio: AudioContext | null = null;
/** A short, soft two-note chime — no audio file needed. */
const TONES = { chime: { f: [880, 1320], type: 'sine' }, pop: { f: [600, 900], type: 'triangle' }, bell: { f: [1046, 1568, 2093], type: 'sine' } } as const;
export function ping(kind: 'chime' | 'pop' | 'bell' = getPrefs().sound === 'off' ? 'chime' : (getPrefs().sound as 'chime')) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    const tone = TONES[kind];
    tone.f.forEach((f, i) => {
      const o = audio!.createOscillator(), g = audio!.createGain();
      o.frequency.value = f; o.type = tone.type;
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.08, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.25);
      o.connect(g).connect(audio!.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3);
    });
  } catch { /* audio not available */ }
}

type Ctx = {
  me: Me;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  conversations: Conversation[] | null;
  communities: Community[];
  people: Map<string, Person>;
  refresh: () => Promise<void>;
  titleOf: (c: Conversation) => string;
  othersOf: (c: Conversation) => Person[];
  isAdmin: (c: Conversation) => boolean;
  settingsOf: (communityId: string | null | undefined) => CommunitySettings | null;
  channelOf: (c: Conversation) => ChannelSettings;
  can: (communityId: string | null | undefined, p: Perm) => boolean;
  standing: ListConversationsOutputType['standing'] | null;
};
const ChatCtx = createContext<Ctx>(null as unknown as Ctx);
export const useChat = () => useContext(ChatCtx);

export function ChatProvider({ me: authMe, children }: { me: Me; children: React.ReactNode }) {
  const [data, setData] = useState<ListConversationsOutputType | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const refresh = useCallback(async () => {
    try { setData(await listConversations({})); } catch { /* keep last good data */ }
  }, []);
  usePoll(refresh, 15000); // safety net — the live connection below does the real work
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const openId = useLocation().pathname.match(/\/app\/c\/([^/?]+)/)?.[1] ?? null;

  // Live connection: one long-held request at a time; it returns the instant something changes.
  useEffect(() => {
    let alive = true;
    let listSig: string | null = null, convSig: string | null = null;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (alive) {
        if (document.hidden) { await sleep(800); continue; }
        try {
          const r = await waitForUpdate({ listSig, convSig, conversationId: openId });
          if (!alive) break;
          if (listSig !== null && r.listSig !== listSig) refreshRef.current();
          if (convSig !== null && r.convSig !== convSig && openId) window.dispatchEvent(new CustomEvent('chat:live', { detail: openId }));
          listSig = r.listSig; convSig = r.convSig;
        } catch { await sleep(1500); }
      }
    })();
    return () => { alive = false; };
  }, [openId]);
  useEffect(() => {
    // One-time welcome DM from the official Chatting account.
    officialChat({ action: 'welcome' }).then((r) => { if (r.conversationId) refreshRef.current(); }).catch(() => {});
    initE2E(authMe.id).catch(() => {}); // creates this device's encryption key and publishes the public half
    myProfile({}).then((p) => {
      setProfile(p);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && p.timeZone !== tz) myProfile({ update: { timeZone: tz } }).then(setProfile).catch(() => {});
    }).catch(() => {});
  }, []);

  // Instantly eject the user from anything they were just removed from (kick, ban, removed from group).
  const navigate = useNavigate();
  const known = useRef<{ convs: Map<string, string>; comms: Map<string, string> } | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = known.current;
    const convs = new Map(data.conversations.map((c) => [c.id, c.name ?? 'this chat']));
    const comms = new Map(data.communities.map((c) => [c.id, c.name]));
    known.current = { convs, comms };
    if (!prev) return;
    const path = location.pathname;
    const lostComm = [...prev.comms].find(([id]) => !comms.has(id));
    if (lostComm) toast.error(`You’re no longer a member of ${lostComm[1]}`);
    const openConv = path.match(/\/app\/c\/([^/?]+)/)?.[1];
    const openComm = path.match(/\/app\/community\/([^/?]+)/)?.[1];
    if (openConv && prev.convs.has(openConv) && !convs.has(openConv)) {
      if (!lostComm) toast.error(`You were removed from ${prev.convs.get(openConv)}`);
      navigate('/app', { replace: true });
    } else if (openComm && prev.comms.has(openComm) && !comms.has(openComm)) {
      navigate('/app', { replace: true });
    }
  }, [data, navigate]);

  // Sound + desktop notification when a new message lands in a chat you're not looking at.
  const seen = useRef<Map<string, string | null> | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = seen.current;
    seen.current = new Map(data.conversations.map((c) => [c.id, c.lastMessageAt]));
    if (!prev) return;
    const open = location.pathname.split('/c/')[1]?.split(/[/?]/)[0];
    const fresh = data.conversations.filter((c) => c.unread > 0 && !c.muted && prev.get(c.id) !== c.lastMessageAt && (c.id !== open || document.hidden));
    if (!fresh.length) return;
    if (isQuiet()) return;
    if (getPrefs().sound !== 'off') ping();
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const c = fresh[0];
      const n = new Notification(c.name ? (c.communityId ? `# ${c.name}` : c.name) : 'New message', { body: getPrefs().privateNotifs ? 'New message' : c.preview ?? '', tag: c.id });
      n.onclick = () => { window.focus(); location.assign(`/app/c/${c.id}`); };
    }
  }, [data]);

  const unread = (data?.conversations ?? []).filter((c) => !c.muted).reduce((n, c) => n + c.unread, 0);
  useEffect(() => { document.title = unread ? `(${unread}) Chatting` : 'Chatting'; }, [unread]);

  const me: Me = profile ? { ...authMe, name: profile.name, image: profile.image } : authMe;
  const people = new Map((data?.people ?? []).map((p) => [p.id, p]));
  const othersOf = (c: Conversation) =>
    c.memberIds.filter((id) => id !== me.id).map((id) => people.get(id) ?? { id, name: 'Someone', email: '', image: null, online: false, statusText: null, statusEmoji: null });
  const titleOf = (c: Conversation) =>
    c.communityId ? `${c.emoji || (parseChannel(c.settings).voice ? '🔊' : '#')} ${c.name ?? 'channel'}` : getPrefs().chatNicknames[c.id] || (c.communityId ? `${c.emoji || (parseChannel(c.settings).voice ? '🔊' : '#')} ${c.name ?? 'channel'}` : c.official || c.name || othersOf(c).map((p) => p.name.split(' ')[0]).join(', ') || 'Just you');
  const isAdmin = (c: Conversation) => c.ownerId === me.id || c.adminIds.includes(me.id);
  const comms = data?.communities ?? [];
  const settingsOf = (id: string | null | undefined) => { const c = id ? comms.find((x) => x.id === id) : null; return c ? parseCommunity(c.settings) : null; };
  const channelOf = (c: Conversation) => parseChannel(c.settings);
  const can = (id: string | null | undefined, p: Perm) => { const c = id ? comms.find((x) => x.id === id) : null; return !!c && permsOf(parseCommunity(c.settings), c.ownerId, me.id).has(p); };

  return (
    <ChatCtx.Provider value={{ me, profile, setProfile, conversations: data?.conversations ?? null, communities: data?.communities ?? [], people, refresh, titleOf, othersOf, isAdmin, settingsOf, channelOf, can, standing: data?.standing ?? null }}>
      {children}
    </ChatCtx.Provider>
  );
}
