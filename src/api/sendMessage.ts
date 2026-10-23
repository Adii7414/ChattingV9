import { z } from 'zod';
import { fail } from '../server/errors';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireMember } from '../server/chat';
import { loadCommunity, postInto } from '../server/community';
import { parseChannel, permsOf, timedOutUntil } from '../lib/community';
import { officialOf, optionCategory, postOfficial, SUPPORT_OPTIONS } from '../server/official';
import { RATING_OPTIONS } from '../server/modOfficial';
import { emitEvent, maybeTick } from '../server/bots';

/** Guided start in the Support chat: pick an issue, describe it, then a ticket is raised. Afterwards messages go to the ticket. */
async function handleSupport(cid: string, me: string, email: string, body: string, files: { url: string; filename: string }[]) {
  const now = new Date().toISOString();
  const att = files.length ? files.map((f) => ({ url: f.url, filename: f.filename })) : null;
  const { records } = await zite.supportTickets.findAll({ filters: { requester: me }, limit: 50 });
  const linked = records.filter((t) => ids(t.supportChat).includes(cid));
  const rating = linked.find((t) => t.status === 'Closed' && t.chatClosesAt && t.rating == null);
  if (rating && RATING_OPTIONS.includes(body) && !files.length) {
    await zite.supportTickets.update({ id: rating.id, record: { rating: Number(body), ratedAt: now, chatClosesAt: now } as never });
    await postOfficial(cid, 'Chatting Support', 'Thanks for the feedback 💚');
    return;
  }
  const open = linked.find((t) => t.status !== 'Closed') ?? linked.find((t) => t.status === 'Closed' && t.chatClosesAt);
  if (open) {
    await Promise.all([
      zite.ticketReplies.create({ record: { body, ticket: [open.id], author: me, fromStaff: false, internalNote: false, attachments: att } as never }),
      zite.supportTickets.update({ id: open.id, record: { status: 'Open', lastActivityAt: now, checkInSentAt: null, chatClosesAt: null } as never }),
    ]);
    return;
  }
  // What has the user said since the last greeting?
  const r = await zite.sql({
    query: `SELECT m."body", m."quickReplies", m."officialSender" FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id
            WHERE l."conversationsId" = $1::uuid ORDER BY m.created_at DESC LIMIT 20`,
    params: [cid],
  });
  const since: string[] = [];
  for (const row of r.rows) { if (row.quickReplies) break; if (!row.officialSender) since.push(String(row.body ?? '')); }
  // since[0] is the message just sent.
  if (SUPPORT_OPTIONS.includes(body) && since.length === 1) {
    await postOfficial(cid, 'Chatting Support', body === 'Other' ? 'No problem — please describe what you need help with in one message.' : `Got it — ${body}. Please describe the problem in one message so our team has the details.`);
    return;
  }
  const picked = since.slice(1).find((x) => SUPPORT_OPTIONS.includes(x)) ?? 'Other';
  const { category, tags } = optionCategory(picked);
  const t = await zite.supportTickets.create({ record: {
    subject: `${picked === 'Other' ? '' : `${picked}: `}${body || '(screenshot)'}`.replace(/\s+/g, ' ').slice(0, 110), category, tags, description: body,
    requester: me, requesterEmail: email, priority: category === 'Abuse' ? 'High' : 'Normal', status: 'Open', lastActivityAt: now, supportChat: [cid],
  } as never });
  await Promise.all([
    zite.ticketReplies.create({ record: { body, ticket: [t.id], author: me, fromStaff: false, internalNote: false, attachments: att } as never }),
    postOfficial(cid, 'Chatting Support', 'Thanks — your issue has been raised and our support team will take a look. You’ll get a reply right here.'),
  ]);
}

const reject = (msg: string) => { const e = new ZiteError(msg); e.userFacingMessage = msg; return e; };

/** Announcement channels, slow mode and auto-moderation for community channels. */
type Extra = { files: number; poll: boolean; thread: boolean };
async function enforceRules(communityId: string, rawChannel: unknown, cid: string, me: string, body: string, x: Extra) {
  const { s, ownerId } = await loadCommunity(communityId);
  const ch = parseChannel(rawChannel);
  const perms = permsOf(s, ownerId, me);
  const until = timedOutUntil(s, me);
  if (until) throw reject(`You’re timed out in this community until ${new Date(until).toUTCString().slice(5, 22)} UTC.`);
  if (ch.announcement && !perms.has('postAnnouncements')) throw reject('Only certain roles can post in this announcement channel.');
  if (/@everyone\b/i.test(body) && !perms.has('mentionEveryone')) throw reject('You don’t have permission to use @everyone here.');
  const c = s.custom;
  if (!c.allowThreads && x.thread) throw reject('Threads are turned off in this community.');
  if (perms.has('bypassSlowmode')) return c;
  if (!c.allowFiles && x.files) throw reject('File uploads are turned off in this community.');
  if (!c.allowPolls && x.poll) throw reject('Polls are turned off in this community.');
  if (!c.allowGifs && /^https:\/\/media\d*\.giphy\.com\//.test(body)) throw reject('GIFs are turned off in this community.');
  if (c.minLength > 0 && body && !x.files && body.length < c.minLength) throw reject(`Messages here need at least ${c.minLength} characters.`);
  const letters = body.replace(/[^a-zA-Z]/g, '');
  if (c.blockCaps && letters.length >= 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) throw reject('Easy on the caps lock — this community blocks shouting.');
  if (c.maxMentions > 0 && (body.match(/@[\w.-]+/g)?.length ?? 0) > c.maxMentions) throw reject(`You can mention at most ${c.maxMentions} people per message here.`);
  if (c.maxEmoji > 0 && (body.match(/\p{Extended_Pictographic}/gu)?.length ?? 0) > c.maxEmoji) throw reject(`Messages here can have at most ${c.maxEmoji} emoji.`);
  if (body.length > s.maxLength) throw reject(`Messages here can be at most ${s.maxLength} characters.`);
  if (s.blockLinks && /(https?:\/\/|www\.)\S+/i.test(body)) throw reject('Links aren’t allowed in this community.');
  const lower = body.toLowerCase();
  if (s.bannedWords.some((w) => w && lower.includes(w))) throw reject('Your message contains a word this community has blocked.');
  if (ch.slowmode > 0) {
    const r = await zite.sql({
      query: `SELECT MAX(m.created_at) AS last FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id
              WHERE l."conversationsId" = $1::uuid AND m."sender"->>0 = $2`,
      params: [cid, me],
    });
    const last = r.rows[0]?.last ? new Date(String(r.rows[0].last)).getTime() : 0;
    const wait = Math.ceil((last + ch.slowmode * 1000 - Date.now()) / 1000);
    if (wait > 0) throw reject(`Slow mode is on — you can send again in ${wait}s.`);
  }
  return c;
}

export default createEndpoint({
  description: 'Sends a message (with optional files), optionally as a thread reply or a quoted reply',
  authenticated: true,
  inputSchema: z.object({
    conversationId: z.string(),
    body: z.string().max(12000),
    attachments: z.array(z.object({ url: z.string(), filename: z.string() })).max(10).optional(),
    parentMessageId: z.string().optional(),
    replyToId: z.string().optional(),
    poll: z.object({ question: z.string().min(1).max(300), options: z.array(z.string().min(1).max(120)).min(2).max(10), multi: z.boolean() }).optional(),
  }),
  outputSchema: z.object({ id: z.string(), sentAt: z.string() }),
  execute: async ({ input, context }) => {
    const body = input.body.trim();
    const files = input.attachments ?? [];
    if (!body && !files.length && !input.poll) throw fail('Empty message');
    const me = context.user.id;
    const cid = input.conversationId;

    // Access checks run together instead of one after another.
    const [conv, restricted] = await Promise.all([
      requireMember(cid, me),
      zite.sql({
        query: `SELECT "action", "expiresAt" FROM "UserActions" WHERE "targetUser"->>0 = $1 AND "action" IN ('Suspend','Ban','Lift') ORDER BY created_at DESC LIMIT 1`,
        params: [me],
      }).then((r) => {
        const a = r.rows[0];
        if (!a || a.action === 'Lift') return;
        if (a.action === 'Ban') return reject('Your account has been banned from sending messages. Contact support from Settings → Help & support.');
        if (!a.expiresAt || new Date(String(a.expiresAt)).getTime() > Date.now()) return reject(`Your account is suspended${a.expiresAt ? ` until ${new Date(String(a.expiresAt)).toUTCString().slice(5, 22)} UTC` : ''}. Contact support from Settings → Help & support.`);
        return undefined;
      }),
      input.parentMessageId && zite.messages.findOne({ id: input.parentMessageId }).then((p) => {
        if (!p || !ids(p.conversation).includes(cid)) throw fail('Thread not found');
      }),
    ]);
    const official = officialOf((conv as { officialAccount?: string }).officialAccount);
    if (official === 'Chatting' || official === 'Chatting Moderation') throw reject(`You can’t reply to ${official}. Need help? Use Contact support.`);
    // Suspended or banned people can still message Support so they can appeal.
    if (restricted && official !== 'Chatting Support') throw restricted;
    // Message requests: the sender gets one message until it's accepted; replying accepts it.
    if ((conv as { requestStatus?: string | null }).requestStatus === 'Pending') {
      const by = ids((conv as { requestedBy?: string | string[] | null }).requestedBy);
      if (by.includes(me)) {
        const sent = await zite.sql({ query: `SELECT COUNT(*) AS n FROM "ConversationsMessages" l WHERE l."conversationsId" = $1`, params: [cid] });
        if (Number(sent.rows[0]?.n ?? 0) >= 1) throw fail('Your message request is waiting — you can send more once they accept.');
      } else {
        await zite.conversations.update({ id: cid, record: { requestStatus: 'Accepted' } });
      }
    }
    if (official === 'Chatting Support') {
      if (input.poll || input.parentMessageId) throw reject('Only messages and images can be sent here.');
      if (files.length > 4) throw reject('You can attach up to 4 images per message.');
      if (files.some((f) => !/\.(png|jpe?g|gif|webp|heic|heif|avif|bmp)$/i.test(f.filename))) throw reject('Only images can be sent to Support.');
    } else if (official && (files.length || input.poll || input.parentMessageId)) throw reject('Only text messages can be sent here.');
    // Community rules, the block check and spam protection are independent, so they run at the same time.
    const other = !conv.isGroup && !official ? ids(conv.members).find((m) => m !== me) : undefined;
    const [custom, blocked, recent] = await Promise.all([
      conv.communityId ? enforceRules(conv.communityId, conv.settings, cid, me, body, { files: files.length, poll: !!input.poll, thread: !!input.parentMessageId }) : Promise.resolve(null),
      other ? zite.sql({ query: `SELECT 1 FROM "Profiles" WHERE ("userKey" = $1 AND "blocked" @> jsonb_build_array($2::text)) OR ("userKey" = $2 AND "blocked" @> jsonb_build_array($1::text)) LIMIT 1`, params: [me, other] }) : Promise.resolve(null),
      zite.sql({
        query: `SELECT m."body", m.created_at FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id
                WHERE l."conversationsId" = $1::uuid AND m."sender" @> jsonb_build_array($2::text) AND m.created_at > now() - interval '30 seconds' ORDER BY m.created_at DESC LIMIT 8`,
        params: [cid, me],
      }),
    ]);
    if (blocked?.rows.length) throw reject('You can’t message this person.');
    const inTen = recent.rows.filter((r) => Date.now() - new Date(String(r.created_at)).getTime() < 10_000).length;
    if (inTen >= 6) throw reject('Slow down a little — you’re sending messages very quickly.');
    if (body && body.length > 3 && recent.rows.filter((r) => String(r.body ?? '') === body).length >= 2) throw reject('Looks like you already sent that — try saying something new.');
    const ttl = Number((conv as { disappearAfter?: number | null }).disappearAfter ?? 0);

    const now = new Date().toISOString();
    const who = context.user.firstName || context.user.email.split('@')[0];
    const sealed = body.startsWith('e2e1.');
    const what = (sealed ? '🔒 Encrypted message' : body) || (input.poll ? `📊 ${input.poll.question}` : '') || `sent ${files.length > 1 ? `${files.length} files` : 'a file'}`;
    const preview = (input.parentMessageId ? `${who} replied in a thread: ${what}` : body || input.poll ? `${who}: ${what}` : `${who} ${what}`).slice(0, 140);

    // The message, the conversation's preview, the sender's read marker and clearing "typing…" all write in parallel.
    const [msg] = await Promise.all([
      zite.messages.create({
        record: {
          body, conversation: cid, sender: me, attachments: files.length ? files : null, reactions: null,
          parentMessageId: input.parentMessageId ?? null, replyToId: input.replyToId ?? null, editedAt: null,
          poll: input.poll ? JSON.stringify({ ...input.poll, votes: {} }) : null,
          expiresAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
        } as never,
      }),
      zite.conversations.update({ id: cid, record: { lastMessageAt: now, lastMessagePreview: preview, archivedBy: [] } as never }),
      input.parentMessageId ? null : zite.readReceipts.bulkCreate({
        records: [{ key: `${cid}:${me}`, conversation: cid, reader: me, lastReadAt: now }], matchOn: ['key'],
      }),
      zite.presence.bulkCreate({ records: [{ userKey: me, person: me, lastSeenAt: now, typingIn: null, typingAt: null } as never], matchOn: ['userKey'] }),
    ]);
    // Follow-up work (bot events, auto-responders, support routing) runs side by side.
    const hit = custom && body ? custom.autoReplies.find((r) => body.toLowerCase().includes(r.trigger)) : null;
    const communityId = conv.communityId;
    await Promise.all([
      communityId ? emitEvent(communityId, 'MESSAGE_CREATE', cid, { messageId: msg.id, channelId: cid, userId: me, authorId: me, authorName: who, body, threadId: input.parentMessageId ?? null, replyToId: input.replyToId ?? null, attachments: files.length }).then(() => { maybeTick(); }) : null,
      hit && communityId ? (async () => {
        const owner = ids((await zite.communities.findOne({ id: communityId }))?.owner)[0];
        if (owner) await postInto(cid, owner, `🤖 ${hit.reply}`).catch(() => {});
      })() : null,
      official === 'Chatting Support' ? handleSupport(cid, me, context.user.email, body, files) : null,
    ]);
    return { id: msg.id, sentAt: now };
  },
});
