import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, BadgeCheck, Bot, BarChart3, CalendarDays, Hash, History, Palette, Shield, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { getCommunity } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { cn } from '@project/components/lib/utils';
import { parseCommunity } from '../../lib/community';
import { useChat } from '../store';
import type { Data } from './kit';
import ProfileTab from './ProfileTab';
import RolesTab from './RolesTab';
import MembersTab from './MembersTab';
import ChannelsTab from './ChannelsTab';
import ModerationTab, { AuditTab } from './ModerationTab';
import EventsTab from './EventsTab';
import InsightsTab from './InsightsTab';
import CustomiseTab from './CustomiseTab';
import VerificationTab from './VerificationTab';
import BotsTab from './BotsTab';
import { Verified } from '../official';
import { errorMessage } from '../../lib/errors';

const TABS = [
  { k: 'profile', l: 'Look & profile', i: Palette, need: 'manageCommunity', g: 'General' },
  { k: 'customise', l: 'Customise', i: Sparkles, need: 'manageCommunity', g: 'General' },
  { k: 'channels', l: 'Channels', i: Hash, need: 'manageChannels', g: 'General' },
  { k: 'events', l: 'Events', i: CalendarDays, need: null, g: 'General' },
  { k: 'bots', l: 'Bots', i: Bot, need: 'manageCommunity', g: 'General' },
  { k: 'members', l: 'Members', i: Users, need: null, g: 'People' },
  { k: 'roles', l: 'Roles', i: ShieldCheck, need: 'manageRoles', g: 'People' },
  { k: 'moderation', l: 'Moderation', i: Shield, need: null, g: 'Safety' },
  { k: 'audit', l: 'Audit log', i: History, need: 'manageCommunity', g: 'Safety' },
  { k: 'insights', l: 'Insights', i: BarChart3, need: null, g: 'Growth' },
  { k: 'verification', l: 'Verification', i: BadgeCheck, need: 'manageCommunity', g: 'Growth' },
] as const;
type K = (typeof TABS)[number]['k'];

export default function CommunitySettings() {
  const { communityId = '' } = useParams();
  const { refresh } = useChat();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<K | null>(null);
  const load = useCallback(async () => {
    try { const r = await getCommunity({ communityId }); setD({ ...r, id: communityId, s: parseCommunity(r.settings) }); setErr(null); } catch (e) { setErr(errorMessage(e, 'You don’t have access to this community.')); }
    refresh();
  }, [communityId, refresh]);
  useEffect(() => { setD(null); load(); }, [load]);

  if (err) return <section className="grid flex-1 place-items-center px-6 text-center text-muted-foreground"><div><p>{err}</p><Link to="/app" className="mt-2 inline-block underline">Go back</Link></div></section>;
  const tabs = d ? TABS.filter((t) => !t.need || d.myPerms.includes(t.need)) : [];
  const active = tab && tabs.some((t) => t.k === tab) ? tab : tabs[0]?.k;
  const props = d ? { d, reload: load } : null;
  const groups = [...new Set(tabs.map((t) => t.g))];
  const accent = d?.s.accent ?? '#0f766e';

  const badge = (k: K) => k === 'moderation' && d && d.pending.length > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{d.pending.length}</span>;

  const nav = (
    <>
      <div className="flex items-center gap-2 px-3 py-3">
        <Link to="/app" className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-secondary"><ArrowLeft className="h-5 w-5" /> Back to chats</Link>
      </div>
      <div className="mx-3 overflow-hidden rounded-2xl border border-border bg-card">
        {d?.s.banner ? <img src={d.s.banner} alt="" className="block aspect-[3/1] w-full object-cover" /> : <div className="aspect-[3/1] w-full" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}66)` }} />}
        <div className="flex items-center gap-3 p-3">
          <div className="relative z-10 -mt-10 grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary text-2xl ring-4 ring-card">{d?.s.icon ? <img src={d.s.icon} alt="" className="h-full w-full object-cover" /> : d?.emoji || d?.name[0]}</div>
          <div className="min-w-0 flex-1">
            {d ? <p className="flex items-center gap-1 font-semibold leading-tight"><span className="truncate">{d.name}</span>{d.verified && <Verified community />}</p> : <Skeleton className="h-5 w-32" />}
            <p className="text-xs text-muted-foreground">Community settings</p>
          </div>
        </div>
      </div>
      <nav className="mt-4 space-y-4 px-3 pb-6">
        {!d && <Skeleton className="h-64 rounded-xl" />}
        {groups.map((g) => (
          <div key={g}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
            {tabs.filter((t) => t.g === g).map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[15px] transition md:py-2 md:text-sm', active === t.k && tab ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground', active === t.k && 'md:bg-primary/10 md:font-medium md:text-primary')}>
                <t.i className="h-[18px] w-[18px] md:h-4 md:w-4" />{t.l}{badge(t.k)}<ChevronRight className="ml-auto h-4 w-4 opacity-40 md:hidden" />
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <section className="flex min-w-0 flex-1 overflow-hidden">
      <aside className={cn('w-full shrink-0 flex-col overflow-y-auto border-r border-border bg-card/40 md:flex md:w-72 xl:w-80', tab ? 'hidden' : 'flex')}>{nav}</aside>

      <div className={cn('min-w-0 flex-1 overflow-y-auto', !tab && 'hidden md:block')}>
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/90 px-2 py-2 backdrop-blur md:hidden">
          <button onClick={() => setTab(null)} aria-label="Back to settings" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0"><p className="truncate font-semibold leading-tight">{TABS.find((t) => t.k === active)?.l}</p><p className="truncate text-xs text-muted-foreground">{d?.name}</p></div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-16 sm:px-8 sm:py-10 lg:px-12 2xl:max-w-7xl">
          {active && <h1 className="mb-5 hidden md:block text-2xl font-semibold tracking-tight">{TABS.find((t) => t.k === active)?.l}</h1>}
          {!props ? <Skeleton className="h-96 rounded-3xl" /> : (
            <div key={`${active}-${d?.s.audit[0]?.at ?? ''}`}>
              {active === 'profile' && <ProfileTab {...props} />}
              {active === 'customise' && <CustomiseTab {...props} />}
              {active === 'channels' && <ChannelsTab {...props} />}
              {active === 'roles' && <RolesTab {...props} />}
              {active === 'members' && <MembersTab {...props} />}
              {active === 'moderation' && <ModerationTab {...props} />}
              {active === 'audit' && <AuditTab {...props} />}
              {active === 'events' && <EventsTab {...props} />}
              {active === 'insights' && <InsightsTab {...props} />}
              {active === 'verification' && <VerificationTab {...props} />}
              {active === 'bots' && <BotsTab {...props} />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
