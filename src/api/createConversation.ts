import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { APP_ID, requireActive } from '../server/chat';
import { friendIds, requestPrefs } from '../server/friends';

export default createEndpoint({
  description: 'Starts a direct message or custom group chat (reuses an existing direct message)',
  authenticated: true,
  inputSchema: z.object({
    memberIds: z.array(z.string()).min(1).max(100),
    name: z.string().max(80).optional(),
    description: z.string().max(500).optional(),
    emoji: z.string().max(16).optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const others = [...new Set(input.memberIds.filter((i) => i !== me))];
    if (!others.length) throw fail('Pick at least one person');

    const { records } = await zite.auth.findAllUsers({ appIds: [APP_ID], limit: 2000 });
    const valid = new Set(records.map((u) => u.id));
    if (others.some((o) => !valid.has(o))) throw fail('Unknown person');

    const isGroup = others.length > 1 || !!input.name?.trim();
    const friends = new Set(await friendIds(me));
    if (isGroup && others.some((o) => !friends.has(o))) throw fail('You can only add friends to a group chat. Send them a friend request first.');
    if (!isGroup) {
      const existing = await zite.sql({
        query: `SELECT id FROM "Conversations" WHERE COALESCE("isGroup", false) = false AND "communityId" IS NULL
                AND "members" @> jsonb_build_array($1::text, $2::text) AND jsonb_array_length("members") = 2 LIMIT 1`,
        params: [me, others[0]],
      });
      if (existing.rows[0]) return { id: String(existing.rows[0].id) };
    }
    // Messaging someone who isn't a friend goes to their message requests (if they allow it).
    let request = false;
    if (!isGroup && !friends.has(others[0])) {
      const [prefs, theirs] = await Promise.all([requestPrefs(others[0]), zite.profiles.findOne({ filters: { userKey: others[0] } })]);
      const theyBlocked = (Array.isArray(theirs?.blocked) ? theirs.blocked : theirs?.blocked ? [theirs.blocked] : []).includes(me);
      if (theyBlocked || prefs.messagesFrom === 'Friends only') throw fail('This person only accepts messages from friends. Send them a friend request instead.');
      request = true;
    }
    const c = await zite.conversations.create({
      record: {
        name: input.name?.trim() || null,
        isGroup,
        members: [me, ...others],
        owner: isGroup ? me : null,
        admins: isGroup ? [me] : null,
        description: input.description?.trim() || null,
        emoji: input.emoji?.trim() || null,
        communityId: null,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: null,
        messages: null, reactions: null, readReceipts: null,
        requestStatus: request ? 'Pending' : null, requestedBy: request ? me : null,
      } as never,
    });
    return { id: c.id };
  },
});
