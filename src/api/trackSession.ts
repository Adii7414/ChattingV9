import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit } from '../server/audit';

/** Registers / refreshes this browser's session and tells it whether staff (or the user) signed it out. */
export default createEndpoint({
  description: 'Records the signed-in device session and reports whether it was revoked',
  authenticated: true,
  inputSchema: z.object({
    sessionKey: z.string().min(8).max(80), browser: z.string().max(60), os: z.string().max(60), device: z.string().max(60),
    userAgent: z.string().max(400), timeZone: z.string().max(60), language: z.string().max(20), screen: z.string().max(20),
    signOutOthers: z.boolean().optional(), revokeKey: z.string().max(80).optional(),
  }),
  outputSchema: z.object({ revoked: z.boolean(), sessions: z.array(z.object({ key: z.string(), device: z.string(), browser: z.string(), os: z.string(), lastSeenAt: z.string().nullable(), current: z.boolean() })) }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const now = new Date().toISOString();
    const [existing, prof] = await Promise.all([
      zite.sessions.findOne({ filters: { sessionKey: input.sessionKey } }),
      zite.profiles.findOne({ filters: { userKey: me } }),
    ]);
    if (existing && existing.user && !(Array.isArray(existing.user) ? existing.user : [existing.user]).includes(me)) return { revoked: true, sessions: [] };
    const started = existing?.startedAt ?? now;
    const force = prof?.forceLogoutAt ? new Date(prof.forceLogoutAt).getTime() : 0;
    if (existing?.revokedAt || (force && new Date(started).getTime() < force)) {
      if (!existing?.revokedAt && existing) await zite.sessions.update({ id: existing.id, record: { revokedAt: now, revokedReason: 'Signed out everywhere' } });
      return { revoked: true, sessions: [] };
    }
    await zite.sessions.bulkCreate({ matchOn: ['sessionKey'], records: [{
      sessionKey: input.sessionKey, user: me, device: input.device, browser: input.browser, os: input.os, userAgent: input.userAgent,
      timeZone: input.timeZone, language: input.language, screen: input.screen, startedAt: started, lastSeenAt: now, revokedAt: null, revokedReason: null,
    }] });
    if (!existing) await audit({ summary: `New sign-in on ${input.browser} · ${input.os}`, category: 'Auth', action: 'session.start', actorType: 'User', actorId: me, actorLabel: context.user.email, targetType: 'Session', targetId: input.sessionKey, targetUser: me, sessionKey: input.sessionKey, details: { device: input.device, timeZone: input.timeZone, language: input.language, screen: input.screen, userAgent: input.userAgent } });

    const { records } = await zite.sessions.findAll({ filters: { user: me }, limit: 100 });
    const live = records.filter((s) => !s.revokedAt);
    if (input.signOutOthers || input.revokeKey) {
      const targets = live.filter((s) => s.sessionKey !== input.sessionKey && (input.signOutOthers || s.sessionKey === input.revokeKey));
      await Promise.all(targets.map((s) => zite.sessions.update({ id: s.id, record: { revokedAt: now, revokedReason: 'Signed out by the account owner' } })));
      await audit({ summary: `Signed out ${targets.length} other session${targets.length === 1 ? '' : 's'}`, category: 'Auth', action: 'session.revoke.self', actorType: 'User', actorId: me, actorLabel: context.user.email, targetUser: me, sessionKey: input.sessionKey });
      targets.forEach((t) => { t.revokedAt = now; });
    }
    return {
      revoked: false,
      sessions: live.filter((s) => !s.revokedAt).sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt))).map((s) => ({ key: s.sessionKey ?? '', device: s.device ?? '', browser: s.browser ?? '', os: s.os ?? '', lastSeenAt: s.lastSeenAt ?? null, current: s.sessionKey === input.sessionKey })),
    };
  },
});
