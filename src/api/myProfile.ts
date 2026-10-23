import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const profile = z.object({
  name: z.string(), firstName: z.string(), lastName: z.string(), image: z.string().nullable(),
  bio: z.string(), statusText: z.string(), statusEmoji: z.string(), pronouns: z.string(),
  showOnlineStatus: z.boolean(), sendReadReceipts: z.boolean(), enterToSend: z.boolean(),
  statusExpiresAt: z.string().nullable(), banner: z.string(), timeZone: z.string(), updatesOptOut: z.boolean(),
  messageRequestsFrom: z.string(), allowFriendRequests: z.boolean(), profileAccent: z.string(), bannerImage: z.string(),
});

export default createEndpoint({
  description: 'Reads or updates the signed-in user’s profile and privacy settings',
  authenticated: true,
  inputSchema: z.object({ update: profile.partial().optional() }),
  outputSchema: profile,
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me, { allowSuspended: true });
    const u = input.update;
    if (u) {
      if (u.firstName !== undefined || u.lastName !== undefined || u.image !== undefined) {
        const first = (u.firstName ?? context.user.firstName ?? '').trim();
        const last = (u.lastName ?? context.user.lastName ?? '').trim();
        await zite.auth.updateUserProfile(me, {
          ...(u.firstName !== undefined || u.lastName !== undefined ? { firstName: first, lastName: last } : {}),
          ...(u.image !== undefined ? { image: u.image } : {}),
        } as never);
      }
      const rec: Record<string, unknown> = { userKey: me, person: me };
      for (const k of ['bio', 'statusText', 'statusEmoji', 'pronouns', 'showOnlineStatus', 'sendReadReceipts', 'enterToSend', 'banner', 'timeZone', 'updatesOptOut', 'messageRequestsFrom', 'allowFriendRequests', 'profileAccent', 'bannerImage'] as const) {
        if (k === 'messageRequestsFrom' && u[k] !== undefined) rec[k] = u[k] === 'Friends only' ? 'Friends only' : 'Everyone';
        else if (u[k] !== undefined) rec[k] = typeof u[k] === 'string' ? (u[k] as string).slice(0, 500) : u[k];
      }
      if (u.statusExpiresAt !== undefined) rec.statusExpiresAt = u.statusExpiresAt;
      await zite.profiles.bulkCreate({ records: [rec as never], matchOn: ['userKey'] });
    }
    const [p, users] = await Promise.all([
      zite.profiles.findOne({ filters: { userKey: me } }),
      zite.sql({ query: `SELECT "name", "image" FROM "ziteUsers" WHERE id::text = $1`, params: [me] }),
    ]);
    const row = users.rows[0] ?? {};
    const first = u?.firstName ?? context.user.firstName ?? '';
    const last = u?.lastName ?? context.user.lastName ?? '';
    return {
      name: String(row.name || [first, last].filter(Boolean).join(' ') || context.user.email.split('@')[0]),
      firstName: first, lastName: last,
      image: row.image ? String(row.image) : null,
      ...(() => { const live = !p?.statusExpiresAt || new Date(String(p.statusExpiresAt)) > new Date(); return { statusText: live ? p?.statusText ?? '' : '', statusEmoji: live ? p?.statusEmoji ?? '' : '', statusExpiresAt: live && p?.statusExpiresAt ? new Date(String(p.statusExpiresAt)).toISOString() : null }; })(),
      bio: p?.bio ?? '', banner: String(p?.banner ?? ''), timeZone: String(p?.timeZone ?? ''), pronouns: p?.pronouns ?? '',
      showOnlineStatus: p?.showOnlineStatus ?? true, sendReadReceipts: p?.sendReadReceipts ?? true, enterToSend: p?.enterToSend ?? true, updatesOptOut: !!p?.updatesOptOut,
      messageRequestsFrom: p?.messageRequestsFrom === 'Friends only' ? 'Friends only' : 'Everyone', allowFriendRequests: p?.allowFriendRequests !== false && (p?.allowFriendRequests as unknown) !== 'false',
      profileAccent: String(p?.profileAccent ?? ''), bannerImage: String(p?.bannerImage ?? ''),
    };
  },
});
