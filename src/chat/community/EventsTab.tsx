import { useEffect, useState } from 'react';
import { format, formatDistanceToNowStrict, isPast } from 'date-fns';
import { CalendarDays, CalendarPlus, Loader2, MapPin, Plus, Timer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { communityEvents, type CommunityEventsOutputType } from 'zitejs/api';
import { DateTimePicker } from '@project/components/ui/date-picker';
import { cn } from '@project/components/lib/utils';
import { useChat } from '../store';
import { Field, input, Section, SaveButton, type TabProps } from './kit';
import { errorMessage } from '../../lib/errors';

type Ev = CommunityEventsOutputType['events'][number];

export default function EventsTab({ d }: TabProps) {
  const { me } = useChat();
  const cid = d.id;
  const canCreate = (d.myPerms as string[]).includes('manageCommunity');
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; location: string; at?: Date } | null>(null);
  const [busy, setBusy] = useState(false);
  const call = async (args: Omit<Parameters<typeof communityEvents>[0], 'communityId'>, ok?: string) => {
    try { const r = await communityEvents({ communityId: cid, ...args }); setEvents(r.events); if (ok) toast.success(ok); return true; }
    catch (e) { toast.error(errorMessage(e, 'Something went wrong')); return false; }
  };
  useEffect(() => { call({ action: 'list' }); }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!form?.title.trim() || !form.at) return;
    setBusy(true);
    const ok = await call({ action: 'create', event: { title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), startsAt: form.at.toISOString() } }, 'Event created');
    setBusy(false); if (ok) setForm(null);
  };
  const rsvp = (e: Ev, r: 'going' | 'maybe' | 'none') => {
    setEvents((list) => list && list.map((x) => x.id !== e.id ? x : { ...x, going: x.going.filter((u) => u !== me.id).concat(r === 'going' ? [me.id] : []), maybe: x.maybe.filter((u) => u !== me.id).concat(r === 'maybe' ? [me.id] : []) }));
    call({ action: 'rsvp', id: e.id, rsvp: r });
  };
  const nameOf = (id: string) => d.s.nicknames[id] ?? d.members.find((m) => m.id === id)?.name ?? 'Someone';

  return (
    <div className="space-y-4">
      {canCreate && (form ? (
        <Section title="New event" desc="Everyone in the community can see it and RSVP.">
          <Field label="Title"><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="Game night, AMA, meetup…" className={input} /></Field>
          <Field label="When"><DateTimePicker value={form.at} onChange={(at) => setForm({ ...form, at })} /></Field>
          <Field label="Where" hint="A place, a link, or a channel name"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={200} className={input} /></Field>
          <Field label="Details"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={3} className={`${input} h-auto py-2`} /></Field>
          {form.at && isPast(form.at) && <p className="text-xs text-destructive">Pick a time in the future.</p>}
          <div className="flex justify-end gap-2"><button onClick={() => setForm(null)} className="h-10 rounded-full px-4 text-sm">Cancel</button>
            <SaveButton busy={busy} onClick={create}>{form.title.trim() && form.at && !isPast(form.at) ? 'Create event' : 'Fill in title & time'}</SaveButton></div>
        </Section>
      ) : (
        <button onClick={() => setForm({ title: '', description: '', location: '' })} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"><Plus className="h-4 w-4" /> Plan an event</button>
      ))}
      {!events ? <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : !events.length ? <Section title="No upcoming events"><p className="text-sm text-muted-foreground">{canCreate ? 'Plan something for your community.' : 'Nothing planned yet — check back soon.'}</p></Section>
        : events.map((e) => {
          const mine = e.going.includes(me.id) ? 'going' : e.maybe.includes(me.id) ? 'maybe' : 'none';
          const at = new Date(e.startsAt);
          return (
            <section key={e.id} className="flex gap-4 rounded-3xl border border-border bg-card p-5">
              <div className="grid h-16 w-14 shrink-0 place-items-center rounded-2xl text-center" style={{ background: `${d.s.accent}1f`, color: d.s.accent }}>
                <div><p className="text-[11px] font-semibold uppercase">{format(at, 'MMM')}</p><p className="text-2xl font-bold leading-none">{format(at, 'd')}</p></div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{e.title}</h3>
                  {(e.createdBy === me.id || canCreate) && <button onClick={() => call({ action: 'delete', id: e.id }, 'Event deleted')} aria-label="Delete event" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{format(at, 'EEE d MMM, h:mm a')}{isPast(at) && ' · started'}</span>
                  {!isPast(at) && <span className="flex items-center gap-1 font-medium" style={{ color: d.s.accent }}><Timer className="h-3.5 w-3.5" />in {formatDistanceToNowStrict(at)}</span>}
                  {e.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{e.location}</span>}
                </p>
                {e.description && <p className="mt-2 whitespace-pre-wrap text-sm">{e.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(['going', 'maybe', 'none'] as const).map((r) => (
                    <button key={r} onClick={() => rsvp(e, r)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', mine === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary')}>
                      {r === 'going' ? '✅ Going' : r === 'maybe' ? '🤔 Maybe' : 'Can’t go'}
                    </button>
                  ))}
                  <button onClick={() => downloadIcs(e, d.name)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary"><CalendarPlus className="h-3.5 w-3.5" /> Add to calendar</button>
                  <span className="text-xs text-muted-foreground" title={[...e.going.map(nameOf), ...e.maybe.map((u) => `${nameOf(u)} (maybe)`)].join(', ')}>{e.going.length} going · {e.maybe.length} maybe</span>
                </div>
              </div>
            </section>
          );
        })}
    </div>
  );
}

function downloadIcs(e: Ev, community: string) {
  const t = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(e.startsAt), end = new Date(+start + 3_600_000);
  const esc = (v: string) => v.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chatting//Events//EN', 'BEGIN:VEVENT', `UID:${e.id}@chatting`, `DTSTAMP:${t(new Date())}`, `DTSTART:${t(start)}`, `DTEND:${t(end)}`,
    `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(`${e.description}\n\n${community} on Chatting`.trim())}`, e.location ? `LOCATION:${esc(e.location)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${e.title.replace(/[^\w\s-]/g, '').trim() || 'event'}.ics` });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
