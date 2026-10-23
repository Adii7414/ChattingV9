import { useState } from 'react';
import { Crown, MoreHorizontal, Search, StickyNote, TriangleAlert } from 'lucide-react';
import { configureCommunity, moderateMember, timeoutMember } from 'zitejs/api';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import PersonAvatar from '../Avatars';
import { useChat } from '../store';
import { timedOutUntil, topRole } from '../../lib/community';

const TIMEOUTS = [{ m: 5, l: '5 minutes' }, { m: 60, l: '1 hour' }, { m: 1440, l: '1 day' }, { m: 10080, l: '1 week' }];
import { input, Section, useRun, type TabProps } from './kit';

type Act = { kind: 'kick' | 'ban' | 'transfer'; id: string; name: string } | null;

export default function MembersTab({ d, reload }: TabProps) {
  const { me } = useChat();
  const [q, setQ] = useState('');
  const [nick, setNick] = useState<{ id: string; v: string } | null>(null);
  const [act, setAct] = useState<Act>(null);
  const [mod, setMod] = useState<{ kind: 'warn' | 'note'; id: string; name: string; v: string } | null>(null);
  const { run } = useRun(reload);
  const has = (p: string) => (d.myPerms as string[]).includes(p);
  const cid = d.id;
  const list = d.members.filter((m) => !q || `${m.name} ${m.email} ${d.s.nicknames[m.id] ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const hoisted = d.s.roles.filter((r) => r.hoist);
  const groups = [...hoisted.map((r) => ({ key: r.id, label: r.name, color: r.color, people: list.filter((m) => topRole({ ...d.s, roles: hoisted }, m.id)?.id === r.id) })),
    { key: 'rest', label: 'Members', color: undefined, people: list.filter((m) => !topRole({ ...d.s, roles: hoisted }, m.id)) }];
  const setRoles = (uid: string, roleIds: string[]) => run('a', () => configureCommunity({ communityId: cid, action: 'assignRoles', userId: uid, roleIds }), 'Roles updated');

  return (
    <Section title={`Members · ${d.members.length}`} desc="Give roles, set nicknames, or remove people.">
      <label className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" className="w-full bg-transparent text-sm outline-none" /></label>
      {groups.map((g) => g.people.length > 0 && (
        <div key={g.key}>
          <p className="px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: g.color }}>{g.label} — {g.people.length}</p>
          {g.people.map((m) => {
            const mine = d.s.memberRoles[m.id] ?? [];
            const role = topRole(d.s, m.id);
            const canEditNick = m.id === me.id || has('manageCommunity');
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <PersonAvatar name={m.name} image={m.image} size={36} />
                <div className="min-w-0 flex-1">
                  {nick && nick.id === m.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); const v = nick.v; run('n', () => configureCommunity({ communityId: cid, action: 'nickname', userId: m.id, nickname: v }), 'Nickname saved'); setNick(null); }}>
                      <input autoFocus value={nick.v} onChange={(e) => setNick({ id: m.id, v: e.target.value })} onBlur={() => setNick(null)} maxLength={32} placeholder={m.name} className={`${input} h-8`} />
                    </form>
                  ) : (
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium" style={{ color: role?.color }}>
                      {d.s.nicknames[m.id] ?? m.name}{m.id === d.ownerId && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                      {(d.s.warnings[m.id]?.length ?? 0) > 0 && has('kick') && <span title={d.s.warnings[m.id].map((w) => `${format(new Date(w.at), 'd MMM')}: ${w.reason}`).join('\n')} className="flex items-center gap-0.5 rounded bg-amber-400/20 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"><TriangleAlert className="h-3 w-3" />{d.s.warnings[m.id].length}</span>}
                      {d.s.modNotes[m.id] && has('kick') && <span title={`Mod note: ${d.s.modNotes[m.id]}`}><StickyNote className="h-3.5 w-3.5 text-muted-foreground" /></span>}
                      {timedOutUntil(d.s, m.id) && <span title={`Until ${format(new Date(timedOutUntil(d.s, m.id)!), 'PPp')}`} className="rounded bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive">Timed out</span>}
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{d.s.nicknames[m.id] ? `${m.name} · ` : ''}{mine.map((r) => d.s.roles.find((x) => x.id === r)?.name).filter(Boolean).join(', ') || m.email}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label="Member options" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {canEditNick && <DropdownMenuItem onClick={() => setNick({ id: m.id, v: d.s.nicknames[m.id] ?? '' })}>Set nickname</DropdownMenuItem>}
                    {has('manageRoles') && d.s.roles.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel className="text-xs">Roles</DropdownMenuLabel>
                      {d.s.roles.map((r) => (
                        <DropdownMenuCheckboxItem key={r.id} checked={mine.includes(r.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={(v) => setRoles(m.id, v ? [...mine, r.id] : mine.filter((x) => x !== r.id))}>
                          <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.name}
                        </DropdownMenuCheckboxItem>
                      ))}</>}
                    {m.id !== me.id && m.id !== d.ownerId && (has('kick') || has('ban')) && <DropdownMenuSeparator />}
                    {m.id !== me.id && has('kick') && <>
                      {m.id !== d.ownerId && <DropdownMenuItem onClick={() => setMod({ kind: 'warn', id: m.id, name: m.name, v: '' })}>Warn…</DropdownMenuItem>}
                      {(d.s.warnings[m.id]?.length ?? 0) > 0 && <DropdownMenuItem onClick={() => run('w', () => moderateMember({ communityId: cid, userId: m.id, action: 'clearWarnings' }), 'Warnings cleared')}>Clear warnings</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => setMod({ kind: 'note', id: m.id, name: m.name, v: d.s.modNotes[m.id] ?? '' })}>{d.s.modNotes[m.id] ? 'Edit mod note…' : 'Add mod note…'}</DropdownMenuItem>
                    </>}
                    {m.id !== me.id && m.id !== d.ownerId && has('kick') && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Time out</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {TIMEOUTS.map((t) => <DropdownMenuItem key={t.m} onClick={() => run('t', () => timeoutMember({ communityId: cid, userId: m.id, minutes: t.m }), `${m.name} timed out for ${t.l}`)}>{t.l}</DropdownMenuItem>)}
                          {timedOutUntil(d.s, m.id) && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => run('t', () => timeoutMember({ communityId: cid, userId: m.id, minutes: 0 }), 'Timeout lifted')}>Lift timeout</DropdownMenuItem></>}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}
                    {m.id !== me.id && m.id !== d.ownerId && has('kick') && <DropdownMenuItem className="text-destructive" onClick={() => setAct({ kind: 'kick', id: m.id, name: m.name })}>Remove from community</DropdownMenuItem>}
                    {m.id !== me.id && m.id !== d.ownerId && has('ban') && <DropdownMenuItem className="text-destructive" onClick={() => setAct({ kind: 'ban', id: m.id, name: m.name })}>Ban</DropdownMenuItem>}
                    {me.id === d.ownerId && m.id !== me.id && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setAct({ kind: 'transfer', id: m.id, name: m.name })}>Transfer ownership</DropdownMenuItem></>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      ))}
      <AlertDialog open={!!act} onOpenChange={(o) => !o && setAct(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{act?.kind === 'transfer' ? `Make ${act.name} the owner?` : act?.kind === 'ban' ? `Ban ${act?.name}?` : `Remove ${act?.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>{act?.kind === 'transfer' ? 'They’ll get full control and you’ll become a regular member.' : act?.kind === 'ban' ? 'They’ll be removed and can’t rejoin until unbanned.' : 'They’ll leave every channel. They can rejoin with an invite.'}</AlertDialogDescription>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => act && run('x', () => configureCommunity({ communityId: cid, action: act.kind, userId: act.id }), 'Done')}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!mod} onOpenChange={(o) => !o && setMod(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{mod?.kind === 'warn' ? `Warn ${mod?.name}` : `Mod note — ${mod?.name}`}</AlertDialogTitle>
          <AlertDialogDescription>{mod?.kind === 'warn' ? 'They’ll see this warning in the community’s channels. It’s also kept in the audit log.' : 'Only people who can remove members see mod notes.'}</AlertDialogDescription>
          <textarea autoFocus value={mod?.v ?? ''} onChange={(e) => mod && setMod({ ...mod, v: e.target.value })} rows={3} maxLength={1000} placeholder={mod?.kind === 'warn' ? 'Reason (e.g. please keep it on-topic)' : 'Notes for other moderators'} className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={mod?.kind === 'warn' && !mod.v.trim()} onClick={() => { if (!mod) return; const m2 = mod; run('m', () => moderateMember({ communityId: cid, userId: m2.id, action: m2.kind, text: m2.v }), m2.kind === 'warn' ? 'Warning sent' : 'Note saved'); }}>{mod?.kind === 'warn' ? 'Send warning' : 'Save note'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
