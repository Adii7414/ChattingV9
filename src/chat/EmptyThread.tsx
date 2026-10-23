import { Link } from 'react-router-dom';
import { Check, Compass, MessageCircle, Palette, UserRound, X } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { setPrefs, usePrefs } from './prefs';
import { useChat } from './store';

const STEPS = [
  { k: 'profile', l: 'Set up your profile', d: 'Add a photo, bio and status', to: '/app/settings', i: UserRound },
  { k: 'look', l: 'Make it yours', d: 'Pick a font, colour and wallpaper', to: '/app/settings', i: Palette },
  { k: 'community', l: 'Join a community', d: 'Find your people in Discover', to: '/app/discover', i: Compass },
] as const;

/** Getting-started checklist for new people; disappears once done or dismissed. */
function Onboarding() {
  const { onboarding } = usePrefs();
  const { conversations } = useChat();
  const done = (k: string) => onboarding.includes(k) || (k === 'chat' && !!conversations?.some((c) => !c.official));
  const mark = (k: string) => setPrefs((p) => ({ onboarding: [...new Set([...p.onboarding, k])] }));
  const all = [...STEPS.map((s) => s.k), 'chat'];
  if (onboarding.includes('dismissed') || all.every(done)) return null;
  const count = all.filter(done).length;
  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 text-left shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-semibold">Get started with Chatting</p><p className="text-sm text-muted-foreground">{count} of {all.length} done</p></div>
        <button onClick={() => mark('dismissed')} aria-label="Dismiss" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / all.length) * 100}%` }} /></div>
      <ul className="mt-4 space-y-1">
        <Step done={done('chat')} icon={MessageCircle} label="Start your first chat" desc="Use the + button in the sidebar" />
        {STEPS.map((s) => <li key={s.k}><Link to={s.to} onClick={() => mark(s.k)}><Step done={done(s.k)} icon={s.i} label={s.l} desc={s.d} /></Link></li>)}
      </ul>
    </div>
  );
}

function Step({ done, icon: I, label, desc }: { done: boolean; icon: typeof Check; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary/60">
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', done ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{done ? <Check className="h-4 w-4" /> : <I className="h-4 w-4" />}</span>
      <span className="min-w-0"><span className={cn('block text-sm font-medium', done && 'text-muted-foreground line-through')}>{label}</span><span className="block truncate text-xs text-muted-foreground">{desc}</span></span>
    </div>
  );
}

export default function EmptyThread() {
  return (
    <section className="hidden flex-1 flex-col items-center justify-center gap-6 px-6 text-center md:flex">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-secondary"><MessageCircle className="h-7 w-7 text-muted-foreground" /></span>
      <div>
        <p className="text-xl font-semibold tracking-tight">Pick a conversation</p>
        <p className="mt-1 text-muted-foreground">Or start a new one from the sidebar.</p>
      </div>
      <Onboarding />
    </section>
  );
}
