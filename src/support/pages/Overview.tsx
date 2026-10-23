import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { modOverview, modTickets, type ModOverviewOutputType, type ModTicketsOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { PageHeader, Pill, Stat, ago, Empty } from '../kit';

export default function Overview() {
  const [d, setD] = useState<ModOverviewOutputType | null>(null);
  const [sla, setSla] = useState<ModTicketsOutputType['stats'] | null>(null);
  useEffect(() => { modOverview({}).then(setD); modTickets({ status: 'Active' }).then((r) => setSla(r.stats)); }, []);
  if (!d) return <div className="space-y-4 p-6"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  const s = d.stats;
  return (
    <div>
      <PageHeader title="Overview" desc="Health of Chatting at a glance" />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link to="/support/reports"><Stat label="Open reports" value={s.openReports} tone={s.openReports > 10 ? 'warn' : undefined} hint="Waiting for review" /></Link>
          <Link to="/support/tickets"><Stat label="Active tickets" value={s.openTickets} hint={`${s.urgentTickets} urgent`} tone={s.urgentTickets ? 'warn' : undefined} /></Link>
          <Stat label="SLA breaching" value={sla?.breaching ?? '—'} tone={sla?.breaching ? 'warn' : undefined} hint="No first reply in time" />
          <Stat label="Avg first response" value={sla?.avgFirstResponseHrs != null ? `${sla.avgFirstResponseHrs}h` : '—'} hint="Last 30 days" />
          <Stat label="Satisfaction" value={s.satisfaction.avg != null ? `${s.satisfaction.avg} / 5` : '—'} hint={s.satisfaction.count ? `${s.satisfaction.happyPct}% rated 4–5 · ${s.satisfaction.count} rating${s.satisfaction.count === 1 ? '' : 's'}, 30 days` : 'No ratings yet'} />
          <Stat label="Messages today" value={s.messagesToday} />
          <Stat label="Active users (24h)" value={s.activeUsers} hint={`${s.totalUsers} total`} />
          <Stat label="Communities" value={s.communities} />
          <Link to="/support/users"><Stat label="Restricted accounts" value={s.restricted} hint="Suspended or banned" /></Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
            <p className="mb-3 text-sm font-medium">Last 14 days</p>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={d.daily.map((x) => ({ ...x, day: x.date.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis yAxisId="m" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis yAxisId="r" orientation="right" fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Area yAxisId="m" dataKey="messages" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / .15)" />
                  <Area yAxisId="r" dataKey="reports" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / .15)" />
                  <Area yAxisId="r" dataKey="tickets" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1) / .15)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <p className="border-b border-border px-4 py-3 text-sm font-medium">Recent staff actions</p>
            {d.recentActions.length === 0 ? <Empty>No actions yet</Empty> : d.recentActions.map((a) => (
              <div key={a.id} className="border-b border-border px-4 py-2.5 last:border-0">
                <div className="flex items-center gap-2 text-sm"><Pill v={a.action} /><span className="truncate font-medium">{a.target}</span></div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.reason} · {a.staff} · {ago(a.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
