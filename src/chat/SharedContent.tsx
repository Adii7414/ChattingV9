import { Plain } from './e2e';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FileText, Loader2 } from 'lucide-react';
import { listCollection, type ListCollectionOutputType } from 'zitejs/api';
import { cn } from '@project/components/lib/utils';
import { useChat } from './store';

type Item = ListCollectionOutputType['items'][number];
const isImg = (a: Item['attachments'][number]) => a.mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(a.url);

/** Shared photos, files and pinned messages for one conversation. */
export default function SharedContent({ conversationId, onJump }: { conversationId: string; onJump: (id: string) => void }) {
  const { people, me } = useChat();
  const [tab, setTab] = useState<'media' | 'files' | 'pinned'>('media');
  const [media, setMedia] = useState<Item[] | null>(null);
  const [pinned, setPinned] = useState<Item[] | null>(null);
  useEffect(() => {
    listCollection({ kind: 'media', conversationId }).then((r) => setMedia(r.items)).catch(() => setMedia([]));
    listCollection({ kind: 'pinned', conversationId }).then((r) => setPinned(r.items)).catch(() => setPinned([]));
  }, [conversationId]);
  const images = (media ?? []).flatMap((m) => m.attachments.filter(isImg).map((a) => ({ ...a, mid: m.id })));
  const files = (media ?? []).flatMap((m) => m.attachments.filter((a) => !isImg(a)).map((a) => ({ ...a, mid: m.id, at: m.sentAt })));
  const loading = media === null || pinned === null;

  return (
    <div>
      <div className="grid grid-cols-3 rounded-xl bg-secondary p-1 text-sm font-medium">
        {([['media', `Photos ${images.length || ''}`], ['files', `Files ${files.length || ''}`], ['pinned', `Pinned ${pinned?.length || ''}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn('rounded-lg py-1.5', tab === k ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{l}</button>
        ))}
      </div>
      <div className="mt-3 min-h-24">
        {loading ? <div className="grid h-24 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          : tab === 'media' ? (images.length ? <div className="grid grid-cols-3 gap-1.5">{images.map((a) => <a key={a.url + a.mid} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" /></a>)}</div> : <Empty t="No photos shared yet" />)
          : tab === 'files' ? (files.length ? files.map((a) => <a key={a.url + a.mid} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-secondary"><FileText className="h-5 w-5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm">{a.name}</span><span className="text-xs text-muted-foreground">{format(new Date(a.at), 'd MMM')}</span></a>) : <Empty t="No files shared yet" />)
          : pinned!.length ? pinned!.map((m) => (
            <button key={m.id} onClick={() => onJump(m.id)} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-secondary">
              <p className="text-xs text-muted-foreground">{m.senderId === me.id ? 'You' : people.get(m.senderId)?.name ?? 'Someone'} · {format(new Date(m.sentAt), 'd MMM')}</p>
              <p className="line-clamp-2 text-sm">{m.body ? <Plain body={m.body}>{(t) => t}</Plain> : 'Attachment'}</p>
            </button>
          )) : <Empty t="Pin important messages from their ⋯ menu" />}
      </div>
    </div>
  );
}
const Empty = ({ t }: { t: string }) => <p className="py-8 text-center text-sm text-muted-foreground">{t}</p>;
