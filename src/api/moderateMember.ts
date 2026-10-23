import { z } from 'zod';
import { requireActive } from '../server/chat';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requirePerm, saveSettings, withAudit } from '../server/community';

export default createEndpoint({
  description: 'Warns a community member or saves private moderator notes about them',
  authenticated: true,
  inputSchema: z.object({
    communityId: z.string(), userId: z.string(),
    action: z.enum(['warn', 'clearWarnings', 'note']),
    text: z.string().max(1000).optional(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const { s, ownerId } = await requirePerm(input.communityId, me, 'kick');
    if (input.userId === ownerId && input.action === 'warn') throw new ZiteError({ code: 'BAD_REQUEST', message: 'owner', userFacingMessage: 'You can’t warn the owner.' });
    const who = s.nicknames[input.userId] ?? 'a member';
    const text = (input.text ?? '').trim();
    if (input.action === 'warn') {
      if (!text) throw new ZiteError({ code: 'BAD_REQUEST', message: 'reason', userFacingMessage: 'Add a reason for the warning.' });
      const list = [...(s.warnings[input.userId] ?? []), { at: new Date().toISOString(), by: me, reason: text }].slice(-20);
      await saveSettings(input.communityId, withAudit({ ...s, warnings: { ...s.warnings, [input.userId]: list } }, me, `warned ${who}: ${text}`));
    } else if (input.action === 'clearWarnings') {
      const warnings = { ...s.warnings }; delete warnings[input.userId];
      await saveSettings(input.communityId, withAudit({ ...s, warnings }, me, `cleared warnings for ${who}`));
    } else {
      const modNotes = { ...s.modNotes };
      if (text) modNotes[input.userId] = text; else delete modNotes[input.userId];
      await saveSettings(input.communityId, { ...s, modNotes });
    }
    return { ok: true };
  },
});
