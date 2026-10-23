import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageCircle } from 'lucide-react';
import { useChat } from './store';
import { openSupport, Verified } from './official';

const FAQ = [
  ['How do I get help?', 'Tap “Chat with support”. Pick what your issue is about, describe it in one message, and our team will reply in the same chat.'],
  ['How quickly will I hear back?', 'Most people get a reply within a day. You’ll see it in your Chatting Support chat, like any other message.'],
  ['My account is suspended — can I still contact you?', 'Yes. You can always message Chatting Support, even while suspended, to appeal.'],
  ['What happens when my issue is solved?', 'When your ticket is closed, the support chat is removed from your list. You can start a new one any time.'],
  ['How do I report a message?', 'Hover a message, open the ⋯ menu and choose Report. Community moderators and our team will see it.'],
];

export default function HelpSupport() {
  const navigate = useNavigate();
  const { refresh } = useChat();
  const [busy, setBusy] = useState(false);
  const start = async () => { setBusy(true); await openSupport(navigate, refresh); setBusy(false); };
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-semibold">Chatting Support <Verified /></p>
          <p className="text-sm text-muted-foreground">Talk to our team in a private chat. Replies arrive right in Chatting.</p>
        </div>
        <button onClick={start} disabled={busy} className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Chat with support
        </button>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium">{q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
