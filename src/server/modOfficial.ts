import { zite } from 'zitejs/db';

const ids = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
export const chatOf = (t: { supportChat?: string | string[] } | null | undefined) => ids(t?.supportChat)[0] ?? null;

/** Posts a staff reply into the user's Chatting Support DM, as the verified Support account. */
export async function postAsSupport(cid: string, body: string, staffName: string) {
  const now = new Date().toISOString();
  await Promise.all([
    zite.messages.create({ record: { body, conversation: cid, sender: null, officialSender: 'Chatting Support', staffName } as never }),
    zite.conversations.update({ id: cid, record: { lastMessageAt: now, lastMessagePreview: `${staffName}: ${body}`.replace(/\s+/g, ' ').slice(0, 140), archivedBy: [] } as never }),
  ]);
}

/** Saves the whole chat to the ticket, then deletes the chat so Support disappears from the user's list. */
export async function closeSupportChat(ticketId: string) {
  const t = await zite.supportTickets.findOne({ id: ticketId });
  const cid = chatOf(t);
  if (!t || !cid) return;
  const r = await zite.sql({
    query: `SELECT m.id, m."body", m.created_at AS at, m."officialSender", m."staffName", COALESCE(u."name", u."email", 'Customer') AS who
            FROM "Messages" m JOIN "ConversationsMessages" l ON l."messagesId" = m.id LEFT JOIN "ziteUsers" u ON u.id::text = m."sender"->>0
            WHERE l."conversationsId" = $1::uuid ORDER BY m.created_at`,
    params: [cid],
  });
  const transcript = r.rows.map((m) => {
    const who = m.officialSender ? `Chatting Support${m.staffName ? ` · ${m.staffName}` : ''}` : String(m.who);
    return `[${new Date(String(m.at)).toISOString().slice(0, 16).replace('T', ' ')} UTC] ${who}: ${String(m.body ?? '')}`;
  }).join('\n');
  await zite.supportTickets.update({ id: ticketId, record: { transcript, status: 'Closed', lastActivityAt: new Date().toISOString(), supportChat: null } as never });
  const mids = r.rows.map((m) => String(m.id));
  for (let i = 0; i < mids.length; i += 20) await Promise.all(mids.slice(i, i + 20).map((id) => zite.messages.delete({ id }).catch(() => {})));
  await zite.conversations.delete({ id: cid }).catch(() => {});
}

export const RATING_OPTIONS = ['1', '2', '3', '4', '5'];
const RATING_WINDOW_MS = 24 * 3600 * 1000;

/** Marks the ticket closed and asks the user for a 1–5 rating. The chat is removed after they rate, or 24h later. */
export async function requestRating(ticketId: string) {
  const t = await zite.supportTickets.findOne({ id: ticketId });
  const cid = chatOf(t);
  if (!t) return;
  if (!cid) { await zite.supportTickets.update({ id: ticketId, record: { status: 'Closed', lastActivityAt: new Date().toISOString() } as never }); return; }
  if (t.status === 'Closed' && t.chatClosesAt) return;
  const now = new Date();
  await zite.supportTickets.update({ id: ticketId, record: { status: 'Closed', lastActivityAt: now.toISOString(), chatClosesAt: new Date(now.getTime() + RATING_WINDOW_MS).toISOString() } as never });
  await zite.messages.create({ record: { body: 'Your ticket is closed. How did we do?', conversation: cid, sender: null, officialSender: 'Chatting Support', quickReplies: JSON.stringify(RATING_OPTIONS) } as never });
  await zite.conversations.update({ id: cid, record: { lastMessageAt: now.toISOString(), lastMessagePreview: 'Your ticket is closed. How did we do?', archivedBy: [] } as never });
}

const CHECK_IN = 'Just checking in — is this sorted? Reply here if you still need help.';

/** Idle check-ins, auto-close and finishing closes whose rating window has ended. */
export async function sweepSupport() {
  const [idle, checked, due] = await Promise.all([
    zite.sql({ query: `SELECT t.id FROM "SupportTickets" t WHERE COALESCE(t."status",'Open') IN ('Open','Pending') AND t."checkInSentAt" IS NULL AND jsonb_array_length(COALESCE(t."supportChat",'[]'::jsonb)) > 0
      AND (SELECT COALESCE(r."fromStaff",false) AND r.created_at < now() - interval '3 days' FROM "SupportTicketsTicketReplies" l JOIN "TicketReplies" r ON r.id = l."ticketRepliesId"
           WHERE l."supportTicketsId" = t.id AND COALESCE(r."internalNote",false) = false ORDER BY r.created_at DESC LIMIT 1) LIMIT 50` }),
    zite.sql({ query: `SELECT id FROM "SupportTickets" WHERE COALESCE("status",'Open') IN ('Open','Pending') AND "checkInSentAt" < now() - interval '24 hours' LIMIT 50` }),
    zite.sql({ query: `SELECT id FROM "SupportTickets" WHERE "status" = 'Closed' AND "chatClosesAt" IS NOT NULL AND "chatClosesAt" <= now() AND jsonb_array_length(COALESCE("supportChat",'[]'::jsonb)) > 0 LIMIT 50` }),
  ]);
  const now = new Date().toISOString();
  for (const row of idle.rows) {
    const id = String(row.id);
    const t = await zite.supportTickets.findOne({ id });
    const cid = chatOf(t);
    if (!cid) continue;
    await zite.supportTickets.update({ id, record: { checkInSentAt: now } as never });
    await postAsSupport(cid, CHECK_IN, 'Support');
  }
  for (const row of checked.rows) {
    const id = String(row.id);
    await zite.ticketReplies.create({ record: { body: 'Auto-closed after no reply', ticket: [id], author: null, fromStaff: true, internalNote: true } as never });
    await requestRating(id);
  }
  for (const row of due.rows) await closeSupportChat(String(row.id));
  return { checkIns: idle.rows.length, autoClosed: checked.rows.length, finished: due.rows.length };
}
