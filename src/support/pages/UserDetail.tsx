import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Crown, Loader2, Trash2 } from 'lucide-react';
import { modUserDetail, type ModUserDetailInputType, type ModUserDetailOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@project/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Empty, Pill, Segmented, ago, input } from '../kit';
import { errorMessage } from '../../lib/errors';
import AccountTools from './AccountTools';

type Act = NonNullable<ModUserDetailInputType['act']>['action'];
const ACTIONS: readonly Act[] = ['Warn', 'Suspend', 'Ban', 'Lift', 'Note'];

function ActionPanel({ standing, run }: { standing: string; run: (a: NonNullable<ModUserDetailInputType['act']>) => Promise<void> }) {
  const [action, setAction] = useState<Act>('Warn');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const go = async () => { setBusy(true); try { await run({ action, reason: reason.trim(), days: action === 'Suspend' ? days : undefined }); setReason(''); } finally { setBusy(false); } };
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">Take action</p>
      <Segmented value={action} options={standing === 'Good' ? ACTIONS.filter((a) => a !== 'Lift') : ACTIONS} onChange={setAction} />
      {action === 'Suspend' && <label className="flex items-center gap-2 text-sm">For <input type="number" min={0} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${input} w-20`} /> days <span className="text-xs text-muted-foreground">(0 = until lifted)</span></label>}
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={action === 'Note' ? 'Private note for staff' : 'Reason (recorded in the log)'} />
      <Button disabled={reason.trim().length < 3 || busy} variant={action === 'Ban' ? 'destructive' : 'default'} onClick={() => (action === 'Ban' || action === 'Suspend' ? setConfirm(true) : go())} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{action === 'Lift' ? 'Lift restrictions' : action === 'Note' ? 'Add note' : action}</Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{action} this user?</AlertDialogTitle><AlertDialogDescription>{action === 'Ban' ? 'They won’t be able to send any messages until a staff member lifts the ban.' : `They won’t be able to send messages ${days ? `for ${days} days` : 'until lifted'}.`}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={go}>Confirm</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function UserDetail() {
  const { userId = '' } = useParams();
  const [d, setD] = useState<ModUserDetailOutputType | null>(null);
  const [err, setErr] = useState(false);
  const call = useCallback((extra: Partial<ModUserDetailInputType> = {}) => modUserDetail({ userId, ...extra }).then(setD), [userId]);
  useEffect(() => { setD(null); call().catch(() => setErr(true)); }, [call]);
  if (err) return <Empty>User not found. <Link to="/support/users" className="underline">Back to users</Link></Empty>;
  if (!d) return <div className="space-y-4 p-6"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
  const u = d.user;
  const run = async (act: NonNullable<ModUserDetailInputType['act']>) => { try { await call({ act }); toast.success('Action recorded'); } catch (e) { toast.error(errorMessage(e, 'Action failed')); } };
  const del = async (id: string) => { setD({ ...d, messages: d.messages.filter((m) => m.id !== id) }); try { await call({ deleteMessageId: id }); toast.success('Message deleted'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t delete')); call(); } };

  return (
    <div>
      <div className="border-b border-border bg-card px-6 py-5">
        <Link to="/support/users" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Users</Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar className="h-14 w-14"><AvatarImage src={u.image ?? undefined} /><AvatarFallback>{u.name[0]}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{u.name}</h1><Pill v={u.standing} />{u.standingUntil && <span className="text-xs text-muted-foreground">until {new Date(u.standingUntil).toLocaleString()}</span>}</div>
            <p className="text-sm text-muted-foreground">{u.email} · joined {ago(u.joinedAt)} · last seen {ago(u.lastSeenAt)}</p>
            {(u.status || u.bio) && <p className="mt-1 text-sm">{u.status} {u.bio && <span className="text-muted-foreground">— {u.bio}</span>}</p>}
          </div>
        </div>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <Tabs defaultValue="messages">
          <TabsList><TabsTrigger value="messages">Messages ({d.messages.length})</TabsTrigger><TabsTrigger value="reports">Reports ({d.reports.length})</TabsTrigger><TabsTrigger value="history">History ({d.actions.length})</TabsTrigger><TabsTrigger value="communities">Communities ({d.communities.length})</TabsTrigger></TabsList>
          <TabsContent value="messages" className="rounded-xl border border-border bg-card">
            {d.messages.length === 0 ? <Empty>No messages</Empty> : d.messages.map((m) => (
              <div key={m.id} className="group flex gap-3 border-b border-border px-4 py-2.5 last:border-0">
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{m.where} · {ago(m.createdAt)}</p><p className="whitespace-pre-wrap break-words text-sm">{m.body || <i className="text-muted-foreground">(attachment)</i>}</p></div>
                <button onClick={() => del(m.id)} title="Delete message" className="self-start rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="reports" className="rounded-xl border border-border bg-card">
            {d.reports.length === 0 ? <Empty>No reports against this user</Empty> : d.reports.map((r) => (
              <div key={r.id} className="border-b border-border px-4 py-2.5 last:border-0"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Pill v={r.status} />{ago(r.createdAt)}</div><p className="mt-1 text-sm">“{r.messageBody}”</p>{r.reason && <p className="text-xs text-muted-foreground">Reason: {r.reason}</p>}</div>
            ))}
          </TabsContent>
          <TabsContent value="history" className="rounded-xl border border-border bg-card">
            {d.actions.length === 0 ? <Empty>Clean record</Empty> : d.actions.map((a) => (
              <div key={a.id} className="border-b border-border px-4 py-2.5 last:border-0"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Pill v={a.action} />{a.staff} · {ago(a.createdAt)}{a.expiresAt && ` · expires ${new Date(a.expiresAt).toLocaleDateString()}`}</div><p className="mt-1 text-sm">{a.reason}</p></div>
            ))}
          </TabsContent>
          <TabsContent value="communities" className="rounded-xl border border-border bg-card">
            {d.communities.length === 0 ? <Empty>Not in any communities</Empty> : d.communities.map((c) => (
              <div key={c.id} className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-0">{c.emoji || '🏠'} {c.name}{c.isOwner && <span className="ml-auto flex items-center gap-1 text-xs text-primary"><Crown className="h-3 w-3" />Owner</span>}</div>
            ))}
          </TabsContent>
        </Tabs>
        <ActionPanel standing={u.standing} run={run} />
      </div>
      <div className="px-6 pb-10"><h2 className="mb-3 text-lg font-semibold tracking-tight">Account</h2><AccountTools userId={userId} /></div>
    </div>
  );
}
