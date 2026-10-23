import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarClock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { scheduleMessage, type ScheduleMessageOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { DateTimePicker } from '@project/components/ui/date-picker';
import { Button } from '@project/components/ui/button';
import { errorMessage } from '../lib/errors';

const presets = [
  { label: 'In 1 hour', at: () => new Date(Date.now() + 3_600_000) },
  { label: 'Tonight 8 PM', at: () => { const d = new Date(); d.setHours(20, 0, 0, 0); if (+d < Date.now() + 60_000) d.setDate(d.getDate() + 1); return d; } },
  { label: 'Tomorrow 9 AM', at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
];

/** Pick a time to send the current draft, and manage messages already scheduled in this chat. */
export default function ScheduleSend({ open, onOpenChange, conversationId, body, onScheduled }: {
  open: boolean; onOpenChange: (o: boolean) => void; conversationId: string; body: string; onScheduled: () => void;
}) {
  const [at, setAt] = useState<Date | undefined>();
  const [items, setItems] = useState<ScheduleMessageOutputType['items']>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) scheduleMessage({ conversationId, action: 'list' }).then((r) => setItems(r.items)).catch(() => {}); }, [open, conversationId]);
  const schedule = async (when: Date) => {
    setBusy(true);
    try { const r = await scheduleMessage({ conversationId, action: 'create', body, sendAt: when.toISOString() }); setItems(r.items); toast.success(`Scheduled for ${format(when, 'EEE d MMM, h:mm a')}`); onScheduled(); setAt(undefined); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t schedule')); } finally { setBusy(false); }
  };
  const cancel = async (id: string) => {
    setItems((s) => s.filter((x) => x.id !== id));
    try { const r = await scheduleMessage({ conversationId, action: 'cancel', id }); setItems(r.items); } catch (e) { toast.error(errorMessage(e, 'Couldn’t cancel')); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Send later</DialogTitle>
          <DialogDescription>{body.trim() ? <span className="line-clamp-2">“{body.trim()}”</span> : 'Type a message first, then pick when to send it.'}</DialogDescription></DialogHeader>
        {body.trim() && <>
          <div className="grid grid-cols-3 gap-2">{presets.map((p) => <Button key={p.label} variant="outline" size="sm" disabled={busy} onClick={() => schedule(p.at())}>{p.label}</Button>)}</div>
          <div className="flex gap-2"><div className="flex-1"><DateTimePicker value={at} onChange={setAt} /></div><Button disabled={!at || busy} onClick={() => at && schedule(at)}>Schedule</Button></div>
        </>}
        {items.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled in this chat</p>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {items.map((x) => (
                <li key={x.id} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1"><p className="truncate">{x.body}</p><p className="text-xs text-muted-foreground">{format(new Date(x.sendAt), 'EEE d MMM, h:mm a')}</p></div>
                  <button onClick={() => cancel(x.id)} aria-label="Cancel scheduled message" className="grid h-8 w-8 place-items-center rounded-full hover:bg-background"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
