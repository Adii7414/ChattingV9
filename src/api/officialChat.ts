import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ensureOfficialChat, postOfficial, SUPPORT_GREETING, SUPPORT_OPTIONS } from '../server/official';

export default createEndpoint({
  description: 'Sends the one-time welcome DM from Chatting, or opens the Chatting Support chat',
  authenticated: true,
  inputSchema: z.object({ action: z.enum(['welcome', 'openSupport']) }),
  outputSchema: z.object({ conversationId: z.string().nullable() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me, { allowSuspended: true });
    if (input.action === 'welcome') {
      const p = await zite.profiles.findOne({ filters: { userKey: me } });
      if (p?.welcomedAt) return { conversationId: null };
      // Mark first so two tabs opening at once don't both send it.
      await zite.profiles.bulkCreate({ records: [{ userKey: me, person: me, welcomedAt: new Date().toISOString() } as never], matchOn: ['userKey'] });
      const { id } = await ensureOfficialChat(me, 'Chatting');
      const name = context.user.firstName || context.user.email.split('@')[0];
      await postOfficial(id, 'Chatting', `👋 Welcome to Chatting, ${name}! Here are three things to try first:\n\n• Start a chat with ⌘K (Ctrl+K)\n• Join a community in Discover\n• Make it yours in Settings → Appearance\n\nProduct updates from the Chatting team will show up here. You can turn them off in Settings → Notifications.`);
      return { conversationId: id };
    }
    const { id, created } = await ensureOfficialChat(me, 'Chatting Support');
    if (created) await postOfficial(id, 'Chatting Support', SUPPORT_GREETING, { quickReplies: SUPPORT_OPTIONS });
    return { conversationId: id };
  },
});
