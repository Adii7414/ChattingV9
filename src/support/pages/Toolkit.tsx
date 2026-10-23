import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Loader2, Search } from 'lucide-react';
import { modTools, type ModToolsInputType } from 'zitejs/api';
import { cn } from '@project/components/lib/utils';
import { Empty, PageHeader, Pill, Stat, ago, input } from '../kit';

type Row = Record<string, unknown>;
const TABS = ['Analytics', 'Message search', 'Usernames', 'Stories', 'Live calls', 'Bots', 'SLA watch', 'Repeat offenders', 'Bulk actions', 'Export'] as const;
type Tab = (typeof TABS)[number];
const s = (v: unknown) => (v == null ? '' : String(v));

function useTool(action: ModToolsInputType['action'], q = '') {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    try { const r = await modTools({ action, q }); setRows(r.rows); setNote(r.message); } catch (e) { setRows([]); toast.error(e instanceof Error ? e.message : 'Failed to load'); }
  }, [action, q]);
  useEffect(() => { setRows(null); load(); }, [load]);
  return { rows, note, load };
}
async function act(input: ModToolsInputType, after?: () => void) {
  try { const r = await modTools(input); toast.success(r.message || 'Done'); after?.(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
}
const Btn = ({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) => (
  <button onClick={onClick} className={cn('h-8 shrink-0 rounded-lg border px-2.5 text-xs font-medium', danger ? 'border-destructive/40 text-destructive hover:bg-destructive/10' : 'border-border hover:bg-secondary')}>{children}</button>
);
const Loading = () => <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
function Table({ rows, cols, actions }: { rows: Row[] | null; cols: [string, string, ((r: Row) => React.ReactNode)?][]; actions?: (r: Row) => React.ReactNode }) {
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty>Nothing here right now.</Empty>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs text-muted-foreground"><tr>{cols.map(([, l]) => <th key={l} className="whitespace-nowrap px-3 py-2 font-medium">{l}</th>)}{actions && <th />}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={s(r.id) || i} className="border-t border-border align-top">{cols.map(([k, l, f]) => <td key={l} className="max-w-[360px] px-3 py-2">{f ? f(r) : s(r[k])}</td>)}{actions && <td className="px-3 py-2"><div className="flex justify-end gap-1.5">{actions(r)}</div></td>}</tr>)}</tbody>
      </table>
    </div>
  );
}
const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <label className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-sm outline-none" /></label>
);
const Note = ({ children }: { children: string }) => (children ? <p className="text-xs text-muted-foreground">{children}</p> : null);

function Analytics() {
  const { rows } = useTool('analytics');
  if (!rows) return <Loading />;
  const sum = (k: string) => rows.reduce((n, r) => n + Number(r[k] ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Sign-ups (14d)" value={sum('signups')} /><Stat label="Messages (14d)" value={sum('messages')} /><Stat label="Peak daily active" value={Math.max(0, ...rows.map((r) => Number(r.active)))} /><Stat label="Reports (14d)" value={sum('reports')} tone={sum('reports') > 0 ? 'warn' : undefined} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl border border-border bg-card p-4"><p className="mb-2 text-sm font-medium">Messages & active people</p><ResponsiveContainer width="100%" height="88%"><LineChart data={rows}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend /><Line dataKey="messages" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} /><Line dataKey="active" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        <div className="h-72 rounded-xl border border-border bg-card p-4"><p className="mb-2 text-sm font-medium">Sign-ups & reports</p><ResponsiveContainer width="100%" height="88%"><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="signups" fill="hsl(var(--chart-3))" radius={4} /><Bar dataKey="reports" fill="hsl(var(--destructive))" radius={4} /></BarChart></ResponsiveContainer></div>
      </div>
    </div>
  );
}

function Messages() {
  const [q, setQ] = useState(''); const [term, setTerm] = useState('');
  const { rows, note, load } = useTool('searchMessages', term);
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q); }} className="flex gap-2"><SearchBox value={q} onChange={setQ} placeholder="Words, or @username for everything they sent" /><button className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Search</button></form>
      <Note>{note}</Note>
      {term.length >= 2 ? <Table rows={rows} cols={[['sender', 'From', (r) => <span>{s(r.sender)} <span className="text-muted-foreground">{r.username ? `@${s(r.username)}` : ''}</span></span>], ['conversation', 'Where'], ['body', 'Message', (r) => <span className="line-clamp-3 break-words">{s(r.body)}</span>], ['sentAt', 'Sent', (r) => ago(s(r.sentAt))]]}
        actions={(r) => <Btn danger onClick={() => act({ action: 'deleteMessage', id: s(r.id), reason: 'Removed by staff' }, load)}>Delete</Btn>} /> : <Empty>Search across every group and community message.</Empty>}
    </div>
  );
}

function Usernames() {
  const [q, setQ] = useState('');
  const { rows, load } = useTool('usernames', q);
  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Find by @username or email" />
      <Table rows={rows} cols={[['username', 'Username', (r) => <Link to={`/support/users/${s(r.id)}`} className="font-medium text-primary">@{s(r.username)}</Link>], ['name', 'Name'], ['email', 'Email'], ['joinedAt', 'Joined', (r) => ago(s(r.joinedAt))]]}
        actions={(r) => <Btn danger onClick={() => act({ action: 'resetUsername', id: s(r.id), reason: 'Inappropriate username' }, load)}>Force rename</Btn>} />
    </div>
  );
}

function StoriesTab() {
  const { rows, load } = useTool('stories');
  return <Table rows={rows} cols={[['author', 'Author', (r) => <span>{s(r.author)} <span className="text-muted-foreground">@{s(r.username)}</span></span>], ['mediaType', 'Type', (r) => <Pill v={s(r.mediaType)} />], ['text', 'Content', (r) => r.mediaUrl ? <a href={s(r.mediaUrl)} target="_blank" rel="noreferrer" className="text-primary underline">Open {s(r.mediaType)}</a> : <span className="line-clamp-2">{s(r.text)}</span>], ['postedAt', 'Posted', (r) => ago(s(r.postedAt))]]}
    actions={(r) => <Btn danger onClick={() => act({ action: 'removeStory', id: s(r.id), reason: 'Violates guidelines' }, load)}>Remove</Btn>} />;
}

function Calls() {
  const { rows, note, load } = useTool('calls');
  useEffect(() => { const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);
  return <div className="space-y-3"><Note>{note}</Note><Table rows={rows} cols={[['name', 'Call', (r) => <span>{s(r.name)} {r.voiceChannel ? <Pill v="Voice channel" /> : null}</span>], ['people', 'People'], ['who', 'Who'], ['video', 'Media', (r) => [r.video && 'Camera', r.screen && 'Screen'].filter(Boolean).join(' · ') || 'Audio'], ['startedAt', 'Started', (r) => ago(s(r.startedAt))]]}
    actions={(r) => <Btn danger onClick={() => act({ action: 'endCall', id: s(r.id) }, load)}>End call</Btn>} /></div>;
}

function Bots() {
  const [q, setQ] = useState('');
  const { rows, load } = useTool('bots', q);
  return <div className="space-y-3"><SearchBox value={q} onChange={setQ} placeholder="Bot or community name" /><Table rows={rows} cols={[['name', 'Bot'], ['kind', 'Kind'], ['community', 'Community'], ['owner', 'Owner'], ['apiCalls', 'API calls'], ['lastActiveAt', 'Last active', (r) => ago(r.lastActiveAt ? s(r.lastActiveAt) : null)], ['enabled', 'Status', (r) => <Pill v={r.enabled ? 'Good' : 'Suspended'} />]]}
    actions={(r) => <Btn danger={!!r.enabled} onClick={() => act({ action: 'toggleBot', id: s(r.id) }, load)}>{r.enabled ? 'Disable' : 'Enable'}</Btn>} /></div>;
}

function Sla() {
  const { rows } = useTool('sla');
  return <Table rows={rows} cols={[['subject', 'Ticket', (r) => <Link to="/support/tickets" className="font-medium text-primary">{s(r.subject) || 'Untitled'}</Link>], ['requester', 'From'], ['priority', 'Priority', (r) => <Pill v={s(r.priority) || 'Normal'} />], ['hoursWaiting', 'Waiting', (r) => { const h = Number(r.hoursWaiting); return <span className={cn('font-mono', h > 24 ? 'text-destructive' : h > 8 ? 'text-amber-600' : '')}>{h < 1 ? `${Math.round(h * 60)}m` : `${Math.round(h)}h`}</span>; }]]} />;
}

function Offenders() {
  const { rows } = useTool('offenders');
  return <Table rows={rows} cols={[['name', 'Person', (r) => <Link to={`/support/users/${s(r.id)}`} className="font-medium text-primary">{s(r.name) || 'Unknown'} {r.username ? <span className="font-normal text-muted-foreground">@{s(r.username)}</span> : null}</Link>], ['reports', 'Reports (30d)'], ['actions', 'Past actions']]} />;
}

function Bulk() {
  const [names, setNames] = useState(''); const [a, setA] = useState<'Warn' | 'Suspend' | 'Ban' | 'Lift'>('Warn'); const [reason, setReason] = useState(''); const [days, setDays] = useState(7); const [busy, setBusy] = useState(false);
  const list = names.split(/[\s,]+/).filter(Boolean);
  return (
    <div className="max-w-xl space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Apply one action to many people at once — e.g. a spam wave. Paste usernames separated by spaces, commas or new lines.</p>
      <textarea value={names} onChange={(e) => setNames(e.target.value)} rows={4} placeholder="@spammer1 @spammer2" className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none" />
      <div className="flex flex-wrap gap-2">
        <select value={a} onChange={(e) => setA(e.target.value as typeof a)} className={input}>{['Warn', 'Suspend', 'Ban', 'Lift'].map((x) => <option key={x}>{x}</option>)}</select>
        {a === 'Suspend' && <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${input} w-24`} aria-label="Days" />}
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className={`${input} flex-1`} />
      </div>
      <button disabled={!list.length || !reason.trim() || busy} onClick={async () => { setBusy(true); await act({ action: 'bulk', usernames: list, bulkAction: a, reason, days }, () => setNames('')); setBusy(false); }} className="h-9 rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground disabled:opacity-50">{busy ? 'Applying…' : `${a} ${list.length || ''} ${list.length === 1 ? 'person' : 'people'}`}</button>
    </div>
  );
}

function Export() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const { rows } = await modTools({ action: 'exportUsers' });
      const cols = ['id', 'username', 'name', 'email', 'joinedAt', 'messages'];
      const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => `"${s(r[c]).replace(/"/g, '""')}"`).join(','))].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `chatting-users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      toast.success(`Exported ${rows.length} users`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed'); } finally { setBusy(false); }
  };
  return <div className="max-w-xl rounded-xl border border-border bg-card p-4"><p className="mb-3 text-sm text-muted-foreground">Download every account as a CSV (username, name, email, join date, message count). The export is recorded in the audit log.</p><button onClick={go} disabled={busy} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export users</button></div>;
}

const VIEWS: Record<Tab, () => JSX.Element> = { Analytics, 'Message search': Messages, Usernames, Stories: StoriesTab, 'Live calls': Calls, Bots, 'SLA watch': Sla, 'Repeat offenders': Offenders, 'Bulk actions': Bulk, Export };

export default function Toolkit() {
  const [tab, setTab] = useState<Tab>('Analytics');
  const View = VIEWS[tab];
  return (
    <div>
      <PageHeader title="Toolkit" desc="Analytics, platform-wide search and power tools for staff." />
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-6">{TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cn('shrink-0 border-b-2 px-3 py-2.5 text-sm', tab === t ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t}</button>)}</div>
      <div className="p-6"><View key={tab} /></div>
    </div>
  );
}
