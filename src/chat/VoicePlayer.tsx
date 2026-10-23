import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@project/components/lib/utils';

const BARS = 36;
const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
const SPEEDS = [1, 1.5, 2];

/** A waveform-style voice note player that matches the chat bubbles. */
export default function VoicePlayer({ src, mine }: { src: string; mine?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(0);
  // Stable pseudo-waveform from the URL so every note looks distinct.
  const bars = useMemo(() => {
    let h = 0; for (const c of src) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: BARS }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; const env = Math.sin((i / BARS) * Math.PI) * 0.5 + 0.5; return 0.2 + ((h % 1000) / 1000) * 0.8 * env; });
  }, [src]);

  useEffect(() => {
    const a = audio.current; if (!a) return;
    const onMeta = () => {
      // webm recordings often report Infinity until the browser scans to the end.
      if (a.duration === Infinity) { a.currentTime = 1e9; a.ontimeupdate = () => { a.ontimeupdate = null; setDur(a.duration); a.currentTime = 0; }; }
      else setDur(a.duration);
    };
    const onTime = () => setT(a.currentTime);
    const onEnd = () => { setPlaying(false); setT(0); };
    a.addEventListener('loadedmetadata', onMeta); a.addEventListener('timeupdate', onTime); a.addEventListener('ended', onEnd);
    a.addEventListener('waiting', () => setLoading(true)); a.addEventListener('playing', () => setLoading(false));
    return () => { a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd); };
  }, []);

  const toggle = async () => {
    const a = audio.current; if (!a) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    document.querySelectorAll('audio').forEach((x) => x !== a && x.pause());
    try { setLoading(true); await a.play(); setPlaying(true); } catch { /* blocked */ } finally { setLoading(false); }
  };
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = audio.current; if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dur; setT(a.currentTime);
  };
  const cycle = () => { const n = (speed + 1) % SPEEDS.length; setSpeed(n); if (audio.current) audio.current.playbackRate = SPEEDS[n]; };
  const pct = dur ? t / dur : 0;

  return (
    <div className={cn('flex w-64 max-w-full items-center gap-2.5 rounded-[20px] px-2 py-2', mine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground')}>
      <audio ref={audio} src={src} preload="metadata" onPause={() => setPlaying(false)} />
      <button onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-95', mine ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground')}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)} tabIndex={0}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e); }} onPointerMove={(e) => e.buttons && seek(e)}
          className="flex h-7 cursor-pointer touch-none items-center gap-[2px]">
          {bars.map((h, i) => (
            <span key={i} className={cn('flex-1 rounded-full transition-colors duration-150', i / BARS < pct ? (mine ? 'bg-primary-foreground' : 'bg-primary') : (mine ? 'bg-primary-foreground/35' : 'bg-foreground/20'))}
              style={{ height: `${h * 100}%` }} />
          ))}
        </div>
        <p className={cn('mt-0.5 text-[11px] tabular-nums', mine ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{fmt(playing || t ? t : dur)}</p>
      </div>
      <button onClick={cycle} aria-label="Playback speed" className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', mine ? 'bg-primary-foreground/15' : 'bg-background/70')}>{SPEEDS[speed]}×</button>
    </div>
  );
}
