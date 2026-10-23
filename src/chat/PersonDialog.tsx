import { useEffect, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, Check, Clock, Copy, Crown, Loader2, MessageCircle, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { bannerStyle } from './banners';
import { blockUser, createConversation, friends, getPerson, type GetPersonOutputType } from 'zitejs/api';
import { Sheet, SheetContent, SheetTitle as DialogTitle, SheetDescription as DialogDescription } from '@project/components/ui/sheet';
import PersonAvatar from './Avatars';
import { Verified } from './official';
import { useChat } from './store';
import { errorMessage } from '../lib/errors';

type P = NonNullable<GetPersonOutputType['profile']>;

export default function PersonDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { me, people, refresh, conversations, titleOf } = useChat();
  const navigate = useNavigate();
  const [p, setP] = useState<P | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setP(undefined);
    if (userId) getPerson({ userId }).then((r) => setP(r.profile)).catch((e) => { setP(null); toast.error(errorMessage(e, 'Couldn’t load this profile')); });
    if (userId) blockUser({}).then((r) => setBlocked(r.blocked.includes(userId))).catch(() => {});
  }, [userId]);
  const online = userId ? people.get(userId)?.online : false;
  const mutual = userId ? (conversations ?? []).filter((c) => c.isGroup && !c.communityId && c.memberIds.includes(userId)) : [];
  const localTime = (tz: string) => { try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(new Date()); } catch { return null; } };
  const isMe = userId === me.id;
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => { const m = window.matchMedia('(min-width: 768px)'); const f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);

  const message = async () => {
    if (!userId) return;
    setBusy('msg');
    try { const { id } = await createConversation({ memberIds: [userId] }); await refresh(); onClose(); navigate(`/app/c/${id}`); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t open the chat')); } finally { setBusy(null); }
  };
  const friend = async (action: 'request' | 'accept' | 'decline' | 'remove') => {
    if (!userId || !p) return;
    setBusy(action);
    try {
      await friends({ action, userId });
      const next = action === 'request' ? (p.relation === 'incoming' ? 'friends' : 'outgoing') : action === 'accept' ? 'friends' : 'none';
      setP({ ...p, relation: next });
      toast.success({ request: p.relation === 'incoming' ? 'You’re now friends' : 'Friend request sent', accept: 'You’re now friends', decline: 'Request declined', remove: p.relation === 'outgoing' ? 'Request cancelled' : 'Removed from friends' }[action]);
      window.dispatchEvent(new CustomEvent('chat:friends'));
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t update your friends')); } finally { setBusy(null); }
  };
  const toggleBlock = async () => {
    if (!userId) return;
    const next = !blocked; setBlocked(next);
    try { await blockUser({ userId }); toast.success(next ? `Blocked ${p?.name ?? 'them'}` : 'Unblocked'); window.dispatchEvent(new CustomEvent('chat:blocks')); }
    catch (e) { setBlocked(!next); toast.error(errorMessage(e, 'Couldn’t update')); }
  };

  const accent = p?.accent || 'hsl(var(--primary))';
  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={wide ? 'right' : 'bottom'} className={wide ? 'w-full gap-0 overflow-y-auto p-0 sm:max-w-[400px]' : 'max-h-[88dvh] gap-0 overflow-y-auto rounded-t-3xl p-0'}>
        {p === undefined ? <div className="grid h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : p === null ? <div className="p-6"><DialogTitle>Profile unavailable</DialogTitle><DialogDescription>This person couldn’t be found.</DialogDescription></div>
          : (
            <div>
              <div className="relative h-36 w-full" style={p.bannerImage ? { background: `url(${p.bannerImage}) center/cover` } : bannerStyle(p.banner)}>
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
              </div>
              <div className="relative px-5">
                <div className="-mt-12 flex items-end justify-between">
                  <div className="rounded-full p-1" style={{ background: accent }}><div className="rounded-full border-4 border-background"><PersonAvatar name={p.name} image={p.image} size={88} online={online} /></div></div>
                  {!isMe && <FriendBadge p={p} busy={busy} onAct={friend} />}
                </div>
                <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                  <DialogTitle className="text-xl tracking-tight">{p.name}</DialogTitle>
                  <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-1">
                    {[p.username && `@${p.username}`, p.pronouns].filter(Boolean).join(' · ') || ' '}
                    {p.username && <button onClick={() => { navigator.clipboard.writeText(`@${p.username}`); toast.success('Username copied'); }} aria-label="Copy username" className="rounded p-0.5 hover:bg-secondary"><Copy className="h-3 w-3" /></button>}
                  </DialogDescription>
                  {(p.statusText || p.statusEmoji) && <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-sm">{p.statusEmoji} {p.statusText}</p>}
                  <div className="my-4 h-px bg-border" />
                  {p.bio && <Block title="About me"><p className="whitespace-pre-wrap text-sm">{p.bio}</p></Block>}
                  <Block title="Member since"><p className="text-sm">{format(new Date(p.joinedAt), 'd MMM yyyy')}</p></Block>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{online ? '🟢 Online now' : p.lastSeenAt ? `Last seen ${formatDistanceToNowStrict(new Date(p.lastSeenAt))} ago` : 'Last seen a while ago'}</span>
                    {p.timeZone && localTime(p.timeZone) && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {localTime(p.timeZone)} local</span>}
                    {!isMe && p.mutualFriends > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {p.mutualFriends} mutual friend{p.mutualFriends === 1 ? '' : 's'}</span>}
                  </div>
                  {p.communities.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{isMe ? 'Your roles' : 'Roles in shared communities'}</p>
                      {p.communities.map((c) => (
                        <div key={c.id}>
                          <p className="flex items-center gap-1 text-xs font-medium">{c.emoji || '🏘️'} {c.name}{c.verified && <Verified community className="h-3 w-3" />}{c.nickname && <span className="font-normal text-muted-foreground">· “{c.nickname}”</span>}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {c.isOwner && <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-xs"><Crown className="h-3 w-3 text-[hsl(var(--verified-community))]" /> Owner</span>}
                            {c.roles.map((r) => <span key={r.name} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.name}</span>)}
                            {!c.isOwner && !c.roles.length && <span className="text-xs text-muted-foreground">Member</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {mutual.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Groups in common</p>
                      <div className="flex flex-wrap gap-1.5">{mutual.map((c) => <button key={c.id} onClick={() => { onClose(); navigate(`/app/c/${c.id}`); }} className="rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70">{titleOf(c)}</button>)}</div>
                    </div>
                  )}
                </div>
                {!isMe && (
                  <div className="space-y-2 py-4">
                    <button onClick={message} disabled={!!busy || !p.acceptsMessages} className="flex h-11 w-full items-center justify-center gap-2 rounded-full font-medium text-white disabled:opacity-50" style={{ background: accent }}>
                      {busy === 'msg' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                      {!p.acceptsMessages ? 'Only accepts messages from friends' : p.relation === 'friends' ? 'Message' : 'Send message request'}
                    </button>
                    <button onClick={toggleBlock} className={`flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-medium ${blocked ? 'border border-border' : 'text-destructive hover:bg-destructive/10'}`}>
                      <Ban className="h-4 w-4" /> {blocked ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                )}
                {isMe && <div className="h-4" />}
              </div>
            </div>
          )}
      </SheetContent>
    </Sheet>
  );
}

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{children}</div>
);

function FriendBadge({ p, busy, onAct }: { p: P; busy: string | null; onAct: (a: 'request' | 'accept' | 'decline' | 'remove') => void }) {
  const cls = 'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium disabled:opacity-50';
  const spin = (k: string) => busy === k && <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (p.relation === 'friends') return <button disabled={!!busy} onClick={() => onAct('remove')} title="Remove friend" className={`${cls} group border border-border bg-background`}>{spin('remove') || <UserCheck className="h-3.5 w-3.5 group-hover:hidden" />}<UserMinus className="hidden h-3.5 w-3.5 group-hover:block" /><span className="group-hover:hidden">Friends</span><span className="hidden group-hover:inline">Remove</span></button>;
  if (p.relation === 'outgoing') return <button disabled={!!busy} onClick={() => onAct('remove')} className={`${cls} border border-border bg-background`}>{spin('remove')}Request sent · Cancel</button>;
  if (p.relation === 'incoming') return <div className="flex gap-1.5"><button disabled={!!busy} onClick={() => onAct('accept')} className={`${cls} bg-primary text-primary-foreground`}>{spin('accept') || <Check className="h-3.5 w-3.5" />}Accept</button><button disabled={!!busy} onClick={() => onAct('decline')} className={`${cls} border border-border bg-background`}>{spin('decline')}Ignore</button></div>;
  if (!p.acceptsFriendRequests) return null;
  return <button disabled={!!busy} onClick={() => onAct('request')} className={`${cls} bg-primary text-primary-foreground`}>{spin('request') || <UserPlus className="h-3.5 w-3.5" />}Add friend</button>;
}
