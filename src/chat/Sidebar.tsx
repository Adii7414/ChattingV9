import StoriesBar from './Stories';
import { NavLink } from 'react-router-dom';
import { ArrowDown as MoveDown, ArrowUp as MoveUp, MessageCircle, MicOff, Video as Cam } from 'lucide-react';
import { call } from 'zitejs/api';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@project/components/ui/context-menu';
import { usePoll } from './store';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { formatDistanceToNowStrict, isToday, format } from 'date-fns';
import { Archive, BellOff, ChevronDown, CheckCheck, Command, Compass, LogOut, Pin, Plus, Search, ArrowUpDown, MailQuestion, UserRound, FolderPlus, Settings, SquarePen, Star, Users, X } from 'lucide-react';
import { logout } from 'zitejs/auth';
import { markAllRead, searchMessages, type SearchMessagesOutputType } from 'zitejs/api';
import { toast } from 'sonner';
import { cn } from '@project/components/lib/utils';
import { Skeleton } from '@project/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import PersonAvatar, { ConvAvatar } from './Avatars';
import NewChatDialog from './NewChatDialog';
import CommunityDialog from './CommunityDialog';
import { useChat, type Community, type Conversation } from './store';
import { parseCommunity } from '../lib/community';
import { getPrefs, setPrefs, usePrefs, type Folder } from './prefs';
import FolderDialog from './FolderDialog';
import { Verified } from './official';
import { usePendingFriends } from './Friends';
import { errorMessage } from '../lib/errors';

export const shortTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  return Date.now() - d.getTime() < 6 * 864e5 ? format(d, 'EEE') : format(d, 'd MMM');
};

function Row({ c, active, compact }: { c: Conversation; active: boolean; compact?: boolean }) {
  const { titleOf } = useChat();
  usePrefs(); // re-render when a chat is renamed for me
  const badge = c.unread > 0 && (
    <span className={cn('grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-semibold', c.muted ? 'bg-muted-foreground/30 text-foreground' : 'bg-primary text-primary-foreground')}>{c.unread > 99 ? '99+' : c.unread}</span>
  );
  if (compact) {
    return (
      <Link data-chat-row={c.id} data-unread={c.unread > 0 ? "1" : "0"} to={`/app/c/${c.id}`} className={cn('flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm transition', active ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground', c.unread > 0 && 'font-semibold text-foreground')}>
        <span className="flex min-w-0 items-center gap-1"><span className="truncate">{titleOf(c)}</span>{c.official && <Verified className="h-3.5 w-3.5" />}</span>{c.muted ? <BellOff className="h-3.5 w-3.5" /> : badge}
      </Link>
    );
  }
  return (
    <Link data-chat-row={c.id} data-unread={c.unread > 0 ? "1" : "0"} to={`/app/c/${c.id}`} className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 transition', active ? 'bg-secondary' : 'hover:bg-secondary/60')}>
      <ConvAvatar c={c} size={46} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('flex min-w-0 items-center gap-1.5', c.unread ? 'font-semibold' : 'font-medium')}>
            <span className="truncate">{titleOf(c)}</span>
            {c.official && <Verified />}
            {c.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {c.muted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">{shortTime(c.lastMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          {getPrefs().sidebarPreviews && <p className={cn('truncate text-sm', c.unread ? 'text-foreground' : 'text-muted-foreground')}>{c.preview ?? (c.isGroup ? 'Group created' : 'No messages yet')}</p>}
          {badge}
        </div>
      </div>
    </Link>
  );
}

function Results({ results, onPick }: { results: SearchMessagesOutputType['results']; onPick: () => void }) {
  const { conversations, titleOf, people, me } = useChat();
  if (!results.length) return null;
  return (
    <div className="mb-3">
      <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">Messages</p>
      {results.map((r) => {
        const c = conversations?.find((x) => x.id === r.conversationId);
        const who = r.senderId === me.id ? 'You' : people.get(r.senderId)?.name ?? 'Someone';
        return (
          <Link key={r.id} to={`/app/c/${r.conversationId}`} onClick={onPick} className="block rounded-2xl px-3 py-2 hover:bg-secondary/60">
            <p className="text-xs text-muted-foreground">{c ? titleOf(c) : 'Chat'} · {formatDistanceToNowStrict(new Date(r.sentAt))} ago</p>
            <p className="truncate text-sm"><span className="text-muted-foreground">{who}: </span>{r.body}</p>
          </Link>
        );
      })}
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>;

function ChatsList({ q, activeId, onNew }: { q: string; activeId?: string; onNew: () => void }) {
  const { conversations, titleOf } = useChat();
  const [filter, setFilter] = useState<string>('all');
  const prefs = usePrefs();
  const [folderEdit, setFolderEdit] = useState<{ f: Folder | null } | null>(null);
  const folder = prefs.folders.find((f) => f.id === filter);
  const [showArchived, setShowArchived] = useState(false);
  if (conversations === null) {
    return <>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-3 py-2.5"><Skeleton className="h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-3/4" /></div></div>)}</>;
  }
  const requests = conversations.filter((c) => c.request === 'incoming');
  const all = conversations.filter((c) => !c.communityId && c.request !== 'incoming' && (!q || titleOf(c).toLowerCase().includes(q.toLowerCase())));
  const archived = all.filter((c) => c.archived);
  const list = all.filter((c) => !c.archived && (folder ? folder.ids.includes(c.id) : filter === 'all' || (filter === 'unread' ? c.unread > 0 : filter === 'groups' ? c.isGroup : !c.isGroup)));
  if (prefs.sort === 'az') list.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  else if (prefs.sort === 'unread') list.sort((a, b) => b.unread - a.unread);
  const pinned = list.filter((c) => c.pinned);
  const rest = list.filter((c) => !c.pinned);
  if (!all.length && !q) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-semibold">No conversations yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Message a friend or start a group.</p>
        <button onClick={onNew} className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">New conversation</button>
      </div>
    );
  }
  if (showArchived) {
    return (
      <>
        <button onClick={() => setShowArchived(false)} className="mb-1 flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">← Back to chats</button>
        <Label>Archived</Label>
        {archived.map((c) => <Row key={c.id} c={c} active={c.id === activeId} />)}
        {!archived.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing archived.</p>}
      </>
    );
  }
  return (
    <>
      {!q && (
        <div className="flex gap-1.5 overflow-x-auto px-2 pb-2 pt-1">
          {(['all', 'unread', 'direct', 'groups'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize transition', filter === f ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>{f}</button>
          ))}
          {prefs.folders.map((f) => {
            const n = all.filter((c) => f.ids.includes(c.id) && c.unread > 0).length;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} onDoubleClick={() => setFolderEdit({ f })} title="Double-click to edit"
                className={cn('flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition', filter === f.id ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>
                {f.name}{n > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
          <button onClick={() => setFolderEdit({ f: null })} aria-label="New folder" title="New folder" className="grid h-6 w-7 shrink-0 place-items-center rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground"><FolderPlus className="h-3.5 w-3.5" /></button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Sort chats" title="Sort" className="ml-auto grid h-6 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><ArrowUpDown className="h-3.5 w-3.5" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Sort chats</DropdownMenuLabel>
              {([['recent', 'Most recent'], ['unread', 'Unread first'], ['az', 'A–Z']] as const).map(([k, l]) => <DropdownMenuItem key={k} onClick={() => setPrefs({ sort: k })}>{l}{prefs.sort === k && ' ✓'}</DropdownMenuItem>)}
              {folder && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setFolderEdit({ f: folder })}>Edit “{folder.name}” folder</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {requests.length > 0 && !q && (
        <Link to="/app/friends?tab=requests" className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-secondary/60">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary"><MailQuestion className="h-4 w-4" /></span><span className="flex-1 text-left font-medium">Message requests</span><span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">{requests.length}</span>
        </Link>
      )}
      {archived.length > 0 && !q && (
        <button onClick={() => setShowArchived(true)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-secondary/60">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><Archive className="h-4 w-4" /></span><span className="flex-1 text-left font-medium">Archived</span><span className="text-xs text-muted-foreground">{archived.length}</span>
        </button>
      )}
      {pinned.length > 0 && <><Label>Pinned</Label>{pinned.map((c) => <Row key={c.id} c={c} active={c.id === activeId} />)}<Label>All chats</Label></>}
      {rest.map((c) => <Row key={c.id} c={c} active={c.id === activeId} />)}
      {!list.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">{filter === 'unread' ? 'You’re all caught up ✨' : 'Nothing here yet.'}</p>}
      <FolderDialog open={!!folderEdit} folder={folderEdit?.f ?? null} onOpenChange={(o) => !o && setFolderEdit(null)} />
    </>
  );
}

function CommunityBlock({ cm, activeId, onChannel }: { cm: Community; activeId?: string; onChannel: (id: string) => void }) {
  const { conversations, can, channelOf } = useChat();
  const s = parseCommunity(cm.settings);
  const [open, setOpen] = useState(true);
  const chans = (conversations ?? []).filter((c) => c.communityId === cm.id);
  const pos = (id: string) => { const i = s.channelOrder.indexOf(id); return i < 0 ? 999 : i; };
  chans.sort((a, b) => pos(a.id) - pos(b.id) || (a.name ?? '').localeCompare(b.name ?? ''));
  const groups = [{ id: null as string | null, name: '' }, ...s.categories].map((g) => ({ ...g, list: chans.filter((c) => (channelOf(c).category ?? null) === g.id || (g.id === null && !s.categories.some((x) => x.id === channelOf(c).category))) }));
  const manage = can(cm.id, 'manageCommunity') || can(cm.id, 'manageChannels') || can(cm.id, 'manageRoles') || can(cm.id, 'ban');
  const unread = chans.reduce((n, c) => n + (c.muted ? 0 : c.unread), 0);
  const [shut, setShut] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(`cats-closed:${cm.id}`) ?? '[]'); } catch { return []; } });
  const flip = (id: string) => setShut((x) => { const n = x.includes(id) ? x.filter((y) => y !== id) : [...x, id]; localStorage.setItem(`cats-closed:${cm.id}`, JSON.stringify(n)); return n; });
  return (
    <div className="mb-2.5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {s.banner ? <img src={s.banner} alt="" className="block aspect-[3/1] w-full object-cover" />
        : <div className="aspect-[4/1] w-full" style={{ background: `linear-gradient(135deg, ${s.accent}, ${s.accent}55)` }} />}
      <div className="flex items-center gap-2.5 px-3 pt-2">
        <div className="-mt-7 shrink-0 self-start">{s.icon ? <img src={s.icon} alt="" className="h-11 w-11 rounded-xl object-cover ring-4 ring-card" /> : <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-base ring-4 ring-card">{cm.emoji || cm.name[0]}</span>}</div>
        <button onClick={() => setOpen((o) => !o)} className="flex h-8 min-w-0 flex-1 items-center gap-1.5 text-left">
          <p className="flex min-w-0 flex-1 items-center gap-1 text-sm font-semibold"><span className="truncate">{cm.name}</span>{cm.verified && <Verified community className="h-3.5 w-3.5" />}</p>
          {!open && unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{unread}</span>}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition', !open && '-rotate-90')} />
        </button>
        {can(cm.id, 'manageChannels') && <button onClick={() => onChannel(cm.id)} aria-label="New channel" title="New channel" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"><Plus className="h-4 w-4" /></button>}
        {manage && (
          <Link to={`/app/community/${cm.id}`} aria-label="Community settings" title="Community settings" className="relative grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
            <Settings className="h-4 w-4" />{s.pending.length > 0 && can(cm.id, 'ban') && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />}
          </Link>
        )}
      </div>
      <div className="px-1.5 pb-2 pt-1.5">
        {open && groups.map((g) => (g.list.length > 0 || g.id) && (
          <div key={g.id ?? 'none'}>
            {g.id && (
              <button onClick={() => flip(g.id!)} className="flex w-full items-center gap-1 px-2 pb-0.5 pt-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn('h-3 w-3 transition', shut.includes(g.id) && '-rotate-90')} /><span className="truncate">{g.name}</span>
              </button>
            )}
            {!(g.id && shut.includes(g.id)) && g.list.map((c) => <div key={c.id}><Row c={c} active={c.id === activeId} compact />{channelOf(c).voice && <VoicePeople conversationId={c.id} />}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunitiesList({ activeId, onCreate, onChannel, focus }: { activeId?: string; onCreate: () => void; onChannel: (id: string) => void; focus?: string | null }) {
  const { communities: all } = useChat();
  const communities = focus ? all.filter((c) => c.id === focus) : all;
  return (
    <>
      {communities.map((cm) => <CommunityBlock key={cm.id} cm={cm} activeId={activeId} onChannel={onChannel} />)}
      {!communities.length && <p className="px-6 pb-4 pt-10 text-center text-sm text-muted-foreground">Communities bring channels for a club, team or neighbourhood together in one place.</p>}
      <div className="grid grid-cols-2 gap-2 px-2 pt-3">
        <Link to="/app/discover" className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-secondary"><Compass className="h-4 w-4" /> Discover</Link>
        <button onClick={onCreate} className="flex items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-sm font-medium text-background"><Plus className="h-4 w-4" /> Create</button>
      </div>
    </>
  );
}

/** Who's hanging out in a voice channel, shown under it like Discord. */
function VoicePeople({ conversationId }: { conversationId: string }) {
  const { people } = useChat();
  const [list, setList] = useState<{ userId: string; muted: boolean; camera: boolean }[]>([]);
  usePoll(() => call({ action: 'peek', conversationId }).then((r) => setList(r.participants)).catch(() => {}), 10000);
  if (!list.length) return null;
  return (
    <div className="mb-1 ml-7 space-y-0.5 border-l border-border pl-2">
      {list.map((p) => { const u = people.get(p.userId); return (
        <div key={p.userId} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
          <PersonAvatar name={u?.name ?? '?'} image={u?.image ?? null} size={18} />
          <span className="flex-1 truncate">{u?.name ?? 'Someone'}</span>
          {p.camera && <Cam className="h-3 w-3" />}{p.muted && <MicOff className="h-3 w-3 text-destructive" />}
        </div>
      ); })}
    </div>
  );
}

const ORDER_KEY = 'rail-order';
const readOrder = (): string[] => { try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); } catch { return []; } };

/** Discord-style rail: home (DMs), every community as an icon, then create and discover. */
function Rail({ tab, focus, onHome, onAll, onPick, onCreate, unread }: { tab: string; focus: string | null; onHome: () => void; onAll: () => void; onPick: (id: string) => void; onCreate: () => void; unread: number }) {
  const { communities: raw, conversations, refresh, can } = useChat();
  const navigate = useNavigate();
  const [order, setOrder] = useState(readOrder);
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? 1e6 : i; };
  const communities = [...raw].sort((a, b) => rank(a.id) - rank(b.id));
  const move = (id: string, d: -1 | 1) => {
    const ids = communities.map((c) => c.id); const i = ids.indexOf(id); const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); setOrder(ids);
  };
  const readAll = async (id: string) => { try { await markAllRead({ communityId: id }); await refresh(); toast.success('Marked as read'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t mark as read')); } };
  const Item = ({ active, label, onClick, children, dot }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode; dot?: boolean }) => (
    <div className="group relative flex w-full justify-center">
      <span className="pointer-events-none fixed left-[76px] z-50 mt-2.5 hidden whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-lg md:group-hover:block">{label}</span>
      <span className={cn('absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all', active ? 'h-8' : dot ? 'h-2' : 'h-0 group-hover:h-4')} />
      <button onClick={onClick} title={label} aria-label={label} className={cn('grid h-11 w-11 place-items-center overflow-hidden transition-all', active ? 'rounded-2xl' : 'rounded-[22px] hover:rounded-2xl')}>{children}</button>
    </div>
  );
  return (
    <div className="no-scrollbar flex w-[68px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-secondary/50 py-3">
      <Item active={tab === 'chats'} label="Direct messages" onClick={onHome} dot={unread > 0}><span className={cn('grid h-full w-full place-items-center', tab === 'chats' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground')}><MessageCircle className="h-5 w-5" /></span></Item>
      <Item active={tab === 'communities' && !focus} label="All communities" onClick={onAll}><span className={cn('grid h-full w-full place-items-center', tab === 'communities' && !focus ? 'bg-primary text-primary-foreground' : 'bg-background')}><Users className="h-5 w-5" /></span></Item>
      <div className="h-px w-8 bg-border" />
      {communities.map((cm) => {
        const st = parseCommunity(cm.settings);
        const un = (conversations ?? []).some((c) => c.communityId === cm.id && !c.muted && c.unread > 0);
        return (
          <ContextMenu key={cm.id}>
            <ContextMenuTrigger asChild><div className="w-full">
              <Item active={tab === 'communities' && focus === cm.id} label={cm.name} onClick={() => onPick(cm.id)} dot={un}>
                {st.icon ? <img src={st.icon} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-lg" style={{ background: `${st.accent}33` }}>{cm.emoji || cm.name[0]}</span>}
              </Item>
            </div></ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem onClick={() => readAll(cm.id)}><CheckCheck className="mr-2 h-4 w-4" /> Mark as read</ContextMenuItem>
              {(can(cm.id, 'manageCommunity') || can(cm.id, 'manageChannels') || can(cm.id, 'ban')) && <ContextMenuItem onClick={() => navigate(`/app/community/${cm.id}`)}><Settings className="mr-2 h-4 w-4" /> Community settings</ContextMenuItem>}
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => move(cm.id, -1)}><MoveUp className="mr-2 h-4 w-4" /> Move up</ContextMenuItem>
              <ContextMenuItem onClick={() => move(cm.id, 1)}><MoveDown className="mr-2 h-4 w-4" /> Move down</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <Item active={false} label="Create a community" onClick={onCreate}><span className="grid h-full w-full place-items-center bg-background text-emerald-600 transition-colors hover:bg-emerald-600 hover:text-white active:bg-emerald-700"><Plus className="h-5 w-5" /></span></Item>
      <NavLink to="/app/discover" title="Discover" aria-label="Discover" className={({ isActive }) => cn('grid h-11 w-11 place-items-center transition-all hover:rounded-2xl hover:bg-emerald-600 hover:text-white', isActive ? 'rounded-2xl bg-emerald-600 text-white' : 'rounded-[22px] bg-background text-emerald-600')}><Compass className="h-5 w-5" /></NavLink>
    </div>
  );
}

export default function Sidebar({ hideOnMobile, wideOnly }: { hideOnMobile?: boolean; wideOnly?: boolean }) {
  const { me, conversations, refresh } = useChat();
  const { id } = useParams();
  const navigate = useNavigate();
  const activeComm = conversations?.find((c) => c.id === id)?.communityId;
  const [tab, setTab] = useState<'chats' | 'communities'>(activeComm ? 'communities' : 'chats');
  const [focus, setFocus] = useState<string | null>(activeComm ?? null);
  useEffect(() => { if (activeComm) { setTab('communities'); setFocus(activeComm); } }, [activeComm]);
  // Discord shortcuts: Alt+↑/↓ moves between chats/channels, Alt+Shift+↑/↓ jumps to the next unread one.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-chat-row]')].filter((l) => l.offsetParent);
      const ids = links.map((l) => l.dataset.chatRow!);
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let i = ids.indexOf(id ?? '');
      for (let n = 0; n < ids.length; n++) {
        i = (i + dir + ids.length) % ids.length;
        if (!e.shiftKey || links[i].dataset.unread === '1') { e.preventDefault(); navigate(`/app/c/${ids[i]}`); return; }
      }
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [id, navigate]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchMessagesOutputType['results']>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [comm, setComm] = useState<{ mode: 'create' } | { mode: 'channel'; communityId: string } | null>(null);
  useEffect(() => { const f = () => setNewOpen(true); window.addEventListener('new-chat', f); return () => window.removeEventListener('new-chat', f); }, []);
  const runSearch = useDebouncedCallback(async (v: string) => {
    if (v.trim().length < 2) return setResults([]);
    try { setResults((await searchMessages({ query: v })).results); } catch { setResults([]); }
  }, 300);
  const commUnread = (conversations ?? []).filter((c) => c.communityId && !c.muted).reduce((n, c) => n + c.unread, 0);
  const pendingFriends = usePendingFriends();
  const chatUnread = (conversations ?? []).filter((c) => !c.communityId && !c.muted && c.request !== 'incoming').reduce((n, c) => n + c.unread, 0);

  return (
    <aside className={cn('flex w-full shrink-0 border-r border-border md:w-[352px] lg:w-[392px] xl:w-[432px]', hideOnMobile && 'hidden md:flex', wideOnly && 'hidden md:hidden 2xl:flex')}>
      <Rail tab={tab} focus={focus} onHome={() => { setTab('chats'); setFocus(null); setQ(''); }} onAll={() => { setTab('communities'); setFocus(null); setQ(''); }} onPick={(cid) => { setTab('communities'); setFocus(cid); setQ(''); }} onCreate={() => setComm({ mode: 'create' })} unread={chatUnread} />
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <button onClick={() => navigate('/')} aria-label="Home"><Logo /></button>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link to="/app/friends" aria-label="Friends" title="Friends" className="focus-ring relative grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"><UserRound className="h-[18px] w-[18px]" />{pendingFriends > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{pendingFriends}</span>}</Link>
          <button onClick={() => setNewOpen(true)} aria-label="New conversation" className="focus-ring grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"><SquarePen className="h-[18px] w-[18px]" /></button>
          <DropdownMenu>
            <DropdownMenuTrigger className="focus-ring ml-1 rounded-full"><PersonAvatar name={me.name} image={me.image} size={32} /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel><p className="truncate">{me.name}</p><p className="truncate text-xs font-normal text-muted-foreground">{me.email}</p></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/app/settings')}><Settings className="mr-2 h-4 w-4" /> Profile & settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/discover')}><Compass className="mr-2 h-4 w-4" /> Discover communities</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/saved')}><Star className="mr-2 h-4 w-4" /> Saved messages</DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { try { await markAllRead({}); await refresh(); toast.success('All caught up'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t mark as read')); } }}><CheckCheck className="mr-2 h-4 w-4" /> Mark all as read</DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.dispatchEvent(new Event('open-palette'))}><Command className="mr-2 h-4 w-4" /> Quick switch <span className="ml-auto text-xs text-muted-foreground">Ctrl K</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="space-y-3 px-4 pb-2 pt-2">
        <label className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); runSearch(e.target.value); }} placeholder="Search chats and messages" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {q && <button onClick={() => { setQ(''); setResults([]); }} aria-label="Clear"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </label>
        {!q && (
          <div className="grid grid-cols-2 rounded-xl bg-secondary p-1 text-sm font-medium">
            {([['chats', 'Chats', chatUnread], ['communities', 'Communities', commUnread]] as const).map(([k, l, n]) => (
              <button key={k} onClick={() => { setTab(k); setFocus(null); }} className={cn('flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition', tab === k ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                {k === 'communities' && <Users className="h-3.5 w-3.5" />}{l}{n > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {q && <Results results={results} onPick={() => setQ('')} />}
        {q || tab === 'chats'
          ? <>{!q && <StoriesBar />}<ChatsList q={q} activeId={id} onNew={() => setNewOpen(true)} /></>
          : <CommunitiesList focus={focus} activeId={id} onCreate={() => setComm({ mode: 'create' })} onChannel={(cid) => setComm({ mode: 'channel', communityId: cid })} />}
      </nav>
      </div>
      <NewChatDialog open={newOpen} onOpenChange={setNewOpen} />
      <CommunityDialog state={comm} onClose={() => setComm(null)} key={comm ? JSON.stringify(comm) : 'none'} />
    </aside>
  );
}
