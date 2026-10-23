import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireCommunityMember, requireActive } from '../server/chat';
import { requirePerm } from '../server/community';

const event = z.object({
  id: z.string(), title: z.string(), description: z.string(), startsAt: z.string(), location: z.string(),
  createdBy: z.string(), going: z.array(z.string()), maybe: z.array(z.string()),
});

export default createEndpoint({
  description: 'Lists, creates, deletes and RSVPs to community events',
  authenticated: true,
  inputSchema: z.object({
    communityId: z.string(),
    action: z.enum(['list', 'create', 'delete', 'rsvp']),
    id: z.string().optional(),
    rsvp: z.enum(['going', 'maybe', 'none']).optional(),
    event: z.object({ title: z.string().min(1).max(120), description: z.string().max(2000), startsAt: z.string(), location: z.string().max(200) }).optional(),
  }),
  outputSchema: z.object({ events: z.array(event) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const cid = input.communityId;
    await requireCommunityMember(cid, me);
    if (input.action === 'create' && input.event) {
      await requirePerm(cid, me, 'manageCommunity');
      const at = new Date(input.event.startsAt);
      if (isNaN(+at)) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Bad date', userFacingMessage: 'Pick a valid date and time.' });
      await zite.communityEvents.create({ record: { ...input.event, startsAt: at.toISOString(), communityId: cid, createdBy: me, going: [me] } as never });
    }
    if ((input.action === 'delete' || input.action === 'rsvp') && input.id) {
      const e = await zite.communityEvents.findOne({ id: input.id });
      if (!e || e.communityId !== cid) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Not found', userFacingMessage: 'That event no longer exists.' });
      if (input.action === 'delete') {
        if (!ids(e.createdBy as string | string[]).includes(me)) await requirePerm(cid, me, 'manageCommunity');
        await zite.communityEvents.delete({ id: e.id });
      } else {
        const going = ids(e.going as string[]).filter((u) => u !== me), maybe = ids(e.maybe as string[]).filter((u) => u !== me);
        if (input.rsvp === 'going') going.push(me);
        if (input.rsvp === 'maybe') maybe.push(me);
        await zite.communityEvents.update({ id: e.id, record: { going, maybe } as never });
      }
    }
    const r = await zite.sql({
      query: `SELECT id, "title", "description", "startsAt", "location", "createdBy"->>0 AS "createdBy", "going", "maybe" FROM "CommunityEvents"
              WHERE "communityId" = $1 AND "startsAt" > now() - interval '1 day' ORDER BY "startsAt" LIMIT 50`,
      params: [cid],
    });
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    return { events: r.rows.map((x) => ({
      id: String(x.id), title: String(x.title ?? ''), description: String(x.description ?? ''), startsAt: new Date(String(x.startsAt)).toISOString(),
      location: String(x.location ?? ''), createdBy: String(x.createdBy ?? ''), going: arr(x.going), maybe: arr(x.maybe),
    })) };
  },
});
