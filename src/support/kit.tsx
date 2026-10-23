import { cn } from '@project/components/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export const ago = (d: string | null) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—');
export const input = 'h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40';

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-card px-6 py-5">
      <div><h1 className="text-xl font-semibold tracking-tight">{title}</h1>{desc && <p className="text-sm text-muted-foreground">{desc}</p>}</div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const G = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
const A = 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
const R = 'bg-destructive/15 text-destructive';
const N = 'bg-secondary text-muted-foreground';
const TONES: Record<string, string> = {
  Open: 'bg-accent text-accent-foreground', Pending: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', Resolved: G, Dismissed: N, Closed: N,
  Good: G, Suspended: A, Banned: R, Urgent: 'bg-destructive text-destructive-foreground', High: R, Normal: 'bg-secondary text-foreground', Low: N,
  Warn: A, Suspend: A, Ban: R, Lift: G, Note: 'bg-secondary text-foreground',
};
export function Pill({ v, className }: { v: string; className?: string }) {
  return <span className={cn('inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', TONES[v] ?? 'bg-secondary', className)}>{v}</span>;
}

export function Segmented<const T extends string>({ value, options, onChange }: { value: NoInfer<T>; options: readonly T[]; onChange: (v: NoInfer<T>) => void }) {
  return (
    <div className="flex rounded-lg bg-secondary p-0.5 text-sm">
      {options.map((o) => <button key={o} onClick={() => onChange(o)} className={cn('rounded-md px-2.5 py-1', value === o ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}>{o}</button>)}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-mono text-2xl font-medium', tone === 'warn' && 'text-destructive')}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid place-items-center px-6 py-16 text-center text-sm text-muted-foreground">{children}</div>;
}
