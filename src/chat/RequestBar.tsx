import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { blockUser, messageRequest } from 'zitejs/api';
import { useChat } from './store';
import { errorMessage } from '../lib/errors';

/** Shown instead of the composer when someone who isn't a friend messages you. */
export default function RequestBar({ conversationId, name, onPerson }: { conversationId: string; name: string; onPerson: () => void }) {
  const { refresh, othersOf, conversations } = useChat();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (k: 'accept' | 'decline' | 'block') => {
    setBusy(k);
    try {
      if (k === 'block') {
        const c = conversations?.find((x) => x.id === conversationId);
        const other = c && othersOf(c)[0];
        if (other) await blockUser({ userId: other.id });
      }
      await messageRequest({ conversationId, action: k === 'accept' ? 'accept' : 'decline' });
      await refresh();
      toast.success(k === 'accept' ? 'Request accepted' : k === 'block' ? `Blocked ${name}` : 'Request deleted');
      if (k !== 'accept') navigate('/app');
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t answer the request')); } finally { setBusy(null); }
  };
  const b = 'inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium disabled:opacity-50';
  return (
    <div className="shrink-0 border-t border-border bg-card px-4 py-4 text-center sm:px-6">
      <p className="text-sm"><button onClick={onPerson} className="font-semibold hover:underline">{name}</button> wants to message you</p>
      <p className="mt-0.5 text-xs text-muted-foreground">You’re not friends. They won’t know you’ve read this until you accept.</p>
      <div className="mx-auto mt-3 flex max-w-sm gap-2">
        <button disabled={!!busy} onClick={() => run('block')} className={`${b} text-destructive hover:bg-destructive/10`}>{busy === 'block' && <Loader2 className="h-4 w-4 animate-spin" />}Block</button>
        <button disabled={!!busy} onClick={() => run('decline')} className={`${b} border border-border`}>{busy === 'decline' && <Loader2 className="h-4 w-4 animate-spin" />}Delete</button>
        <button disabled={!!busy} onClick={() => run('accept')} className={`${b} bg-primary text-primary-foreground`}>{busy === 'accept' && <Loader2 className="h-4 w-4 animate-spin" />}Accept</button>
      </div>
    </div>
  );
}
