import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import { AlarmClock, ArrowLeft, Inbox, Loader2, Lock, MessageSquareText, Search, Send, Star, User, UserCheck } from 'lucide-react';
import { modCannedReplies, modTickets, type ModCannedRepliesOutputType, type ModTicketsInputType, type ModTicketsOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { Checkbox } from '@project/components/ui/checkbox';
import { Textarea } from '@project/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { Empty, Pill, Segmented, ago, input } from '../kit';
import { useAuth } from 'zitejs/auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import { errorMessage } from '../../lib/errors';

type D = ModTicketsOutputType;
type T = D['tickets'][number];
type Upd = NonNullable<ModTicketsInputType['update']>;
const STATUSES = ['Active', 'Open', 'Pending', 'Resolved', 'Closed', 'All'] as const;
const TAGS = ['VIP', 'Refund', 'Escalated', 'Needs engineering', 'Appeal', 'Duplicate'] as const;
const SLA_H: Record<string, number> = { Urgent: 1, High: 4, Normal: 24, Low: 48 };

function slaState(t: T) {
  if (!t.awaitingSince || !['Open', 'Pending'].includes(t.status)) return null;
  const hrs = (Date.now() - new Date(t.awaitingSince).getTime()) / 3_600_000;
  const lim = SLA_H[t.priority] ?? 24;
  return hrs > lim ? 'breach' : hrs > lim * 0.75 ? 'soon' : 'ok';
}

function TicketRow({ t, active, checked, onCheck, onOpen }: { t: T; active: boolean; checked: boolean; onCheck: (v: boolean) => void; onOpen: () => void }) {
  const sla = slaState(t);
  return (
    <div onClick={onOpen} className={cn('flex cursor-pointer gap-2.5 border-b border-border px-3 py-3', active ? 'bg-accent' : 'hover:bg-secondary/60')}>
      <div onClick={(e) => e.stopPropagation()} className="pt-0.5"><Checkbox checked={checked} onCheckedChange={(v) => onCheck(!!v)} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><p className="truncate text-sm font-medium">{t.subject}</p>{t.awaitingSince && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="Awaiting our reply" />}</div>
        <p className="truncate text-xs text-muted-foreground">{t.requesterName} · {t.category}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Pill v={t.status} />{t.priority !== 'Normal' && <Pill v={t.priority} />}
          {t.tags.slice(0, 2).map((g) => <span key={g} className="rounded bg-secondary px-1 text-[10px]">{g}</span>)}
          {sla === 'breach' && <span className="flex items-center gap-0.5 text-[10px] font-medium text-destructive"><AlarmClock className="h-3 w-3" />SLA</span>}
          {sla === 'soon' && <span className="flex items-center gap-0.5 text-[10px] text-amber-600"><AlarmClock className="h-3 w-3" />due</span>}
          {t.status === 'Closed' && t.rating != null && <span className="flex items-center gap-0.5 rounded bg-secondary px-1 text-[10px] font-medium"><Star className="h-2.5 w-2.5 fill-current" />{t.rating}/5</span>}
          <span className="ml-auto text-[10px] text-muted-foreground">{ago(t.lastActivityAt)}</span>
        </div>
      </div>
    </div>
  );
}

function Composer({ t, live, macros, send }: { t: T; live: boolean; macros: ModCannedRepliesOutputType['replies']; send: (body: string, internal: boolean, setStatus?: 'Resolved' | 'Pending') => Promise<void> }) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const go = async (s?: 'Resolved' | 'Pending') => { setBusy(true); try { await send(body.trim(), internal, s); setBody(''); } finally { setBusy(false); } };
  const first = t.requesterName.split(' ')[0];
  const { user } = useAuth();
  return (
    <div className={cn('border-t border-border p-3', internal && 'bg-amber-500/5')}>
      {!internal && live && <p className="mb-2 text-xs text-muted-foreground">Replying as <span className="font-medium text-foreground">Chatting Support · {user?.firstName || user?.name?.split(' ')[0] || 'you'}</span> — sent straight to {first}’s chat</p>}
      <div className="mb-2 flex items-center gap-2">
        <Segmented value={internal ? 'Internal note' : 'Reply'} options={['Reply', 'Internal note'] as const} onChange={(v) => setInternal(v === 'Internal note')} />
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="ghost"><MessageSquareText className="mr-1 h-4 w-4" />Saved replies</Button></PopoverTrigger>
          <PopoverContent className="max-h-72 w-80 overflow-y-auto p-1">
            {macros.length === 0 ? <p className="p-3 text-sm text-muted-foreground">None yet — add some under Saved replies.</p> : macros.map((m) => (
              <button key={m.id} onClick={() => setBody((b) => (b ? b + '\n\n' : '') + m.body.replaceAll('{name}', first))} className="block w-full rounded-md px-3 py-2 text-left hover:bg-secondary">
                <p className="text-sm font-medium">{m.title}</p><p className="truncate text-xs text-muted-foreground">{m.body}</p>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={internal ? 'Only staff can see this note' : `Reply to ${first}… (⌘/Ctrl + Enter to send)`}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) go(); }} />
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {!internal && <Button size="sm" variant="outline" disabled={!body.trim() || busy} onClick={() => go('Resolved')}>Send & resolve</Button>}
        <Button size="sm" disabled={!body.trim() || busy} onClick={() => go()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : internal ? <Lock className="mr-1 h-4 w-4" /> : <Send className="mr-1 h-4 w-4" />}{internal ? 'Add note' : 'Send'}</Button>
      </div>
    </div>
  );
}

function Details({ t, th, update }: { t: T; th: NonNullable<D['thread']>; update: (u: Upd) => void }) {
  const row = (l: string, c: React.ReactNode) => <div className="space-y-1"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{l}</p>{c}</div>;
  return (
    <div className="space-y-4 p-4">
      {row('Status', <Select value={t.status} onValueChange={(v) => update({ status: v as Upd['status'] })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{['Open', 'Pending', 'Resolved', 'Closed'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>)}
      {(th.rating != null || th.awaitingRating) && row('Rating', th.rating != null
        ? <p className="flex items-center gap-1 text-sm font-medium"><Star className="h-3.5 w-3.5 fill-current text-amber-500" />{th.rating} / 5<span className="ml-1 text-xs font-normal text-muted-foreground">{th.ratedAt ? ago(th.ratedAt) : ''}</span></p>
        : <p className="text-sm text-muted-foreground">Waiting for the customer to rate</p>)}
      {row('Priority', <Select value={t.priority} onValueChange={(v) => update({ priority: v as Upd['priority'] })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{['Low', 'Normal', 'High', 'Urgent'].map((s) => <SelectItem key={s} value={s}>{s} · {SLA_H[s]}h SLA</SelectItem>)}</SelectContent></Select>)}
      {row('Category', <Select value={t.category} onValueChange={(v) => update({ category: v as Upd['category'] })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{['Account', 'Bug', 'Abuse', 'Billing', 'Feature request', 'Other'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>)}
      {row('Assignee', <div className="flex items-center gap-2 text-sm"><span className="flex-1 truncate">{t.assignee || <span className="text-muted-foreground">Unassigned</span>}</span>
        <Button size="sm" variant="outline" className="h-7" onClick={() => update({ assignToMe: true })}>Take</Button>{t.assignee && <Button size="sm" variant="ghost" className="h-7" onClick={() => update({ unassign: true })}>Clear</Button>}</div>)}
      {row('Tags', <div className="flex flex-wrap gap-1">{TAGS.map((g) => { const on = t.tags.includes(g); return <button key={g} onClick={() => update({ tags: (on ? t.tags.filter((x) => x !== g) : [...t.tags, g]) as Upd['tags'] })} className={cn('rounded-md border px-1.5 py-0.5 text-[11px]', on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>{g}</button>; })}</div>)}
      <div className="space-y-1 border-t border-border pt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Customer</p>
        <p className="text-sm font-medium">{t.requesterName}</p>
        <p className="break-all text-xs text-muted-foreground">{t.requesterEmail}</p>
        <div className="flex items-center gap-2 pt-1 text-xs"><Pill v={th.requesterStanding} /><span className="text-muted-foreground">joined {ago(th.requesterJoined)}</span></div>
        {t.requesterId && <Link to={`/support/users/${t.requesterId}`} className="inline-flex items-center gap-1 pt-1 text-xs text-primary hover:underline"><User className="h-3 w-3" />Open moderation profile</Link>}
      </div>
      <div className="space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>Opened {ago(t.createdAt)}</p><p>First response: {t.firstResponseAt ? ago(t.firstResponseAt) : 'not yet'}</p>
      </div>
      {th.otherTickets.length > 0 && <div className="space-y-1 border-t border-border pt-4"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Other requests</p>
        {th.otherTickets.map((o) => <Link key={o.id} to={`/support/tickets?t=${o.id}`} className="flex items-center gap-2 rounded-md py-1 text-xs hover:underline"><Pill v={o.status} /><span className="truncate">{o.subject}</span></Link>)}</div>}
    </div>
  );
}

export default function Support() {
  const [params, setParams] = useSearchParams();
  const open = params.get('t');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('Active');
  const [view, setView] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [q, setQ] = useState('');
  const [dq] = useDebounce(q, 300);
  const [d, setD] = useState<D | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [macros, setMacros] = useState<ModCannedRepliesOutputType['replies']>([]);
  const call = useCallback((extra: Partial<ModTicketsInputType> = {}) => modTickets({ status, view, search: dq, ticketId: open ?? undefined, ...extra }).then(setD), [status, view, dq, open]);
  useEffect(() => { call(); const i = setInterval(() => { if (!document.hidden) call(); }, open ? 5_000 : 30_000); return () => clearInterval(i); }, [call]);
  useEffect(() => { modCannedReplies({}).then((r) => setMacros(r.replies)); }, []);
  const cur = d?.tickets.find((t) => t.id === open) ?? null;
  const th = d?.thread && d.thread.id === open ? d.thread : null;
  const pick = (id: string | null) => setParams(id ? { t: id } : {});

  const update = async (u: Upd) => { try { await call({ update: u }); toast.success('Updated'); } catch (e) { toast.error(errorMessage(e, 'Update failed')); } };
  const send = async (body: string, internal: boolean, setStatus?: 'Resolved' | 'Pending') => { try { await call({ reply: { body, internal, setStatus } }); toast.success(internal ? 'Note added' : 'Reply sent'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t send')); throw new Error(); } };
  const closeChat = async () => { try { await call({ close: true }); toast.success('Ticket closed — asked the customer for a rating'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t close')); } };
  const bulk = async (b: { status?: 'Resolved' | 'Closed'; assignToMe?: boolean }) => { try { await call({ bulk: { ids: sel, ...b } }); toast.success(`${sel.length} tickets updated`); setSel([]); } catch (e) { toast.error(errorMessage(e, 'Bulk update failed')); } };

  const s = d?.stats;
  return (
    <div className="flex h-full min-h-0">
      {/* List */}
      <div className={cn('flex w-full shrink-0 flex-col border-r border-border bg-card md:w-[340px]', open && 'hidden md:flex')}>
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex gap-1 text-xs">
            {([['all', 'All', s?.active], ['mine', 'Mine', s?.mine], ['unassigned', 'Unassigned', s?.unassigned]] as const).map(([k, l, n]) => (
              <button key={k} onClick={() => setView(k)} className={cn('flex-1 rounded-md px-2 py-1.5', view === k ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground')}>{l} <span className="font-mono">{n ?? ''}</span></button>
            ))}
          </div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, name, email" className={`${input} w-full pl-8`} /></div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x === 'Active' ? 'Open + Pending' : x}</SelectItem>)}</SelectContent></Select>
          {s && <div className="flex gap-3 text-[11px] text-muted-foreground"><span className={s.breaching ? 'text-destructive' : ''}>{s.breaching} breaching SLA</span><span>avg 1st reply {s.avgFirstResponseHrs ?? '—'}h</span><span>{s.resolved7d} solved 7d</span></div>}
        </div>
        {sel.length > 0 && <div className="flex items-center gap-1.5 border-b border-border bg-accent px-3 py-2 text-xs"><span className="mr-auto font-medium">{sel.length} selected</span>
          <Button size="sm" variant="outline" className="h-7" onClick={() => bulk({ assignToMe: true })}><UserCheck className="mr-1 h-3 w-3" />Take</Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => bulk({ status: 'Resolved' })}>Resolve</Button>
          <Button size="sm" variant="outline" className="h-7" onClick={() => bulk({ status: 'Closed' })}>Close</Button></div>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!d ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="m-3 h-16" />) : d.tickets.length === 0 ? <Empty><Inbox className="mb-2 h-6 w-6" />Inbox zero.</Empty> : d.tickets.map((t) => (
            <TicketRow key={t.id} t={t} active={t.id === open} checked={sel.includes(t.id)} onCheck={(v) => setSel((x) => (v ? [...x, t.id] : x.filter((y) => y !== t.id)))} onOpen={() => pick(t.id)} />
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className={cn('flex min-w-0 flex-1 flex-col', !open && 'hidden md:flex')}>
        {!open ? <Empty><Inbox className="mb-2 h-8 w-8" />Pick a ticket to start helping.</Empty> : !cur || !th ? <div className="p-6"><Skeleton className="h-64" /></div> : <>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <button onClick={() => pick(null)} className="md:hidden"><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{cur.subject}</p><p className="text-xs text-muted-foreground">{cur.requesterName} · {cur.requesterEmail}</p></div>
            {th.liveChat && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Live chat</span>}
            <Pill v={cur.status} /><Pill v={cur.priority} />
            {cur.status !== 'Resolved' && cur.status !== 'Closed' && <Button size="sm" variant="outline" onClick={() => update({ status: 'Resolved' })}>Resolve</Button>}
            {th.liveChat && cur.status !== 'Closed' && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Close ticket</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Close this ticket?</AlertDialogTitle>
                    <AlertDialogDescription>Support asks {cur.requesterName} “How did we do?”. Once they rate (or after 24 hours), the full chat is saved to this ticket and removed from their list.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={closeChat} className="bg-destructive text-destructive-foreground">Close ticket</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background p-4">
            {th.replies.map((r) => (
              <div key={r.id} className={cn('max-w-[80%] rounded-xl px-4 py-2.5 text-sm', r.internal ? 'mx-auto max-w-[90%] border border-dashed border-amber-500/50 bg-amber-500/10' : r.fromStaff ? 'ml-auto bg-primary text-primary-foreground' : 'border border-border bg-card')}>
                <p className="mb-1 flex items-center gap-1 text-[11px] opacity-75">{r.internal && <Lock className="h-3 w-3" />}{r.author}{r.internal && ' · internal note'} · {ago(r.createdAt)}</p>
                {r.body && <p className="whitespace-pre-wrap break-words">{r.body}</p>}
                {r.images.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{r.images.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" title="Open full size"><img src={u} alt="Attached screenshot" className="h-32 max-w-[12rem] rounded-lg border border-border object-cover transition-opacity hover:opacity-90" /></a>
                ))}</div>}
              </div>
            ))}
            {th.transcript && <details className="rounded-xl border border-border bg-card p-3 text-xs"><summary className="cursor-pointer font-medium">Saved chat transcript</summary><pre className="mt-2 whitespace-pre-wrap font-mono text-muted-foreground">{th.transcript}</pre></details>}
            {th.replies.length === 0 && <div className="rounded-xl border border-border bg-card p-4 text-sm">{th.description}</div>}
          </div>
          {cur.status === 'Closed' && !th.liveChat ? <p className="border-t border-border p-4 text-center text-sm text-muted-foreground">This ticket is closed and its chat was deleted for the customer.</p> : <Composer key={cur.id} t={cur} live={th.liveChat} macros={macros} send={send} />}
        </>}
      </div>

      {/* Details */}
      {cur && th && <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-card xl:block"><Details t={cur} th={th} update={update} /></aside>}
    </div>
  );
}
