import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Menu, Search, X } from 'lucide-react';
import { developerInfo } from 'zitejs/api';
import { cn } from '@project/components/lib/utils';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { Auth, Events, Intro, Objects, Quickstart, ReadyMade, Recipes } from '../developers/Guides';
import { C, Code, H2, P, Table } from '../developers/kit';
import { GROUPS, OPS, type Op } from '../developers/reference';

const NAV: { title: string; items: [string, string][] }[] = [
  { title: 'Getting started', items: [['introduction', 'Introduction'], ['quickstart', 'Quickstart'], ['authentication', 'Authentication'], ['errors', 'Errors'], ['limits', 'Rate limits'], ['permissions', 'Permissions']] },
  { title: 'Concepts', items: [['objects', 'Messages'], ['obj-embed', 'Embeds'], ['obj-components', 'Buttons & dropdowns'], ['builtin-components', 'Built-in ids'], ['events', 'Events'], ['signatures', 'Signatures'], ['polling', 'Polling']] },
  { title: 'API reference', items: GROUPS.map((g) => [`ref-${g.toLowerCase().replace(/[^a-z]+/g, '-')}`, g]) },
  { title: 'Guides', items: [['ready-made', 'Ready-made bots'], ['recipe-roles', 'Role picker'], ['recipe-commands', 'Commands'], ['recipe-buttons', 'Button flows'], ['recipe-github', 'GitHub feed'], ['recipe-mod', 'Moderation'], ['recipe-digest', 'Scheduled posts'], ['more-ideas', 'More ideas']] },
];

const opId = (op: string) => `op-${op.replace(/\./g, '-')}`;

function OpCard({ o }: { o: Op }) {
  return (
    <div id={opId(o.op)} className="mt-6 scroll-mt-24 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold text-primary">{o.op}</span>
        {o.perm && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">needs {o.perm}</span>}
      </div>
      <p className="mt-2 font-medium">{o.summary}</p>
      {o.desc && <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>}
      {o.params.length > 0 && <Table head={['param', 'type', '']} rows={o.params.map((p) => [<span key="n" className="font-mono text-xs">{p.name}{p.required && <span className="text-destructive">*</span>}</span>, <span key="t" className="font-mono text-xs text-muted-foreground">{p.type}</span>, p.desc])} />}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Code lang="request" code={JSON.stringify({ token: 'cb_…', op: o.op, params: o.example }, null, 2)} />
        <Code lang="data" code={JSON.stringify(o.response, null, 2)} />
      </div>
    </div>
  );
}

export default function Developers() {
  const [url, setUrl] = useState('https://YOUR-APP/public/…/webhooks/botApi/…');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('introduction');
  useEffect(() => { document.title = 'Chatting Developers — Bot API'; developerInfo({}).then((r) => r.apiUrl && setUrl(r.apiUrl)).catch(() => {}); }, []);
  useEffect(() => {
    const ids = NAV.flatMap((n) => n.items.map(([id]) => id));
    const obs = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); }, { rootMargin: '-80px 0px -70% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  const hits = useMemo(() => (q.trim() ? OPS.filter((o) => `${o.op} ${o.summary} ${o.group}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []), [q]);
  const go = (id: string) => { setOpen(false); setQ(''); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  const nav = (
    <nav className="space-y-6 text-sm">
      {NAV.map((n) => (
        <div key={n.title}>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{n.title}</p>
          {n.items.map(([id, l]) => <button key={id} onClick={() => go(id)} className={cn('block w-full rounded-lg px-2 py-1.5 text-left transition', active === id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}>{l}</button>)}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-lg lg:hidden" aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <Link to="/" aria-label="Chatting home"><Logo /></Link>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">Developers</span>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ops…" className="focus-ring h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none" />
            {!!hits.length && (
              <div className="absolute inset-x-0 top-11 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {hits.map((o) => <button key={o.op} onClick={() => go(opId(o.op))} className="block w-full px-3 py-2 text-left hover:bg-secondary"><span className="font-mono text-xs text-primary">{o.op}</span><span className="block text-xs text-muted-foreground">{o.summary}</span></button>)}
              </div>
            )}
          </div>
          <ThemeToggle />
          <Link to="/app" className="hidden h-9 items-center rounded-lg bg-foreground px-3 text-sm font-medium text-background sm:flex">Open Chatting</Link>
        </div>
      </header>
      {open && <div className="fixed inset-x-0 bottom-0 top-14 z-30 overflow-y-auto bg-background p-4 lg:hidden">{nav}</div>}
      <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto py-8 lg:block">{nav}</aside>
        <main className="min-w-0 max-w-3xl flex-1 space-y-2 py-10 pb-32">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> chatting home</Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Bot API</h1>
          <p className="mt-3 text-lg text-muted-foreground">Build bots that post, react, moderate and respond to buttons in Chatting communities.</p>
          <div className="pt-6" />
          <Intro url={url} />
          <Quickstart url={url} />
          <Auth />
          <Objects />
          <Events />
          <H2 id="reference">API reference</H2>
          <P>Every op below is called the same way: <C>{'{ token, op, params }'}</C>. Fields marked <span className="text-destructive">*</span> are required.</P>
          {GROUPS.map((g) => (
            <section key={g} id={`ref-${g.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="scroll-mt-24 pt-6">
              <h3 className="text-lg font-semibold tracking-tight">{g}</h3>
              {OPS.filter((o) => o.group === g).map((o) => <OpCard key={o.op} o={o} />)}
            </section>
          ))}
          <ReadyMade />
          <Recipes url={url} />
          <H2 id="changelog">Changelog</H2>
          <Table head={['date', 'change']} rows={[['Oct 2026', 'Bot API v1: 29 ops, signed webhooks, polling, embeds, buttons, dropdowns, giveaways and reminders.']]} />
        </main>
      </div>
    </div>
  );
}
