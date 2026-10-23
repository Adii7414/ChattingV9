import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Crown, Loader2, LogOut, MoreHorizontal, Shield, Trash2, UserPlus } from 'lucide-react';
import { findPeople, manageCommunity, updateConversation, type FindPeopleOutputType } from 'zitejs/api';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from '@project/components/ui/alert-dialog';
import PersonAvatar, { ConvAvatar } from './Avatars';
import { useChat, type Conversation } from './store';
import SharedContent from './SharedContent';
import { errorMessage } from '../lib/errors';

const field = 'focus-ring h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none';

function Confirm({ label, title, desc, onConfirm, icon }: { label: string; title: string; desc: string; onConfirm: () => void; icon: React.ReactNode }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-destructive/40 text-sm font-medium text-destructive hover:bg-destructive/10">{icon}{label}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{desc}</AlertDialogDescription>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{label}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AddPeople({ conv, onDone }: { conv: Conversation; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<FindPeopleOutputType['people']>([]);
  useEffect(() => { findPeople({ query: q }).then((r) => setList(r.people.filter((p) => !conv.memberIds.includes(p.id)))).catch(() => {}); }, [q, conv.memberIds]);
  const add = async (id: string) => {
    try { await updateConversation({ conversationId: conv.id, action: 'addMembers', userIds: [id] }); toast.success('Added'); onDone(); } catch (e) { toast.error(errorMessage(e, 'Couldn’t add them')); }
  };
  return (
    <div className="space-y-2 rounded-2xl border border-border p-3">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people to add" className={field} />
      <div className="max-h-48 overflow-y-auto">
        {list.slice(0, 8).map((p) => (
          <button key={p.id} onClick={() => add(p.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary">
            <PersonAvatar name={p.name} image={p.image} size={32} /><span className="min-w-0 flex-1 truncate text-sm">{p.name}</span><UserPlus className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
        {!list.length && <p className="py-4 text-center text-xs text-muted-foreground">No one else to add.</p>}
      </div>
    </div>
  );
}

export default function InfoSheet({ open, onOpenChange, conv, onPerson, onJump }: { open: boolean; onOpenChange: (o: boolean) => void; conv: Conversation; onPerson: (u: string) => void; onJump: (id: string) => void }) {
  const { me, people, refresh, isAdmin, titleOf, communities } = useChat();
  const navigate = useNavigate();
  const admin = conv.isGroup && isAdmin(conv);
  const community = communities.find((c) => c.id === conv.communityId);
  const [d, setD] = useState({ name: conv.name ?? '', description: conv.description ?? '', emoji: conv.emoji ?? '' });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (open) { setD({ name: conv.name ?? '', description: conv.description ?? '', emoji: conv.emoji ?? '' }); setAdding(false); } }, [open, conv.name, conv.description, conv.emoji]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await refresh(); if (ok) toast.success(ok); } catch (e) { toast.error(errorMessage(e, 'Something went wrong')); }
  };
  const saveDetails = async () => { setSaving(true); await run(() => updateConversation({ conversationId: conv.id, action: 'details', ...d }), 'Saved'); setSaving(false); };
  const dirty = d.name !== (conv.name ?? '') || d.description !== (conv.description ?? '') || d.emoji !== (conv.emoji ?? '');
  const leaveAndGo = async (fn: () => Promise<unknown>, ok: string) => { await run(fn, ok); onOpenChange(false); navigate('/app'); };
  const invite = `${location.origin}/app/join/${conv.communityId}`;
  const members = [...conv.memberIds].sort((a, b) => Number(b === conv.ownerId) - Number(a === conv.ownerId) || Number(conv.adminIds.includes(b)) - Number(conv.adminIds.includes(a)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="items-center text-center">
          <ConvAvatar c={conv} size={80} />
          <SheetTitle className="text-xl tracking-tight">{titleOf(conv)}</SheetTitle>
          <SheetDescription>{community ? `Channel in ${community.emoji ?? ''} ${community.name}` : conv.isGroup ? `Group · ${conv.memberIds.length} members` : 'Direct message'}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {admin ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                {!conv.communityId && <input value={d.emoji} onChange={(e) => setD({ ...d, emoji: e.target.value })} maxLength={4} placeholder="😎" aria-label="Emoji" className={`${field} w-12 text-center`} />}
                <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} placeholder={conv.communityId ? 'channel-name' : 'Group name'} className={field} />
              </div>
              <textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} maxLength={500} rows={2} placeholder="Description" className={`${field} h-auto py-2`} />
              {dirty && <button onClick={saveDetails} disabled={saving} className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button>}
            </div>
          ) : conv.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{conv.description}</p>}

          {community && (
            <div className="rounded-2xl bg-secondary p-4">
              <p className="text-sm font-medium">Invite people to {community.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Anyone with this link can join the community and all its channels.</p>
              <button onClick={() => { navigator.clipboard.writeText(invite); toast.success('Invite link copied'); }} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-background text-sm font-medium"><Copy className="h-4 w-4" /> Copy invite link</button>
            </div>
          )}

          {open && <SharedContent conversationId={conv.id} onJump={onJump} />}

          {conv.isGroup && <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{conv.memberIds.length} members</p>
              {admin && !conv.communityId && <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1 text-sm font-medium text-primary"><UserPlus className="h-4 w-4" /> Add</button>}
            </div>
            {adding && <div className="mb-3"><AddPeople conv={conv} onDone={() => { setAdding(false); refresh(); }} /></div>}
            {members.map((uid) => {
              const p = uid === me.id ? { ...me, online: true, statusText: null } : people.get(uid);
              const role = uid === conv.ownerId ? 'Owner' : conv.adminIds.includes(uid) ? 'Admin' : null;
              return (
                <div key={uid} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <button onClick={() => uid !== me.id && onPerson(uid)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <PersonAvatar name={p?.name ?? '?'} image={p?.image} online={p?.online} size={36} />
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{p?.name ?? 'Someone'}{uid === me.id && ' (you)'}</p>{p?.statusText && <p className="truncate text-xs text-muted-foreground">{p.statusText}</p>}</div>
                  </button>
                  {role && <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{role === 'Owner' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}{role}</span>}
                  {admin && uid !== me.id && uid !== conv.ownerId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" aria-label="Member options"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => run(() => updateConversation({ conversationId: conv.id, action: 'toggleAdmin', userId: uid }))}><Shield className="mr-2 h-4 w-4" />{conv.adminIds.includes(uid) ? 'Remove admin' : 'Make admin'}</DropdownMenuItem>
                        {!conv.communityId && <DropdownMenuItem className="text-destructive" onClick={() => run(() => updateConversation({ conversationId: conv.id, action: 'removeMember', userId: uid }), 'Removed')}><Trash2 className="mr-2 h-4 w-4" />Remove from group</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>}

          <div className="space-y-2 pb-6">
            {conv.isGroup && !conv.communityId && <Confirm label="Leave group" icon={<LogOut className="h-4 w-4" />} title="Leave this group?" desc="You’ll stop getting its messages. Someone will need to add you back." onConfirm={() => leaveAndGo(() => updateConversation({ conversationId: conv.id, action: 'leave' }), 'You left the group')} />}
            {community && community.ownerId !== me.id && <Confirm label="Leave community" icon={<LogOut className="h-4 w-4" />} title={`Leave ${community.name}?`} desc="You’ll leave every channel in it." onConfirm={() => leaveAndGo(() => manageCommunity({ communityId: community.id, action: 'leave' }), 'You left the community')} />}
            {community && community.ownerId === me.id && <Confirm label="Delete community" icon={<Trash2 className="h-4 w-4" />} title={`Delete ${community.name}?`} desc="All its channels and messages will be removed for everyone. This can’t be undone." onConfirm={() => leaveAndGo(() => manageCommunity({ communityId: community.id, action: 'delete' }), 'Community deleted')} />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
