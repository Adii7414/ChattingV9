import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@project/components/ui/dialog';
import { TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import type { CommunitySettings } from '../lib/community';
import { setPrefs, usePrefs } from './prefs';
import { useChat } from './store';

/** One-time welcome card the first time you open a community on this device. */
export function CommunityWelcome({ communityId, cs }: { communityId: string; cs: CommunitySettings }) {
  const prefs = usePrefs();
  const { communities, conversations, titleOf } = useChat();
  const cm = communities.find((c) => c.id === communityId);
  const open = !!cm && !prefs.welcomed.includes(communityId);
  const close = () => setPrefs((p) => ({ welcomed: [...p.welcomed, communityId] }));
  const chans = (conversations ?? []).filter((c) => c.communityId === communityId).slice(0, 6);
  if (!cm) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div className="h-28" style={{ background: cs.banner ? `url(${cs.banner}) center/cover` : `linear-gradient(135deg, ${cs.accent}, ${cs.accent}66)` }} />
        <div className="-mt-10 px-6 pb-6">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-secondary text-2xl">{cs.icon ? <img src={cs.icon} alt="" className="h-full w-full object-cover" /> : cm.emoji || cm.name[0]}</div>
          <DialogTitle className="mt-3 text-xl">Welcome to {cm.name}!</DialogTitle>
          <DialogDescription className="mt-1">{cs.tagline || cm.description || `${cm.memberCount} members chatting here.`}</DialogDescription>
          {cs.welcome && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-secondary p-3 text-sm">{cs.welcome}</p>}
          {chans.length > 0 && (
            <div className="mt-4"><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Channels to explore</p>
              <div className="flex flex-wrap gap-1.5">{chans.map((c) => <span key={c.id} className="rounded-full border border-border px-2.5 py-1 text-xs">{titleOf(c)}</span>)}</div></div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Tip: check the <b>Events</b> and <b>Insights</b> tabs in the community page.</p>
          <button onClick={close} className="mt-5 h-11 w-full rounded-full font-medium text-white" style={{ background: cs.accent }}>Let’s go</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shows a member their most recent moderator warning (last 7 days) until they dismiss it. */
export function WarningBanner({ cs }: { cs: CommunitySettings }) {
  const { me } = useChat();
  const last = cs.warnings[me.id]?.[cs.warnings[me.id].length - 1];
  const key = last ? `warn-seen:${last.at}` : '';
  const [hidden, setHidden] = useState(() => !!key && localStorage.getItem(key) === '1');
  if (!last || hidden || Date.now() - +new Date(last.at) > 7 * 864e5) return null;
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm sm:px-6">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="flex-1"><b>A moderator warned you:</b> {last.reason}</p>
      <button onClick={() => { localStorage.setItem(key, '1'); setHidden(true); }} aria-label="Dismiss"><X className="h-4 w-4" /></button>
    </div>
  );
}
