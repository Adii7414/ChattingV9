import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, Lock, ScanLine, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { useChat } from './store';
import { getIdentity, securityCode } from '../lib/e2e';
import type { useE2E } from './e2e';
import ScanCode from './ScanCode';

type E2E = ReturnType<typeof useE2E>;

/** WhatsApp-style "Verify security code" screen: 60-digit code, QR to show, and a camera to scan theirs. */
export default function EncryptionDialog({ open, onOpenChange, e2e, name }: { open: boolean; onOpenChange: (o: boolean) => void; e2e: E2E; name: string }) {
  const { me } = useChat();
  const [code, setCode] = useState<{ groups: string[]; qr: string } | null>(null);
  const [qrImg, setQrImg] = useState('');
  const [scan, setScan] = useState(false);
  useEffect(() => {
    if (!open || !e2e.them || !e2e.theirPub) return;
    setScan(false);
    getIdentity(me.id).then(({ pub }) => securityCode({ id: me.id, pub }, { id: e2e.them!, pub: e2e.theirPub! })).then(async (c) => {
      setCode(c);
      setQrImg(await QRCode.toDataURL(c.qr, { margin: 1, width: 480, errorCorrectionLevel: 'M' }));
    });
  }, [open, e2e.them, e2e.theirPub, me.id]);
  const onResult = useCallback((ok: boolean) => { if (ok) e2e.setVerified(true); }, [e2e]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Encryption</DialogTitle>
          <DialogDescription>Messages between you and {name} are end-to-end encrypted. Not even Chatting can read them.</DialogDescription>
        </DialogHeader>
        {!e2e.theirPub ? (
          <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">{e2e.theirPub === undefined ? 'Loading…' : `${name} hasn’t opened the updated Chatting yet, so there’s no security code to compare. Messages will be encrypted as soon as they do.`}</p>
        ) : scan && code ? <ScanCode expected={code.qr} onResult={onResult} /> : (
          <div className="space-y-4">
            <div className="mx-auto w-52 rounded-2xl bg-white p-3">{qrImg ? <img src={qrImg} alt="Security QR code" className="w-full" /> : <div className="aspect-square" />}</div>
            <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-center font-mono text-[15px] tracking-wider">
              {code?.groups.map((g, i) => <span key={i}>{g}</span>)}
            </div>
            <p className="text-center text-xs text-muted-foreground">To verify, scan their code or compare these 60 numbers with {name}’s screen. If they match, no one is listening in.</p>
            {e2e.verified && <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary"><ShieldCheck className="h-4 w-4" /> Verified</p>}
            <div className="flex gap-2">
              <button onClick={() => setScan(true)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background"><ScanLine className="h-4 w-4" /> Scan code</button>
              <button onClick={() => { navigator.clipboard.writeText(code?.groups.join(' ') ?? ''); toast.success('Security code copied'); }} className="grid h-10 w-10 place-items-center rounded-full border border-border" aria-label="Copy code"><Copy className="h-4 w-4" /></button>
            </div>
            <button onClick={() => { e2e.setVerified(!e2e.verified); toast.success(e2e.verified ? 'Marked as not verified' : 'Marked as verified'); }} className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground">
              {e2e.verified ? 'Clear verification' : 'The numbers match — mark as verified'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
