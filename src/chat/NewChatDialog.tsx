import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { Check, Loader2, Search, X } from 'lucide-react';
import { createConversation, findPeople, type FindPeopleOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import PersonAvatar from './Avatars';
import { useChat } from './store';
import { errorMessage } from '../lib/errors';

type P = FindPeopleOutputType['people'][number];

export default function NewChatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { refresh } = useChat();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<P[] | null>(null);
  const [picked, setPicked] = useState<P[]>([]);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useDebouncedCallback(async (v: string) => {
    try { setPeople((await findPeople({ query: v })).people); } catch { setPeople([]); }
  }, 250);
  useEffect(() => { if (open) { setQ(''); setPicked([]); setName(''); setEmoji(''); setPeople(null); load(''); } }, [open, load]);

  const toggle = (p: P) => setPicked((s) => (s.some((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]));
  const start = async () => {
    setBusy(true);
    try {
      const { id } = await createConversation({ memberIds: picked.map((p) => p.id), name: picked.length > 1 && name.trim() ? name.trim() : undefined, emoji: picked.length > 1 ? emoji : undefined });
      await refresh();
      onOpenChange(false);
      navigate(`/app/c/${id}`);
    } catch (e) {
      toast.error(errorMessage(e, 'Couldn’t start the conversation'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl tracking-tight">New conversation</DialogTitle>
          <DialogDescription>Pick a friend for a direct message, or several for a group.</DialogDescription>
        </DialogHeader>
        <div className="px-6">
          {picked.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <button key={p.id} onClick={() => toggle(p)} className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-2.5 text-sm">
                  <PersonAvatar name={p.name} image={p.image} size={22} /> {p.name.split(' ')[0]} <X className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          {picked.length > 1 && (
            <div className="mb-3 flex gap-2">
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} placeholder="😎" aria-label="Group emoji" className="focus-ring h-10 w-12 rounded-xl border border-input bg-background text-center outline-none" />
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Group name (optional)" className="focus-ring h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none" />
            </div>
          )}
          <label className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} placeholder="Search by @username" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </label>
        </div>
        <div className="mt-2 h-72 overflow-y-auto px-3">
          {people === null && <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {people?.length === 0 && <p className="px-3 py-12 text-center text-sm text-muted-foreground">{q.replace(/^@/, '').length >= 2 ? `No one with a username starting “${q.replace(/^@/, '')}”.` : 'Type at least 2 letters of someone’s @username.'}</p>}
          {people?.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <button key={p.id} onClick={() => toggle(p)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-secondary/60">
                <PersonAvatar name={p.name} image={p.image} size={40} />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.name}</p><p className="truncate text-sm text-muted-foreground">@{p.username}</p></div>
                <span className={`grid h-6 w-6 place-items-center rounded-full border ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border p-4">
          <button disabled={!picked.length || busy} onClick={start} className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground font-medium text-background transition disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {picked.length > 1 ? `Start group with ${picked.length}` : 'Start chatting'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
