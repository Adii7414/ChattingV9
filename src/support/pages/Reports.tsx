import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import { Check, Search, Trash2, Undo2, X } from 'lucide-react';
import { modReports, type ModReportsOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Empty, PageHeader, Pill, Segmented, ago, input } from '../kit';
import { errorMessage } from '../../lib/errors';

type R = ModReportsOutputType['reports'][number];
const STATUSES = ['Open', 'Resolved', 'Dismissed', 'All'] as const;
type Decision = 'Resolve' | 'Dismiss' | 'DeleteMessage' | 'Reopen';

export default function Reports() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('Open');
  const [q, setQ] = useState('');
  const [dq] = useDebounce(q, 300);
  const [list, setList] = useState<R[] | null>(null);
  const [confirm, setConfirm] = useState<R | null>(null);
  const load = useCallback((act?: { reportId: string; decision: Decision }) => modReports({ status, search: dq, act }).then((r) => setList(r.reports)), [status, dq]);
  useEffect(() => { setList(null); load(); }, [load]);

  const act = async (r: R, decision: Decision) => {
    setList((l) => l && (status === 'All' ? l : l.filter((x) => x.id !== r.id)));
    try { await load({ reportId: r.id, decision }); toast.success(decision === 'DeleteMessage' ? 'Message deleted and report resolved' : `Report ${decision === 'Reopen' ? 'reopened' : decision.toLowerCase() + 'd'}`); }
    catch (e) { toast.error(errorMessage(e, 'Action failed')); load(); }
  };

  return (
    <div>
      <PageHeader title="Reports" desc="Messages flagged by members across every chat and community">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports" className={`${input} w-56 pl-8`} /></div>
        <Segmented value={status} options={STATUSES} onChange={setStatus} />
      </PageHeader>
      <div className="space-y-3 p-6">
        {list === null ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />) : list.length === 0 ? <Empty>Nothing here — the queue is clear 🎉</Empty> : list.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Pill v={r.status} />
              <Link to={`/support/users/${r.reportedId}`} className="font-medium hover:underline">{r.reportedName}</Link>
              {r.priorReports > 0 && <span className="rounded-md bg-destructive/10 px-1.5 text-[11px] text-destructive">{r.priorReports} other report{r.priorReports > 1 ? 's' : ''}</span>}
              <span className="text-muted-foreground">in {r.communityName}</span>
              <span className="ml-auto text-xs text-muted-foreground">reported by {r.reporterName} · {ago(r.createdAt)}</span>
            </div>
            <blockquote className="mt-3 whitespace-pre-wrap rounded-lg border-l-2 border-primary bg-secondary px-3 py-2 text-sm">{r.messageBody || <span className="italic text-muted-foreground">(no text — attachment or deleted)</span>}</blockquote>
            {r.reason && <p className="mt-2 text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === 'Open' ? <>
                <Button size="sm" onClick={() => act(r, 'Resolve')}><Check className="mr-1 h-3.5 w-3.5" />Resolve</Button>
                {r.messageId && <Button size="sm" variant="destructive" onClick={() => setConfirm(r)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete message</Button>}
                <Button size="sm" variant="outline" onClick={() => act(r, 'Dismiss')}><X className="mr-1 h-3.5 w-3.5" />Dismiss</Button>
              </> : <Button size="sm" variant="outline" onClick={() => act(r, 'Reopen')}><Undo2 className="mr-1 h-3.5 w-3.5" />Reopen</Button>}
              <Button size="sm" variant="ghost" asChild><Link to={`/support/users/${r.reportedId}`}>Review user →</Link></Button>
            </div>
          </div>
        ))}
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this message?</AlertDialogTitle><AlertDialogDescription>It disappears for everyone in the chat. The report is marked resolved. This can’t be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (confirm) act(confirm, 'DeleteMessage'); setConfirm(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
