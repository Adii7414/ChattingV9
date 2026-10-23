import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import { communityVerification, type CommunityVerificationOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Textarea } from '@project/components/ui/textarea';
import { Verified } from '../official';
import { errorMessage } from '../../lib/errors';
import { SaveButton, Section, useRun, type TabProps } from './kit';

type V = CommunityVerificationOutputType;

export default function VerificationTab({ d, reload }: TabProps) {
  const [v, setV] = useState<V | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => communityVerification({ communityId: d.id, action: 'status' }).then((r) => { setV(r); setErr(null); }).catch((e) => setErr(errorMessage(e, 'Couldn’t load verification status'))), [d.id]);
  useEffect(() => { load(); }, [load]);
  const { busy, run } = useRun(async () => { await Promise.all([load(), reload()]); });

  if (err) return <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">{err}</p>;
  if (!v) return <Skeleton className="h-80 rounded-3xl" />;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
        <Verified community className="h-10 w-10" />
        <div className="min-w-0">
          <p className="font-semibold">Get the gold check</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Verified communities show a gold badge next to their name and rank higher in Discover. It tells people your community is authentic, active and well-run.</p>
        </div>
      </div>
      <StatusCard v={v} />
      <Section title="Requirements" desc="Your community needs to meet all of these to apply.">
        <ul className="divide-y divide-border">
          {v.criteria.map((c) => (
            <li key={c.key} className="flex items-center gap-3 py-2.5 text-sm">
              {c.met ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="flex-1">{c.label}</span><span className="text-xs text-muted-foreground">{c.detail}</span>
            </li>
          ))}
        </ul>
      </Section>
      {v.isOwner && (v.status === 'None' || v.status === 'Rejected') && (
        <Section title="Apply for verification" desc="Tell us about your community — what it’s for and who runs it. Our team usually reviews within a few days.">
          <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000} rows={4} placeholder="e.g. The official community for… run by…" />
          <SaveButton busy={busy === 'apply'} onClick={() => v.eligible && run('apply', () => communityVerification({ communityId: d.id, action: 'apply', message: msg }), 'Application sent')} className={v.eligible ? '' : 'pointer-events-none opacity-50'}>
            {v.eligible ? 'Submit application' : 'Meet all requirements to apply'}
          </SaveButton>
        </Section>
      )}
      {v.isOwner && v.status === 'Pending' && <SaveButton busy={busy === 'withdraw'} onClick={() => run('withdraw', () => communityVerification({ communityId: d.id, action: 'withdraw' }), 'Application withdrawn')} className="bg-secondary text-foreground">Withdraw application</SaveButton>}
      {!v.isOwner && v.status !== 'Verified' && <p className="text-sm text-muted-foreground">Only the community owner can apply for verification.</p>}
    </div>
  );
}

function StatusCard({ v }: { v: V }) {
  if (v.status === 'Verified') return <Banner icon={<Verified community className="h-5 w-5" />} title="This community is verified" body={v.verifiedAt ? `Verified on ${new Date(v.verifiedAt).toLocaleDateString()}.` : ''} />;
  if (v.status === 'Pending') return <Banner icon={<Clock className="h-5 w-5 text-[hsl(var(--verified-community))]" />} title="Application under review" body={v.requestedAt ? `Submitted ${new Date(v.requestedAt).toLocaleDateString()}. We’ll message you from the Chatting account when it’s decided.` : ''} />;
  if (v.status === 'Rejected') return <Banner icon={<XCircle className="h-5 w-5 text-destructive" />} title="Last application wasn’t approved" body={v.decisionNote ? `Note from our team: ${v.decisionNote}` : 'You can apply again once you meet the requirements.'} />;
  return null;
}

const Banner = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/50 p-4 text-sm">{icon}<div><p className="font-medium">{title}</p>{body && <p className="mt-0.5 text-muted-foreground">{body}</p>}</div></div>
);
