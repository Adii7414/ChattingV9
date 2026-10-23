import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Checkbox } from '@project/components/ui/checkbox';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { cn } from '@project/components/lib/utils';
import { BOT_EVENTS, BOT_PERMS, type BotEventType, type BotPerm } from '../../lib/bots';
import { Field, SaveButton, input, type Data } from './kit';
import type { BotRow } from './BotsTab';

type Patch = { name?: string; avatar?: string | null; description?: string; permissions?: BotPerm[]; eventTypes?: BotEventType[]; eventsUrl?: string | null; config?: Record<string, unknown> };
type Props = { b: BotRow; d: Data; busy: boolean; rotating: boolean; onSave: (p: Patch) => void; onRotate: () => void; onRotateSecret: () => void };

const USAGE: Record<string, string> = {
  Giveaway: 'Members type /giveaway 2h 3w Prize name to start a giveaway with an Enter button (3w = 3 winners), or /poll Question | A | B for a quick poll. Winners are picked at random when it ends.',
  Reminder: 'Members type /remind me 2h check the oven (or /remind here 30m standup). Durations: 45s, 10m, 2h, 1d, 1h30m.',
};

export default function BotEditor({ b, d, busy, rotating, onSave, onRotate, onRotateSecret }: Props) {
  const [name, setName] = useState(b.name);
  const [avatar, setAvatar] = useState(b.avatar ?? '');
  const [desc, setDesc] = useState(b.description);
  const [perms, setPerms] = useState<string[]>(b.permissions);
  const [events, setEvents] = useState<string[]>(b.eventTypes);
  const [url, setUrl] = useState(b.eventsUrl ?? '');
  const [cfg, setCfg] = useState<Record<string, unknown>>(b.config);
  const [show, setShow] = useState(false);
  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const save = () => {
    if (url && !/^https:\/\//.test(url)) return toast.error('The events URL must start with https://');
    onSave({ name: name.trim() || b.name, avatar: avatar.trim() || null, description: desc, permissions: perms as BotPerm[], config: cfg, ...(b.kind === 'Custom' && { eventTypes: events as BotEventType[], eventsUrl: url.trim() || null }) });
  };
  const channelPick = (k: string, allowSame = false) => (
    <Select value={String(cfg[k] || (allowSame ? 'same' : 'system'))} onValueChange={(v) => set(k, v === 'same' || v === 'system' ? '' : v)}>
      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={allowSame ? 'same' : 'system'}>{allowSame ? 'Same channel as the message' : 'Community system channel'}</SelectItem>
        {d.channels.map((c) => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const roles = (cfg.roleIds as string[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Avatar" hint="An emoji or an image URL"><input className={input} value={avatar} maxLength={500} onChange={(e) => setAvatar(e.target.value)} placeholder="🤖" /></Field>
      </div>
      <Field label="Description"><input className={input} value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} /></Field>

      {b.kind === 'Welcome' && (<>
        <Field label="Greeting" hint="Use {user} and {community}"><textarea className={cn(input, 'h-20 py-2')} value={String(cfg.message ?? 'Welcome to {community}, {user}! 👋')} onChange={(e) => set('message', e.target.value)} /></Field>
        <Field label="Post greetings in">{channelPick('channelId')}</Field>
        <div><p className="mb-1 text-sm font-medium">Starter roles</p>
          {!d.s.roles.length ? <p className="text-xs text-muted-foreground">Create roles in the Roles tab first.</p> : (
            <div className="flex flex-wrap gap-2">{d.s.roles.map((r) => (
              <label key={r.id} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"><Checkbox checked={roles.includes(r.id)} onCheckedChange={() => set('roleIds', toggle(roles, r.id))} /><span style={{ color: r.color }}>{r.name}</span></label>
            ))}</div>
          )}
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">Add an “Accept rules ✅” button to greetings<Switch checked={!!cfg.rulesButton} onCheckedChange={(v) => set('rulesButton', v)} /></label>
      </>)}

      {b.kind === 'Moderator' && (<>
        {([['blockInvites', 'Delete invite links to other chat apps', true], ['blockLinks', 'Delete all links', false], ['blockRepeats', 'Delete repeated-character spam', true]] as const).map(([k, l, def]) => (
          <label key={k} className="flex items-center justify-between gap-3 text-sm">{l}<Switch checked={cfg[k] === undefined ? def : !!cfg[k]} onCheckedChange={(v) => set(k, v)} /></label>
        ))}
        <Field label="Blocked words" hint="Comma-separated. Works alongside the community’s own blocked words."><input className={input} value={((cfg.bannedWords as string[]) ?? []).join(', ')} onChange={(e) => set('bannedWords', e.target.value.split(',').map((w) => w.trim()).filter(Boolean))} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Max mentions"><input type="number" min={0} className={input} value={Number(cfg.maxMentions ?? 6)} onChange={(e) => set('maxMentions', Number(e.target.value))} /></Field>
          <Field label="Time out after" hint="warnings (0 = never)"><input type="number" min={0} className={input} value={Number(cfg.timeoutAfter ?? 3)} onChange={(e) => set('timeoutAfter', Number(e.target.value))} /></Field>
          <Field label="Timeout length" hint="minutes"><input type="number" min={1} className={input} value={Number(cfg.timeoutMinutes ?? 10)} onChange={(e) => set('timeoutMinutes', Number(e.target.value))} /></Field>
        </div>
      </>)}

      {b.kind === 'Levels' && (<>
        <Field label="Level-up message" hint="Use {user} and {level}"><input className={input} value={String(cfg.message ?? '🎉 GG {user}, you just reached **level {level}**!')} onChange={(e) => set('message', e.target.value)} /></Field>
        <Field label="Announce in">{channelPick('channelId', true)}</Field>
      </>)}

      {USAGE[b.kind] && <p className="rounded-xl bg-background p-3 text-sm text-muted-foreground">{USAGE[b.kind]}</p>}

      {b.kind === 'Custom' && (<>
        <div className="rounded-2xl border border-border bg-background p-3 text-sm">
          <p className="font-medium">API key</p>
          <p className="mt-0.5 text-muted-foreground">Ends in <code className="font-mono">{b.tokenHint ?? '—'}</code>. Lost it? Create a new one — the old key stops working immediately.</p>
          <button onClick={onRotate} disabled={rotating} className="mt-2 flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-secondary"><RefreshCw className="h-3.5 w-3.5" /> Reset API key</button>
        </div>
        <Field label="Events URL" hint="We POST signed JSON here when something happens. Leave empty to use events.poll instead."><input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://my-bot.example.com/chatting" /></Field>
        <div><p className="mb-1 text-sm font-medium">Events</p>
          <div className="flex flex-wrap gap-2">{BOT_EVENTS.map((e) => <label key={e} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-mono text-xs"><Checkbox checked={events.includes(e)} onCheckedChange={() => setEvents(toggle(events, e))} />{e}</label>)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-3 text-sm">
          <p className="font-medium">Signing secret</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{show ? b.signingSecret : '••••••••••••••••••••••••'}</code>
            <button onClick={() => setShow(!show)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary" aria-label="Show secret">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            <button onClick={() => { navigator.clipboard.writeText(b.signingSecret ?? ''); toast.success('Copied'); }} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary" aria-label="Copy secret"><Copy className="h-4 w-4" /></button>
            <button onClick={onRotateSecret} disabled={rotating} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary" aria-label="Reset secret"><RefreshCw className="h-4 w-4" /></button>
          </div>
        </div>
        {!!b.recentEvents.length && (
          <div><p className="mb-1 text-sm font-medium">Recent deliveries</p>
            <div className="divide-y divide-border rounded-xl border border-border bg-background text-xs">
              {b.recentEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={cn('h-2 w-2 rounded-full', e.status === 'Delivered' ? 'bg-emerald-500' : e.status === 'Failed' ? 'bg-destructive' : 'bg-muted-foreground')} />
                  <span className="font-mono">{e.type}</span><span className="text-muted-foreground">{e.status}{e.code ? ` · ${e.code}` : ''}{e.error ? ` · ${e.error}` : ''}</span>
                  <span className="ml-auto text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>)}

      <div><p className="mb-1 text-sm font-medium">Permissions</p>
        <div className="flex flex-wrap gap-2">{BOT_PERMS.map((p) => <label key={p} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"><Checkbox checked={perms.includes(p)} onCheckedChange={() => setPerms(toggle(perms, p))} />{p}</label>)}</div>
      </div>
      <SaveButton busy={busy} onClick={save} />
    </div>
  );
}
