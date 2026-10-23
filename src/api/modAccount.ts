import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';
import { audit, staffActor } from '../server/audit';
import { fail } from '../server/errors';

const FLAGS = ['VIP', 'Watchlist', 'Identity verified', 'Fraud risk', 'Under 18', 'Press', 'Partner'] as const;

export default createEndpoint({
  description: 'Staff account tools: sessions, sign-out, flags, notes, profile resets, activity and audit trail for one user',
  authenticated: true,
  inputSchema: z.object({
    userId: z.string(),
    act: z.discriminatedUnion('type', [
      z.object({ type: z.literal('revokeSession'), sessionKey: z.string() }),
      z.object({ type: z.literal('revokeAll') }),
      z.object({ type: z.literal('flags'), flags: z.array(z.enum(FLAGS)) }),
      z.object({ type: z.literal('notes'), notes: z.string().max(5000) }),
      z.object({ type: z.literal('rename'), firstName: z.string().max(60), lastName: z.string().max(60) }),
      z.object({ type: z.literal('resetProfile'), fields: z.array(z.enum(['bio', 'status', 'avatar', 'banner', 'activity'])).min(1) }),
      z.object({ type: z.literal('disableBot'), botId: z.string() }),
    ]).optional(),
  }),
  outputSchema: z.object({
    sessions: z.array(z.object({ key: z.string(), device: z.string(), browser: z.string(), os: z.string(), timeZone: z.string(), language: z.string(), screen: z.string(), userAgent: z.string(), startedAt: z.string().nullable(), lastSeenAt: z.string().nullable(), revokedAt: z.string().nullable(), revokedReason: z.string() })),
    flags: z.array(z.string()), notes: z.string(), forceLogoutAt: z.string().nullable(),
    profile: z.object({ firstName: z.string(), lastName: z.string(), pronouns: z.string(), timeZone: z.string(), activity: z.string(), messageRequestsFrom: z.string(), showOnlineStatus: z.boolean(), sendReadReceipts: z.boolean() }),
    stats: z.object({ messages24h: z.number(), messages7d: z.number(), messages30d: z.number(), messagesAll: z.number(), reactions: z.number(), communitiesOwned: z.number(), friends: z.number(), reportsFiled: z.number(), reportsAgainst: z.number(), tickets: z.number(), dms: z.number() }),
    bots: z.array(z.object({ id: z.string(), name: z.string(), community: z.string(), kind: z.string(), enabled: z.boolean(), apiCalls: z.number(), lastActiveAt: z.string().nullable() })),
    audit: z.array(z.object({ id: z.string(), at: z.string(), summary: z.string(), category: z.string(), action: z.string(), actor: z.string(), severity: z.string(), details: z.string() })),
  }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    const id = input.userId;
    const now = new Date().toISOString();
    const actor = staffActor(context.user);
    const prof = await zite.profiles.findOne({ filters: { userKey: id } });
    const ensureProfile = async () => prof ?? zite.profiles.create({ record: { userKey: id, person: id } as never });
    const a = input.act;
    if (a) {
      const log = (summary: string, action: string, severity: 'Info' | 'Notice' | 'Warning' = 'Notice', details?: Record<string, unknown>) =>
        audit({ ...actor, summary, category: 'Account', action, targetType: 'User', targetId: id, targetUser: id, severity, details });
      if (a.type === 'revokeSession') {
        const s = await zite.sessions.findOne({ filters: { sessionKey: a.sessionKey } });
        if (!s) throw fail('Session not found');
        await zite.sessions.update({ id: s.id, record: { revokedAt: now, revokedReason: `Revoked by staff (${context.user.email})` } });
        await log(`Signed out session on ${s.browser} · ${s.os}`, 'staff.session.revoke', 'Warning', { sessionKey: a.sessionKey });
      } else if (a.type === 'revokeAll') {
        const p = await ensureProfile();
        const { records } = await zite.sessions.findAll({ filters: { user: id }, limit: 200 });
        await Promise.all([
          zite.profiles.update({ id: p.id, record: { forceLogoutAt: now } }),
          ...records.filter((s) => !s.revokedAt).map((s) => zite.sessions.update({ id: s.id, record: { revokedAt: now, revokedReason: `Signed out everywhere by staff (${context.user.email})` } })),
        ]);
        await log('Signed the account out on every device', 'staff.session.revokeAll', 'Warning');
      } else if (a.type === 'flags') {
        const p = await ensureProfile();
        await zite.profiles.update({ id: p.id, record: { staffFlags: a.flags } });
        await log(`Set staff flags: ${a.flags.join(', ') || 'none'}`, 'staff.flags', 'Info', { before: prof?.staffFlags ?? [], after: a.flags });
      } else if (a.type === 'notes') {
        const p = await ensureProfile();
        await zite.profiles.update({ id: p.id, record: { staffNotes: a.notes } });
        await log('Updated staff notes', 'staff.notes', 'Info');
      } else if (a.type === 'rename') {
        await zite.auth.updateUserProfile(id, { firstName: a.firstName.trim(), lastName: a.lastName.trim() });
        await log(`Renamed account to “${`${a.firstName} ${a.lastName}`.trim()}”`, 'staff.rename', 'Notice', a);
      } else if (a.type === 'resetProfile') {
        const p = await ensureProfile();
        const rec: Record<string, unknown> = {};
        if (a.fields.includes('bio')) rec.bio = null;
        if (a.fields.includes('status')) Object.assign(rec, { statusText: null, statusEmoji: null, statusExpiresAt: null });
        if (a.fields.includes('banner')) Object.assign(rec, { banner: null, bannerImage: null });
        if (a.fields.includes('activity')) Object.assign(rec, { activityType: null, activityName: null, activityStartedAt: null });
        await zite.profiles.update({ id: p.id, record: rec as never });
        if (a.fields.includes('avatar')) await zite.auth.updateUserProfile(id, { image: null as never });
        await log(`Reset profile fields: ${a.fields.join(', ')}`, 'staff.profile.reset', 'Notice', { fields: a.fields });
      } else if (a.type === 'disableBot') {
        const b = await zite.bots.findOne({ id: a.botId });
        if (!b) throw fail('Bot not found');
        await zite.bots.update({ id: b.id, record: { enabled: false } });
        await audit({ ...actor, summary: `Disabled bot ${b.name}`, category: 'Bot', action: 'staff.bot.disable', targetType: 'Bot', targetId: b.id, targetUser: id, communityId: b.communityId ?? null, severity: 'Warning' });
      }
    }

    const [p2, sess, st, bots, logs, u] = await Promise.all([
      zite.profiles.findOne({ filters: { userKey: id } }),
      zite.sql({ query: `SELECT * FROM "Sessions" WHERE "user"->>0 = $1 ORDER BY "lastSeenAt" DESC NULLS LAST LIMIT 100`, params: [id] }),
      zite.sql({ query: `SELECT
          (SELECT COUNT(*) FROM "Messages" WHERE "sender"->>0 = $1 AND created_at > now() - interval '1 day') AS m1,
          (SELECT COUNT(*) FROM "Messages" WHERE "sender"->>0 = $1 AND created_at > now() - interval '7 days') AS m7,
          (SELECT COUNT(*) FROM "Messages" WHERE "sender"->>0 = $1 AND created_at > now() - interval '30 days') AS m30,
          (SELECT COUNT(*) FROM "Messages" WHERE "sender"->>0 = $1) AS mall,
          (SELECT COUNT(*) FROM "Reactions" WHERE "reactor"->>0 = $1) AS reactions,
          (SELECT COUNT(*) FROM "Communities" WHERE "owner"->>0 = $1) AS owned,
          (SELECT COUNT(*) FROM "Friendships" f WHERE f::text LIKE '%' || $1 || '%' ) AS friends,
          (SELECT COUNT(*) FROM "Reports" WHERE "reporter"->>0 = $1) AS filed,
          (SELECT COUNT(*) FROM "Reports" WHERE "reportedUser"->>0 = $1) AS against,
          (SELECT COUNT(*) FROM "SupportTickets" WHERE "requester"->>0 = $1) AS tickets,
          (SELECT COUNT(*) FROM "Conversations" WHERE "members" ? $1 AND COALESCE("isGroup", false) = false AND "communityId" IS NULL) AS dms`, params: [id] }).catch(() => ({ rows: [{}] as Record<string, unknown>[] })),
      zite.sql({ query: `SELECT b.id, b."name", b."kind", COALESCE(b."enabled", true) AS enabled, COALESCE(b."apiCalls", 0) AS "apiCalls", b."lastActiveAt", COALESCE(c."name", '—') AS community FROM "Bots" b LEFT JOIN "Communities" c ON c.id::text = b."communityId" WHERE b."owner"->>0 = $1`, params: [id] }),
      zite.sql({ query: `SELECT id, created_at, "summary", "category", "action", COALESCE("actorLabel", "actorType") AS actor, COALESCE("severity", 'Info') AS severity, COALESCE("details", '') AS details
          FROM "AuditLogs" WHERE "targetUser"->>0 = $1 OR "actor"->>0 = $1 ORDER BY created_at DESC LIMIT 150`, params: [id] }),
      zite.auth.findAllUsers({ filters: { id }, limit: 1 }),
    ]);
    const s0 = st.rows[0] ?? {};
    const user = u.records[0];
    const d = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      sessions: sess.rows.map((s) => ({ key: String(s.sessionKey ?? ''), device: String(s.device ?? ''), browser: String(s.browser ?? ''), os: String(s.os ?? ''), timeZone: String(s.timeZone ?? ''), language: String(s.language ?? ''), screen: String(s.screen ?? ''), userAgent: String(s.userAgent ?? ''), startedAt: d(s.startedAt), lastSeenAt: d(s.lastSeenAt), revokedAt: d(s.revokedAt), revokedReason: String(s.revokedReason ?? '') })),
      flags: (p2?.staffFlags ?? []) as string[], notes: p2?.staffNotes ?? '', forceLogoutAt: p2?.forceLogoutAt ?? null,
      profile: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', pronouns: p2?.pronouns ?? '', timeZone: p2?.timeZone ?? '', activity: p2?.activityType ? `${p2.activityType} ${p2.activityName ?? ''}` : '', messageRequestsFrom: p2?.messageRequestsFrom ?? 'Everyone', showOnlineStatus: p2?.showOnlineStatus !== false, sendReadReceipts: p2?.sendReadReceipts !== false },
      stats: { messages24h: Number(s0.m1 ?? 0), messages7d: Number(s0.m7 ?? 0), messages30d: Number(s0.m30 ?? 0), messagesAll: Number(s0.mall ?? 0), reactions: Number(s0.reactions ?? 0), communitiesOwned: Number(s0.owned ?? 0), friends: Number(s0.friends ?? 0), reportsFiled: Number(s0.filed ?? 0), reportsAgainst: Number(s0.against ?? 0), tickets: Number(s0.tickets ?? 0), dms: Number(s0.dms ?? 0) },
      bots: bots.rows.map((b) => ({ id: String(b.id), name: String(b.name ?? 'Bot'), community: String(b.community), kind: String(b.kind ?? 'Custom'), enabled: !!b.enabled, apiCalls: Number(b.apiCalls), lastActiveAt: d(b.lastActiveAt) })),
      audit: logs.rows.map((l) => ({ id: String(l.id), at: new Date(String(l.created_at)).toISOString(), summary: String(l.summary ?? ''), category: String(l.category ?? ''), action: String(l.action ?? ''), actor: String(l.actor ?? ''), severity: String(l.severity), details: String(l.details) })),
    };
  },
});
