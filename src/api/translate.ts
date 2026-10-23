import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  description: 'Translates a message into the reader’s language',
  authenticated: true,
  inputSchema: z.object({ text: z.string().min(1).max(2000), target: z.string().min(2).max(10) }),
  outputSchema: z.object({ text: z.string(), from: z.string().nullable() }),
  execute: async ({ input }) => {
    const target = input.target.split('-')[0];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(input.text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new ZiteError({ code: 'INTERNAL_ERROR', message: `Translate ${res.status}`, userFacingMessage: 'Translation isn’t available right now.' });
    const j = (await res.json()) as [Array<[string, string]>, unknown, string];
    const text = (j[0] ?? []).map((p) => p[0]).join('');
    return { text: text || input.text, from: typeof j[2] === 'string' ? j[2] : null };
  },
});
