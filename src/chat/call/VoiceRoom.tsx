import { useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, Volume2 } from 'lucide-react';
import { call as callApi, type CallOutputType } from 'zitejs/api';
import { useChat, usePoll } from '../store';
import PersonAvatar from '../Avatars';
import { useCall } from './CallProvider';

/** Drop-in bar for voice channels: who's talking now, and a one-tap join. */
export default function VoiceRoom({ conversationId }: { conversationId: string }) {
  const { me, people } = useChat();
  const { call, start, leave, toggleMute } = useCall();
  const [list, setList] = useState<CallOutputType['participants']>([]);
  const inThis = call?.conversationId === conversationId;
  usePoll(() => callApi({ action: 'peek', conversationId }).then((r) => setList(r.participants)).catch(() => {}), 5000, [conversationId]);
  const shown = inThis ? call!.participants : list;
  const nameOf = (u: string) => (u === me.id ? me : people.get(u));
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-secondary/40 px-4 py-2.5 sm:px-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Volume2 className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{inThis ? 'You’re in voice' : shown.length ? `${shown.length} in voice` : 'Voice channel'}</p>
        {shown.length ? (
          <div className="mt-1 flex -space-x-1.5">
            {shown.slice(0, 8).map((p) => <span key={p.userId} title={nameOf(p.userId)?.name} className="rounded-full ring-2 ring-background"><PersonAvatar name={nameOf(p.userId)?.name ?? '?'} image={nameOf(p.userId)?.image} size={22} /></span>)}
          </div>
        ) : <p className="text-xs text-muted-foreground">No one’s here yet. Hop in and others can join.</p>}
      </div>
      {inThis ? (
        <>
          <button onClick={toggleMute} aria-label={call!.muted ? 'Unmute' : 'Mute'} className="grid h-9 w-9 place-items-center rounded-full bg-background">{call!.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
          <button onClick={leave} className="flex h-9 items-center gap-1.5 rounded-full bg-destructive px-3 text-sm font-medium text-destructive-foreground"><PhoneOff className="h-4 w-4" /> Leave</button>
        </>
      ) : (
        <>
          <button onClick={() => start(conversationId, true)} aria-label="Join with video" className="grid h-9 w-9 place-items-center rounded-full bg-background"><Video className="h-4 w-4" /></button>
          <button onClick={() => start(conversationId, false)} className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">Join voice</button>
        </>
      )}
    </div>
  );
}
