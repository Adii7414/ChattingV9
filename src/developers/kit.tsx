import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

export function Code({ code, lang, className }: { code: string; lang?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className={cn('group relative overflow-hidden rounded-xl border border-border bg-[hsl(var(--foreground)/0.04)]', className)}>
      {lang && <span className="absolute left-3 top-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{lang}</span>}
      <button onClick={() => { navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1200); }} aria-label="Copy code"
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 focus:opacity-100">
        {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className={cn('overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed', lang && 'pt-7')}><code>{code}</code></pre>
    </div>
  );
}

export function Tabs({ items }: { items: { label: string; lang: string; code: string }[] }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {items.map((t, k) => <button key={t.label} onClick={() => setI(k)} className={cn('-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition', k === i ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t.label}</button>)}
      </div>
      <Code code={items[i].code} lang={items[i].lang} className="mt-2" />
    </div>
  );
}

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-24 border-t border-border pt-10 text-2xl font-semibold tracking-tight first:border-0 first:pt-0">{children}</h2>;
}
export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h3 id={id} className="mt-8 scroll-mt-24 text-lg font-semibold tracking-tight">{children}</h3>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 leading-7 text-muted-foreground">{children}</p>;
}
export function C({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}
export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: React.ReactNode }) {
  return <div className={cn('mt-4 rounded-xl border p-4 text-sm leading-6', tone === 'warn' ? 'border-amber-500/40 bg-amber-500/10' : 'border-primary/30 bg-primary/5')}>{children}</div>;
}
export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
