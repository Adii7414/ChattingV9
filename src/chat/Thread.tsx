import MemberList from './MemberList';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { isToday, isYesterday, format } from 'date-fns';
import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowUp, BellOff, Bell, Download, ImagePlus, Info, Loader2, MoreHorizontal, Pin, PinOff, Search, Settings2, Timer, X, Palette, PenLine, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { chatPrefs, updateConversation } from 'zitejs/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { exportChat } from './exportChat';
import { ACCENT_CHOICES, setPrefs, usePrefs, WALLPAPERS } from './prefs';
import ChatNotes from './ChatNotes';
import { CommunityWelcome, WarningBanner } from './CommunityExtras';
import { ConvAvatar } from './Avatars';
import MessageItem, { RichText, type MsgActions } from './MessageItem';
import { FONT_STACK, hexToHsl } from '../lib/community';
import Composer from './Composer';
import ThreadPanel from './ThreadPanel';
import InfoSheet from './InfoSheet';
import PersonDialog from './PersonDialog';
import ForwardDialog from './ForwardDialog';
import { readersOf, receiptFor, useMessages, type Msg } from './messages';
import { useChat } from './store';
import ChannelBar from './ChannelBar';
import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useE2E } from './e2e';
import { Phone, Users, Video } from 'lucide-react';
import { useCall } from './call/CallProvider';
import VoiceRoom from './call/VoiceRoom';
import EncryptionDialog from './EncryptionDialog';
import { isOfficialId, openSupport, Verified } from './official';
import RequestBar from './RequestBar';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../lib/errors';

const DISAPPEAR = [{ s: 0, l: 'Off' }, { s: 3600, l: '1 hour' }, { s: 86400, l: '24 hours' }, { s: 604800, l: '7 days' }, { s: 2592000, l: '30 days' }];
const dayLabel = (iso: string) => { const d = new Date(iso); return isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, d MMMM'); };
export const jumpTo = (id: string) => {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return toast('That message is further back in the chat');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('bg-primary/10'); setTimeout(() => el.classList.remove('bg-primary/10'), 1600);
};

export function MessageList({ messages, isGroup, receiptId, receipt, seenBy, inThread, actions, unreadAfter, highlight, scroller }: {
  messages: Msg[]; isGroup: boolean; receiptId?: string; receipt?: string | ((m: Msg) => string | undefined); seenBy?: (m: Msg) => string[] | undefined; inThread?: boolean;
  actions: MsgActions; unreadAfter?: string | null; highlight?: string; scroller?: React.RefObject<HTMLDivElement>;
}) {
  const { me } = useChat();
  const endRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);
  const [newBelow, setNewBelow] = useState(0);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = scroller?.current; if (!el) return;
    const f = () => { const far = el.scrollHeight - el.scrollTop - el.clientHeight > 200; setAway(far); if (!far) setNewBelow(0); };
    el.addEventListener('scroll', f, { passive: true }); return () => el.removeEventListener('scroll', f);
  }, [scroller]);
  useEffect(() => {
    const added = messages.length - count.current;
    const lastMine = messages[messages.length - 1]?.senderId === me.id;
    if (added > 0) {
      if (!count.current || !away || lastMine) endRef.current?.scrollIntoView({ behavior: count.current ? 'smooth' : 'auto', block: 'end' });
      else setNewBelow((n) => n + added);
    }
    count.current = messages.length;
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const firstUnread = unreadAfter ? messages.find((m) => m.senderId !== me.id && m.sentAt > unreadAfter)?.id : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      {messages.map((m, i) => (
        <div key={m.id}>
          {(!messages[i - 1] || dayLabel(messages[i - 1].sentAt) !== dayLabel(m.sentAt)) && !inThread && (
            <div className="sticky top-0 z-[1] my-4 flex justify-center"><span className="rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">{dayLabel(m.sentAt)}</span></div>
          )}
          {m.id === firstUnread && <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-primary"><span className="h-px flex-1 bg-primary/40" />New messages<span className="h-px flex-1 bg-primary/40" /></div>}
          <MessageItem m={m} prev={messages[i - 1]} next={messages[i + 1]} isGroup={isGroup} inThread={inThread} highlight={highlight}
            receipt={typeof receipt === 'function' ? receipt(m) : m.id === receiptId ? receipt : undefined} seenBy={seenBy?.(m)} {...actions} />
        </div>
      ))}
      <div ref={endRef} />
      {away && scroller && (
        <button onClick={() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); setNewBelow(0); }}
          className="sticky bottom-2 ml-auto flex h-10 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm shadow-lg">
          <ArrowDown className="h-4 w-4" />{newBelow > 0 && <span className="font-medium">{newBelow} new</span>}
        </button>
      )}
    </div>
  );
}

export function Typing({ ids }: { ids: string[] }) {
  const { people } = useChat();
  if (!ids.length) return null;
  const names = ids.map((i) => people.get(i)?.name.split(' ')[0] ?? 'Someone');
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-2 px-2 pt-2 text-xs text-muted-foreground">
      <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
      {names.length > 2 ? 'Several people are typing…' : `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} typing…`}
    </div>
  );
}

export default function Thread() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const threadId = params.get('thread');
  const { conversations, titleOf, othersOf, me, refresh, communities, settingsOf, channelOf, can, isAdmin } = useChat();
  const conv = conversations?.find((c) => c.id === id);
  const { data, messages, error, send, react, edit, remove, toggle, vote, markUnread, firstUnreadAt } = useMessages(id);
  const [info, setInfo] = useState(false);
  const [showMembers, setShowMembers] = useState(() => localStorage.getItem('member-list') !== '0');
  const e2e = useE2E(conv);
  const { start: startCall } = useCall();
  const [enc, setEnc] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [forward, setForward] = useState<Msg | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File[] | null>(null);
  const [pinIdx, setPinIdx] = useState(0);
  const [jumped, setJumped] = useState<string | null>(null);
  const [notes, setNotes] = useState(false);
  const prefs = usePrefs();
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { setReplyTo(null); setSearch(null); setPinIdx(0); }, [id]);
  const linkMsg = params.get('m');
  useEffect(() => { if (linkMsg && messages.some((x) => x.id === linkMsg)) setTimeout(() => jumpTo(linkMsg), 200); }, [linkMsg, messages.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const exportRef = useRef<() => void>(() => {});
  useEffect(() => { const f = (e: Event) => send({ body: String((e as CustomEvent).detail), files: [] }); window.addEventListener('chat:quick', f); return () => window.removeEventListener('chat:quick', f); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => exportRef.current(); window.addEventListener('chat:export', f); return () => window.removeEventListener('chat:export', f); }, []);
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && threadId) setParams({});
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && !e.shiftKey) { e.preventDefault(); setSearch((s) => s ?? ''); }
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [threadId, setParams]);

  if (error && !data) return <section className="flex flex-1 items-center justify-center text-muted-foreground">This conversation isn’t available. <Link to="/app" className="ml-1 underline">Go back</Link></section>;
  const others = conv ? othersOf(conv) : [];
  const community = communities.find((c) => c.id === conv?.communityId);
  const online = others.filter((o) => o.online).length;
  const cc = settingsOf(conv?.communityId)?.custom;
  const status = !conv ? '' : conv.communityId ? (cc?.memberLabel ? `${conv.memberIds.length} ${cc.memberLabel}${conv.description ? ` · ${conv.description}` : ''}` : conv.description || community?.name || '')
    : conv.isGroup ? `${conv.memberIds.length} members${online ? ` · ${online} online` : ''}`
    : conv.official ? (conv.official === 'Chatting' ? 'Official account' : conv.official === 'Chatting Moderation' ? 'Official account · moderation notices' : 'Official support · replies from our team') : others[0]?.statusText ? `${others[0].statusEmoji ?? ''} ${others[0].statusText}` : others[0]?.online ? 'Online' : 'Offline';
  const myLast = [...(data?.messages ?? [])].reverse().find((m) => m.senderId === me.id);
  const flag = async (action: 'pin' | 'mute' | 'archive') => {
    try { await updateConversation({ conversationId: id, action }); await refresh(); if (action === 'archive') toast.success(conv?.archived ? 'Moved back to chats' : 'Archived'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t update')); }
  };
  const shown = search && search.length >= 2 ? messages.filter((m) => m.body.toLowerCase().includes(search.toLowerCase())) : messages;
  const pinned = messages.filter((m) => m.pinned);
  const pin = pinned[pinIdx % Math.max(pinned.length, 1)];
  const cs = settingsOf(conv?.communityId);
  const chs = conv ? channelOf(conv) : null;
  const canModerate = conv ? (conv.communityId ? can(conv.communityId, 'manageMessages') : conv.isGroup && isAdmin(conv)) : false;
  const locked = !!(conv?.communityId && chs?.announcement && !can(conv.communityId, 'postAnnouncements'));
  const canDisappear = conv ? !conv.communityId && (!conv.isGroup || isAdmin(conv)) : false;
  const setDisappear = async (seconds: number) => {
    try { await chatPrefs({ conversationId: id, action: 'disappear', seconds }); await refresh(); toast.success(seconds ? `New messages will disappear after ${DISAPPEAR.find((d) => d.s === seconds)?.l}` : 'Disappearing messages off'); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t update')); }
  };
  exportRef.current = () => conv && exportChat(titleOf(conv), messages, (u) => (u === me.id ? me.name : others.find((o) => o.id === u)?.name ?? 'Someone'));
  const firstUnreadId = firstUnreadAt ? messages.find((m) => m.senderId !== me.id && m.sentAt > firstUnreadAt)?.id : undefined;
  const actions: MsgActions = {
    community: cs, canModerate,
    onReact: react, onDelete: remove, onEdit: edit, onReply: (mid) => setParams({ thread: mid }), onPerson: (u) => u !== me.id && setPerson(u),
    onVote: vote, onMarkUnread: markUnread,
    onQuote: setReplyTo, onForward: setForward, onToggle: toggle, onJump: (mid) => { setSearch(null); setTimeout(() => jumpTo(mid), 50); },
  };

  return (
    <>
      <section className={`relative min-w-0 flex-1 flex-col ${threadId ? 'hidden lg:flex' : 'flex'} ${cc && cc.bubble !== 'round' ? `cbubble-${cc.bubble}` : ''}`}
        style={{
          ...(prefs.chatColors[id] ? { ['--primary' as string]: prefs.chatColors[id], ['--ring' as string]: prefs.chatColors[id] } : cc?.useAccent && cs && hexToHsl(cs.accent) ? { ['--primary' as string]: hexToHsl(cs.accent)!, ['--ring' as string]: hexToHsl(cs.accent)! } : {}),
          ...(cc && FONT_STACK[cc.font] ? { fontFamily: FONT_STACK[cc.font] } : {}),
        }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = Array.from(e.dataTransfer.files); if (f.length) setDropped(f); }}>
        {dragging && <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-3xl border-2 border-dashed border-primary bg-background/80 backdrop-blur"><p className="flex items-center gap-2 font-medium"><ImagePlus className="h-5 w-5 text-primary" /> Drop to attach</p></div>}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-5">
          <Link to="/app" className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
          {search !== null ? (
            <label className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-secondary px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search in this chat" className="w-full bg-transparent text-sm outline-none" />
              {search.length >= 2 && <span className="shrink-0 text-xs text-muted-foreground">{shown.length} found</span>}
              <button onClick={() => setSearch(null)} aria-label="Close search"><X className="h-4 w-4" /></button>
            </label>
          ) : (
            <button onClick={() => (conv?.isGroup ? setInfo(true) : others[0] && !isOfficialId(others[0].id) && setPerson(others[0].id))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              {conv && <ConvAvatar c={conv} size={38} />}
              <div className="min-w-0"><p className="flex items-center gap-1 font-semibold"><span className="truncate">{conv ? titleOf(conv) : ' '}</span>{conv?.official && <Verified />}{conv?.communityId && communities.find((x) => x.id === conv.communityId)?.verified && <Verified community />}</p><p className="truncate text-xs text-muted-foreground">{data?.typing.length ? <span className="text-primary">typing…</span> : status}</p></div>
            </button>
          )}
          {search === null && conv && !conv.communityId && !conv.official && conv.request !== 'incoming' && <>
            <button onClick={() => startCall(id, false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Voice call" title="Voice call"><Phone className="h-[18px] w-[18px]" /></button>
            <button onClick={() => startCall(id, true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Video call" title="Video call"><Video className="h-[19px] w-[19px]" /></button>
          </>}
          {search === null && e2e.enabled && <button onClick={() => setEnc(true)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Encryption" title={e2e.verified ? 'End-to-end encrypted · verified' : 'End-to-end encrypted'}>{e2e.verified ? <ShieldCheck className="h-[18px] w-[18px] text-primary" /> : <Lock className="h-[17px] w-[17px]" />}</button>}
          {conv?.communityId && <button onClick={() => setShowMembers((v) => { localStorage.setItem('member-list', v ? '0' : '1'); return !v; })} className={`hidden h-9 w-9 place-items-center rounded-full hover:bg-secondary xl:grid ${showMembers ? 'text-foreground' : 'text-muted-foreground'}`} aria-label="Member list" title="Show member list"><Users className="h-[18px] w-[18px]" /></button>}
          {search === null && <button onClick={() => setSearch('')} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Search in chat" title="Search (Ctrl+F)"><Search className="h-[18px] w-[18px]" /></button>}
          {conv && (
            <DropdownMenu>
              <DropdownMenuTrigger className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Conversation options"><MoreHorizontal className="h-5 w-5" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setInfo(true)}><Info className="mr-2 h-4 w-4" /> {conv.communityId ? 'Channel info' : conv.isGroup ? 'Group info' : 'Media & pinned'}</DropdownMenuItem>
                {conv.communityId && <DropdownMenuItem asChild><Link to={`/app/community/${conv.communityId}`}><Settings2 className="mr-2 h-4 w-4" /> Community settings</Link></DropdownMenuItem>}
                <DropdownMenuItem onClick={() => flag('pin')}>{conv.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />}{conv.pinned ? 'Unpin chat' : 'Pin chat to top'}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => flag('mute')}>{conv.muted ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}{conv.muted ? 'Unmute' : 'Mute'}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => flag('archive')}>{conv.archived ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}{conv.archived ? 'Unarchive' : 'Archive'}</DropdownMenuItem>
                {canDisappear && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger><Timer className="mr-2 h-4 w-4" /> Disappearing messages</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {DISAPPEAR.map((d) => <DropdownMenuItem key={d.s} onClick={() => setDisappear(d.s)}>{(conv.disappearAfter || 0) === d.s ? '✓ ' : ''}{d.l}</DropdownMenuItem>)}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><Palette className="mr-2 h-4 w-4" /> Chat colour</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setPrefs((p) => { const c = { ...p.chatColors }; delete c[id]; return { chatColors: c }; })}>Default</DropdownMenuItem>
                    {ACCENT_CHOICES.map((a) => <DropdownMenuItem key={a.v} onClick={() => setPrefs((p) => ({ chatColors: { ...p.chatColors, [id]: a.v } }))}><span className="mr-2 h-3.5 w-3.5 rounded-full" style={{ background: `hsl(${a.v})` }} />{a.name}{prefs.chatColors[id] === a.v && ' ✓'}</DropdownMenuItem>)}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {!conv.communityId && <DropdownMenuItem onClick={() => { const v = window.prompt('Nickname for this chat (only you see it). Leave empty to reset.', prefs.chatNicknames[id] ?? ''); if (v !== null) setPrefs((p) => { const n = { ...p.chatNicknames }; if (v.trim()) n[id] = v.trim().slice(0, 40); else delete n[id]; return { chatNicknames: n }; }); }}><PenLine className="mr-2 h-4 w-4" /> Rename for me</DropdownMenuItem>}
                {e2e.enabled && <DropdownMenuItem onClick={() => setEnc(true)}><Lock className="mr-2 h-4 w-4" /> Encryption</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setNotes(true)}><NotebookPen className="mr-2 h-4 w-4" /> My notes</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportChat(titleOf(conv), messages, (u) => (u === me.id ? me.name : others.find((o) => o.id === u)?.name ?? 'Someone'))}><Download className="mr-2 h-4 w-4" /> Export chat</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        {cc?.showBannerStrip && cs && <div className="h-12 shrink-0" style={{ background: cs.banner ? `url(${cs.banner}) center/cover` : `linear-gradient(90deg, ${cs.accent}, ${cs.accent}55)` }} />}
        {cc?.announcement && <p className="shrink-0 px-4 py-1.5 text-center text-xs font-medium text-white" style={{ background: cc.announcementColor }}>📣 {cc.announcement}</p>}
        {pin && !search && (
          <button onClick={() => { jumpTo(pin.id); setPinIdx((i) => i + 1); }} className="flex shrink-0 items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-left sm:px-6">
            <Pin className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-primary">Pinned message{pinned.length > 1 && ` ${(pinIdx % pinned.length) + 1} of ${pinned.length}`}</p><p className="truncate text-sm"><RichText text={pin.body || 'Attachment'} /></p></div>
          </button>
        )}
        {!!conv?.disappearAfter && <p className="flex shrink-0 items-center justify-center gap-1.5 border-b border-border py-1.5 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Messages disappear after {DISAPPEAR.find((d) => d.s === conv.disappearAfter)?.l ?? `${conv.disappearAfter}s`}</p>}
        {cs && <WarningBanner cs={cs} />}
        {conv?.communityId && chs?.voice && <VoiceRoom conversationId={id} />}
        {firstUnreadId && jumped !== firstUnreadId && !search && (
          <button onClick={() => { jumpTo(firstUnreadId); setJumped(firstUnreadId); }} className="absolute left-1/2 top-[4.5rem] z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg">
            <ArrowUp className="h-3.5 w-3.5" /> Jump to first unread
          </button>
        )}
        <div ref={scroller} className="flex-1 overflow-y-auto px-3 pb-5 sm:px-6" style={WALLPAPERS[cc && cc.wallpaper !== 'none' ? cc.wallpaper : prefs.wallpaper]}>
          {!data ? <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <>
              {e2e.enabled && (
                <button onClick={() => setEnc(true)} className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-xl bg-amber-100/90 px-3 py-2 text-left text-xs leading-relaxed text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{e2e.theirPub === null ? 'Messages will be end-to-end encrypted once they open the latest Chatting. Until then, new messages are sent normally.' : 'Messages are end-to-end encrypted. No one outside of this chat, not even Chatting, can read them. Tap to verify.'}</span>
                </button>
              )}
              {e2e.changed && (
                <button onClick={() => { setEnc(true); e2e.dismissChanged(); }} className="mx-auto mt-2 flex max-w-md items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-left text-xs text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{others[0]?.name.split(' ')[0] ?? 'Their'}’s security code changed — they may have signed in on a new device. Tap to verify.</span>
                </button>
              )}
              {messages.length === 0 && <p className="py-20 text-center text-muted-foreground">{conv?.communityId ? cc?.emptyText || `This is the start of ${conv ? titleOf(conv) : 'the channel'}.` : 'Say hello 👋'}</p>}
              {search && search.length >= 2 && !shown.length && <p className="py-20 text-center text-muted-foreground">No messages match “{search}”.</p>}
              <MessageList messages={shown} isGroup={!!conv?.isGroup} receiptId={myLast?.id} scroller={scroller} highlight={search ?? undefined} unreadAfter={firstUnreadAt}
                receipt={(m: Msg) => (m.senderId === me.id && !m.pending && !conv?.communityId ? receiptFor(m.sentAt, data.reads, conv?.isGroup, conv?.memberIds.length) : undefined)} actions={actions}
                seenBy={(m) => (m.senderId === me.id && conv?.isGroup ? readersOf(m.sentAt, data.reads) : undefined)} />
              <Typing ids={data.typing} />
            </>
          )}
        </div>
        {conv?.communityId && cs && <ChannelBar key={conv.communityId} cs={cs} slowmode={chs?.slowmode ?? 0} communityId={conv.communityId} />}
        {cc?.guidelinesUrl && <a href={cc.guidelinesUrl} target="_blank" rel="noreferrer" className="border-t border-border py-1.5 text-center text-xs text-muted-foreground hover:text-foreground">📘 Read the community guidelines</a>}
        {conv?.official === 'Chatting' || conv?.official === 'Chatting Moderation' ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-secondary/50 px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">You can’t reply to {conv.official}. {conv.official === 'Chatting Moderation' ? 'Think this is a mistake? Appeal through' : 'Need help?'}</p>
            <button onClick={() => openSupport(navigate, refresh)} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Contact support</button>
          </div>
        ) : conv?.request === 'incoming' ? <RequestBar conversationId={conv.id} name={others[0]?.name ?? 'Someone'} onPerson={() => others[0] && setPerson(others[0].id)} />
        : locked ? <p className="border-t border-border px-4 py-4 text-center text-sm text-muted-foreground">📣 This is an announcement channel — only some roles can post here.</p> :
        <>{conv?.request === 'outgoing' && <p className="border-t border-border bg-secondary/50 px-4 py-2 text-center text-xs text-muted-foreground">✉️ Message request sent — you can send more once {others[0]?.name.split(' ')[0] ?? 'they'} accepts.</p>}<Composer key={id} conversationId={id} draftKey={id} typingKey={id} onSend={(d) => send(d)} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} dropped={dropped}
          mentionable={conv?.isGroup ? others : []} placeholder={cc?.placeholder || (conv ? `Message ${titleOf(conv)}` : 'Message')} features={cc ? { gifs: cc.allowGifs, files: cc.allowFiles, polls: cc.allowPolls } : conv?.official === 'Chatting Support' ? { gifs: false, files: true, polls: false, imagesOnly: true } : undefined} /></>}
      </section>
      {conv?.communityId && cs && showMembers && !threadId && <MemberList memberIds={conv.memberIds} cs={cs} ownerId={communities.find((c) => c.id === conv.communityId)?.ownerId ?? null} onPerson={(u) => setPerson(u)} />}
      {threadId && conv && <ThreadPanel key={threadId} conversationId={id} parentId={threadId} isGroup={conv.isGroup} onClose={() => setParams({})} onPerson={actions.onPerson} mentionable={conv.isGroup ? others : []} />}
      {conv && <InfoSheet open={info} onOpenChange={setInfo} conv={conv} onPerson={(u) => setPerson(u)} onJump={(mid) => { setInfo(false); setTimeout(() => jumpTo(mid), 300); }} />}
      {conv?.communityId && cs && <CommunityWelcome communityId={conv.communityId} cs={cs} />}
      {e2e.enabled && <EncryptionDialog open={enc} onOpenChange={setEnc} e2e={e2e} name={others[0]?.name ?? 'this person'} />}
      <ChatNotes open={notes} onOpenChange={setNotes} conversationId={id} />
      <PersonDialog userId={person} onClose={() => setPerson(null)} />
      <ForwardDialog message={forward} onClose={() => setForward(null)} send={send} />
    </>
  );
}
