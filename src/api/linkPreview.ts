import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export default createEndpoint({
  description: 'Fetches the title, description and image for a link shared in chat',
  authenticated: true,
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: z.object({ title: z.string().nullable(), description: z.string().nullable(), image: z.string().nullable(), site: z.string() }),
  execute: async ({ input }) => {
    const u = new URL(input.url);
    const empty = { title: null, description: null, image: null, site: u.hostname.replace(/^www\./, '') };
    if (!/^https?:$/.test(u.protocol)) return empty;
    try {
      const res = await fetch(u.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChattingBot/1.0)', Accept: 'text/html' }, signal: AbortSignal.timeout(5000) });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return empty;
      const html = (await res.text()).slice(0, 200_000);
      const meta = (name: string) => {
        const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
          ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'));
        return m ? decode(m[1]).trim() || null : null;
      };
      const title = meta('og:title') ?? meta('twitter:title') ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]).trim() : null);
      let image = meta('og:image') ?? meta('twitter:image');
      if (image) { try { image = new URL(image, u).toString(); } catch { image = null; } }
      return { ...empty, title, description: meta('og:description') ?? meta('description'), image, site: meta('og:site_name') ?? empty.site };
    } catch { return empty; }
  },
});
