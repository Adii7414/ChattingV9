// Reference data for the public Bot API docs at /developers.

export type Param = { name: string; type: string; required?: boolean; desc: string };
export type Op = { op: string; group: string; perm?: string; summary: string; desc?: string; params: Param[]; example: Record<string, unknown>; response: unknown };

const MSG = {
  id: '8c1f0a2e-…', channelId: 'b4d7…', content: 'Hello from my bot 👋', author: { id: '1e9c…', name: 'Helper', bot: true },
  createdAt: '2026-10-20T08:15:02.114Z', editedAt: null, threadId: null, replyToId: null, pinned: false, embeds: [], components: [], attachments: [],
};

export const GROUPS = ['General', 'Community', 'Channels', 'Members', 'Messages', 'Reactions', 'Roles', 'Moderation', 'Events', 'Interactions', 'Giveaways & reminders'] as const;

export const OPS: Op[] = [
  { op: 'ping', group: 'General', summary: 'Check that your key works', params: [], example: {}, response: { pong: true, time: '2026-10-20T08:15:02.114Z' } },
  { op: 'bot.me', group: 'General', summary: 'Your bot’s own profile, permissions and subscriptions', params: [], example: {}, response: { id: '1e9c…', name: 'Helper', avatar: '🤖', description: 'Answers FAQs', communityId: '5a2b…', kind: 'Custom', permissions: ['Read Messages', 'Send Messages'], eventTypes: ['MESSAGE_CREATE'], eventsUrl: 'https://bot.example.com/hook', apiCalls: 1294 } },

  { op: 'community.get', group: 'Community', summary: 'The community the bot is installed in', params: [], example: {}, response: { id: '5a2b…', name: 'Design Club', description: '…', emoji: '🎨', icon: null, banner: null, accent: '#0f766e', tagline: 'Make things', memberCount: 412, isPublic: true, verified: true, roles: [{ id: 'r_mods', name: 'Mods', color: '#2563eb', permissions: ['manageMessages'] }], rules: ['Be kind'] } },

  { op: 'channels.list', group: 'Channels', summary: 'Every channel in the community', params: [], example: {}, response: { channels: [{ id: 'b4d7…', name: 'general', emoji: '💬', topic: 'Say hi', category: null, announcement: false, slowmode: 0, private: false, lastMessageAt: '2026-10-20T08:10:00.000Z' }] } },
  { op: 'channels.get', group: 'Channels', summary: 'One channel', params: [{ name: 'channelId', type: 'string', required: true, desc: 'Channel id' }], example: { channelId: 'b4d7…' }, response: { id: 'b4d7…', name: 'general', emoji: '💬', topic: 'Say hi', announcement: false, slowmode: 0, memberCount: 412 } },

  { op: 'members.list', group: 'Members', perm: 'View Members', summary: 'Paginated member list with roles', params: [{ name: 'limit', type: 'number', desc: '1–1000, default 100' }, { name: 'offset', type: 'number', desc: 'Skip this many, default 0' }], example: { limit: 2 }, response: { total: 412, members: [{ id: 'u_1…', name: 'Ava Lin', avatar: null, nickname: 'ava', roles: ['r_mods'], owner: false, timedOutUntil: null }] } },
  { op: 'members.get', group: 'Members', perm: 'View Members', summary: 'One member', params: [{ name: 'userId', type: 'string', required: true, desc: 'User id' }], example: { userId: 'u_1…' }, response: { id: 'u_1…', name: 'Ava Lin', nickname: null, roles: [], owner: false, warnings: 0, timedOutUntil: null } },

  { op: 'messages.list', group: 'Messages', perm: 'Read Messages', summary: 'Read a channel’s history (oldest → newest)', desc: 'Page backwards with `before` = the previous response’s `nextBefore`.', params: [{ name: 'channelId', type: 'string', required: true, desc: 'Channel id' }, { name: 'limit', type: 'number', desc: '1–100, default 50' }, { name: 'before', type: 'ISO date', desc: 'Only messages older than this' }, { name: 'after', type: 'ISO date', desc: 'Only messages newer than this' }, { name: 'threadId', type: 'string', desc: 'Only this thread (parent + replies)' }], example: { channelId: 'b4d7…', limit: 20 }, response: { messages: [MSG], hasMore: true, nextBefore: '2026-10-20T08:15:02.114Z' } },
  { op: 'messages.get', group: 'Messages', perm: 'Read Messages', summary: 'One message', params: [{ name: 'messageId', type: 'string', required: true, desc: 'Message id' }], example: { messageId: '8c1f…' }, response: MSG },
  { op: 'messages.search', group: 'Messages', perm: 'Read Messages', summary: 'Full-text search across the community', params: [{ name: 'query', type: 'string', required: true, desc: 'Text to find (case-insensitive)' }, { name: 'limit', type: 'number', desc: '1–100, default 25' }], example: { query: 'deploy' }, response: { messages: [MSG] } },
  { op: 'messages.send', group: 'Messages', perm: 'Send Messages', summary: 'Post a message, card, or buttons', desc: 'Send `content`, `embeds`, or both. Add `components` for buttons and dropdowns.', params: [{ name: 'channelId', type: 'string', required: true, desc: 'Where to post' }, { name: 'content', type: 'string', desc: 'Up to 4000 chars. Supports **bold**, _italics_, `code`, ||spoilers|| and <t:ISO> local times' }, { name: 'embeds', type: 'Embed[]', desc: 'Up to 10 rich cards' }, { name: 'components', type: 'Component[][]', desc: 'Up to 5 rows of buttons / one select per row' }, { name: 'replyToId', type: 'string', desc: 'Quote-reply to a message' }, { name: 'threadId', type: 'string', desc: 'Post inside a thread' }], example: { channelId: 'b4d7…', content: 'Deploy finished ✅', embeds: [{ title: 'v2.4.0', description: '3 fixes, 1 feature', color: '#16a34a', fields: [{ name: 'Duration', value: '42s', inline: true }] }] }, response: { id: '8c1f…', channelId: 'b4d7…', createdAt: '2026-10-20T08:15:02.114Z' } },
  { op: 'messages.edit', group: 'Messages', summary: 'Edit one of your bot’s messages', params: [{ name: 'messageId', type: 'string', required: true, desc: 'A message your bot sent' }, { name: 'content', type: 'string', desc: 'New text' }, { name: 'embeds', type: 'Embed[]', desc: 'Replaces all embeds' }, { name: 'components', type: 'Component[][]', desc: 'Replaces all components ([] removes them)' }], example: { messageId: '8c1f…', content: 'Deploy finished ✅ (edited)' }, response: { id: '8c1f…', edited: true } },
  { op: 'messages.delete', group: 'Messages', perm: 'Manage Messages (for others’ messages)', summary: 'Delete a message', params: [{ name: 'messageId', type: 'string', required: true, desc: 'Message id' }, { name: 'reason', type: 'string', desc: 'Stored in the audit log' }], example: { messageId: '8c1f…', reason: 'spam' }, response: { id: '8c1f…', deleted: true } },
  { op: 'messages.pin', group: 'Messages', perm: 'Manage Messages', summary: 'Pin or unpin', params: [{ name: 'messageId', type: 'string', required: true, desc: 'Message id' }, { name: 'pinned', type: 'boolean', desc: 'Default true' }], example: { messageId: '8c1f…', pinned: true }, response: { id: '8c1f…', pinned: true } },

  { op: 'reactions.add', group: 'Reactions', perm: 'Add Reactions', summary: 'React as the bot', params: [{ name: 'messageId', type: 'string', required: true, desc: 'Message id' }, { name: 'emoji', type: 'string', required: true, desc: 'A single emoji' }], example: { messageId: '8c1f…', emoji: '✅' }, response: { messageId: '8c1f…', emoji: '✅', reacted: true } },
  { op: 'reactions.remove', group: 'Reactions', summary: 'Remove the bot’s reaction', params: [{ name: 'messageId', type: 'string', required: true, desc: 'Message id' }, { name: 'emoji', type: 'string', required: true, desc: 'The emoji' }], example: { messageId: '8c1f…', emoji: '✅' }, response: { messageId: '8c1f…', emoji: '✅', reacted: false } },
  { op: 'reactions.list', group: 'Reactions', perm: 'Read Messages', summary: 'Who reacted with what', params: [{ name: 'messageId', type: 'string', required: true, desc: 'Message id' }], example: { messageId: '8c1f…' }, response: { reactions: [{ emoji: '🔥', count: 2, users: ['u_1…', 'bot:1e9c…'] }] } },

  { op: 'roles.list', group: 'Roles', summary: 'All roles', params: [], example: {}, response: { roles: [{ id: 'r_mods', name: 'Mods', color: '#2563eb', permissions: ['manageMessages'], hoist: true }] } },
  { op: 'roles.add', group: 'Roles', perm: 'Manage Roles', summary: 'Give a member a role', desc: 'Channel access updates instantly for role-gated channels.', params: [{ name: 'userId', type: 'string', required: true, desc: 'Member' }, { name: 'roleId', type: 'string', required: true, desc: 'Role' }], example: { userId: 'u_1…', roleId: 'r_artists' }, response: { userId: 'u_1…', roles: ['r_artists'] } },
  { op: 'roles.remove', group: 'Roles', perm: 'Manage Roles', summary: 'Take a role away', params: [{ name: 'userId', type: 'string', required: true, desc: 'Member' }, { name: 'roleId', type: 'string', required: true, desc: 'Role' }], example: { userId: 'u_1…', roleId: 'r_artists' }, response: { userId: 'u_1…', roles: [] } },

  { op: 'members.warn', group: 'Moderation', perm: 'Moderate Members', summary: 'Add a warning', params: [{ name: 'userId', type: 'string', required: true, desc: 'Member' }, { name: 'reason', type: 'string', required: true, desc: 'Shown to moderators' }], example: { userId: 'u_1…', reason: 'Off-topic spam' }, response: { userId: 'u_1…', warnings: 2 } },
  { op: 'members.timeout', group: 'Moderation', perm: 'Moderate Members', summary: 'Stop a member posting for a while', params: [{ name: 'userId', type: 'string', required: true, desc: 'Member' }, { name: 'minutes', type: 'number', desc: '1–40320 (28 days), default 10' }, { name: 'reason', type: 'string', desc: 'Audit-logged' }], example: { userId: 'u_1…', minutes: 60, reason: 'Flooding' }, response: { userId: 'u_1…', timedOutUntil: '2026-10-20T09:15:02.114Z' } },
  { op: 'members.untimeout', group: 'Moderation', perm: 'Moderate Members', summary: 'Lift a timeout', params: [{ name: 'userId', type: 'string', required: true, desc: 'Member' }], example: { userId: 'u_1…' }, response: { userId: 'u_1…', timedOutUntil: null } },
  { op: 'members.kick', group: 'Moderation', perm: 'Moderate Members', summary: 'Remove someone from the community', params: [{ name: 'userId', type: 'string', required: true, desc: 'Member' }, { name: 'reason', type: 'string', desc: 'Audit-logged' }], example: { userId: 'u_1…', reason: 'Raid account' }, response: { userId: 'u_1…', removed: true } },

  { op: 'events.poll', group: 'Events', summary: 'Pull events instead of receiving webhooks', desc: 'Keep the returned `cursor` and pass it as `after` next time. Events are kept for 30 days.', params: [{ name: 'after', type: 'number', desc: 'Return events with seq greater than this (default 0)' }, { name: 'limit', type: 'number', desc: '1–100, default 50' }], example: { after: 1520 }, response: { events: [{ id: 'e_…', seq: 1521, type: 'MESSAGE_CREATE', channelId: 'b4d7…', createdAt: '2026-10-20T08:15:02.114Z', payload: { type: 'MESSAGE_CREATE', data: { messageId: '8c1f…', userId: 'u_1…', body: '!help' } } }], cursor: 1521 } },

  { op: 'interactions.respond', group: 'Interactions', summary: 'Answer a button click or dropdown choice', desc: '`type: "reply"` (default) posts a reply to the clicked message. `type: "update"` edits the clicked message in place — great for toggles and paginated cards.', params: [{ name: 'interactionId', type: 'string', required: true, desc: 'The INTERACTION_CREATE event id' }, { name: 'type', type: '"reply" | "update"', desc: 'Default "reply"' }, { name: 'content / embeds / components', type: '…', desc: 'Same as messages.send' }], example: { interactionId: 'e_…', type: 'update', content: 'You picked **Blue** 💙', components: [] }, response: { id: '8c1f…', edited: true } },

  { op: 'giveaways.create', group: 'Giveaways & reminders', perm: 'Send Messages', summary: 'Start a giveaway with an Enter button', params: [{ name: 'channelId', type: 'string', required: true, desc: 'Where to post' }, { name: 'prize', type: 'string', required: true, desc: 'What’s being given away' }, { name: 'duration', type: 'string', desc: '"30m", "2h", "1d"… (default 1h)' }, { name: 'winners', type: 'number', desc: '1–20, default 1' }], example: { channelId: 'b4d7…', prize: 'Sticker pack', duration: '1d', winners: 3 }, response: { id: 'g_…', messageId: '8c1f…', endsAt: '2026-10-21T08:15:02.114Z' } },
  { op: 'giveaways.end', group: 'Giveaways & reminders', summary: 'End early and draw winners', params: [{ name: 'giveawayId', type: 'string', required: true, desc: 'Giveaway id' }], example: { giveawayId: 'g_…' }, response: { id: 'g_…', winners: ['u_1…'] } },
  { op: 'reminders.create', group: 'Giveaways & reminders', perm: 'Send Messages', summary: 'Ping someone later', params: [{ name: 'channelId', type: 'string', required: true, desc: 'Where the reminder posts' }, { name: 'userId', type: 'string', required: true, desc: 'Who to remind' }, { name: 'in', type: 'string', required: true, desc: '"10m", "2h", "1d", "1h30m"' }, { name: 'text', type: 'string', required: true, desc: 'What to say' }], example: { channelId: 'b4d7…', userId: 'u_1…', in: '2h', text: 'Stand-up!' }, response: { id: 'rm_…', dueAt: '2026-10-20T10:15:02.114Z' } },
];

export const EVENTS: { type: string; when: string; data: Record<string, unknown> }[] = [
  { type: 'MESSAGE_CREATE', when: 'Someone (or another bot) posts in any channel', data: { messageId: '8c1f…', channelId: 'b4d7…', userId: 'u_1…', authorName: 'Ava', body: '!help', threadId: null, replyToId: null, attachments: 0 } },
  { type: 'MESSAGE_UPDATE', when: 'A bot edits a message', data: { messageId: '8c1f…', botId: '1e9c…' } },
  { type: 'MESSAGE_DELETE', when: 'A bot deletes a message', data: { messageId: '8c1f…', botId: '1e9c…' } },
  { type: 'MEMBER_JOIN', when: 'Someone joins the community', data: { userId: 'u_1…', userName: 'Ava' } },
  { type: 'MEMBER_LEAVE', when: 'Someone leaves or is removed', data: { userId: 'u_1…', reason: 'left | kicked' } },
  { type: 'REACTION_ADD', when: 'A member reacts', data: { messageId: '8c1f…', userId: 'u_1…', emoji: '🔥', messageBotId: null } },
  { type: 'REACTION_REMOVE', when: 'A member removes a reaction', data: { messageId: '8c1f…', userId: 'u_1…', emoji: '🔥', messageBotId: null } },
  { type: 'INTERACTION_CREATE', when: 'A member clicks a button or picks from a dropdown on your bot’s message', data: { messageId: '8c1f…', channelId: 'b4d7…', userId: 'u_1…', userName: 'Ava', componentId: 'color', values: ['blue'], targetBotId: '1e9c…' } },
];

export const ERRORS: [string, number, string][] = [
  ['unauthorized', 401, 'Missing or wrong token'],
  ['bot_disabled', 403, 'A community admin switched the bot off'],
  ['no_community', 403, 'The bot isn’t installed anywhere'],
  ['missing_permission', 403, 'The bot lacks the permission the op needs'],
  ['forbidden', 403, 'Not allowed (e.g. editing someone else’s message)'],
  ['not_found', 404, 'Channel, message, member or role not found in your community'],
  ['unknown_op', 404, 'Typo in `op`'],
  ['invalid_params', 400, 'A required param is missing or malformed'],
  ['rate_limited', 429, 'More than 120 calls in 60 seconds'],
  ['internal_error', 500, 'Something broke on our side — safe to retry'],
];
