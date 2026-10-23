import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';
import { customFor } from '../server/community';
import { emitEvent } from '../server/bots';

export default createEndpoint({
  description: 'Adds or removes the signed-in user’s emoji reaction on a message',
  authenticated: true,
  inputSchema: z.object({ conversationId: z.string(), messageId: z.string(), emoji: z.string().min(1).max(16) }),
  outputSchema: z.object({ reacted: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireMember(input.conversationId, context.user.id);
    const msg = await zite.messages.findOne({ id: input.messageId });
    if (!msg || !ids(msg.conversation).includes(input.conversationId)) throw fail('Message not found');

    const rules = await customFor(input.conversationId, context.user.id);
    if (rules && !rules.custom.allowReactions) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Reactions disabled', userFacingMessage: 'Reactions are turned off in this community.' });
    const fire = async (t: 'REACTION_ADD' | 'REACTION_REMOVE') => {
      const conv = await zite.conversations.findOne({ id: input.conversationId });
      await emitEvent(conv?.communityId, t, input.conversationId, { messageId: input.messageId, userId: context.user.id, emoji: input.emoji, messageBotId: msg.botId ?? null });
    };
    const key = `${input.messageId}:${context.user.id}:${input.emoji}`;
    const existing = await zite.reactions.findOne({ filters: { key } });
    if (existing) {
      await zite.reactions.delete({ id: existing.id });
      await fire('REACTION_REMOVE');
      return { reacted: false };
    }
    await zite.reactions.create({
      record: { key, emoji: input.emoji, message: input.messageId, reactor: context.user.id, conversation: input.conversationId },
    });
    await fire('REACTION_ADD');
    return { reacted: true };
  },
});
