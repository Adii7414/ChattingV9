import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Megaphone, Plus, Trash2 } from 'lucide-react';
import { configureCommunity } from 'zitejs/api';
import { Switch } from '@project/components/ui/switch';
import { Checkbox } from '@project/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { parseChannel, uid, type Category } from '../../lib/community';
import { Field, SaveButton, Section, input, useRun, type TabProps } from './kit';

const SLOW = [[0, 'Off'], [5, '5s'], [10, '10s'], [30, '30s'], [60, '1m'], [300, '5m'], [900, '15m'], [3600, '1h'], [21600, '6h']] as const;

export default function ChannelsTab({ d, reload }: TabProps) {
  const pos = (id: string) => { const i = d.s.channelOrder.indexOf(id); return i < 0 ? 999 : i; };
  const [order, setOrder] = useState(() => [...d.channels].sort((a, b) => pos(a.id) - pos(b.id)).map((c) => c.id));
  const [cats, setCats] = useState<Category[]>(d.s.categories);
  const initial = Object.fromEntries(d.channels.map((c) => [c.id, parseChannel(c.settings).category ?? null])) as Record<string, string | null>;
  const [where, setWhere] = useState(initial);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(order[0] ?? null);
  const { busy, run } = useRun(reload);
  const byId = new Map(d.channels.map((c) => [c.id, c]));
  const catOf = (id: string) => (where[id] && cats.some((c) => c.id === where[id]) ? where[id] : null);
  const move = (id: string, dir: -1 | 1) => setOrder((o) => {
    const peers = o.filter((x) => catOf(x) === catOf(id)); const k = peers.indexOf(id) + dir;
    if (k < 0 || k >= peers.length) return o;
    const n = [...o]; const a = n.indexOf(id), b = n.indexOf(peers[k]); [n[a], n[b]] = [n[b], n[a]]; return n;
  });
  const moveCat = (i: number, dir: -1 | 1) => setCats((c) => { const n = [...c]; const j = i + dir; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toggle = (id: string) => setClosed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const saveAll = () => run('l', async () => {
    const clean = cats.map((c) => ({ ...c, name: c.name.trim() || 'Category' }));
    await configureCommunity({ communityId: d.id, action: 'layout', layout: { categories: clean, channelOrder: order } });
    const moved = d.channels.filter((c) => (initial[c.id] ?? null) !== catOf(c.id));
    await Promise.all(moved.map((c) => { const st = parseChannel(c.settings); return configureCommunity({ communityId: d.id, action: 'channel', channel: { id: c.id, name: c.name, emoji: c.emoji, topic: st.topic, category: catOf(c.id), slowmode: st.slowmode, announcement: st.announcement, voice: st.voice, allowedRoles: st.allowedRoles } }); }));
  }, 'Categories saved');
  const groups: (Category | null)[] = [null, ...cats];
  const dirty = JSON.stringify(cats) !== JSON.stringify(d.s.categories) || order.join() !== [...d.channels].sort((a, b) => pos(a.id) - pos(b.id)).map((c) => c.id).join() || d.channels.some((c) => (initial[c.id] ?? null) !== catOf(c.id));

  return (
    <div className="space-y-5">
      <Section title="Categories & channels" desc="Group channels under collapsible categories, like folders. Move channels between categories and reorder them, then save.">
        <div className="space-y-2">
          {groups.map((g, gi) => {
            const list = order.filter((id) => byId.has(id) && catOf(id) === (g?.id ?? null));
            if (!g && !list.length) return null;
            const open = !closed.has(g?.id ?? 'none');
            return (
              <div key={g?.id ?? 'none'} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <button onClick={() => toggle(g?.id ?? 'none')} aria-label={open ? 'Collapse' : 'Expand'} className="grid h-8 w-6 place-items-center text-muted-foreground"><ChevronDown className={cn('h-4 w-4 transition', !open && '-rotate-90')} /></button>
                  {g ? <input value={g.name} onChange={(e) => setCats(cats.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))} maxLength={40} aria-label="Category name" className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-xs font-semibold uppercase tracking-wider outline-none focus:bg-secondary" />
                    : <p className="flex-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">No category</p>}
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                  {g && <>
                    <button onClick={() => moveCat(gi - 1, -1)} aria-label="Move category up" className="grid h-8 w-7 place-items-center"><ArrowUp className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button onClick={() => moveCat(gi - 1, 1)} aria-label="Move category down" className="grid h-8 w-7 place-items-center"><ArrowDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button onClick={() => setCats(cats.filter((x) => x.id !== g.id))} aria-label="Delete category" title="Delete category (its channels move to No category)" className="grid h-8 w-7 place-items-center text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </>}
                </div>
                {open && (
                  <div className="space-y-0.5 border-t border-border p-1.5">
                    {list.map((id) => (
                      <div key={id} className={cn('flex items-center gap-1.5 rounded-lg py-1 pl-3 pr-1', sel === id ? 'bg-secondary' : 'hover:bg-secondary/60')}>
                        <button onClick={() => setSel(id)} className="min-w-0 flex-1 truncate text-left text-sm">{byId.get(id)!.emoji || (parseChannel(byId.get(id)!.settings).voice ? '🔊' : '#')} {byId.get(id)!.name}</button>
                        <Select value={catOf(id) ?? 'none'} onValueChange={(v) => setWhere({ ...where, [id]: v === 'none' ? null : v })}>
                          <SelectTrigger className="h-7 w-28 rounded-lg text-xs" aria-label="Move to category"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="none">No category</SelectItem>{cats.map((x) => <SelectItem key={x.id} value={x.id}>{x.name || 'Category'}</SelectItem>)}</SelectContent>
                        </Select>
                        <button onClick={() => move(id, -1)} aria-label="Move up" className="grid h-7 w-6 place-items-center"><ArrowUp className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => move(id, 1)} aria-label="Move down" className="grid h-7 w-6 place-items-center"><ArrowDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </div>
                    ))}
                    {!list.length && <p className="px-3 py-2 text-xs text-muted-foreground">Empty — use “Move to” on a channel to put it here.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setCats([...cats, { id: uid(), name: 'New category' }])} className="flex items-center gap-1.5 text-sm font-medium text-primary"><Plus className="h-4 w-4" /> Add category</button>
          <span className="flex-1" />
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          <SaveButton busy={busy === 'l'} onClick={saveAll}>Save categories</SaveButton>
        </div>
      </Section>
      {sel && byId.get(sel) && <ChannelEditor key={sel + JSON.stringify(d.s.categories)} ch={byId.get(sel)!} d={d} reload={reload} cats={d.s.categories} />}
    </div>
  );
}

function ChannelEditor({ ch, d, reload, cats }: TabProps & { ch: TabProps['d']['channels'][number]; cats: Category[] }) {
  const s0 = parseChannel(ch.settings);
  const [c, setC] = useState({ name: ch.name, emoji: ch.emoji, ...s0 });
  const { busy, run } = useRun(reload);
  return (
    <Section title={`Edit #${ch.name}`}>
      <div className="flex gap-2"><input value={c.emoji} onChange={(e) => setC({ ...c, emoji: e.target.value })} maxLength={4} placeholder="#" aria-label="Channel emoji" className={`${input} w-14 text-center`} /><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} maxLength={60} className={input} aria-label="Channel name" /></div>
      <Field label="Topic"><input value={c.topic} onChange={(e) => setC({ ...c, topic: e.target.value })} maxLength={300} placeholder="What’s this channel for?" className={input} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select value={c.category ?? 'none'} onValueChange={(v) => setC({ ...c, category: v === 'none' ? null : v })}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">No category</SelectItem>{cats.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Slow mode">
          <Select value={String(c.slowmode)} onValueChange={(v) => setC({ ...c, slowmode: Number(v) })}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{SLOW.map(([v, l]) => <SelectItem key={v} value={String(v)}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><span className="flex items-center gap-2 text-sm"><Megaphone className="h-4 w-4" /> Announcement channel (only roles with “Post in announcement channels” can write)</span><Switch checked={c.announcement} onCheckedChange={(announcement) => setC({ ...c, announcement })} /></label>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">{c.voice ? <><Volume2 className="h-3.5 w-3.5" /> Voice channel</> : '# Text channel'} · the type is chosen when the channel is created.</p>
      <Field label="Who can see this channel" hint="Leave all unticked for everyone. Ticked = private to those roles (plus channel managers).">
        <div className="flex flex-wrap gap-2">
          {d.s.roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
              <Checkbox checked={c.allowedRoles.includes(r.id)} onCheckedChange={(v) => setC({ ...c, allowedRoles: v ? [...c.allowedRoles, r.id] : c.allowedRoles.filter((x) => x !== r.id) })} />
              <span style={{ color: r.color }}>{r.name}</span>
            </label>
          ))}
          {!d.s.roles.length && <span className="text-sm text-muted-foreground">Create roles first to make private channels.</span>}
        </div>
      </Field>
      <div className="flex flex-wrap gap-2">
        <SaveButton busy={busy === 's'} onClick={() => run('s', () => configureCommunity({ communityId: d.id, action: 'channel', channel: { id: ch.id, name: c.name, emoji: c.emoji, topic: c.topic, category: c.category, slowmode: c.slowmode, announcement: c.announcement, voice: c.voice, allowedRoles: c.allowedRoles } }), 'Channel saved')}>Save channel</SaveButton>
        <SaveButton danger busy={busy === 'd'} onClick={() => run('d', () => configureCommunity({ communityId: d.id, action: 'deleteChannel', userId: ch.id }), 'Channel deleted')}>Delete channel</SaveButton>
      </div>
    </Section>
  );
}
