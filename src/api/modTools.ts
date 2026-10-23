import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';
import { audit, staffActor } from '../server/audit';

const row = z.record(z.string(), z.unknown());
const bad = (m: string) => new ZiteError({ code: 'BAD_REQUEST', message: m, userFacingMessage: m });
const clean = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));

/** Staff toolkit: analytics, message search, usernames, stories, live calls, bots, SLA, offenders, export and bulk actions. */
export default createEndpoint({
  description: 'Staff toolkit for the support panel',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['analytics', 'searchMessages', 'deleteMessage', 'usernames', 'resetUsername', 'stories', 'removeStory', 'calls', 'endCall', 'bots', 'toggleBot', 'sla', 'offenders', 'exportUsers', 'bulk']),
    q: z.string().max(200).optional(),
    id: z.string().optional(),
    reason: z.string().max(500).optional(),
    usernames: z.array(z.string()).max(100).optional(),
    bulkAction: z.enum(['Warn', 'Suspend', 'Ban', 'Lift']).optional(),
    days: z.number().min(1).max(365).optional(),
  }),
  outputSchema: z.object({ rows: z.array(row), message: z.string() }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    const actor = staffActor(context.user);
    const q = (input.q ?? '').trim();
    const out = (rows: Record<string, unknown>[], message = '') => ({ rows: clean(rows), message });
    const sql = async (query: string, params: unknown[] = []) => (await zite.sql({ query, params })).rows as Record<string, unknown>[];

    switch (input.action) {
      case 'analytics':
        return out(await sql(`
          WITH d AS (SELECT generate_series(current_date - 13, current_date, interval '1 day')::date AS day)
          SELECT to_char(d.day, 'DD Mon') AS day,
            (SELECT COUNT(*) FROM "ziteUsers" u WHERE u.created_at::date = d.day)::int AS signups,
            (SELECT COUNT(*) FROM "Messages" m WHERE m.created_at::date = d.day)::int AS messages,
            (SELECT COUNT(DISTINCT m."sender"->>0) FROM "Messages" m WHERE m.created_at::date = d.day)::int AS active,
            (SELECT COUNT(*) FROM "Reports" r WHERE r.created_at::date = d.day)::int AS reports
          FROM d ORDER BY d.day`));
      case 'searchMessages':
        if (q.length < 2) return out([]);
        return out(await sql(`
          SELECT m.id, LEFT(m."body", 300) AS body, m.created_at AS "sentAt", COALESCE(u."name", 'Someone') AS sender, COALESCE(p."username", '') AS username, COALESCE(c."name", 'Direct message') AS conversation
          FROM "Messages" m LEFT JOIN "ziteUsers" u ON u.id = m."sender"->>0 LEFT JOIN "Profiles" p ON p."userKey" = m."sender"->>0
          LEFT JOIN "ConversationsMessages" l ON l."messagesId" = m.id LEFT JOIN "Conversations" c ON c.id = l."conversationsId"
          WHERE m."body" NOT LIKE 'e2e1.%' AND (m."body" ILIKE '%' || $1 || '%' OR LOWER(p."username") = LOWER(LTRIM($1, '@')))
          ORDER BY m.created_at DESC LIMIT 50`, [q]), 'End-to-end encrypted direct messages can’t be searched.');
      case 'deleteMessage': {
        if (!input.id) throw bad('Pick a message');
        const m = await zite.messages.findOne({ id: input.id });
        if (!m) return out([], 'Already deleted');
        await zite.messages.delete({ id: input.id });
        await audit({ ...actor, summary: 'Staff deleted a message', category: 'Moderation', action: 'staff.message.delete', targetType: 'Message', targetId: input.id, details: { body: String(m.body ?? '').slice(0, 500), reason: input.reason ?? null }, severity: 'Notice' });
        return out([], 'Message deleted');
      }
      case 'usernames':
        return out(await sql(`
          SELECT p."userKey" AS id, p."username", COALESCE(u."name", '') AS name, u."email", u.created_at AS "joinedAt"
          FROM "Profiles" p JOIN "ziteUsers" u ON u.id::text = p."userKey"
          WHERE COALESCE(p."username", '') <> '' AND ($1 = '' OR p."username" ILIKE '%' || LTRIM($1, '@') || '%' OR u."email" ILIKE '%' || $1 || '%')
          ORDER BY u.created_at DESC LIMIT 100`, [q]));
      case 'resetUsername': {
        if (!input.id) throw bad('Pick a user');
        const r = await sql(`SELECT id, "username" FROM "Profiles" WHERE "userKey" = $1 LIMIT 1`, [input.id]);
        if (!r[0]) throw bad('No profile');
        await zite.profiles.update({ id: String(r[0].id), record: { username: null } as never });
        await audit({ ...actor, summary: `Reset username @${r[0].username}`, category: 'Account', action: 'staff.username.reset', targetUser: input.id, details: { old: r[0].username, reason: input.reason ?? null }, severity: 'Notice' });
        return out([], 'Username reset — they’ll pick a new one next time they open Chatting');
      }
      case 'stories':
        return out(await sql(`
          SELECT s.id, s."mediaType", LEFT(COALESCE(NULLIF(s."text", ''), s."caption", ''), 200) AS text, s."mediaUrl", s.created_at AS "postedAt", s."expiresAt",
            COALESCE(u."name", 'Someone') AS author, COALESCE(p."username", '') AS username
          FROM "Stories" s LEFT JOIN "ziteUsers" u ON u.id::text = s."authorKey" LEFT JOIN "Profiles" p ON p."userKey" = s."authorKey"
          WHERE s."expiresAt" > now() ORDER BY s.created_at DESC LIMIT 100`));
      case 'removeStory': {
        if (!input.id) throw bad('Pick a story');
        await zite.stories.delete({ id: input.id });
        await audit({ ...actor, summary: 'Staff removed a story', category: 'Moderation', action: 'staff.story.remove', targetType: 'Story', targetId: input.id, details: { reason: input.reason ?? null }, severity: 'Notice' });
        return out([], 'Story removed');
      }
      case 'calls':
        return out(await sql(`
          SELECT p."conversationKey" AS id, COALESCE(c."name", 'Direct call') AS name, COALESCE(c."communityId", '') <> '' AS "voiceChannel",
            COUNT(*)::int AS people, MIN(p."joinedAt") AS "startedAt", BOOL_OR(p."cameraOn") AS video, BOOL_OR(p."screenSharing") AS screen,
            STRING_AGG(COALESCE(u."name", 'Someone'), ', ') AS who
          FROM "CallParticipants" p LEFT JOIN "Conversations" c ON c.id::text = p."conversationKey" LEFT JOIN "ziteUsers" u ON u.id::text = p."userKey"
          WHERE p."lastSeenAt" > now() - interval '12 seconds' GROUP BY 1, 2, 3 ORDER BY people DESC`), 'Only who is in a call is visible — audio and video are end-to-end encrypted.');
      case 'endCall': {
        if (!input.id) throw bad('Pick a call');
        const r = await sql(`SELECT id FROM "CallParticipants" WHERE "conversationKey" = $1`, [input.id]);
        await Promise.all(r.map((x) => zite.callParticipants.update({ id: String(x.id), record: { lastSeenAt: new Date(0).toISOString() } })));
        await audit({ ...actor, summary: 'Staff ended a call', category: 'Moderation', action: 'staff.call.end', targetType: 'Conversation', targetId: input.id, severity: 'Warning' });
        return out([], 'Call ended');
      }
      case 'bots':
        return out(await sql(`
          SELECT b.id, b."name", b."kind", b."enabled", COALESCE(b."apiCalls", 0)::int AS "apiCalls", b."lastActiveAt", COALESCE(c."name", '—') AS community, COALESCE(u."name", '—') AS owner
          FROM "Bots" b LEFT JOIN "Communities" c ON c.id::text = b."communityId" LEFT JOIN "ziteUsers" u ON u.id = b."owner"->>0
          WHERE $1 = '' OR b."name" ILIKE '%' || $1 || '%' OR c."name" ILIKE '%' || $1 || '%'
          ORDER BY b."lastActiveAt" DESC NULLS LAST LIMIT 100`, [q]));
      case 'toggleBot': {
        if (!input.id) throw bad('Pick a bot');
        const b = await zite.bots.findOne({ id: input.id });
        if (!b) throw bad('Bot not found');
        await zite.bots.update({ id: b.id, record: { enabled: !b.enabled } });
        await audit({ ...actor, summary: `${b.enabled ? 'Disabled' : 'Enabled'} bot ${b.name}`, category: 'Bot', action: 'staff.bot.toggle', targetType: 'Bot', targetId: b.id, communityId: b.communityId ?? null, severity: 'Notice' });
        return out([], b.enabled ? 'Bot disabled' : 'Bot enabled');
      }
      case 'sla':
        return out(await sql(`
          SELECT t.id, t."subject", t."priority", t."status", t."lastActivityAt", COALESCE(u."name", t."requesterEmail", 'Someone') AS requester,
            EXTRACT(EPOCH FROM (now() - COALESCE(t."lastActivityAt", t.created_at))) / 3600 AS "hoursWaiting"
          FROM "SupportTickets" t LEFT JOIN "ziteUsers" u ON u.id = t."requester"->>0
          WHERE t."status" = 'Open' ORDER BY CASE t."priority" WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END, COALESCE(t."lastActivityAt", t.created_at) LIMIT 100`));
      case 'offenders':
        return out(await sql(`
          SELECT u.id, COALESCE(u."name", '') AS name, COALESCE(p."username", '') AS username,
            (SELECT COUNT(*) FROM "Reports" r WHERE r."reportedUser"->>0 = u.id AND r.created_at > now() - interval '30 days')::int AS reports,
            (SELECT COUNT(*) FROM "UserActions" a WHERE a."targetUser"->>0 = u.id AND a."action" IN ('Warn','Suspend','Ban'))::int AS actions
          FROM "ziteUsers" u LEFT JOIN "Profiles" p ON p."userKey" = u.id::text
          ORDER BY reports DESC, actions DESC LIMIT 25`).then((r) => r.filter((x) => Number(x.reports) + Number(x.actions) > 0)));
      case 'exportUsers':
        await audit({ ...actor, summary: 'Exported the user list', category: 'Account', action: 'staff.users.export', severity: 'Notice' });
        return out(await sql(`
          SELECT u.id, COALESCE(p."username", '') AS username, COALESCE(u."name", '') AS name, u."email", u.created_at AS "joinedAt",
            (SELECT COUNT(*) FROM "Messages" m WHERE m."sender"->>0 = u.id)::int AS messages
          FROM "ziteUsers" u LEFT JOIN "Profiles" p ON p."userKey" = u.id::text ORDER BY u.created_at`));
      case 'bulk': {
        const names = (input.usernames ?? []).map((n) => n.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
        if (!names.length || !input.bulkAction) throw bad('Add usernames and pick an action');
        if (!input.reason?.trim()) throw bad('Add a reason');
        const found = await sql(`SELECT "userKey" AS id, LOWER("username") AS username FROM "Profiles" WHERE LOWER("username") = ANY($1::text[])`, [names]);
        const expiresAt = input.bulkAction === 'Suspend' ? new Date(Date.now() + (input.days ?? 7) * 86_400_000).toISOString() : null;
        if (found.length) await zite.userActions.bulkCreate({ records: found.map((f) => ({ summary: `${input.bulkAction}: ${input.reason!.slice(0, 60)}`, targetUser: String(f.id), action: input.bulkAction!, reason: input.reason!, expiresAt, staff: context.user.id })) as never });
        await audit({ ...actor, summary: `Bulk ${input.bulkAction} on ${found.length} users`, category: 'Moderation', action: 'staff.bulk', details: { usernames: found.map((f) => f.username), reason: input.reason }, severity: 'Warning' });
        const missing = names.filter((n) => !found.some((f) => f.username === n));
        return out(found, `${input.bulkAction} applied to ${found.length} ${found.length === 1 ? 'person' : 'people'}${missing.length ? ` · not found: ${missing.map((m) => '@' + m).join(', ')}` : ''}`);
      }
    }
  },
});
