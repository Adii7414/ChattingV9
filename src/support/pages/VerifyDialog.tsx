import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { modCommunities, type ModCommunitiesOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { Verified } from '../../chat/official';
import { errorMessage } from '../../lib/errors';

type C = ModCommunitiesOutputType['communities'][number];
type Crit = NonNullable<ModCommunitiesOutputType['criteria']>;

/** Staff review of a community's verification request (or revoking an existing badge). */
export default function VerifyDialog({ c, onClose, onDone }: { c: C | null; onClose: () => void; onDone: () => void }) {
  const [crit, setCrit] = useState<Crit | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!c) return;
    setCrit(null); setNote('');
    modCommunities({ search: c.name, criteriaFor: c.id }).then((r) => setCrit(r.criteria ?? [])).catch((e) => { setCrit([]); toast.error(errorMessage(e, 'Couldn’t load the requirements')); });
  }, [c]);

  const unmet = crit ? crit.filter((x) => !x.met).length : 0;
  const decide = async (decision: 'approve' | 'manual' | 'reject' | 'revoke') => {
    if (!c) return;
    if (decision !== 'approve' && note.trim().length < 3) return toast.error(decision === 'manual' ? 'Add an internal reason for the manual verification — it goes in the audit log.' : 'Add a short note so the owner knows why.');
    setBusy(decision);
    try {
      await modCommunities({ decide: { id: c.id, decision, note } });
      toast.success(decision === 'approve' || decision === 'manual' ? `${c.name} is now verified` : decision === 'reject' ? 'Application rejected' : 'Badge removed');
      onDone();
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t save the decision')); } finally { setBusy(null); }
  };
  const btn = 'inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium disabled:opacity-50';

  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{c?.emoji} {c?.name} {c?.verificationStatus === 'Verified' && <Verified community />}</DialogTitle>
          <DialogDescription>{c?.verificationStatus === 'Pending' ? `Verification request from ${c.owner}${c.requestedAt ? ` · ${new Date(c.requestedAt).toLocaleDateString()}` : ''}` : c?.verificationStatus === 'Verified' ? 'This community is verified.' : 'Not verified. Staff can verify it manually, even if it doesn’t meet every requirement.'}</DialogDescription>
        </DialogHeader>
        {c?.application && <p className="whitespace-pre-wrap rounded-xl bg-secondary p-3 text-sm">{c.application}</p>}
        <div className="rounded-xl border border-border">
          {!crit ? <Skeleton className="h-40" /> : crit.map((x) => (
            <div key={x.key} className="flex items-center gap-2.5 border-b border-border px-3 py-2 text-sm last:border-0">
              {x.met ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-destructive" />}
              <span className="flex-1">{x.label}</span><span className="text-xs text-muted-foreground">{x.detail}</span>
            </div>
          ))}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder={c?.verificationStatus === 'Pending' ? (unmet ? 'Note (required to reject or to override unmet requirements)' : 'Note to the owner (required to reject)') : c?.verificationStatus === 'Verified' ? 'Reason for removing the badge' : 'Why are you verifying this manually? (required, logged)'} />
        <div className="flex justify-end gap-2">
          {c?.verificationStatus === 'Pending' ? (<>
            <button disabled={!!busy} onClick={() => decide('reject')} className={`${btn} border border-border`}>{busy === 'reject' && <Loader2 className="h-4 w-4 animate-spin" />}Reject</button>
            <button disabled={!!busy || !crit} onClick={() => decide(unmet ? 'manual' : 'approve')} className={`${btn} bg-[hsl(var(--verified-community))] text-black`}>{(busy === 'approve' || busy === 'manual') && <Loader2 className="h-4 w-4 animate-spin" />}{unmet ? `Verify anyway (${unmet} unmet)` : 'Verify community'}</button>
          </>) : c?.verificationStatus !== 'Verified' ? (
            <button disabled={!!busy || !crit} onClick={() => decide('manual')} className={`${btn} bg-[hsl(var(--verified-community))] text-black`}>{busy === 'manual' && <Loader2 className="h-4 w-4 animate-spin" />}Verify manually{unmet ? ` (${unmet} unmet)` : ''}</button>
          ) : (
            <button disabled={!!busy} onClick={() => decide('revoke')} className={`${btn} bg-destructive text-destructive-foreground`}>{busy === 'revoke' && <Loader2 className="h-4 w-4 animate-spin" />}Remove badge</button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
