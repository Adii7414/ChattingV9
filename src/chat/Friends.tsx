import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, MessageCircle, Search, UserPlus, X } from 'lucide-react';
import { createConversation, friends, messageRequest, type FriendsOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { cn } from '@project/components/lib/utils';
import PersonAvatar from './Avatars';
import PersonDialog from './PersonDialog';
import { useChat, usePoll } from './store';
import { errorMessage } from '../lib/errors';

type F = FriendsOutputType;
type Person = F['friends'][number];
type Tab = 'all' | 'pending' | 'requests' | 'add';

/** Count of incoming friend requests, for the sidebar badge. */
export function usePendingFriends() {
  const [n, setN] = useState(0);
  const load = useCallback(() => friends({ action: 'list' }).then((r) => setN(r.incoming.length)).catch(() => {}), []);
  usePoll(load, 30000);
  useEffect(() => { window.addEventListener('chat:friends', load); return () => window.removeEventListener('chat:friends', load); }, [load]);
  return n;
}

export default function Friends() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'all';
  const { conversations } = useChat();
  const [d, setD] = useState<F | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const load = useCallback(() => friends({ action: 'list' }).then(setD).catch((e) => toast.error(errorMessage(e, 'Couldn’t load your friends'))), []);
  useEffect(() => { load(); window.addEventListener('chat:friends', load); return () => window.removeEventListener('chat:friends', load); }, [load]);
  const requests = (conversations ?? []).filter((c) => c.request === 'incoming');
  const tabs: { k: Tab; l: string; n?: number }[] = [
    { k: 'all', l: 'Friends', n: d?.friends.length }, { k: 'pending', l: 'Pending', n: d ? d.incoming.length : 0 },
    { k: 'requests', l: 'Message requests', n: requests.length }, { k: 'add', l: 'Add friend' },
  ];

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="border-b border-border px-5 py-4 sm:px-8">
        <Link to="/app" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground md:hidden"><ArrowLeft className="h-4 w-4" /> Chats</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setParams({ tab: t.k })} className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition', tab === t.k ? (t.k === 'add' ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background') : t.k === 'add' ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-secondary')}>
              {t.l}{!!t.n && t.k !== 'all' && <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{t.n}</span>}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {tab === 'add' ? <AddFriend onPerson={setPerson} onChange={load} />
          : tab === 'requests' ? <Requests list={requests} />
          : !d ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          : tab === 'pending' ? <Pending d={d} onPerson={setPerson} onChange={load} />
          : <AllFriends list={d.friends} onPerson={setPerson} />}
      </div>
      <PersonDialog userId={person} onClose={() => { setPerson(null); load(); }} />
    </section>
  );
}

function Row({ p, onPerson, children, sub }: { p: F['results'][number]; onPerson: (id: string) => void; children?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-secondary/60">
      <button onClick={() => onPerson(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <PersonAvatar name={p.name} image={p.image} size={42} online={p.online} />
        <div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{sub ?? (p.online ? 'Online' : 'Offline')}</p></div>
      </button>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </div>
  );
}

const iconBtn = 'grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground transition hover:text-foreground disabled:opacity-50';
const empty = (t: string) => <p className="px-3 py-16 text-center text-sm text-muted-foreground">{t}</p>;

function useAct(onChange: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (userId: string, action: 'request' | 'accept' | 'decline' | 'remove', ok: string) => {
    setBusy(userId + action);
    try { await friends({ action, userId }); toast.success(ok); onChange(); window.dispatchEvent(new CustomEvent('chat:friends')); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t update your friends')); } finally { setBusy(null); }
  };
  return { busy, act };
}

function AllFriends({ list, onPerson }: { list: Person[]; onPerson: (id: string) => void }) {
  const { refresh } = useChat();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const message = async (id: string) => {
    try { const r = await createConversation({ memberIds: [id] }); await refresh(); navigate(`/app/c/${r.id}`); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t open the chat')); }
  };
  if (!list.length) return empty('No friends yet — head to “Add friend” to find people.');
  const shown = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.online) - Number(a.online));
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search friends" className="focus-ring mb-3 h-10 w-full rounded-xl bg-secondary px-3 text-sm outline-none" />
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">All friends — {shown.length}</p>
      {shown.map((p) => <Row key={p.id} p={p} onPerson={onPerson}><button onClick={() => message(p.id)} className={iconBtn} title="Message"><MessageCircle className="h-4 w-4" /></button></Row>)}
    </>
  );
}

function Pending({ d, onPerson, onChange }: { d: F; onPerson: (id: string) => void; onChange: () => void }) {
  const { busy, act } = useAct(onChange);
  if (!d.incoming.length && !d.outgoing.length) return empty('No pending friend requests.');
  return (
    <>
      {d.incoming.length > 0 && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Incoming — {d.incoming.length}</p>}
      {d.incoming.map((p) => (
        <Row key={p.id} p={p} onPerson={onPerson} sub="Wants to be friends">
          <button disabled={!!busy} onClick={() => act(p.id, 'accept', `You and ${p.name} are now friends`)} className={cn(iconBtn, 'hover:bg-primary hover:text-primary-foreground')} title="Accept">{busy === p.id + 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
          <button disabled={!!busy} onClick={() => act(p.id, 'decline', 'Request ignored')} className={cn(iconBtn, 'hover:bg-destructive hover:text-destructive-foreground')} title="Ignore"><X className="h-4 w-4" /></button>
        </Row>
      ))}
      {d.outgoing.length > 0 && <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sent — {d.outgoing.length}</p>}
      {d.outgoing.map((p) => (
        <Row key={p.id} p={p} onPerson={onPerson} sub="Request sent">
          <button disabled={!!busy} onClick={() => act(p.id, 'remove', 'Request cancelled')} className={iconBtn} title="Cancel request"><X className="h-4 w-4" /></button>
        </Row>
      ))}
    </>
  );
}

function AddFriend({ onPerson, onChange }: { onPerson: (id: string) => void; onChange: () => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<F['results'] | null>([]);
  const search = useDebouncedCallback(async (v: string) => {
    if (v.trim().length < 2) return setRes([]);
    try { setRes((await friends({ action: 'search', query: v })).results); } catch (e) { setRes([]); toast.error(errorMessage(e, 'Search failed')); }
  }, 300);
  const { busy, act } = useAct(() => { onChange(); search(q); });
  const label = { none: 'Add friend', outgoing: 'Sent', incoming: 'Accept', friends: 'Friends' } as const;
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-muted-foreground">Find people by their name or exact email. They’ll get a request they can accept.</p>
      <label className="mt-3 flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-4 focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setRes(null); search(e.target.value); }} placeholder="Search by @username" className="w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="mt-3">
        {res === null && <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {res?.length === 0 && q.trim().length >= 2 && empty('No one matches that.')}
        {res?.map((p) => (
          <Row key={p.id} p={p} onPerson={onPerson} sub={p.relation === 'friends' ? 'Already friends' : ' '}>
            <button disabled={!!busy || p.relation === 'friends' || p.relation === 'outgoing'} onClick={() => act(p.id, p.relation === 'incoming' ? 'accept' : 'request', p.relation === 'incoming' ? 'You’re now friends' : `Friend request sent to ${p.name}`)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground">
              {busy === p.id + 'request' || busy === p.id + 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{label[p.relation]}
            </button>
          </Row>
        ))}
      </div>
    </div>
  );
}

function Requests({ list }: { list: NonNullable<ReturnType<typeof useChat>['conversations']> }) {
  const { othersOf, refresh } = useChat();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const answer = async (id: string, action: 'accept' | 'decline') => {
    setBusy(id + action);
    try { await messageRequest({ conversationId: id, action }); await refresh(); toast.success(action === 'accept' ? 'Request accepted' : 'Request deleted'); if (action === 'accept') navigate(`/app/c/${id}`); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t answer the request')); } finally { setBusy(null); }
  };
  if (!list.length) return empty('No message requests. People who aren’t your friends will show up here when they message you.');
  return (
    <>
      <p className="px-3 pb-2 text-sm text-muted-foreground">They won’t know you’ve seen their message until you accept.</p>
      {list.map((c) => {
        const o = othersOf(c)[0];
        return (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-secondary/60">
            <Link to={`/app/c/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <PersonAvatar name={o?.name ?? '?'} image={o?.image ?? null} size={42} />
              <div className="min-w-0"><p className="truncate font-medium">{o?.name ?? 'Someone'}</p><p className="truncate text-sm text-muted-foreground">{c.preview ?? 'Wants to message you'}</p></div>
            </Link>
            <button disabled={!!busy} onClick={() => answer(c.id, 'accept')} className={cn(iconBtn, 'hover:bg-primary hover:text-primary-foreground')} title="Accept">{busy === c.id + 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
            <button disabled={!!busy} onClick={() => answer(c.id, 'decline')} className={cn(iconBtn, 'hover:bg-destructive hover:text-destructive-foreground')} title="Delete"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </>
  );
}
