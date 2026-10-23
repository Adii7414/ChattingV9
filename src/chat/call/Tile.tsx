import { useEffect, useRef, useState } from 'react';
import { MicOff, MonitorUp } from 'lucide-react';
import PersonAvatar from '../Avatars';
import { cn } from '@project/components/lib/utils';

/** True while the stream's audio is above a speaking threshold. */
function useSpeaking(stream: MediaStream | null | undefined) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return;
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const t = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += (v - 128) ** 2;
      setOn(Math.sqrt(sum / buf.length) > 6);
    }, 150);
    return () => { clearInterval(t); ctx.close().catch(() => {}); };
  }, [stream]);
  return on;
}

export default function Tile({ name, image, stream, showVideo, muted, screen, self, connecting, big }: {
  name: string; image?: string | null; stream: MediaStream | null | undefined; showVideo: boolean; muted: boolean; screen?: boolean; self?: boolean; connecting?: boolean; big?: boolean;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const speaking = useSpeaking(muted ? null : stream);
  useEffect(() => { if (v.current && v.current.srcObject !== stream) v.current.srcObject = stream ?? null; }, [stream, showVideo]);
  return (
    <div className={cn('relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06] ring-2 transition', speaking ? 'ring-primary' : 'ring-transparent', big ? 'aspect-video w-full' : 'aspect-video')}>
      {showVideo ? (
        <video ref={v} autoPlay playsInline muted className={cn('h-full w-full', screen ? 'object-contain' : 'object-cover', self && !screen && '-scale-x-100')} />
      ) : (
        <div className={cn('rounded-full transition', speaking && 'shadow-[0_0_0_6px_hsl(var(--primary)/0.35)]')}><PersonAvatar name={name} image={image} size={big ? 96 : 64} /></div>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
        {muted && <MicOff className="h-3 w-3 text-red-400" />}{screen && <MonitorUp className="h-3 w-3" />}
        <span className="truncate">{self ? `${name} (you)` : name}</span>
        {connecting && <span className="text-white/60">· connecting…</span>}
      </div>
    </div>
  );
}
