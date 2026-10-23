import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Search, Users } from 'lucide-react';
import { Verified } from './official';
import { discoverCommunities, manageCommunity, type DiscoverCommunitiesOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { useChat, usePoll } from './store';
import { parseCommunity } from '../lib/community';
import { errorMessage } from '../lib/errors';

type C = DiscoverCommunitiesOutputType['communities'][number];
const look = (c: C) => parseCommunity(c.settings);

export default function Discover() {
  const { refresh, conversations } = useChat();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [list, setList] = useState<C[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useDebouncedCallback(async (v: string) => {
    try { setList((await discoverCommunities({ query: v })).communities); } catch { setList([]); }
  }, 250);
  usePoll(() => load(q), 30000);

  const open = async (c: C) => {
    if (c.joined) {
      const ch = conversations?.find((x) => x.communityId === c.id);
      return navigate(ch ? `/app/c/${ch.id}` : '/app');
    }
    setBusy(c.id);
    try {
      const r = await manageCommunity({ communityId: c.id, action: 'join' });
      if (r.status === 'pending') { toast.success(`Request sent to ${c.name}`); return; }
      await refresh();
      toast.success(`Joined ${c.name}`);
      navigate(r.channelId ? `/app/c/${r.channelId}` : '/app');
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t join')); } finally { setBusy(null); }
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <Link to="/app" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground md:hidden"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Discover communities</h1>
        <p className="mt-2 text-muted-foreground">Find your people. Join a public community to get all its channels.</p>
        <label className="mt-6 flex h-12 items-center gap-2 rounded-2xl bg-secondary px-4 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} placeholder="Search communities" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {list === null && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}
          {list?.map((c) => (
            <div key={c.id} className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
              <div className="h-20" style={{ background: look(c).banner ? `url(${look(c).banner}) center/cover` : `linear-gradient(135deg, ${look(c).accent}, ${look(c).accent}55)` }} />
              <div className="flex flex-1 flex-col px-5 pb-5">
              <div className="-mt-6 flex items-end gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-secondary text-2xl">{look(c).icon ? <img src={look(c).icon!} alt="" className="h-full w-full object-cover" /> : c.emoji || c.name[0]}</span>
                <div className="min-w-0"><p className="flex items-center gap-1 font-semibold"><span className="truncate">{c.name}</span>{c.verified && <Verified community />}</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {c.memberCount} member{c.memberCount === 1 ? '' : 's'}</p></div>
              </div>
              <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{look(c).tagline || c.description || 'No description yet.'}</p>
              {look(c).tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{look(c).tags.map((t) => <button key={t} onClick={() => { setQ(t); load(t); }} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">{t}</button>)}</div>}
              <button onClick={() => open(c)} disabled={busy === c.id} className={`mt-4 flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium ${c.joined ? 'border border-border' : 'bg-foreground text-background'}`}>
                {busy === c.id && <Loader2 className="h-4 w-4 animate-spin" />}{c.joined ? 'Open' : look(c).joinMode === 'approval' ? 'Request to join' : 'Join'}
              </button>
              </div>
            </div>
          ))}
        </div>
        {list?.length === 0 && <p className="py-16 text-center text-muted-foreground">{q ? 'No communities match that search.' : 'No public communities yet — create the first one from the Communities tab.'}</p>}
      </div>
    </section>
  );
}
