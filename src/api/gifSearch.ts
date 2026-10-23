import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';

type Giphy = { data: { id: string; title: string; images: { fixed_width: { url: string; width: string; height: string }; original: { url: string } } }[] };

export default createEndpoint({
  description: 'Searches GIPHY for GIFs (trending when the search is empty)',
  authenticated: true,
  inputSchema: z.object({ query: z.string().max(100) }),
  outputSchema: z.object({ gifs: z.array(z.object({ id: z.string(), title: z.string(), preview: z.string(), url: z.string() })) }),
  execute: async ({ input }) => {
    const key = process.env.ZITE_GIPHY_API_KEY;
    if (!key) throw new ZiteError({ code: 'BAD_REQUEST', message: 'ZITE_GIPHY_API_KEY not set', userFacingMessage: 'GIFs aren’t set up yet.' });
    const q = input.query.trim();
    const url = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=pg-13`;
    const res = await fetch(url);
    if (!res.ok) throw new ZiteError({ code: 'INTERNAL_ERROR', message: `GIPHY ${res.status}`, userFacingMessage: 'Couldn’t load GIFs right now.' });
    const j = (await res.json()) as Giphy;
    return { gifs: j.data.map((g) => ({ id: g.id, title: g.title, preview: g.images.fixed_width.url, url: g.images.original.url })) };
  },
});
