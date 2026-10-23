import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import type { CommunitySettings } from '../lib/community';
import { useChat } from './store';

/** Slow-mode hint above the composer, plus the "accept the rules" gate on first visit. */
export default function ChannelBar({ cs, slowmode, communityId }: { cs: CommunitySettings; slowmode: number; communityId: string }) {
  const { communities, can } = useChat();
  const navigate = useNavigate();
  const key = `rules-ok:${communityId}:${cs.rules.join('|').length}`;
  const [ok, setOk] = useState(() => !!localStorage.getItem(key));
  const name = communities.find((c) => c.id === communityId)?.name ?? 'this community';
  const fmt = slowmode >= 3600 ? `${slowmode / 3600}h` : slowmode >= 60 ? `${Math.round(slowmode / 60)}m` : `${slowmode}s`;
  return (
    <>
      {slowmode > 0 && !can(communityId, 'bypassSlowmode') && (
        <p className="flex items-center justify-center gap-1.5 border-t border-border py-1.5 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Slow mode: one message every {fmt}</p>
      )}
      <Dialog open={cs.rules.length > 0 && !ok}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl tracking-tight">Rules of {name}</DialogTitle>
            <DialogDescription>Please read and accept before you chat.</DialogDescription>
          </DialogHeader>
          <ol className="max-h-72 space-y-2 overflow-y-auto">
            {cs.rules.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: cs.accent }}>{i + 1}</span>{r}
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <button onClick={() => navigate('/app')} className="h-11 flex-1 rounded-full border border-border text-sm font-medium">Not now</button>
            <button onClick={() => { localStorage.setItem(key, '1'); setOk(true); }} className="h-11 flex-1 rounded-full text-sm font-medium text-white" style={{ background: cs.accent }}>I agree</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
