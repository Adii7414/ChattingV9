import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireStaff } from '../server/staff';
import { notifyModeration } from '../server/official';
import { audit, staffActor } from '../server/audit';

export default createEndpoint({
  authenticated: true,
  description: 'Full moderation profile for one user, and records staff actions against them',
  inputSchema: z.object({
    userId: z.string(),
    act: z.object({ action: z.enum(['Warn', 'Suspend', 'Ban', 'Lift', 'Note']), reason: z.string().min(3).max(2000), days: z.number().int().min(0).max(3650).optional() }).optional(),
    deleteMessageId: z.string().optional(),
  }),
  outputSchema: z.object({
    user: z.object({ id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable(), joinedAt: z.string(), bio: z.string(), status: z.string(), lastSeenAt: z.string().nullable(), standing: z.string(), standingUntil: z.string().nullable() }),
    communities: z.array(z.object({ id: z.string(), name: z.string(), emoji: z.string(), isOwner: z.boolean() })),
    messages: z.array(z.object({ id: z.string(), body: z.string(), createdAt: z.string(), where: z.string() })),
    reports: z.array(z.object({ id: z.string(), reason: z.string(), messageBody: z.string(), status: z.string(), createdAt: z.string() })),
    actions: z.array(z.object({ id: z.string(), action: z.string(), reason: z.string(), staff: z.string(), expiresAt: z.string().nullable(), createdAt: z.string() })),
  }),
  execute: async ({ input, context }) => {
    requireStaff(context.user);
    const id = input.userId;
    if (input.act) {
      const { action, reason, days } = input.act;
      const expiresAt = action === 'Suspend' && days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
      await zite.userActions.create({ record: { summary: `${action}: ${reason.slice(0, 60)}`, targetUser: id, action, reason, expiresAt, staff: context.user?.id ?? null } as never });
      const until = expiresAt ? `${new Date(expiresAt).toUTCString().slice(5, 22)} UTC` : null;
      const notice = {
        Warn: `⚠️ You’ve received a warning from the Chatting moderation team.\n\nReason: ${reason}\n\nPlease review our community guidelines. Further violations may lead to a suspension.`,
        Suspend: `⛔ Your account has been suspended${until ? ` until ${until}` : ' until further notice'}.\n\nReason: ${reason}\n\nWhile suspended you can’t see or send messages. You can still contact Chatting Support to appeal.`,
        Ban: `🚫 Your account has been permanently banned.\n\nReason: ${reason}`,
        Lift: `✅ The restriction on your account has been lifted. Welcome back — please keep our guidelines in mind.`,
        Note: null,
      }[action];
      await audit({ ...staffActor(context.user), summary: `${action === 'Note' ? 'Added a note to' : action === 'Lift' ? 'Lifted restrictions on' : `${action === 'Warn' ? 'Warned' : action === 'Suspend' ? `Suspended${days ? ` (${days}d)` : ''}` : 'Banned'}`} user`, category: 'Moderation', action: `staff.user.${action.toLowerCase()}`, targetType: 'User', targetId: id, targetUser: id, severity: action === 'Ban' ? 'Critical' : action === 'Suspend' ? 'Warning' : 'Notice', details: { reason, days: days ?? null, expiresAt } });
      if (notice) await notifyModeration(id, notice).catch((e) => console.error('moderation notice failed', e));
    }
    if (input.deleteMessageId) {
      const m = await zite.messages.findOne({ id: input.deleteMessageId });
      await zite.messages.delete({ id: input.deleteMessageId });
      await audit({ ...staffActor(context.user), summary: 'Deleted a message', category: 'Message', action: 'staff.message.delete', targetType: 'Message', targetId: input.deleteMessageId, targetUser: id, severity: 'Notice', details: { body: m?.body?.slice(0, 1000) ?? null } });
    }

    const [u, comms, msgs, reps, acts] = await Promise.all([
      zite.sql({ query: `SELECT u.id, u."name", u."email", u."image", u.created_at AS "joinedAt", COALESCE(p."bio",'') AS bio, TRIM(COALESCE(p."statusEmoji",'') || ' ' || COALESCE(p."statusText",'')) AS status,
          (SELECT MAX(pr."lastSeenAt") FROM "Presence" pr WHERE pr."person"->>0 = u.id) AS "lastSeenAt"
        FROM "ziteUsers" u LEFT JOIN "Profiles" p ON p."person"->>0 = u.id WHERE u.id = $1 LIMIT 1`, params: [id] }),
      zite.sql({ query: `SELECT c.id, COALESCE(c."name",'') AS name, COALESCE(c."emoji",'') AS emoji, (c."owner"->>0 = $1) AS "isOwner" FROM "Communities" c WHERE c."members" ? $1 OR c."owner"->>0 = $1 ORDER BY c."name"`, params: [id] }),
      zite.sql({ query: `SELECT m.id, COALESCE(m."body",'') AS body, m.created_at AS "createdAt", COALESCE(MAX(c."name"), 'Direct message') AS "where"
        FROM "Messages" m LEFT JOIN "ConversationsMessages" l ON l."messagesId" = m.id LEFT JOIN "Conversations" c ON c.id = l."conversationsId"
        WHERE m."sender"->>0 = $1 GROUP BY m.id ORDER BY m.created_at DESC LIMIT 40`, params: [id] }),
      zite.sql({ query: `SELECT id, COALESCE("reason",'') AS reason, COALESCE("messageBody",'') AS "messageBody", COALESCE("status",'Open') AS status, created_at AS "createdAt" FROM "Reports" WHERE "reportedUser"->>0 = $1 ORDER BY created_at DESC LIMIT 50`, params: [id] }),
      zite.sql({ query: `SELECT a.id, a."action", COALESCE(a."reason",'') AS reason, a."expiresAt", a.created_at AS "createdAt", COALESCE(s."name",'Staff') AS staff FROM "UserActions" a LEFT JOIN "ziteUsers" s ON s.id = a."staff"->>0 WHERE a."targetUser"->>0 = $1 ORDER BY a.created_at DESC`, params: [id] }),
    ]);
    const x = u.rows[0];
    if (!x) throw fail('User not found');
    const last = acts.rows.find((a) => ['Suspend', 'Ban', 'Lift'].includes(String(a.action)));
    let standing = 'Good'; let standingUntil: string | null = null;
    if (last?.action === 'Ban') standing = 'Banned';
    else if (last?.action === 'Suspend' && (!last.expiresAt || new Date(String(last.expiresAt)) > new Date())) { standing = 'Suspended'; standingUntil = last.expiresAt ? String(last.expiresAt) : null; }
    return {
      user: { id, name: String(x.name ?? 'Unknown'), email: String(x.email ?? ''), image: x.image ? String(x.image) : null, joinedAt: String(x.joinedAt), bio: String(x.bio), status: String(x.status), lastSeenAt: x.lastSeenAt ? String(x.lastSeenAt) : null, standing, standingUntil },
      communities: comms.rows.map((c) => ({ id: String(c.id), name: String(c.name), emoji: String(c.emoji), isOwner: !!c.isOwner })),
      messages: msgs.rows.map((m) => ({ id: String(m.id), body: String(m.body), createdAt: String(m.createdAt), where: String(m.where) })),
      reports: reps.rows.map((r) => ({ id: String(r.id), reason: String(r.reason), messageBody: String(r.messageBody), status: String(r.status), createdAt: String(r.createdAt) })),
      actions: acts.rows.map((a) => ({ id: String(a.id), action: String(a.action ?? ''), reason: String(a.reason), staff: String(a.staff), expiresAt: a.expiresAt ? String(a.expiresAt) : null, createdAt: String(a.createdAt) })),
    };
  },
});
