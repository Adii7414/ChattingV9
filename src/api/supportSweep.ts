import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireStaff } from '../server/staff';
import { sweepSupport } from '../server/modOfficial';

export default createEndpoint({
  description: 'Sends idle check-ins, auto-closes quiet support tickets and finishes closes after the rating window',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ checkIns: z.number(), autoClosed: z.number(), finished: z.number() }),
  execute: async ({ context }) => {
    requireStaff(context.user);
    return sweepSupport();
  },
});
