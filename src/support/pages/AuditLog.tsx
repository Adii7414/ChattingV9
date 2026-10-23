import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { modAuditLog, type ModAuditLogOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { cn } from '@project/components/lib/utils';
import { Empty, PageHeader, Stat, ago, input } from '../kit';

const CATS = ['Auth', 'Account', 'Message', 'Community', 'Moderation', 'Support', 'Verification', 'Bot', 'API', 'System'];
const SEVS = ['Info', 'Notice', 'Warning', 'Critical'];
const ACTORS = ['User', 'Staff', 'Bot', 'System'];
const SEV_TONE: Record<string, string> = { Info: 'bg-secondary text-muted-foreground', Notice: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', Warning: 'bg-amber-500/20 text-amber-700 dark:text-amber-300', Critical: 'bg-destructive text-destructive-foreground' };
export const SeverityPill = ({ v }: { v: string }) => <span className={cn('inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium', SEV_TONE[v] ?? SEV_TONE.Info)}>{v}</span>;
type Entry = ModAuditLogOutputType['entries'][number];
const PAGE = 50;

function Filter({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">All {label}</SelectItem>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export default function AuditLog() {
  const [q, setQ] = useState('');
  const [dq] = useDebounce(q, 350);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [actorType, setActorType] = useState('');
  const [range, setRange] = useState('7d');
  const [page, setPage] = useState(0);
  const [d, setD] = useState<ModAuditLogOutputType | null>(null);
  const [sel, setSel] = useState<Entry | null>(null);
  useEffect(() => setPage(0), [dq, category, severity, actorType, range]);
  useEffect(() => {
    setD(null);
    const from = range === 'all' ? undefined : new Date(Date.now() - { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[range as '7d']! * 86_400_000).toISOString();
    modAuditLog({ search: dq, category, severity, actorType, from, offset: page * PAGE, limit: PAGE }).then(setD).catch(() => setD({ total: 0, entries: [], byCategory: [], bySeverity: [] }));
  }, [dq, category, severity, actorType, range, page]);

  const exportCsv = () => {
    if (!d) return;
    const rows = [['time', 'severity', 'category', 'action', 'summary', 'actorType', 'actor', 'targetType', 'target', 'targetUser', 'community', 'details'], ...d.entries.map((e) => [e.at, e.severity, e.category, e.action, e.summary, e.actorType, e.actorLabel, e.targetType, e.targetLabel || e.targetId, e.targetUserName, e.communityName, e.details])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
  const sev = (k: string) => d?.bySeverity.find((x) => x.severity === k)?.n ?? 0;

  return (
    <div>
      <PageHeader title="Audit log" desc="Every sign-in, staff action, moderation, verification and bot action on the platform">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search summary, action, people, details" className={`${input} w-72 pl-8`} /></div>
        <button onClick={exportCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-secondary"><Download className="h-4 w-4" /> Export page</button>
      </PageHeader>
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Critical · 7 days" value={sev('Critical')} tone={sev('Critical') ? 'warn' : undefined} /><Stat label="Warnings · 7 days" value={sev('Warning')} />
          <Stat label="Notices · 7 days" value={sev('Notice')} /><Stat label="Matching entries" value={d?.total ?? '…'} />
        </div>
        {!!d?.byCategory.length && (
          <div className="flex flex-wrap gap-1.5">{d.byCategory.map((c) => <button key={c.category} onClick={() => setCategory(category === c.category ? '' : c.category)} className={cn('rounded-full border px-3 py-1 text-xs', category === c.category ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>{c.category} · {c.n}</button>)}</div>
        )}
        <div className="flex flex-wrap gap-2">
          <Filter value={category} onChange={setCategory} options={CATS} label="categories" />
          <Filter value={severity} onChange={setSeverity} options={SEVS} label="severities" />
          <Filter value={actorType} onChange={setActorType} options={ACTORS} label="actors" />
          <Select value={range} onValueChange={setRange}><SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger><SelectContent>{[['24h', 'Last 24 hours'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['all', 'All time']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">When</th><th className="px-3 font-medium">Severity</th><th className="px-3 font-medium">Category</th><th className="px-3 font-medium">Event</th><th className="px-3 font-medium">Actor</th><th className="px-3 font-medium">Target</th></tr></thead>
            <tbody>
              {!d ? [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-7" /></td></tr>) : d.entries.map((e) => (
                <tr key={e.id} onClick={() => setSel(e)} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground" title={new Date(e.at).toLocaleString()}>{ago(e.at)}</td>
                  <td className="px-3"><SeverityPill v={e.severity} /></td>
                  <td className="px-3"><span className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{e.category}</span></td>
                  <td className="max-w-md px-3"><p className="truncate">{e.summary}</p><p className="font-mono text-[11px] text-muted-foreground">{e.action}</p></td>
                  <td className="whitespace-nowrap px-3 text-xs"><span className="text-muted-foreground">{e.actorType}</span> {e.actorLabel}</td>
                  <td className="whitespace-nowrap px-3 text-xs">{e.targetUserName || e.targetLabel || e.communityName || e.targetType || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d && !d.entries.length && <Empty>No entries match these filters</Empty>}
        </div>
        {d && d.total > PAGE && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">{page * PAGE + 1}–{Math.min(d.total, (page + 1) * PAGE)} of {d.total}</span>
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button disabled={(page + 1) * PAGE >= d.total} onClick={() => setPage(page + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-border disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {sel && (<>
            <SheetHeader><SheetTitle className="pr-6 text-left">{sel.summary}</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap gap-1.5"><SeverityPill v={sel.severity} /><span className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{sel.category}</span><span className="font-mono text-xs text-muted-foreground">{sel.action}</span></div>
              <dl className="space-y-1.5">
                {[['Time', new Date(sel.at).toLocaleString()], ['Actor', `${sel.actorType}${sel.actorLabel ? ` · ${sel.actorLabel}` : ''}`], ['Target', [sel.targetType, sel.targetLabel || sel.targetId].filter(Boolean).join(' · ') || '—'], ['Community', sel.communityName || sel.communityId || '—'], ['Session', sel.sessionKey || '—'], ['Entry id', sel.id]].map(([k, v]) => <div key={k} className="flex gap-3"><dt className="w-24 shrink-0 text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd></div>)}
              </dl>
              <div className="flex flex-wrap gap-2">
                {sel.targetUserId && <Link to={`/support/users/${sel.targetUserId}`} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">Open {sel.targetUserName || 'user'}</Link>}
                {sel.actorId && sel.actorType === 'User' && <Link to={`/support/users/${sel.actorId}`} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">Open actor</Link>}
              </div>
              <div><p className="mb-1 font-medium">Details</p><pre className="overflow-x-auto rounded-lg bg-secondary p-3 font-mono text-xs">{sel.details ? (() => { try { return JSON.stringify(JSON.parse(sel.details), null, 2); } catch { return sel.details; } })() : 'No extra details'}</pre></div>
            </div>
          </>)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
