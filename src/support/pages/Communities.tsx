import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import { ArrowDown, ArrowUp, BadgeCheck, Globe, Lock, Search, Trash2 } from 'lucide-react';
import { Verified } from '../../chat/official';
import VerifyDialog from './VerifyDialog';
import { modCommunities, type ModCommunitiesOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Empty, PageHeader, ago, input } from '../kit';
import { errorMessage } from '../../lib/errors';

type C = ModCommunitiesOutputType['communities'][number];
const COLS: { k: keyof C; l: string }[] = [{ k: 'members', l: 'Members' }, { k: 'channels', l: 'Channels' }, { k: 'messages7d', l: 'Msgs 7d' }, { k: 'openReports', l: 'Open reports' }];

export default function Communities() {
  const [q, setQ] = useState('');
  const [dq] = useDebounce(q, 300);
  const [list, setList] = useState<C[] | null>(null);
  const [sort, setSort] = useState<{ k: keyof C; desc: boolean }>({ k: 'openReports', desc: true });
  const [del, setDel] = useState<C | null>(null);
  const [filter, setFilter] = useState<'all' | 'Pending' | 'Verified'>('all');
  const [pending, setPending] = useState(0);
  const [review, setReview] = useState<C | null>(null);
  const load = useCallback((deleteId?: string) => modCommunities({ search: dq, deleteId, verification: filter }).then((r) => { setList(r.communities); setPending(r.pending); }), [dq, filter]);
  useEffect(() => { setList(null); load().catch((e) => { setList([]); toast.error(errorMessage(e, 'Couldn’t load communities')); }); }, [load]);
  const sorted = list && [...list].sort((a, b) => (Number(a[sort.k]) - Number(b[sort.k])) * (sort.desc ? -1 : 1));
  const remove = async (c: C) => { setList((l) => l && l.filter((x) => x.id !== c.id)); try { await load(c.id); toast.success(`${c.name} deleted`); } catch (e) { toast.error(errorMessage(e, 'Couldn’t delete')); load(); } };

  return (
    <div>
      <PageHeader title="Communities" desc="Every community, sorted by what needs attention">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search communities" className={`${input} w-60 pl-8`} /></div>
      </PageHeader>
      <div className="p-6">
        <div className="mb-4 flex gap-1.5">
          {(["all", "Pending", "Verified"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${filter === f ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "All" : f === "Pending" ? "Verification requests" : "Verified"}{f === "Pending" && pending > 0 && <span className="rounded-full bg-[hsl(var(--verified-community))] px-1.5 text-[10px] font-semibold text-black">{pending}</span>}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr>
              <th className="px-4 py-2.5 font-medium">Community</th><th className="px-3 font-medium">Owner</th>
              {COLS.map((c) => <th key={c.k} className="px-3 text-right font-medium"><button onClick={() => setSort({ k: c.k, desc: sort.k === c.k ? !sort.desc : true })} className="inline-flex items-center gap-1">{c.l}{sort.k === c.k && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}</button></th>)}
              <th className="px-3 font-medium">Created</th><th />
            </tr></thead>
            <tbody>
              {!sorted ? [0, 1, 2].map((i) => <tr key={i}><td colSpan={9} className="p-3"><Skeleton className="h-8" /></td></tr>) : sorted.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="text-lg">{c.emoji || '🏠'}</span><div className="min-w-0"><p className="flex items-center gap-1 font-medium">{c.name}{c.verificationStatus === "Verified" && <Verified community className="h-3.5 w-3.5" />}{c.isPublic ? <Globe className="h-3 w-3 text-muted-foreground" /> : <Lock className="h-3 w-3 text-muted-foreground" />}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{c.description}</p></div></div></td>
                  <td className="px-3">{c.ownerId ? <Link to={`/support/users/${c.ownerId}`} className="hover:underline">{c.owner}</Link> : c.owner}</td>
                  {COLS.map((k) => <td key={k.k} className={`px-3 text-right font-mono ${k.k === 'openReports' && c.openReports ? 'text-destructive' : ''}`}>{String(c[k.k])}</td>)}
                  <td className="px-3 text-muted-foreground">{ago(c.createdAt)}</td>
                  <td className="whitespace-nowrap px-3"><button onClick={() => setReview(c)} className={`mr-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${c.verificationStatus === "Pending" ? "bg-[hsl(var(--verified-community))] text-black" : "border border-border text-muted-foreground hover:text-foreground"}`}><BadgeCheck className="h-3.5 w-3.5" />{c.verificationStatus === "Pending" ? "Review" : c.verificationStatus === "Verified" ? "Verified" : "Verify"}</button><button onClick={() => setDel(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete community"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted?.length === 0 && <Empty>{filter === 'Pending' ? 'No verification requests waiting' : filter === 'Verified' ? 'No verified communities yet' : 'No communities'}</Empty>}
        </div>
      </div>
      <VerifyDialog c={review} onClose={() => setReview(null)} onDone={() => { setReview(null); load(); }} />
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {del?.name}?</AlertDialogTitle><AlertDialogDescription>The community is removed for all {del?.members} members. Use this only for communities that break the Terms. This can’t be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (del) remove(del); setDel(null); }}>Delete community</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
