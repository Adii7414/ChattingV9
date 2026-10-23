import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Laptop, Loader2, LogOut, Smartphone, Tablet } from 'lucide-react';
import { modAccount, type ModAccountInputType, type ModAccountOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { cn } from '@project/components/lib/utils';
import { Empty, Stat, ago, input } from '../kit';
import { SeverityPill } from './AuditLog';
import { errorMessage } from '../../lib/errors';

const FLAGS = ['VIP', 'Watchlist', 'Identity verified', 'Fraud risk', 'Under 18', 'Press', 'Partner'] as const;
const RESETS = ['bio', 'status', 'avatar', 'banner', 'activity'] as const;
type Act = NonNullable<ModAccountInputType['act']>;
const DevIcon = ({ d }: { d: string }) => (d === 'Phone' ? <Smartphone className="h-4 w-4" /> : d === 'Tablet' ? <Tablet className="h-4 w-4" /> : <Laptop className="h-4 w-4" />);

export default function AccountTools({ userId }: { userId: string }) {
  const [d, setD] = useState<ModAccountOutputType | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [notes, setNotes] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [resets, setResets] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async (act?: Act, ok?: string) => {
    if (act) setBusy(act.type);
    try {
      const r = await modAccount({ userId, act });
      setD(r); setNotes(r.notes); setFirst(r.profile.firstName); setLast(r.profile.lastName);
      if (ok) toast.success(ok);
    } catch (e) { toast.error(errorMessage(e, 'That didn’t work')); } finally { setBusy(null); }
  }, [userId]);
  useEffect(() => { setD(null); load(); }, [load]);
  if (!d) return <Skeleton className="h-64 rounded-xl" />;
  const live = d.sessions.filter((s) => !s.revokedAt);
  const s = d.stats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
        <Stat label="Messages · 24h" value={s.messages24h} /><Stat label="Messages · 7d" value={s.messages7d} /><Stat label="Messages · 30d" value={s.messages30d} />
        <Stat label="All messages" value={s.messagesAll} /><Stat label="Reactions" value={s.reactions} /><Stat label="Active sessions" value={live.length} />
        <Stat label="Communities owned" value={s.communitiesOwned} /><Stat label="Friends" value={s.friends} /><Stat label="DMs" value={s.dms} />
        <Stat label="Reports filed" value={s.reportsFiled} /><Stat label="Reports against" value={s.reportsAgainst} tone={s.reportsAgainst > 2 ? 'warn' : undefined} /><Stat label="Support tickets" value={s.tickets} />
      </div>

      <Tabs defaultValue="sessions">
        <TabsList className="flex-wrap"><TabsTrigger value="sessions">Sessions ({live.length})</TabsTrigger><TabsTrigger value="audit">Audit trail ({d.audit.length})</TabsTrigger><TabsTrigger value="bots">Bots ({d.bots.length})</TabsTrigger><TabsTrigger value="tools">Account tools</TabsTrigger><TabsTrigger value="privacy">Settings</TabsTrigger></TabsList>

        <TabsContent value="sessions" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">{d.forceLogoutAt ? `Last forced sign-out ${ago(d.forceLogoutAt)}` : 'Never force-signed-out'}</span>
            <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => setConfirmAll(true)}>{busy === 'revokeAll' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}Sign out everywhere</Button>
          </div>
          <div className="rounded-xl border border-border bg-card">
            {!d.sessions.length ? <Empty>No sessions recorded yet. They appear the next time this person opens the app.</Empty> : d.sessions.map((x) => (
              <div key={x.key} className={cn('border-b border-border px-4 py-3 last:border-0', x.revokedAt && 'opacity-60')}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary"><DevIcon d={x.device} /></span>
                  <button onClick={() => setOpen(open === x.key ? null : x.key)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-medium">{x.browser} on {x.os} <span className="text-xs font-normal text-muted-foreground">· {x.device}</span></p>
                    <p className="text-xs text-muted-foreground">{x.revokedAt ? `Revoked ${ago(x.revokedAt)} — ${x.revokedReason}` : `Active ${ago(x.lastSeenAt)} · started ${ago(x.startedAt)}`}</p>
                  </button>
                  {!x.revokedAt && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => load({ type: 'revokeSession', sessionKey: x.key }, 'Session signed out')}>Sign out</Button>}
                </div>
                {open === x.key && (
                  <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-lg bg-secondary/50 p-3 text-xs sm:grid-cols-2">
                    {[['Session', x.key], ['Time zone', x.timeZone], ['Language', x.language], ['Screen', x.screen], ['Started', x.startedAt && new Date(x.startedAt).toLocaleString()], ['Last seen', x.lastSeenAt && new Date(x.lastSeenAt).toLocaleString()]].map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">{k}</dt><dd className="break-all font-mono">{v || '—'}</dd></div>)}
                    <div className="sm:col-span-2"><dt className="text-muted-foreground">User agent</dt><dd className="break-all font-mono">{x.userAgent || '—'}</dd></div>
                  </dl>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="rounded-xl border border-border bg-card">
          {!d.audit.length ? <Empty>No audit entries for this account yet</Empty> : d.audit.map((a) => (
            <details key={a.id} className="group border-b border-border px-4 py-2.5 last:border-0">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm"><SeverityPill v={a.severity} /><span className="rounded bg-secondary px-1.5 text-[11px]">{a.category}</span><span className="min-w-0 flex-1 truncate">{a.summary}</span><span className="shrink-0 text-xs text-muted-foreground">{a.actor} · {ago(a.at)}</span></summary>
              <div className="mt-2 space-y-1 text-xs"><p className="font-mono text-muted-foreground">{a.action} · {new Date(a.at).toLocaleString()}</p>{a.details && <pre className="overflow-x-auto rounded-lg bg-secondary p-2 font-mono">{(() => { try { return JSON.stringify(JSON.parse(a.details), null, 2); } catch { return a.details; } })()}</pre>}</div>
            </details>
          ))}
        </TabsContent>

        <TabsContent value="bots" className="rounded-xl border border-border bg-card">
          {!d.bots.length ? <Empty>This account doesn’t own any bots</Empty> : d.bots.map((b) => (
            <div key={b.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
              <div className="min-w-0 flex-1"><p className="font-medium">{b.name} <span className="text-xs font-normal text-muted-foreground">{b.kind} · {b.community}</span></p><p className="text-xs text-muted-foreground">{b.apiCalls} API calls · last active {ago(b.lastActiveAt)}</p></div>
              {b.enabled ? <Button size="sm" variant="outline" disabled={!!busy} onClick={() => load({ type: 'disableBot', botId: b.id }, 'Bot disabled')}>Disable</Button> : <span className="text-xs text-muted-foreground">Disabled</span>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="tools" className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Staff flags</p>
            <div className="flex flex-wrap gap-2">{FLAGS.map((f) => (
              <label key={f} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"><Checkbox checked={d.flags.includes(f)} disabled={!!busy} onCheckedChange={() => load({ type: 'flags', flags: (d.flags.includes(f) ? d.flags.filter((x) => x !== f) : [...d.flags, f]) as typeof FLAGS[number][] }, 'Flags updated')} />{f}</label>
            ))}</div>
            <p className="pt-2 text-sm font-medium">Staff notes</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} placeholder="Private context for other staff" />
            <Button size="sm" disabled={!!busy || notes === d.notes} onClick={() => load({ type: 'notes', notes }, 'Notes saved')}>Save notes</Button>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Display name</p>
            <div className="flex gap-2"><input className={`${input} min-w-0 flex-1`} value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First" /><input className={`${input} min-w-0 flex-1`} value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last" /></div>
            <Button size="sm" variant="outline" disabled={!!busy || !first.trim()} onClick={() => load({ type: 'rename', firstName: first, lastName: last }, 'Name changed')}>Rename</Button>
            <p className="pt-2 text-sm font-medium">Reset profile content</p>
            <div className="flex flex-wrap gap-2">{RESETS.map((r) => <label key={r} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs capitalize"><Checkbox checked={resets.includes(r)} onCheckedChange={() => setResets(resets.includes(r) ? resets.filter((x) => x !== r) : [...resets, r])} />{r}</label>)}</div>
            <Button size="sm" variant="destructive" disabled={!!busy || !resets.length} onClick={() => load({ type: 'resetProfile', fields: resets as typeof RESETS[number][] }, 'Profile reset').then(() => setResets([]))}>Reset selected</Button>
          </div>
        </TabsContent>

        <TabsContent value="privacy" className="rounded-xl border border-border bg-card p-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            {[['Pronouns', d.profile.pronouns || '—'], ['Time zone', d.profile.timeZone || '—'], ['Activity', d.profile.activity || '—'], ['Message requests from', d.profile.messageRequestsFrom], ['Shows online status', d.profile.showOnlineStatus ? 'Yes' : 'No'], ['Sends read receipts', d.profile.sendReadReceipts ? 'Yes' : 'No']].map(([k, v]) => <div key={k} className="flex justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sign this account out everywhere?</AlertDialogTitle><AlertDialogDescription>Every device is signed out within a couple of minutes. They can sign back in with their email unless the account is suspended or banned.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => load({ type: 'revokeAll' }, 'Signed out on every device')}>Sign out everywhere</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
