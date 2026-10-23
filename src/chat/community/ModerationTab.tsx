import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { configureCommunity } from 'zitejs/api';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import PersonAvatar from '../Avatars';
import ReportsQueue from './ReportsQueue';
import { Chips, Field, SaveButton, Section, input, useRun, type TabProps } from './kit';

const MODES = [['open', 'Open', 'Anyone with the link (or from Discover) joins instantly'], ['approval', 'Approval', 'People request to join; moderators approve'], ['invite', 'Invite only', 'Hidden from Discover; invite link only']] as const;

export default function ModerationTab({ d, reload }: TabProps) {
  const [m, setM] = useState({ joinMode: d.s.joinMode, bannedWords: d.s.bannedWords, blockLinks: d.s.blockLinks, maxLength: d.s.maxLength, welcome: d.s.welcome, systemChannel: d.s.systemChannel, rules: d.s.rules });
  const { busy, run } = useRun(reload);
  const canEdit = d.myPerms.includes('manageCommunity');
  const mod = d.myPerms.includes('ban');
  const act = (action: 'approve' | 'deny' | 'unban', userId: string, ok: string) => run(action + userId, () => configureCommunity({ communityId: d.id, action, userId }), ok);

  return (
    <div className="space-y-5">
      {d.myPerms.includes('manageMessages') && <ReportsQueue d={d} reload={reload} />}
      {mod && d.pending.length > 0 && (
        <Section title={`Join requests · ${d.pending.length}`}>
          {d.pending.map((p) => (
            <div key={p.id} className="flex items-center gap-3"><PersonAvatar name={p.name} image={p.image} size={34} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.name}</p><p className="truncate text-xs text-muted-foreground">{p.email}</p></div>
              <button onClick={() => act('deny', p.id, 'Declined')} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium">Decline</button>
              <button onClick={() => act('approve', p.id, 'Approved')} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">Approve</button></div>
          ))}
        </Section>
      )}
      {canEdit && <>
        <Section title="Joining">
          <div className="grid gap-2 sm:grid-cols-3">
            {MODES.map(([k, l, desc]) => (
              <button key={k} onClick={() => setM({ ...m, joinMode: k })} className={cn('rounded-2xl border p-3 text-left', m.joinMode === k ? 'border-foreground bg-secondary' : 'border-border')}>
                <p className="text-sm font-medium">{l}</p><p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Welcome" desc="Posted automatically when someone joins. Use {user} for their name.">
          <textarea value={m.welcome} onChange={(e) => setM({ ...m, welcome: e.target.value })} maxLength={500} rows={2} placeholder="Welcome {user}! Say hi 👋" className={`${input} h-auto py-2`} />
          <Field label="Post welcomes in">
            <Select value={m.systemChannel ?? 'none'} onValueChange={(v) => setM({ ...m, systemChannel: v === 'none' ? null : v })}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Don’t post welcomes</SelectItem>{d.channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.emoji || '#'} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </Section>
        <Section title="Rules" desc="New members must accept these before chatting.">
          {m.rules.map((r, i) => (
            <div key={i} className="flex gap-2"><span className="grid h-10 w-8 shrink-0 place-items-center text-sm text-muted-foreground">{i + 1}.</span>
              <input value={r} onChange={(e) => setM({ ...m, rules: m.rules.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={300} className={input} aria-label={`Rule ${i + 1}`} />
              <button onClick={() => setM({ ...m, rules: m.rules.filter((_, j) => j !== i) })} aria-label="Remove rule" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-destructive"><Trash2 className="h-4 w-4" /></button></div>
          ))}
          {m.rules.length < 20 && <button onClick={() => setM({ ...m, rules: [...m.rules, ''] })} className="flex items-center gap-1.5 text-sm font-medium text-primary"><Plus className="h-4 w-4" /> Add rule</button>}
        </Section>
        <Section title="Auto-moderation" desc="Applies to everyone without the “Skip slow mode & auto-moderation” permission.">
          <Field label="Blocked words" hint="Messages containing these are rejected."><Chips value={m.bannedWords} onChange={(bannedWords) => setM({ ...m, bannedWords })} placeholder="Add a word, press Enter" max={200} /></Field>
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">Block links<Switch checked={m.blockLinks} onCheckedChange={(blockLinks) => setM({ ...m, blockLinks })} /></label>
          <Field label={`Max message length · ${m.maxLength}`}><input type="range" min={50} max={5000} step={50} value={m.maxLength} onChange={(e) => setM({ ...m, maxLength: Number(e.target.value) })} className="w-full accent-[hsl(var(--primary))]" /></Field>
        </Section>
        <SaveButton busy={busy === 'm'} onClick={() => run('m', () => configureCommunity({ communityId: d.id, action: 'moderation', moderation: m }))} />
      </>}
      {mod && (
        <Section title={`Banned · ${d.banned.length}`}>
          {d.banned.map((p) => (
            <div key={p.id} className="flex items-center gap-3"><PersonAvatar name={p.name} image={p.image} size={34} /><p className="flex-1 truncate text-sm">{p.name}</p>
              <button onClick={() => act('unban', p.id, 'Unbanned')} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium">Unban</button></div>
          ))}
          {!d.banned.length && <p className="text-sm text-muted-foreground">Nobody is banned.</p>}
        </Section>
      )}
      {!canEdit && !mod && <p className="text-sm text-muted-foreground">You don’t have moderation permissions here.</p>}
      {busy && busy !== 'm' && <span className="sr-only">Working…</span>}
    </div>
  );
}

export function AuditTab({ d }: TabProps) {
  const name = (id: string) => d.members.find((m) => m.id === id)?.name ?? 'Someone';
  return (
    <Section title="Audit log" desc="Recent changes made by the team.">
      {d.s.audit.map((a, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
          <p><span className="font-medium">{name(a.by)}</span> {a.text}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
        </div>
      ))}
      {!d.s.audit.length && <p className="text-sm text-muted-foreground">No changes yet.</p>}
    </Section>
  );
}
