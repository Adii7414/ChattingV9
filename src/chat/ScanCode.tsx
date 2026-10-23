import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { BarcodeDetector } from 'barcode-detector/pure';
import { CheckCircle2, XCircle } from 'lucide-react';

/** Camera view that reads the other person's security QR code and reports whether it matches ours. */
export default function ScanCode({ expected, onResult }: { expected: string; onResult: (ok: boolean) => void }) {
  const cam = useRef<Webcam>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (result !== null) return;
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    let busy = false;
    const t = setInterval(async () => {
      const video = cam.current?.video;
      if (busy || !video || video.readyState < 2) return;
      busy = true;
      try {
        const codes = await detector.detect(video);
        const hit = codes.find((c) => c.rawValue.startsWith('chatting-e2e:'));
        if (hit) { const ok = hit.rawValue === expected; setResult(ok); onResult(ok); }
      } catch { /* keep scanning */ } finally { busy = false; }
    }, 250);
    return () => clearInterval(t);
  }, [expected, onResult, result]);

  if (result !== null) return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {result ? <CheckCircle2 className="h-14 w-14 text-primary" /> : <XCircle className="h-14 w-14 text-destructive" />}
      <p className="font-semibold">{result ? 'Security code verified' : 'Codes don’t match'}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{result ? 'Your messages with this person are end-to-end encrypted and no one has stepped in between you.' : 'This could mean you scanned the wrong code, or one of you changed devices. Ask them to reopen this screen and try again.'}</p>
      <button onClick={() => setResult(null)} className="text-sm font-medium text-primary">Scan again</button>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
        {denied ? <p className="grid h-full place-items-center p-6 text-center text-sm text-white/80">Camera access is blocked. Allow it in your browser to scan.</p> : (
          <Webcam ref={cam} audio={false} onUserMediaError={() => setDenied(true)} videoConstraints={{ facingMode: 'environment' }} className="h-full w-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-white/80" />
      </div>
      <p className="text-center text-xs text-muted-foreground">Point your camera at the QR code on the other person’s screen.</p>
    </div>
  );
}
