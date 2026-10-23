import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { configureCommunity } from 'zitejs/api';
import { Switch } from '@project/components/ui/switch';
import { cn } from '@project/components/lib/utils';
import { ACCENTS, FONT_STACK, type CommunityCustom } from '../../lib/community';
import { WALLPAPERS } from '../prefs';
import { Field, SaveButton, Section, input, useRun, type TabProps } from './kit';

type C = CommunityCustom;

function Pick<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium', value === v ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground')}>{l}</button>)}
    </div>
  );
}

function Toggle({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</span>
      <Switch checked={on} onCheckedChange={set} />
    </label>
  );
}

function Num({ label, hint, value, max, set }: { label: string; hint: string; value: number; max: number; set: (v: number) => void }) {
  return <Field label={`${label} · ${value || 'off'}`} hint={hint}><input type="range" min={0} max={max} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" /></Field>;
}

/** Every look, behaviour and content knob for a community. */
export default function CustomiseTab({ d, reload }: TabProps) {
  const [c, setC] = useState<C>(d.s.custom);
  const set = <K extends keyof C>(k: K) => (v: C[K]) => setC((p) => ({ ...p, [k]: v }));
  const { busy, run } = useRun(reload);
  const radius = c.bubble === 'square' ? '6px' : c.bubble === 'minimal' ? '0px' : '20px';

  return (
    <div className="space-y-5">
      <Section title="Live preview">
        <div className="overflow-hidden rounded-2xl border border-border" style={{ fontFamily: FONT_STACK[c.font] }}>
          {c.showBannerStrip && <div className="h-10" style={{ background: d.s.banner ? `url(${d.s.banner}) center/cover` : `linear-gradient(90deg, ${d.s.accent}, ${d.s.accent}55)` }} />}
          {c.announcement && <p className="px-3 py-1.5 text-xs font-medium text-white" style={{ background: c.announcementColor }}>📣 {c.announcement}</p>}
          <div className="space-y-1.5 bg-background p-4" style={WALLPAPERS[c.wallpaper]}>
            <p className="w-fit bg-secondary px-3.5 py-2 text-sm" style={{ borderRadius: radius }}>Hey everyone 👋</p>
            <p className="ml-auto w-fit px-3.5 py-2 text-sm text-white" style={{ borderRadius: radius, background: c.useAccent ? d.s.accent : 'hsl(var(--primary))' }}>Welcome to {d.name}!</p>
          </div>
        </div>
      </Section>

      <Section title="Look" desc="Applies inside every channel of this community, for everyone.">
        <Field label="Font"><Pick value={c.font} onChange={set('font')} options={[['default', 'Default'], ['serif', 'Serif'], ['mono', 'Mono'], ['rounded', 'Rounded']]} /></Field>
        <Field label="Message bubbles"><Pick value={c.bubble} onChange={set('bubble')} options={[['round', 'Round'], ['square', 'Square'], ['minimal', 'Minimal']]} /></Field>
        <Field label="Channel wallpaper" hint="Overrides members’ personal wallpaper in this community.">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {(Object.keys(WALLPAPERS) as C['wallpaper'][]).map((w) => <button key={w} type="button" onClick={() => set('wallpaper')(w)} className={cn('h-12 rounded-xl border border-border bg-background text-[10px] capitalize text-muted-foreground', c.wallpaper === w && 'ring-2 ring-foreground')} style={WALLPAPERS[w]}>{w}</button>)}
          </div>
        </Field>
        <Toggle label="Use community accent colour" hint="Buttons and your own bubbles take the community colour" on={c.useAccent} set={set('useAccent')} />
        <Toggle label="Banner strip in channels" hint="Show the community banner above messages" on={c.showBannerStrip} set={set('showBannerStrip')} />
        <Toggle label="Show role tags next to names" on={c.showRoleTags} set={set('showRoleTags')} />
      </Section>

      <Section title="Words & content" desc="Change what members read across the community.">
        <Field label="Announcement bar" hint="A banner pinned to the top of every channel. Leave empty to hide.">
          <div className="flex gap-2"><input value={c.announcement} onChange={(e) => set('announcement')(e.target.value)} maxLength={300} placeholder="Game night Friday at 8pm!" className={input} />
            <input type="color" value={c.announcementColor} onChange={(e) => set('announcementColor')(e.target.value)} aria-label="Announcement colour" className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-border bg-transparent" /></div>
          <div className="mt-2 flex gap-1.5">{ACCENTS.slice(0, 8).map((a) => <button key={a} type="button" onClick={() => set('announcementColor')(a)} aria-label={a} className="h-5 w-5 rounded-full" style={{ background: a }} />)}</div>
        </Field>
        <Field label="Message box placeholder"><input value={c.placeholder} onChange={(e) => set('placeholder')(e.target.value)} maxLength={80} placeholder="Say something nice…" className={input} /></Field>
        <Field label="Empty channel text"><input value={c.emptyText} onChange={(e) => set('emptyText')(e.target.value)} maxLength={200} placeholder="Be the first to say hi!" className={input} /></Field>
        <Field label="What members are called" hint="Shown in channel headers, e.g. “42 explorers”."><input value={c.memberLabel} onChange={(e) => set('memberLabel')(e.target.value)} maxLength={24} placeholder="members" className={input} /></Field>
        <Field label="Guidelines link" hint="Shown above the message box in every channel."><input value={c.guidelinesUrl} onChange={(e) => set('guidelinesUrl')(e.target.value)} maxLength={300} placeholder="https://…" className={input} /></Field>
      </Section>

      <Section title="Features" desc="Turn whole features on or off for this community.">
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="GIFs" on={c.allowGifs} set={set('allowGifs')} />
          <Toggle label="File & photo uploads" on={c.allowFiles} set={set('allowFiles')} />
          <Toggle label="Polls" on={c.allowPolls} set={set('allowPolls')} />
          <Toggle label="Reactions" on={c.allowReactions} set={set('allowReactions')} />
          <Toggle label="Threads" on={c.allowThreads} set={set('allowThreads')} />
          <Toggle label="Editing messages" on={c.allowEdits} set={set('allowEdits')} />
        </div>
      </Section>

      <Section title="Message rules" desc="Skipped for roles with “Skip slow mode & auto-moderation”.">
        <Num label="Minimum length" hint="Stops one-word spam." value={c.minLength} max={100} set={set('minLength')} />
        <Num label="Max mentions per message" hint="Stops mass-pinging." value={c.maxMentions} max={20} set={set('maxMentions')} />
        <Num label="Max emoji per message" hint="Stops emoji walls." value={c.maxEmoji} max={50} set={set('maxEmoji')} />
        <Toggle label="Block ALL-CAPS shouting" on={c.blockCaps} set={set('blockCaps')} />
      </Section>

      <Section title="Auto-responders" desc="When a message contains a trigger word, Chatting replies automatically.">
        {c.autoReplies.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input value={r.trigger} onChange={(e) => set('autoReplies')(c.autoReplies.map((x, j) => (j === i ? { ...x, trigger: e.target.value } : x)))} maxLength={60} placeholder="!rules" aria-label="Trigger" className={`${input} w-32 shrink-0`} />
            <input value={r.reply} onChange={(e) => set('autoReplies')(c.autoReplies.map((x, j) => (j === i ? { ...x, reply: e.target.value } : x)))} maxLength={500} placeholder="Read the rules in #welcome" aria-label="Reply" className={input} />
            <button type="button" onClick={() => set('autoReplies')(c.autoReplies.filter((_, j) => j !== i))} aria-label="Remove" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {c.autoReplies.length < 25 && <button type="button" onClick={() => set('autoReplies')([...c.autoReplies, { trigger: '', reply: '' }])} className="flex items-center gap-1.5 text-sm font-medium text-primary"><Plus className="h-4 w-4" /> Add auto-responder</button>}
      </Section>

      <SaveButton busy={busy === 'c'} onClick={() => {
        const autoReplies = c.autoReplies.filter((r) => r.trigger.trim() && r.reply.trim());
        if (c.guidelinesUrl.trim() && !/^https?:\/\//i.test(c.guidelinesUrl.trim())) return toast.error('Guidelines link must start with https://');
        run('c', () => configureCommunity({ communityId: d.id, action: 'customise', custom: { ...c, autoReplies } }));
      }} />
    </div>
  );
}
