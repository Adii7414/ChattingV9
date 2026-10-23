import { useState } from 'react';
import { toast } from 'sonner';
import { Search, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { ConvAvatar } from './Avatars';
import { useChat } from './store';
import type { Draft, Msg } from './messages';

export default function ForwardDialog({ message, onClose, send }: { message: Msg | null; onClose: () => void; send: (d: Draft, target?: string) => Promise<boolean> }) {
  const { conversations, titleOf } = useChat();
  const [q, setQ] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const list = (conversations ?? []).filter((c) => titleOf(c).toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const go = async (cid: string) => {
    if (!message) return;
    setSent((s) => [...s, cid]);
    const ok = await send({ body: message.body, files: message.attachments.map((a) => ({ url: a.url, filename: a.name, mimeType: a.mimeType })) }, cid);
    if (ok) toast.success('Forwarded'); else setSent((s) => s.filter((x) => x !== cid));
  };
  return (
    <Dialog open={!!message} onOpenChange={(o) => { if (!o) { onClose(); setSent([]); setQ(''); } }}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="p-6 pb-3"><DialogTitle>Forward message</DialogTitle><DialogDescription className="line-clamp-2">{message?.body || 'Attachment'}</DialogDescription></DialogHeader>
        <div className="px-6"><label className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3"><Search className="h-4 w-4 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="w-full bg-transparent text-sm outline-none" /></label></div>
        <div className="mt-2 max-h-80 overflow-y-auto px-3 pb-4">
          {list.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl px-3 py-2">
              <ConvAvatar c={c} size={36} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{titleOf(c)}</span>
              <button disabled={sent.includes(c.id)} onClick={() => go(c.id)} className="flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background disabled:bg-secondary disabled:text-muted-foreground">
                {sent.includes(c.id) ? 'Sent' : <><Send className="h-3 w-3" /> Send</>}
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
