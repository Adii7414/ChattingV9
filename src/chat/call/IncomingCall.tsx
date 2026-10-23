import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { call as callApi, type CallOutputType } from 'zitejs/api';
import { useChat, usePoll } from '../store';
import PersonAvatar from '../Avatars';
import { useCall } from './CallProvider';

type Ring = CallOutputType['calls'][number];

/** Soft two-tone ring while a call is waiting to be answered. */
function useRingtone(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const ctx = new AudioContext();
    const beep = () => [0, 0.25].forEach((d, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = i ? 660 : 880; g.gain.setValueAtTime(0.06, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.22);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.24);
    });
    beep(); const t = setInterval(beep, 2000);
    return () => { clearInterval(t); ctx.close().catch(() => {}); };
  }, [on]);
}

/** Shows a ringing card for calls started in my DMs and groups. */
export default function IncomingCall() {
  const { people, conversations, titleOf } = useChat();
  const { call, start } = useCall();
  const [rings, setRings] = useState<Ring[]>([]);
  const dismissed = useRef(new Set<string>());
  usePoll(() => callApi({ action: 'active' }).then((r) => setRings(r.calls)).catch(() => {}), 4000);
  const ring = rings.find((r) => r.conversationId !== call?.conversationId && !dismissed.current.has(`${r.conversationId}:${r.startedAt}`) && Date.now() - +new Date(r.startedAt) < 10 * 60_000);
  useRingtone(!!ring && !call);
  const [, force] = useState(0);
  if (!ring) return null;
  const conv = conversations?.find((c) => c.id === ring.conversationId);
  const caller = people.get(ring.startedBy);
  const decline = () => { dismissed.current.add(`${ring.conversationId}:${ring.startedAt}`); force((n) => n + 1); };
  return (
    <div className="fixed left-1/2 top-4 z-[60] flex w-[min(92vw,380px)] -translate-x-1/2 items-center gap-3 rounded-3xl bg-neutral-950 p-3 pl-4 text-white shadow-2xl ring-1 ring-white/10">
      <PersonAvatar name={caller?.name ?? 'Someone'} image={caller?.image} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{conv?.isGroup ? (conv ? titleOf(conv) : 'Group call') : caller?.name ?? 'Someone'}</p>
        <p className="truncate text-xs text-white/60">{ring.video ? 'Video' : 'Voice'} call{conv?.isGroup ? ` · ${ring.count} in call` : ''}</p>
      </div>
      <button onClick={decline} aria-label="Decline" className="grid h-11 w-11 place-items-center rounded-full bg-red-600"><PhoneOff className="h-5 w-5" /></button>
      <button onClick={() => { decline(); start(ring.conversationId, ring.video); }} aria-label="Answer" className="grid h-11 w-11 place-items-center rounded-full bg-emerald-600">{ring.video ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}</button>
    </div>
  );
}
