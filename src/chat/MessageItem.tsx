import { CheckCheck, Clock3 } from 'lucide-react';
import { useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { Copy, FileText, Forward, MessageSquareReply, MoreHorizontal, Pencil, Pin, Reply, SmilePlus, Star, Trash2, Eye, MailOpen, Timer, Languages, Link2, Flag } from 'lucide-react';
import { reports, translate } from 'zitejs/api';
import { cn } from '@project/components/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import PersonAvatar from './Avatars';
import { useChat } from './store';
import type { Msg } from './messages';
import PollCard from './PollCard';
import { BotAvatar, BotBadge, BotCard } from './BotMessage';
import VoicePlayer from './VoicePlayer';
import LinkPreview from './LinkPreview';
import { topRole, type CommunitySettings } from '../lib/community';
import { timeFmt, usePrefs } from './prefs';
import { errorMessage } from '../lib/errors';

export type { Msg };
const EMOJI = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '🙏'];
const gap = (a?: Msg, b?: Msg) => !a || !b || a.senderId !== b.senderId || Math.abs(+new Date(b.sentAt) - +new Date(a.sentAt)) > 5 * 60_000;

/** Lightweight formatting: ```code```, > quotes, links, **bold**, _italic_, ~~strike~~, ||spoiler||, `code`, @mentions. */
export function RichText({ text, mine, highlight }: { text: string; mine?: boolean; highlight?: string }) {
  const blocks = text.split(/```(?:\w*\n)?([\s\S]*?)```/g);
  return <>{blocks.map((b, i) => i % 2 ? <CodeBlock key={i} code={b} mine={mine} /> : (
    <span key={i}>{b.split('\n').map((line, j, arr) => {
      const quote = line.startsWith('> ');
      const content = <Inline text={quote ? line.slice(2) : line} mine={mine} highlight={highlight} />;
      return <span key={j}>{quote ? <span className={cn('my-0.5 block border-l-[3px] pl-2 opacity-90', mine ? 'border-primary-foreground/50' : 'border-primary/50')}>{content}</span> : content}{j < arr.length - 1 && !quote && '\n'}</span>;
    })}</span>
  ))}</>;
}

function Inline({ text, mine, highlight }: { text: string; mine?: boolean; highlight?: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+|\*\*[^*]+\*\*|==[^=]+==|__[^_]+__|~~[^~]+~~|\|\|[^|]+\|\||_[^_\s][^_]*_|`[^`]+`|@[\w.-]+)/g);
  const hi = (s: string, k: number) => {
    if (!highlight || highlight.length < 2) return s;
    return s.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((x, i) => (i % 2 ? <mark key={`${k}-${i}`} className="rounded bg-yellow-300/70 px-0.5 text-foreground">{x}</mark> : x));
  };
  return <>{parts.map((p, i) => {
    if (i % 2 === 0) return <span key={i}>{hi(p, i)}</span>;
    if (p.startsWith('http')) return <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">{p}</a>;
    if (p.startsWith('**')) return <strong key={i}>{hi(p.slice(2, -2), i)}</strong>;
    if (p.startsWith('==')) return <mark key={i} className="rounded bg-yellow-300/70 px-0.5 text-foreground">{hi(p.slice(2, -2), i)}</mark>;
    if (p.startsWith('__')) return <u key={i} className="underline-offset-2">{hi(p.slice(2, -2), i)}</u>;
    if (p.startsWith('~~')) return <s key={i}>{hi(p.slice(2, -2), i)}</s>;
    if (p.startsWith('||')) return <Spoiler key={i} text={p.slice(2, -2)} />;
    if (p.startsWith('`')) return <code key={i} className={cn('rounded px-1 py-0.5 font-mono text-[13px]', mine ? 'bg-black/15' : 'bg-background/70')}>{p.slice(1, -1)}</code>;
    if (p.startsWith('@')) return <span key={i} className={cn('font-semibold', !mine && 'text-primary', (p === '@here' || p === '@everyone') && 'rounded bg-amber-400/25 px-1')}>{p}</span>;
    return <em key={i}>{hi(p.slice(1, -1), i)}</em>;
  })}</>;
}

function Spoiler({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  return <span role="button" tabIndex={0} title={shown ? undefined : 'Click to reveal'} onClick={(e) => { e.stopPropagation(); setShown(true); }} className={cn('spoiler px-0.5', shown && 'revealed')}>{text}</span>;
}

function CodeBlock({ code, mine }: { code: string; mine?: boolean }) {
  return (
    <span className={cn('group/code relative my-1 block overflow-x-auto whitespace-pre rounded-xl p-3 font-mono text-[12.5px] leading-relaxed', mine ? 'bg-black/20' : 'bg-background/80')}>
      <button onClick={() => { navigator.clipboard.writeText(code.replace(/\n$/, '')); toast.success('Code copied'); }} className="absolute right-1.5 top-1.5 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-sans text-foreground opacity-0 transition group-hover/code:opacity-100">Copy</button>
      {code.replace(/\n$/, '')}
    </span>
  );
}

/** Messages made of 1–3 emoji (and nothing else) are shown big, sticker-style. */
export const isJumbo = (s: string) => { const t = s.trim(); return !!t && t.length <= 24 && /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u.test(t) && (t.match(/\p{Extended_Pictographic}/gu)?.length ?? 0) <= 3 && /\p{Extended_Pictographic}/u.test(t); };

export type MsgActions = {
  onReact: (id: string, emoji: string) => void; onDelete: (id: string) => void; onEdit: (id: string, body: string) => void;
  onReply?: (id: string) => void; onPerson: (id: string) => void; onQuote?: (m: Msg) => void; onForward?: (m: Msg) => void;
  onToggle?: (id: string, action: 'pin' | 'star') => void; onJump?: (id: string) => void;
  onVote?: (id: string, option: number) => void; onMarkUnread?: (m: Msg) => void;
  community?: CommunitySettings | null; canModerate?: boolean;
};
type Props = MsgActions & { m: Msg; prev?: Msg; next?: Msg; isGroup: boolean; receipt?: string; seenBy?: string[]; inThread?: boolean; highlight?: string };

export default function MessageItem({ m, prev, next, isGroup, receipt, seenBy, inThread, highlight, community, canModerate, ...a }: Props) {
  const { me, people } = useChat();
  const prefs = usePrefs();
  const cc = community?.custom;
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [translated, setTranslated] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const doTranslate = async () => {
    if (translated) return setTranslated(null);
    try { const r = await translate({ text: m.body, target: navigator.language || 'en' }); setTranslated(r.text); } catch (e) { toast.error(errorMessage(e, 'Couldn’t translate')); }
  };
  const sendReport = async () => {
    try { await reports({ action: 'report', messageId: m.id, reason }); toast.success('Reported — moderators will take a look'); setReporting(false); setReason(''); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t report')); }
  };
  const mine = m.senderId === me.id;
  const first = gap(prev, m);
  const last = gap(m, next) || m.replyCount > 0;
  const sender = people.get(m.senderId);
  const nameOf = (id: string) => (id === me.id ? 'You' : id.startsWith('bot:') ? (id === m.senderId && m.bot ? m.bot.name : 'Bot') : community?.nicknames[id] ?? people.get(id)?.name ?? 'Someone');
  const role = community ? topRole(community, m.senderId) : null;
  const images = m.attachments.filter((x) => x.mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(x.url));
  const audio = m.attachments.filter((x) => !images.includes(x) && (x.mimeType.startsWith('audio/') || /\.(webm|m4a|mp3|ogg|wav)(\?|$)/i.test(x.name + ' ' + x.url) || /^voice-message/.test(x.name)));
  const files = m.attachments.filter((x) => !images.includes(x) && !audio.includes(x));
  const gif = /^https:\/\/media\d*\.giphy\.com\/\S+$/.test(m.body.trim()) ? m.body.trim() : null;
  const saveEdit = () => { const b = draft.trim(); if (b && b !== m.body) a.onEdit(m.id, b); setEditing(false); };

  return (
    <div id={`msg-${m.id}`} className={cn('group flex items-end gap-2 rounded-2xl transition-colors', mine ? 'justify-end' : 'justify-start', first ? 'mt-4' : 'mt-0.5', m.pending && 'opacity-60')}>
      {!mine && isGroup && !prefs.hideAvatars && <span className="w-7 shrink-0">{last && (m.bot ? <BotAvatar name={m.bot.name} avatar={m.bot.avatar} /> : <button onClick={() => a.onPerson(m.senderId)}><PersonAvatar name={sender?.name ?? '?'} image={sender?.image} size={28} /></button>)}</span>}
      <div className={cn('flex max-w-[80%] flex-col sm:max-w-[65%]', mine ? 'items-end' : 'items-start')}>
        {first && m.bot && <p className="mb-1 ml-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">{m.bot.name}<BotBadge /></p>}
        {first && !mine && isGroup && !m.bot && <button onClick={() => a.onPerson(m.senderId)} className="mb-1 ml-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"><span style={role ? { color: role.color, fontWeight: 600 } : undefined}>{nameOf(m.senderId)}</span>{role && cc?.showRoleTags !== false && <span className="rounded px-1 text-[10px] font-medium" style={{ background: `${role.color}22`, color: role.color }}>{role.name}</span>}</button>}
        {first && !mine && m.staffName && <p className="mb-1 ml-3 text-xs text-muted-foreground">Chatting Support · <span className="font-medium text-foreground">{m.staffName}</span></p>}
        {(m.pinned || m.starred) && <p className="mb-0.5 flex items-center gap-1 px-2 text-[11px] text-muted-foreground">{m.pinned && <><Pin className="h-3 w-3" /> Pinned</>}{m.starred && <Star className="h-3 w-3 fill-current" />}</p>}
        <div className={cn('flex items-center gap-0.5', mine && 'flex-row-reverse')}>
          <div className="flex min-w-0 flex-col gap-1">
            {m.replyTo && (
              <button onClick={() => a.onJump?.(m.replyTo!.id)} className={cn('max-w-full rounded-2xl border-l-4 border-primary/60 bg-secondary/60 px-3 py-1.5 text-left text-xs', mine && 'self-end')}>
                <span className="font-medium">{nameOf(m.replyTo.senderId)}</span><span className="line-clamp-2 text-muted-foreground">{m.replyTo.body || 'Attachment'}</span>
              </button>
            )}
            {images.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer"><img src={x.url} alt={x.name} loading="lazy" className="max-h-72 rounded-2xl object-cover" /></a>)}
            {audio.map((x) => <VoicePlayer key={x.url} src={x.url} mine={mine} />)}
            {gif && <img src={gif} alt="GIF" loading="lazy" className="max-h-60 rounded-2xl" />}
            <BotCard m={m} />
            {m.poll && <PollCard poll={m.poll} onVote={m.pending || !a.onVote ? undefined : (i) => a.onVote!(m.id, i)} />}
            {files.map((x) => (
              <a key={x.url} href={x.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-sm hover:bg-secondary"><FileText className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="truncate">{x.name}</span></a>
            ))}
            {editing ? (
              <div className="w-72 max-w-full rounded-2xl border border-input bg-background p-2">
                <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={5000}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditing(false); }}
                  className="w-full resize-none bg-transparent text-[15px] outline-none" />
                <div className="flex justify-end gap-1 text-xs"><button onClick={() => setEditing(false)} className="rounded-full px-3 py-1">Cancel</button><button onClick={saveEdit} className="rounded-full bg-foreground px-3 py-1 text-background">Save</button></div>
              </div>
            ) : m.body && !gif && isJumbo(m.body) ? (
              <p title={format(new Date(m.sentAt), 'PPp')} className="select-none px-1 text-5xl leading-tight">{m.body}</p>
            ) : m.body && !gif && (
              <p title={format(new Date(m.sentAt), 'PPp')} onDoubleClick={() => !m.pending && a.onQuote?.(m)}
                className={cn('whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-[15px] leading-snug', mine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground', mine ? last && 'rounded-br-md' : last && 'rounded-bl-md')}>
                <RichText text={m.body} mine={mine} highlight={highlight} />
              </p>
            )}
            {translated && <p className="max-w-full rounded-2xl border border-dashed border-border px-3 py-1.5 text-sm"><span className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Languages className="h-3 w-3" /> Translated</span>{translated}</p>}
            {m.body && !gif && !m.pending && prefs.linkPreviews && <LinkPreview text={m.body} />}
          </div>
          {!m.pending && !editing && (
            <div className={cn('flex shrink-0 items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-70', mine && 'flex-row-reverse')}>
              {cc?.allowReactions !== false && <ReactPicker emojis={community?.quickReactions} onPick={(e) => a.onReact(m.id, e)} />}
              {a.onQuote && <Act label="Reply" onClick={() => a.onQuote!(m)}><Reply className="h-4 w-4" /></Act>}
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="More" title="More" className={actCls}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? 'end' : 'start'} className="w-52">
                  {a.onReply && !inThread && cc?.allowThreads !== false && <DropdownMenuItem onClick={() => a.onReply!(m.id)}><MessageSquareReply className="mr-2 h-4 w-4" /> Reply in thread</DropdownMenuItem>}
                  {a.onForward && <DropdownMenuItem onClick={() => a.onForward!(m)}><Forward className="mr-2 h-4 w-4" /> Forward</DropdownMenuItem>}
                  {m.body && <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(m.body); toast.success('Copied'); }}><Copy className="mr-2 h-4 w-4" /> Copy text</DropdownMenuItem>}
                  {a.onToggle && <DropdownMenuItem onClick={() => a.onToggle!(m.id, 'pin')}><Pin className="mr-2 h-4 w-4" /> {m.pinned ? 'Unpin' : 'Pin to chat'}</DropdownMenuItem>}
                  {a.onToggle && <DropdownMenuItem onClick={() => a.onToggle!(m.id, 'star')}><Star className="mr-2 h-4 w-4" /> {m.starred ? 'Unsave' : 'Save message'}</DropdownMenuItem>}
                  {m.body && !gif && <DropdownMenuItem onClick={doTranslate}><Languages className="mr-2 h-4 w-4" /> {translated ? 'Show original' : 'Translate'}</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${location.origin}${location.pathname}?m=${m.id}`); toast.success('Link copied'); }}><Link2 className="mr-2 h-4 w-4" /> Copy link</DropdownMenuItem>
                  {!mine && <DropdownMenuItem onClick={() => setReporting(true)}><Flag className="mr-2 h-4 w-4" /> Report</DropdownMenuItem>}
                  {!mine && a.onMarkUnread && <DropdownMenuItem onClick={() => a.onMarkUnread!(m)}><MailOpen className="mr-2 h-4 w-4" /> Mark unread from here</DropdownMenuItem>}
                  {mine && m.body && cc?.allowEdits !== false && <DropdownMenuItem onClick={() => { setDraft(m.body); setEditing(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                  {(mine || canModerate) && <DropdownMenuItem onClick={() => setConfirm(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                  {seenBy && (
                    <><DropdownMenuSeparator /><DropdownMenuLabel className="text-xs font-normal text-muted-foreground"><Eye className="mr-1 inline h-3 w-3" />{seenBy.length ? `Seen by ${seenBy.map(nameOf).join(', ')}` : 'Not seen yet'}</DropdownMenuLabel></>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        {!next && !!m.quickReplies?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.quickReplies.map((q) => (
              <button key={q} onClick={() => window.dispatchEvent(new CustomEvent('chat:quick', { detail: q }))}
                className="rounded-full border border-primary/40 bg-background px-3 py-1 text-sm font-medium text-primary transition hover:bg-primary/10">{q}</button>
            ))}
          </div>
        )}
        {m.reactions.length > 0 && (
          <div className={cn('-mt-1.5 flex flex-wrap gap-1 px-2', mine && 'justify-end')}>
            {m.reactions.map((r) => (
              <button key={r.emoji} onClick={() => a.onReact(m.id, r.emoji)} title={r.userIds.map(nameOf).join(', ')}
                className={cn('rounded-full border px-1.5 py-0.5 text-xs shadow-sm transition', r.userIds.includes(me.id) ? 'border-primary/50 bg-primary/10' : 'border-border bg-background')}>
                {r.emoji}{r.userIds.length > 1 && <span className="ml-0.5 text-muted-foreground">{r.userIds.length}</span>}
              </button>
            ))}
          </div>
        )}
        {m.replyCount > 0 && !inThread && a.onReply && (
          <button onClick={() => a.onReply!(m.id)} className="mt-1 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-primary hover:bg-secondary">
            <MessageSquareReply className="h-3.5 w-3.5" /> {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
            {m.lastReplyAt && <span className="font-normal text-muted-foreground">· {formatDistanceToNowStrict(new Date(m.lastReplyAt))} ago</span>}
          </button>
        )}
        {last && <p className={`mt-1 flex items-center gap-1 px-2 text-[11px] text-muted-foreground ${mine ? 'justify-end' : ''}`}>{format(new Date(m.sentAt), timeFmt())}{m.editedAt && ' · edited'}{m.expiresAt && <Timer className="ml-1 inline h-3 w-3" />}<Ticks state={m.pending ? 'pending' : receipt} /></p>}
      </div>
      <AlertDialog open={reporting} onOpenChange={setReporting}>
        <AlertDialogContent>
          <AlertDialogTitle>Report this message?</AlertDialogTitle>
          <AlertDialogDescription>Moderators of this community will see the message and your reason. The sender won’t know it was you.</AlertDialogDescription>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="What’s wrong? (spam, harassment, …)" className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={sendReport} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Report</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this message?</AlertDialogTitle>
          <AlertDialogDescription>It will be removed for everyone in the conversation. This can’t be undone.</AlertDialogDescription>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => a.onDelete(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const actCls = 'grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground';
const Act = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => <button aria-label={label} title={label} onClick={onClick} className={actCls}>{children}</button>;

function ReactPicker({ onPick, emojis = EMOJI }: { onPick: (e: string) => void; emojis?: string[] }) {
  return (
    <Popover>
      <PopoverTrigger aria-label="React" title="React" className={actCls}><SmilePlus className="h-4 w-4" /></PopoverTrigger>
      <PopoverContent side="top" className="flex w-auto gap-0.5 rounded-full p-1.5">
        {emojis.map((e) => <button key={e} onClick={() => onPick(e)} className="grid h-9 w-9 place-items-center rounded-full text-xl transition hover:scale-125 hover:bg-secondary">{e}</button>)}
      </PopoverContent>
    </Popover>
  );
}

function Ticks({ state }: { state?: string }) {
  if (!state) return null;
  if (state === 'pending') return <Clock3 className="ml-0.5 inline h-3 w-3" aria-label="Sending" />;
  const read = state === 'Read';
  return <CheckCheck className={`ml-0.5 inline h-3.5 w-3.5 ${read ? 'text-sky-500' : ''}`} aria-label={read ? 'Read' : 'Delivered'} />;
}
