import { Plain } from './e2e';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, Star } from 'lucide-react';
import { listCollection, messageAction, type ListCollectionOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { RichText } from './MessageItem';
import { useChat, usePoll } from './store';
import { errorMessage } from '../lib/errors';

export default function Saved() {
  const { conversations, titleOf, people, me } = useChat();
  const navigate = useNavigate();
  const [items, setItems] = useState<ListCollectionOutputType['items'] | null>(null);
  usePoll(() => listCollection({ kind: 'starred' }).then((r) => setItems(r.items)).catch(() => setItems([])), 30000);
  const unsave = async (id: string) => {
    setItems((x) => x?.filter((i) => i.id !== id) ?? null);
    try { await messageAction({ messageId: id, action: 'star' }); } catch (e) { toast.error(errorMessage(e, 'Couldn’t update')); }
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <Link to="/app" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground md:hidden"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Saved messages</h1>
        <p className="mt-2 text-muted-foreground">Messages you’ve saved from any chat. Only you can see this list.</p>
        <div className="mt-8 space-y-3">
          {items === null && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}
          {items?.map((m) => {
            const c = conversations?.find((x) => x.id === m.conversationId);
            return (
              <div key={m.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{m.senderId === me.id ? 'You' : people.get(m.senderId)?.name ?? 'Someone'}</span>
                  in {c ? titleOf(c) : 'a chat'} · {format(new Date(m.sentAt), 'd MMM, h:mm a')}
                  <button onClick={() => unsave(m.id)} className="ml-auto" aria-label="Unsave" title="Unsave"><Star className="h-4 w-4 fill-primary text-primary" /></button>
                </div>
                {m.body && <p className="mt-2 whitespace-pre-wrap text-[15px]"><Plain body={m.body}>{(t) => <RichText text={t} />}</Plain></p>}
                {m.attachments.length > 0 && <p className="mt-2 text-sm text-muted-foreground">📎 {m.attachments.map((a) => a.name).join(', ')}</p>}
                <button onClick={() => navigate(`/app/c/${m.conversationId}`)} className="mt-3 text-sm font-medium text-primary">Open chat →</button>
              </div>
            );
          })}
          {items?.length === 0 && <p className="py-16 text-center text-muted-foreground">Nothing saved yet. Use “Save message” from any message’s ⋯ menu.</p>}
        </div>
      </div>
    </section>
  );
}
