import { ArrowLeft, Loader2, X } from 'lucide-react';
import Composer from './Composer';
import { MessageList, Typing } from './Thread';
import { useMessages } from './messages';
import type { MsgActions } from './MessageItem';
import type { Person } from './store';

export default function ThreadPanel({ conversationId, parentId, isGroup, onClose, onPerson, mentionable }: {
  conversationId: string; parentId: string; isGroup: boolean; onClose: () => void; onPerson: (u: string) => void; mentionable: Person[];
}) {
  const { data, messages, send, react, edit, remove, toggle } = useMessages(conversationId, parentId);
  const [parent, ...replies] = messages;
  const actions: MsgActions = { onReact: react, onEdit: edit, onPerson, onToggle: toggle, onDelete: (id) => { remove(id); if (id === parentId) onClose(); } };

  return (
    <aside className="flex min-w-0 flex-1 flex-col border-l border-border lg:w-[400px] lg:flex-none">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-3">
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary lg:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1"><p className="font-semibold">Thread</p><p className="text-xs text-muted-foreground">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</p></div>
        <button onClick={onClose} className="hidden h-9 w-9 place-items-center rounded-full hover:bg-secondary lg:grid" aria-label="Close thread" title="Close (Esc)"><X className="h-5 w-5" /></button>
      </header>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {!data ? <div className="grid h-full place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : !parent ? <p className="py-16 text-center text-sm text-muted-foreground">This message was deleted.</p> : (
            <>
              <MessageList messages={[parent]} isGroup inThread actions={actions} />
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'No replies yet'}<span className="h-px flex-1 bg-border" /></div>
              <MessageList messages={replies} isGroup={isGroup} inThread actions={actions} />
              <Typing ids={data.typing} />
            </>
          )}
      </div>
      {parent && <Composer onSend={(d) => send(d)} draftKey={`${conversationId}:${parentId}`} typingKey={`${conversationId}:${parentId}`} placeholder="Reply in thread" autoFocus mentionable={mentionable} />}
    </aside>
  );
}
