import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Loader2, Megaphone, Send } from 'lucide-react';
import { modAnnouncements, type ModAnnouncementsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Empty, ago } from '../kit';
import { errorMessage } from '../../lib/errors';

export default function Announcements() {
  const [d, setD] = useState<ModAnnouncementsOutputType | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { modAnnouncements({}).then(setD).catch((e) => toast.error(errorMessage(e, 'Couldn’t load announcements'))); }, []);
  const ok = title.trim().length >= 3 && body.trim().length >= 3;
  const send = async () => {
    setBusy(true);
    try { setD(await modAnnouncements({ send: { title: title.trim(), body: body.trim() } })); setTitle(''); setBody(''); toast.success('Announcement sent'); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t send the announcement')); } finally { setBusy(false); setConfirm(false); }
  };
  const n = d?.recipients ?? 0;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div><h1 className="text-xl font-semibold">Announcements</h1><p className="flex items-center gap-1 text-sm text-muted-foreground">Sent from the verified Chatting account <BadgeCheck className="h-4 w-4 fill-primary text-primary-foreground" /></p></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {!d ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />) : d.announcements.length === 0 ? <Empty><Megaphone className="mb-2 h-6 w-6" />No announcements yet.</Empty> : d.announcements.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">Sent {ago(a.sentAt)} · {a.sentBy} · {a.recipients.toLocaleString()} people</p>
            </div>
          ))}
        </div>
        <div className="h-fit space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold">New update</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={3000} placeholder="What’s new?" />
          <p className="text-xs text-muted-foreground">{d ? `Goes to ${n.toLocaleString()} people (${d.optedOut} opted out)` : 'Counting recipients…'}</p>
          <Button className="w-full" disabled={!ok || busy || !n} onClick={() => setConfirm(true)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send as Chatting</Button>
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Send to {n.toLocaleString()} people?</AlertDialogTitle>
            <AlertDialogDescription>“{title}” will land in everyone’s Chatting DM right away. Sends can’t be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); send(); }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send now</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
