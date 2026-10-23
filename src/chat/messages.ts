import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { chatPrefs, deleteMessage, editMessage, getMessages, messageAction, sendMessage, toggleReaction, votePoll, type GetMessagesOutputType } from 'zitejs/api';
import { useChat, usePoll } from './store';
import { errorMessage } from '../lib/errors';
import { withTimes } from '../lib/bots';
import { decrypt, encrypt, isSealed, partnerKey } from '../lib/e2e';

export type Msg = GetMessagesOutputType['messages'][number] & { pending?: boolean; encrypted?: boolean };
type Pending = Msg & { realId?: string; confirmedAt?: number };
export type PollDraft = { question: string; options: string[]; multi: boolean };
export type Draft = { body: string; files: { url: string; filename: string; mimeType: string }[]; replyTo?: Msg | null; poll?: PollDraft };

/** Messages for a conversation (or one thread), with optimistic send/react/edit/delete/pin/star. */
export function useMessages(conversationId: string, parentMessageId?: string) {
  const { me, refresh, conversations } = useChat();
  const [data, setData] = useState<GetMessagesOutputType | null>(null);
  // Decrypted bodies, keyed by the stored ciphertext.
  const [plain, setPlain] = useState<Record<string, string>>({});
  const plainRef = useRef(plain);
  plainRef.current = plain;
  const seal = async (target: string, text: string) => {
    const c = conversations?.find((x) => x.id === target);
    const them = c && !c.isGroup && !c.communityId && !c.official ? c.memberIds.find((u) => u !== me.id) : undefined;
    if (!text || !them) return text;
    const k = await partnerKey(them);
    if (!k) return text;
    const env = await encrypt(me.id, k, text);
    setPlain((p) => ({ ...p, [env]: text }));
    return env;
  };
  useEffect(() => {
    const todo = new Set<string>();
    for (const m of data?.messages ?? []) for (const b of [m.body, m.replyTo?.body ?? '']) if (isSealed(b) && !(b in plainRef.current)) todo.add(b);
    if (!todo.size) return;
    Promise.all([...todo].map(async (b) => [b, await decrypt(me.id, b)] as const)).then((pairs) => setPlain((p) => ({ ...p, ...Object.fromEntries(pairs) })));
  }, [data, me.id]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState(false);
  const [firstUnreadAt, setFirstUnreadAt] = useState<string | null>(null);
  const lastMarked = useRef<string | null>(null);
  const inflight = useRef(false);

  useEffect(() => { setData(null); setPending([]); setError(false); setFirstUnreadAt(null); lastMarked.current = null; }, [conversationId, parentMessageId]);

  const again = useRef(false);
  const load = async (): Promise<void> => {
    // Never stack requests — but remember that a fresh load was asked for, so it runs right after.
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    again.current = false;
    try {
      const prevLast = lastMarked.current;
      const startedAt = Date.now();
      const d = await getMessages({ conversationId, parentMessageId, markRead: false });
      const last = d.messages[d.messages.length - 1]?.id ?? null;
      // Mark read only when a new message arrived since we last did — keeps polling cheap.
      if (!parentMessageId && last && last !== prevLast && !document.hidden) {
        if (prevLast === null && d.myLastReadAt) setFirstUnreadAt(d.myLastReadAt);
        lastMarked.current = last;
        getMessages({ conversationId, markRead: true }).then(() => refresh()).catch(() => {});
      }
      setData(d);
      // The server list is authoritative for anything confirmed before this fetch began — e.g. a message a bot already removed.
      setPending((ps) => (ps.some((p) => p.confirmedAt && p.confirmedAt < startedAt) ? ps.filter((p) => !(p.confirmedAt && p.confirmedAt < startedAt)) : ps));
      setError(false);
    } catch { setError(true); } finally {
      inflight.current = false;
      if (again.current) loadRef.current();
    }
  };
  usePoll(load, 8000, [conversationId, parentMessageId]); // fallback; live updates arrive via 'chat:live'
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const f = (e: Event) => { if ((e as CustomEvent).detail === conversationId) loadRef.current(); };
    window.addEventListener('chat:live', f);
    return () => window.removeEventListener('chat:live', f);
  }, [conversationId]);

  const messages = useMemo(() => {
    const open = (b: string) => (isSealed(b) ? plain[b] ?? '🔒 Decrypting…' : b);
    const real = (data?.messages ?? []).map((m) => (m.bot && m.body.includes('<t:') ? { ...m, body: withTimes(m.body) }
      : isSealed(m.body) || (m.replyTo && isSealed(m.replyTo.body)) ? { ...m, body: open(m.body), encrypted: isSealed(m.body), replyTo: m.replyTo && { ...m.replyTo, body: open(m.replyTo.body) } } : m));
    const ids = new Set(real.map((m) => m.id));
    // Pending messages stay visible until the server list contains them — matched by id only,
    // so sending the same text twice never hides a message.
    const shown = pending.filter((p) => !(p.realId && ids.has(p.realId)));
    return [...real, ...shown] as Msg[];
  }, [data, pending, plain]);
  useEffect(() => {
    const ids = new Set((data?.messages ?? []).map((m) => m.id));
    if (pending.some((p) => p.realId && ids.has(p.realId))) setPending((ps) => ps.filter((p) => !(p.realId && ids.has(p.realId))));
  }, [data, pending]);

  const send = async (d: Draft, target = conversationId) => {
    const local = target === conversationId;
    const tmp: Pending = { staffName: null, quickReplies: [], bot: null, embeds: [], components: [],
      id: `tmp-${Date.now()}-${Math.random()}`, body: d.body, senderId: me.id, sentAt: new Date().toISOString(), editedAt: null,
      reactions: [], replyCount: 0, lastReplyAt: null, pending: true, pinned: false, starred: false, expiresAt: null,
      poll: d.poll ? { question: d.poll.question, multi: d.poll.multi, options: d.poll.options.map((text) => ({ text, votes: [] })) } : null,
      replyTo: d.replyTo ? { id: d.replyTo.id, body: d.replyTo.body, senderId: d.replyTo.senderId } : null,
      attachments: d.files.map((f) => ({ url: f.url, name: f.filename, mimeType: f.mimeType })),
    };
    if (local) setPending((p) => [...p, tmp]);
    try {
      const { id, sentAt } = await sendMessage({
        conversationId: target, body: await seal(target, d.body.trim()), parentMessageId: local ? parentMessageId : undefined, replyToId: d.replyTo?.id,
        attachments: d.files.map(({ url, filename }) => ({ url, filename })), poll: d.poll,
      });
      // Confirm in place: it stops looking "Sending…" immediately and takes its real id, so the
      // server copy replaces it seamlessly (same key, no flicker or jump).
      if (local) { setPending((p) => p.map((m) => (m.id === tmp.id ? { ...m, id, realId: id, confirmedAt: Date.now(), sentAt, pending: false } : m))); lastMarked.current = id; load(); }
      refresh();
      return true;
    } catch (e) {
      if (local) setPending((p) => p.filter((m) => m.id !== tmp.id));
      toast.error(errorMessage(e, 'Message not sent'));
      return false;
    }
  };

  const patch = (id: string, fn: (m: Msg) => Msg | null) =>
    setData((d) => d && { ...d, messages: d.messages.map((m) => (m.id === id ? fn(m) : m)).filter(Boolean) as Msg[] });

  const react = async (messageId: string, emoji: string) => {
    patch(messageId, (m) => ({ ...m, reactions: flip(m.reactions, emoji, me.id) }));
    try { await toggleReaction({ conversationId, messageId, emoji }); } catch (e) { toast.error(errorMessage(e, 'Couldn’t react')); load(); }
  };
  const edit = async (messageId: string, body: string) => {
    patch(messageId, (m) => ({ ...m, body, editedAt: new Date().toISOString() }));
    try { await editMessage({ messageId, body: await seal(conversationId, body) }); } catch (e) { toast.error(errorMessage(e, 'Couldn’t edit')); load(); }
  };
  const remove = async (messageId: string) => {
    patch(messageId, () => null);
    try { await deleteMessage({ messageId }); toast.success('Message deleted'); refresh(); } catch (e) { toast.error(errorMessage(e, 'Couldn’t delete')); load(); }
  };
  const toggle = async (messageId: string, action: 'pin' | 'star') => {
    const key = action === 'pin' ? 'pinned' : 'starred';
    patch(messageId, (m) => ({ ...m, [key]: !m[key] }));
    try { const { on } = await messageAction({ messageId, action }); toast.success(action === 'pin' ? (on ? 'Pinned to the chat' : 'Unpinned') : on ? 'Saved' : 'Removed from saved'); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t update')); load(); }
  };

  const vote = async (messageId: string, option: number) => {
    patch(messageId, (m) => m.poll ? { ...m, poll: { ...m.poll, options: m.poll.options.map((o, i) => {
      const has = o.votes.includes(me.id);
      if (i === option) return { ...o, votes: has ? o.votes.filter((u) => u !== me.id) : [...o.votes, me.id] };
      return m.poll!.multi ? o : { ...o, votes: o.votes.filter((u) => u !== me.id) };
    }) } } : m);
    try { await votePoll({ messageId, option }); } catch (e) { toast.error(errorMessage(e, 'Couldn’t vote')); load(); }
  };
  const markUnread = async (m: Msg) => {
    try {
      lastMarked.current = data?.messages[data.messages.length - 1]?.id ?? m.id; // don't immediately re-mark it read
      await chatPrefs({ conversationId, action: 'markUnread', sentAt: m.sentAt });
      setFirstUnreadAt(new Date(+new Date(m.sentAt) - 1).toISOString());
      await refresh(); toast.success('Marked as unread');
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t mark unread')); }
  };

  return { data, messages, error, send, react, edit, remove, toggle, vote, markUnread, firstUnreadAt };
}

function flip(rs: Msg['reactions'], emoji: string, me: string) {
  const has = rs.find((r) => r.emoji === emoji);
  if (!has) return [...rs, { emoji, userIds: [me] }];
  const userIds = has.userIds.includes(me) ? has.userIds.filter((u) => u !== me) : [...has.userIds, me];
  return rs.map((r) => (r.emoji === emoji ? { ...r, userIds } : r)).filter((r) => r.userIds.length);
}

export function readersOf(sentAt: string, reads: GetMessagesOutputType['reads']) {
  return reads.filter((r) => r.lastReadAt >= sentAt).map((r) => r.userId);
}
/** WhatsApp rules: blue ticks once everyone else in the chat has read it. */
export function receiptFor(sentAt: string, reads: GetMessagesOutputType['reads'], isGroup?: boolean, members = 2) {
  const n = readersOf(sentAt, reads).length;
  return n > 0 && (!isGroup || n >= members - 1) ? 'Read' : 'Delivered';
}
