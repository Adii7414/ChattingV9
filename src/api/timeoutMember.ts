import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requirePerm, saveSettings, withAudit } from '../server/community';

export default createEndpoint({
  description: 'Times out a community member (they can read but not post) or lifts their timeout',
  authenticated: true,
  inputSchema: z.object({ communityId: z.string(), userId: z.string(), minutes: z.number().int().min(0).max(60 * 24 * 28) }),
  outputSchema: z.object({ until: z.string().nullable() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const { s, ownerId } = await requirePerm(input.communityId, me, 'kick');
    if (input.userId === ownerId || input.userId === me) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Cannot time out', userFacingMessage: 'You can’t time out that member.' });
    const timeouts = { ...s.timeouts };
    const until = input.minutes > 0 ? new Date(Date.now() + input.minutes * 60_000).toISOString() : null;
    if (until) timeouts[input.userId] = until; else delete timeouts[input.userId];
    const who = s.nicknames[input.userId] ?? 'a member';
    await saveSettings(input.communityId, withAudit({ ...s, timeouts }, me, until ? `timed out ${who} for ${input.minutes} min` : `lifted the timeout on ${who}`));
    return { until };
  },
});
