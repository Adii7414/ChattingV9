import { useEffect, useState } from 'react';
import { Loader2, NotebookPen } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { draft } from 'zitejs/api';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@project/components/ui/sheet';

/** A private notepad attached to a chat — only you can see it, synced across your devices. */
export default function ChatNotes({ open, onOpenChange, conversationId }: { open: boolean; onOpenChange: (o: boolean) => void; conversationId: string }) {
  const key = `note:${conversationId}`;
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  useEffect(() => { if (open) { setText(null); draft({ conversationId: key }).then((d) => setText(d.body)).catch(() => setText('')); } }, [open, key]);
  const save = useDebouncedCallback(async (v: string) => { try { await draft({ conversationId: key, body: v }); setSaved(true); } catch { /* retry on next edit */ } }, 700);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) save.flush(); onOpenChange(o); }}>
      <SheetContent className="flex flex-col">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><NotebookPen className="h-5 w-5 text-primary" /> My notes</SheetTitle>
          <SheetDescription>Private to you — jot down plans, addresses, to-dos for this chat.</SheetDescription></SheetHeader>
        {text === null ? <div className="grid flex-1 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <textarea autoFocus value={text} maxLength={5000} onChange={(e) => { setText(e.target.value); setSaved(false); save(e.target.value); }} placeholder="Start typing…"
            className="mt-4 flex-1 resize-none rounded-2xl border border-input bg-background p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring" />
        )}
        <p className="mt-2 text-right text-xs text-muted-foreground">{saved ? 'Saved' : 'Saving…'}</p>
      </SheetContent>
    </Sheet>
  );
}
