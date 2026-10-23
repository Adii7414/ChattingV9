import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { communityInsights, type CommunityInsightsOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Section, type TabProps } from './kit';

export default function InsightsTab({ d }: TabProps) {
  const [r, setR] = useState<CommunityInsightsOutputType | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { communityInsights({ communityId: d.id }).then(setR).catch(() => setErr(true)); }, [d.id]);
  if (err) return <Section title="Insights"><p className="text-sm text-muted-foreground">Couldn’t load insights right now.</p></Section>;
  if (!r) return <Skeleton className="h-96 rounded-3xl" />;
  const maxCh = Math.max(1, ...r.channels.map((c) => c.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[['Members', r.members], ['Messages · 30 days', r.messages30d], ['Active posters', r.activePosters30d]].map(([l, v]) => (
          <div key={l} className="rounded-3xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{Number(v).toLocaleString()}</p></div>
        ))}
      </div>
      <Section title="Messages per day" desc="Last 30 days">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.daily}>
              <XAxis dataKey="day" tickFormatter={(v: string) => format(new Date(v), 'd MMM')} tick={{ fontSize: 11 }} interval={6} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} labelFormatter={(v: string) => format(new Date(v), 'EEE d MMM')} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} />
              <Bar dataKey="count" name="Messages" fill={d.s.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <Section title="When people chat" desc="Messages by hour of day, your time">
        <div className="grid grid-cols-12 gap-1 sm:grid-cols-[repeat(24,minmax(0,1fr))]">
          {localHours(r.hours).map((n, h) => (
            <div key={h} title={`${h}:00 — ${n} messages`} className="aspect-square rounded-md" style={{ background: d.s.accent, opacity: 0.08 + (n / Math.max(1, ...r.hours)) * 0.92 }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
      </Section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Leaderboard" desc="Levels are earned by chatting (last 30 days)">
          {!r.topPosters.length ? <p className="text-sm text-muted-foreground">No messages yet.</p> : r.topPosters.map((p, i) => {
            const lv = levelOf(p.count);
            return (
              <div key={p.userId} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-center">{['🥇', '🥈', '🥉'][i] ?? <span className="text-muted-foreground">{i + 1}</span>}</span>
                <span className="flex-1 truncate">{d.s.nicknames[p.userId] ?? p.name}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${d.s.accent}22`, color: d.s.accent }}>Lv {lv.level}</span>
                <span className="w-10 text-right tabular-nums text-muted-foreground">{p.count}</span>
              </div>
            );
          })}
        </Section>
        <Section title="Busiest channels">
          {!r.channels.length ? <p className="text-sm text-muted-foreground">No messages yet.</p> : r.channels.map((c) => (
            <div key={c.name} className="text-sm">
              <div className="mb-1 flex justify-between"><span>#{c.name}</span><span className="tabular-nums text-muted-foreground">{c.count}</span></div>
              <div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full" style={{ width: `${(c.count / maxCh) * 100}%`, background: d.s.accent }} /></div>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

/** Level from message count: 5 msgs → Lv 1, 20 → Lv 2, 45 → Lv 3 … */
export const levelOf = (count: number) => { const level = Math.floor(Math.sqrt(count / 5)); return { level, next: 5 * (level + 1) ** 2 }; };
const localHours = (utc: number[]) => { const off = Math.round(-new Date().getTimezoneOffset() / 60); return Array.from({ length: 24 }, (_, h) => utc[(h - off + 48) % 24]); };
