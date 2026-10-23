import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { cn } from '@project/components/lib/utils';
import { useChat } from '../store';
import { useCall } from './CallProvider';
import Tile from './Tile';

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <audio ref={ref} autoPlay />;
}

const Ctl = ({ on, danger, label, onClick, children }: { on?: boolean; danger?: boolean; label: string; onClick?: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} aria-label={label} title={label} className={cn('grid h-12 w-12 place-items-center rounded-full transition', danger ? 'bg-red-600 text-white hover:bg-red-500' : on ? 'bg-white text-neutral-900' : 'bg-white/10 text-white hover:bg-white/20')}>{children}</button>
);

function useDuration(from: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function CallWindow() {
  const { call, leave, toggleMute, toggleCamera, toggleScreen } = useCall();
  const { me, people, conversations, titleOf } = useChat();
  const [mini, setMini] = useState(false);
  const navigate = useNavigate();
  const duration = useDuration(call?.startedAt ?? Date.now());
  if (!call) return null;
  const conv = conversations?.find((c) => c.id === call.conversationId);
  const title = conv ? titleOf(conv) : 'Call';
  const others = call.participants.filter((p) => p.userId !== me.id);
  const alone = others.length === 0;
  const canShare = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  const audio = Object.entries(call.remote).map(([uid, st]) => <RemoteAudio key={uid} stream={st} />);

  if (mini) return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full bg-neutral-950 py-2 pl-4 pr-2 text-white shadow-2xl ring-1 ring-white/10">
      {audio}
      <button onClick={() => { setMini(false); navigate(`/app/c/${call.conversationId}`); }} className="min-w-0 text-left">
        <p className="max-w-[10rem] truncate text-sm font-semibold">{title}</p>
        <p className="text-xs text-emerald-400">{alone ? 'Waiting…' : `${call.participants.length} in call`} · {duration}</p>
      </button>
      <button onClick={toggleMute} aria-label={call.muted ? 'Unmute' : 'Mute'} className="grid h-9 w-9 place-items-center rounded-full bg-white/10">{call.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
      <button onClick={() => setMini(false)} aria-label="Expand" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><Maximize2 className="h-4 w-4" /></button>
      <button onClick={leave} aria-label="Leave call" className="grid h-9 w-9 place-items-center rounded-full bg-red-600"><PhoneOff className="h-4 w-4" /></button>
    </div>
  );

  const tiles = [
    { id: me.id, name: me.name, image: me.image, stream: call.local, video: call.camera || call.screen, muted: call.muted, screen: call.screen, self: true, connecting: false },
    ...others.map((p) => {
      const person = people.get(p.userId);
      const st = call.states[p.userId];
      return { id: p.userId, name: person?.name ?? 'Someone', image: person?.image, stream: call.remote[p.userId], video: p.camera || p.screen, muted: p.muted, screen: p.screen, self: false, connecting: st !== 'connected' };
    }),
  ];
  const cols = tiles.length <= 1 ? 'grid-cols-1' : tiles.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-3';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white md:inset-4 md:rounded-3xl md:shadow-2xl md:ring-1 md:ring-white/10">
      {audio}
      <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="text-xs text-white/60">{alone ? 'Waiting for others to join…' : `${call.participants.length} people`} · {duration}</p>
        </div>
        <Popover>
          <PopoverTrigger className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> End-to-end encrypted</PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <p className="text-sm font-semibold">Call privacy code</p>
            <p className="mt-1 text-xs text-muted-foreground">Audio, video and screen share go straight between devices, encrypted with keys only the people in this call have. Chatting’s servers can’t see or hear them.</p>
            {call.privacyCode ? (
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-secondary p-3 text-center font-mono text-base tracking-wider">{call.privacyCode.map((g, i) => <span key={i}>{g}</span>)}</div>
            ) : <p className="mt-3 rounded-xl bg-secondary p-3 text-center text-xs text-muted-foreground">The code shows up once someone joins.</p>}
            <p className="mt-2 text-xs text-muted-foreground">Everyone in the call sees the same code. If yours matches theirs, no one is listening in. It changes when someone joins or leaves.</p>
          </PopoverContent>
        </Popover>
        <button onClick={() => setMini(true)} aria-label="Minimise" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><Minimize2 className="h-4 w-4" /></button>
      </header>
      <div className={cn('grid min-h-0 flex-1 content-center gap-3 overflow-y-auto px-3 sm:px-6', cols)}>
        {tiles.map((t) => <Tile key={t.id} name={t.name} image={t.image} stream={t.stream} showVideo={t.video} muted={t.muted} screen={t.screen} self={t.self} connecting={t.connecting} big={tiles.length === 1} />)}
      </div>
      <footer className="flex items-center justify-center gap-3 px-4 py-5">
        <Ctl label={call.muted ? 'Unmute' : 'Mute'} on={call.muted} onClick={toggleMute}>{call.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</Ctl>
        <Ctl label={call.camera ? 'Turn camera off' : 'Turn camera on'} on={call.camera} onClick={toggleCamera}>{call.camera ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</Ctl>
        {canShare && <Ctl label={call.screen ? 'Stop sharing' : 'Share screen'} on={call.screen} onClick={toggleScreen}><MonitorUp className="h-5 w-5" /></Ctl>}
        <Ctl label="Leave call" danger onClick={leave}><PhoneOff className="h-5 w-5" /></Ctl>
      </footer>
    </div>
  );
}
