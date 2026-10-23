import { useEffect, useState } from 'react';
import { linkPreview, type LinkPreviewOutputType } from 'zitejs/api';

const cache = new Map<string, Promise<LinkPreviewOutputType | null>>();
const get = (url: string) => {
  if (!cache.has(url)) cache.set(url, linkPreview({ url }).catch(() => null));
  return cache.get(url)!;
};

/** A card for the first link in a message (title, description, image). */
export default function LinkPreview({ text }: { text: string }) {
  const url = text.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[).,!?]+$/, '');
  const [p, setP] = useState<LinkPreviewOutputType | null>(null);
  useEffect(() => { let on = true; setP(null); if (url) get(url).then((r) => on && setP(r)); return () => { on = false; }; }, [url]);
  if (!url || !p || (!p.title && !p.image)) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block w-72 max-w-full overflow-hidden rounded-2xl border border-border bg-card text-card-foreground transition hover:bg-secondary">
      {p.image && <img src={p.image} alt="" loading="lazy" className="h-36 w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
      <div className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{p.site}</p>
        {p.title && <p className="line-clamp-2 text-sm font-semibold">{p.title}</p>}
        {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
      </div>
    </a>
  );
}
