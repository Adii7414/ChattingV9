import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { modUsers, type ModUsersOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@project/components/ui/avatar';
import { Empty, PageHeader, Pill, Segmented, ago, input } from '../kit';

const STANDING = ['All', 'Good', 'Suspended', 'Banned'] as const;

export default function UsersPage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [dq] = useDebounce(q, 300);
  const [standing, setStanding] = useState<(typeof STANDING)[number]>('All');
  const [page, setPage] = useState(0);
  const [d, setD] = useState<ModUsersOutputType | null>(null);
  useEffect(() => { setPage(0); }, [dq, standing]);
  useEffect(() => { setD(null); modUsers({ search: dq, standing, page }).then(setD); }, [dq, standing, page]);
  const pages = d ? Math.max(1, Math.ceil(d.total / 50)) : 1;
  return (
    <div>
      <PageHeader title="Users" desc="Everyone with a Chatting account — most reported first">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" className={`${input} w-60 pl-8`} /></div>
        <Segmented value={standing} options={STANDING} onChange={setStanding} />
      </PageHeader>
      <div className="p-6">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">User</th><th className="px-3 font-medium">Standing</th><th className="px-3 text-right font-medium">Messages</th><th className="px-3 text-right font-medium">Reports</th><th className="px-3 font-medium">Last seen</th><th className="px-3 font-medium">Joined</th></tr></thead>
            <tbody>
              {!d ? [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-8" /></td></tr>) : d.users.map((u) => (
                <tr key={u.id} onClick={() => nav(`/support/users/${u.id}`)} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/60">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar className="h-8 w-8"><AvatarImage src={u.image ?? undefined} /><AvatarFallback>{u.name[0]}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-medium">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div></div></td>
                  <td className="px-3"><Pill v={u.standing} /></td>
                  <td className="px-3 text-right font-mono">{u.messages}</td>
                  <td className={`px-3 text-right font-mono ${u.reports ? 'text-destructive' : ''}`}>{u.reports}</td>
                  <td className="px-3 text-muted-foreground">{ago(u.lastSeenAt)}</td>
                  <td className="px-3 text-muted-foreground">{ago(u.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d && d.users.length === 0 && <Empty>No users match</Empty>}
        </div>
        {d && d.total > 50 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
            {d.total} users · page {page + 1} of {pages}
            <Button size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}
