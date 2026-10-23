import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { fail } from '../server/errors';
import { ids, requireMember } from '../server/chat';

const ACTIVE = `"lastSeenAt" > now() - interval '12 seconds'`;
const MAX_PEOPLE = 8; // media goes device-to-device, so calls stay small

const participant = z.object({ userId: z.string(), muted: z.boolean(), camera: z.boolean(), screen: z.boolean(), joinedAt: z.string() });
const signal = z.object({ seq: z.number(), from: z.string(), kind: z.string(), payload: z.string() });

async function participants(cid: string) {
  const r = await zite.sql({ query: `SELECT "userKey", "muted", "cameraOn", "screenSharing", "joinedAt" FROM "CallParticipants" WHERE "conversationKey" = $1 AND ${ACTIVE} ORDER BY "joinedAt"`, params: [cid] });
  return r.rows.map((p) => ({ userId: String(p.userKey), muted: !!p.muted, camera: !!p.cameraOn, screen: !!p.screenSharing, joinedAt: String(p.joinedAt ?? '') }));
}

export default createEndpoint({
  description: 'Runs voice and video calls: join, keep-alive with handshake delivery, send a handshake, leave, and list ringing calls',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['join', 'poll', 'signal', 'leave', 'active', 'peek']),
    conversationId: z.string().optional(),
    video: z.boolean().optional(),
    muted: z.boolean().optional(),
    camera: z.boolean().optional(),
    screen: z.boolean().optional(),
    after: z.number().optional(),
    to: z.string().optional(),
    kind: z.string().optional(),
    payload: z.string().max(20000).optional(),
  }),
  outputSchema: z.object({
    participants: z.array(participant),
    signals: z.array(signal),
    calls: z.array(z.object({ conversationId: z.string(), startedBy: z.string(), startedAt: z.string(), video: z.boolean(), count: z.number() })),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const none = { participants: [] as z.infer<typeof participant>[], signals: [] as z.infer<typeof signal>[], calls: [] as { conversationId: string; startedBy: string; startedAt: string; video: boolean; count: number }[] };

    if (input.action === 'active') {
      // Calls in my DMs/groups (not community channels) that I'm not in — these ring.
      const r = await zite.sql({
        query: `SELECT p."conversationKey" AS cid, MIN(p."joinedAt") AS started, COUNT(*) AS n, BOOL_OR(p."videoCall") AS video,
                  (ARRAY_AGG(p."userKey" ORDER BY p."joinedAt"))[1] AS starter
                FROM "CallParticipants" p JOIN "Conversations" c ON c.id::text = p."conversationKey"
                WHERE p.${ACTIVE} AND c."members" @> jsonb_build_array($1::text) AND (c."communityId" IS NULL OR c."communityId" = '')
                GROUP BY p."conversationKey" HAVING NOT BOOL_OR(p."userKey" = $1)`,
        params: [me],
      });
      return { ...none, calls: r.rows.map((c) => ({ conversationId: String(c.cid), startedBy: String(c.starter), startedAt: String(c.started), video: !!c.video, count: Number(c.n) })) };
    }

    const cid = input.conversationId;
    if (!cid) throw fail('Missing conversation');
    const key = `${cid}:${me}`;
    const now = new Date().toISOString();

    if (input.action === 'peek') {
      await requireMember(cid, me);
      return { ...none, participants: await participants(cid) };
    }

    if (input.action === 'leave') {
      const r = await zite.sql({ query: `SELECT id FROM "CallParticipants" WHERE "participantKey" = $1`, params: [key] });
      await Promise.all(r.rows.map((x) => zite.callParticipants.update({ id: String(x.id), record: { lastSeenAt: new Date(0).toISOString() } })));
      return none;
    }

    if (input.action === 'signal') {
      if (!input.to || !input.kind || input.payload == null) throw fail('Bad signal');
      await zite.callSignals.create({ record: { conversationKey: cid, fromUser: me, toUser: input.to, kind: input.kind, payload: input.payload } });
      return none;
    }

    if (input.action === 'join') {
      const conv = await requireMember(cid, me);
      if (!ids(conv.members).includes(me)) throw fail('Not a member');
      const current = await participants(cid);
      if (current.filter((p) => p.userId !== me).length >= MAX_PEOPLE - 1) throw fail(`Calls can have up to ${MAX_PEOPLE} people.`);
      // Clear stale handshakes addressed to me from an earlier session.
      const old = await zite.sql({ query: `SELECT id FROM "CallSignals" WHERE "conversationKey" = $1 AND ("toUser" = $2 OR "fromUser" = $2)`, params: [cid, me] });
      await Promise.all(old.rows.map((x) => zite.callSignals.delete({ id: String(x.id) })));
      await zite.callParticipants.bulkCreate({
        records: [{ participantKey: key, conversationKey: cid, userKey: me, person: me, joinedAt: now, lastSeenAt: now, muted: false, cameraOn: !!input.video, screenSharing: false, videoCall: !!input.video }],
        matchOn: ['participantKey'],
      });
      return { ...none, participants: await participants(cid) };
    }

    // poll: keep me alive, report my state, and hand over handshakes addressed to me.
    await zite.callParticipants.bulkCreate({
      records: [{ participantKey: key, conversationKey: cid, userKey: me, person: me, lastSeenAt: now, muted: !!input.muted, cameraOn: !!input.camera, screenSharing: !!input.screen }],
      matchOn: ['participantKey'],
    });
    const [list, sig] = await Promise.all([
      participants(cid),
      zite.sql({ query: `SELECT id, "seq", "fromUser", "kind", "payload" FROM "CallSignals" WHERE "conversationKey" = $1 AND "toUser" = $2 AND "seq" > $3 ORDER BY "seq" LIMIT 200`, params: [cid, me, input.after ?? 0] }),
    ]);
    // Delivered handshakes are removed so they're never replayed.
    await Promise.all(sig.rows.map((x) => zite.callSignals.delete({ id: String(x.id) }).catch(() => null)));
    return { ...none, participants: list, signals: sig.rows.map((s) => ({ seq: Number(s.seq), from: String(s.fromUser), kind: String(s.kind), payload: String(s.payload ?? '') })) };
  },
});
