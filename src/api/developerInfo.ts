import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Returns the public Bot API URL for the developer docs',
  inputSchema: z.object({}),
  outputSchema: z.object({ apiUrl: z.string().nullable() }),
  execute: async () => ({ apiUrl: (process.env as Record<string, string | undefined>).ZITE_BOT_API_URL || null }),
});
