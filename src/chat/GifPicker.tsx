import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { gifSearch, type GifSearchOutputType } from 'zitejs/api';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { errorMessage } from '../lib/errors';

export default function GifPicker({ onPick }: { onPick: (url: string, title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [dq] = useDebounce(q, 350);
  const [gifs, setGifs] = useState<GifSearchOutputType['gifs'] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let on = true; setGifs(null); setErr(null);
    gifSearch({ query: dq }).then((r) => on && setGifs(r.gifs)).catch((e) => on && setErr(errorMessage(e, 'Couldn’t load GIFs')));
    return () => { on = false; };
  }, [dq, open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="GIF" title="GIF" className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full text-[11px] font-bold text-muted-foreground hover:bg-secondary">GIF</PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-2">
        <label className="mb-2 flex h-9 items-center gap-2 rounded-lg bg-secondary px-2.5"><Search className="h-4 w-4 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIPHY" className="w-full bg-transparent text-sm outline-none" /></label>
        <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto">
          {err ? <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">{err}</p>
            : !gifs ? <div className="col-span-2 grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : !gifs.length ? <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">No GIFs found</p>
            : gifs.map((g) => <button key={g.id} onClick={() => { onPick(g.url, g.title); setOpen(false); setQ(''); }} className="overflow-hidden rounded-lg bg-secondary"><img src={g.preview} alt={g.title} loading="lazy" className="h-24 w-full object-cover" /></button>)}
        </div>
        <p className="mt-1.5 text-right text-[10px] text-muted-foreground">Powered by GIPHY</p>
      </PopoverContent>
    </Popover>
  );
}
