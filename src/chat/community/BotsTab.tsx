import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, KeyRound, Plus, Trash2, BookOpen, Loader2 } from 'lucide-react';
import { manageBots, type ManageBotsOutputType } from 'zitejs/api';
import { Switch } from '@project/components/ui/switch';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { cn } from '@project/components/lib/utils';
import { BOT_KINDS, type BotKind } from '../../lib/bots';
import { BotAvatar, BotBadge } from '../BotMessage';
import { errorMessage } from '../../lib/errors';
import { Section, type TabProps } from './kit';
import BotEditor from './BotEditor';

export type BotRow = ManageBotsOutputType['bots'][number];
type Patch = Parameters<typeof manageBots>[0]['patch'];

export default function BotsTab({ d }: TabProps) {
  const [bots, setBots] = useState<BotRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<BotRow | null>(null);

  const call = async (key: string, args: Omit<Parameters<typeof manageBots>[0], 'communityId'>, ok?: string) => {
    setBusy(key);
    try {
      const r = await manageBots({ communityId: d.id, ...args });
      setBots(r.bots);
      if (r.token) setToken(r.token);
      if (ok) toast.success(ok);
      return r;
    } catch (e) { toast.error(errorMessage(e, 'Something went wrong')); return null; } finally { setBusy(null); }
  };
  useEffect(() => { call('load', { action: 'list' }); }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (kind: BotKind) => {
    const r = await call(`add-${kind}`, { action: 'create', kind }, 'Bot added');
    if (r) { setAdding(false); const b = r.bots.find((x) => x.kind === kind && !bots?.some((y) => y.id === x.id)); if (b) setOpen(b.id); }
  };
  const save = (b: BotRow, patch: Patch) => call(`save-${b.id}`, { action: 'update', botId: b.id, patch }, 'Saved');
  const taken = new Set((bots ?? []).filter((b) => b.kind !== 'Custom').map((b) => b.kind));

  return (
    <div className="space-y-5">
      <Section title="Bots" desc="Bots join your community like members, wear a BOT badge, and can only do what you allow.">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAdding(true)} className="focus-ring flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Add bot</button>
          <Link to="/developers" className="focus-ring flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"><BookOpen className="h-4 w-4" /> Developer docs</Link>
        </div>
        {!bots ? <Skeleton className="h-24 rounded-2xl" /> : !bots.length ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No bots yet. Add a ready-made one, or create a custom bot and connect your own code.</p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {bots.map((b) => (
              <div key={b.id}>
                <div className="flex items-center gap-3 p-3">
                  <BotAvatar name={b.name} avatar={b.avatar || BOT_KINDS.find((k) => k.kind === b.kind)?.emoji} size={40} />
                  <button onClick={() => setOpen(open === b.id ? null : b.id)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-1.5 font-medium">{b.name}<BotBadge /><span className="text-xs font-normal text-muted-foreground">{b.kind}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{b.description || '—'}{b.kind === 'Custom' && ` · ${b.apiCalls} API calls${b.lastActiveAt ? ` · active ${new Date(b.lastActiveAt).toLocaleString()}` : ''}`}</p>
                  </button>
                  <Switch checked={b.enabled} onCheckedChange={(v) => save(b, { enabled: v })} aria-label="Enabled" />
                  <button onClick={() => setRemoving(b)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove bot"><Trash2 className="h-4 w-4" /></button>
                </div>
                {open === b.id && (
                  <div className="border-t border-border bg-secondary/30 p-4">
                    <BotEditor b={b} d={d} busy={busy === `save-${b.id}`} onSave={(p) => save(b, p)}
                      onRotate={() => call(`rot-${b.id}`, { action: 'rotateToken', botId: b.id }, 'New key created — the old one stopped working')}
                      onRotateSecret={() => call(`sec-${b.id}`, { action: 'rotateSecret', botId: b.id }, 'New signing secret created')} rotating={busy === `rot-${b.id}` || busy === `sec-${b.id}`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add a bot</DialogTitle><DialogDescription>Ready-made bots work instantly. Custom bots get an API key for your own code.</DialogDescription></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOT_KINDS.map((k) => {
              const used = k.kind !== 'Custom' && taken.has(k.kind);
              return (
                <button key={k.kind} disabled={used || !!busy} onClick={() => add(k.kind)} className={cn('flex items-start gap-3 rounded-2xl border border-border p-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-50')}>
                  <span className="text-2xl">{k.emoji}</span>
                  <span className="min-w-0"><span className="block text-sm font-semibold">{k.name}{used && ' · added'}</span><span className="block text-xs text-muted-foreground">{k.blurb}</span></span>
                  {busy === `add-${k.kind}` && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!token} onOpenChange={(o) => !o && setToken(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Your bot’s API key</DialogTitle>
            <DialogDescription>Copy it now — for security it’s shown only once. Anyone with this key can act as your bot.</DialogDescription></DialogHeader>
          <code className="block break-all rounded-xl bg-secondary p-3 font-mono text-xs">{token}</code>
          <button onClick={() => { navigator.clipboard.writeText(token ?? ''); toast.success('Copied'); }} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground"><Copy className="h-4 w-4" /> Copy key</button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
          <AlertDialogDescription>The bot leaves the community and its API key stops working. Messages it already posted stay.</AlertDialogDescription>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && call(`del-${removing.id}`, { action: 'delete', botId: removing.id }, 'Bot removed')} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

