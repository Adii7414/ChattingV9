import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUpload } from 'zitejs/upload';
import { errorMessage } from '../lib/errors';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Hold-free voice recorder: tap to record, then send or discard. Calls onDone with the uploaded file. */
export default function VoiceRecorder({ onDone, disabled }: { onDone: (f: { url: string; filename: string; mimeType: string }) => void; disabled?: boolean }) {
  const { upload } = useUpload();
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const keep = useRef(false);
  useEffect(() => { if (!rec) return; const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [rec]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = []; keep.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!keep.current || !chunks.current.length) return;
        const mime = (r.mimeType || 'audio/webm').split(';')[0];
        const file = new File(chunks.current, `voice-message.${mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: mime });
        setBusy(true);
        try { const { url } = await upload(file); onDone({ url, filename: file.name, mimeType: mime }); }
        catch (e) { toast.error(errorMessage(e, 'Couldn’t upload the voice message')); } finally { setBusy(false); }
      };
      r.start(); setSecs(0); setRec(r);
    } catch { toast.error('Microphone access was blocked — allow it in your browser settings.'); }
  };
  const stop = (send: boolean) => { keep.current = send; rec?.stop(); setRec(null); };

  if (!rec) return (
    <button onClick={start} disabled={disabled || busy} aria-label="Record voice message" title="Voice message"
      className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-40">
      <Mic className={busy ? 'h-5 w-5 animate-pulse' : 'h-5 w-5'} />
    </button>
  );
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-destructive/10 pl-3 pr-1 text-sm text-destructive">
      <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /><span className="w-10 tabular-nums">{fmt(secs)}</span>
      <button onClick={() => stop(false)} aria-label="Discard recording" className="grid h-8 w-8 place-items-center rounded-full hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
      <button onClick={() => stop(true)} aria-label="Finish recording" className="grid h-8 w-8 place-items-center rounded-full bg-destructive text-destructive-foreground">{secs > 0 ? <Send className="h-4 w-4" /> : <Square className="h-3.5 w-3.5" />}</button>
    </div>
  );
}
