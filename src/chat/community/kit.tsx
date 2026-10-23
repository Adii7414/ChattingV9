import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@project/components/lib/utils';
import type { GetCommunityOutputType } from 'zitejs/api';
import type { CommunitySettings } from '../../lib/community';
import { errorMessage } from '../../lib/errors';

export type Data = GetCommunityOutputType & { s: CommunitySettings; id: string };
export type TabProps = { d: Data; reload: () => Promise<void> };

export const input = 'focus-ring h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none';

export function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h3 className="font-semibold">{title}</h3>
      {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}</label>;
}

/** Runs an async action with a spinner and toasts. */
export function useRun(reload: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, ok = 'Saved') => {
    setBusy(key);
    try { await fn(); await reload(); toast.success(ok); return true; }
    catch (e) { toast.error(errorMessage(e, 'Something went wrong')); return false; }
    finally { setBusy(null); }
  };
  return { busy, run };
}

export function SaveButton({ busy, onClick, children = 'Save changes', danger, className }: { busy?: boolean; onClick: () => void; children?: React.ReactNode; danger?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={busy} className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-50', danger ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background', className)}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}

/** Comma/Enter separated chips editor. */
export function Chips({ value, onChange, placeholder, max = 50 }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim(); if (v && !value.includes(v) && value.length < max) onChange([...value, v]); setT(''); };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background p-1.5">
      {value.map((v) => <button key={v} type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{v} ✕</button>)}
      <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add} placeholder={placeholder} className="min-w-[8rem] flex-1 bg-transparent px-1.5 text-sm outline-none" />
    </div>
  );
}
