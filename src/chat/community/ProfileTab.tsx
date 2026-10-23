import { useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUpload } from 'zitejs/upload';
import { configureCommunity } from 'zitejs/api';
import { Switch } from '@project/components/ui/switch';
import { cn } from '@project/components/lib/utils';
import { ACCENTS } from '../../lib/community';
import { Chips, Field, SaveButton, Section, input, useRun, type TabProps } from './kit';
import { errorMessage } from '../../lib/errors';

function ImagePick({ value, onChange, label, wide }: { value: string | null; onChange: (v: string | null) => void; label: string; wide?: boolean }) {
  const { upload, isUploading } = useUpload();
  const pick = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Pick an image');
    try { onChange((await upload(f)).url); } catch (e) { toast.error(errorMessage(e, 'Upload failed')); }
  };
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/50', wide ? 'h-32 w-full' : 'h-24 w-24')}>
      {value && <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <label className="absolute inset-0 grid cursor-pointer place-items-center text-xs text-muted-foreground hover:bg-black/10">
        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : !value && <span className="flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" />{label}</span>}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {value && <button onClick={() => onChange(null)} aria-label={`Remove ${label}`} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

export default function ProfileTab({ d, reload }: TabProps) {
  const [p, setP] = useState({
    name: d.name, description: d.description, emoji: d.emoji, isPublic: d.isPublic, icon: d.s.icon, banner: d.s.banner, accent: d.s.accent,
    tagline: d.s.tagline, tags: d.s.tags, vanity: d.s.vanity, quickReactions: d.s.quickReactions,
  });
  const { busy, run } = useRun(reload);
  const link = `${location.origin}/app/join/${p.vanity || d.id}`;
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-border">
        {p.banner ? <img src={p.banner} alt="" className="block aspect-[3/1] max-h-56 w-full object-cover" /> : <div className="aspect-[3/1] max-h-56 w-full" style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent}88)` }} />}
        <div className="flex items-start gap-3 bg-card px-5 pb-4 pt-3">
          <div className="relative z-10 -mt-12 grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-card text-3xl ring-4 ring-card">{p.icon ? <img src={p.icon} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center" style={{ background: `${p.accent}33` }}>{p.emoji || p.name[0]}</span>}</div>
          <div className="min-w-0 pt-0.5"><p className="truncate text-lg font-semibold">{p.name || 'Community'}</p><p className="truncate text-xs text-muted-foreground">{p.tagline || 'Live preview'}</p></div>
        </div>
      </div>
      <Section title="Identity" desc="How your community looks everywhere.">
        <div className="flex gap-3"><ImagePick value={p.icon} onChange={(icon) => setP({ ...p, icon })} label="Icon" /><ImagePick wide value={p.banner} onChange={(banner) => setP({ ...p, banner })} label="Banner" /></div>
        <div className="flex gap-2"><input value={p.emoji} onChange={(e) => setP({ ...p, emoji: e.target.value })} maxLength={4} placeholder="🌿" aria-label="Emoji" className={`${input} w-14 text-center`} /><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} maxLength={60} className={input} aria-label="Name" /></div>
        <Field label="Tagline"><input value={p.tagline} onChange={(e) => setP({ ...p, tagline: e.target.value })} maxLength={120} placeholder="One line that sums you up" className={input} /></Field>
        <Field label="About"><textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} maxLength={500} rows={3} className={`${input} h-auto py-2`} /></Field>
        <Field label="Accent colour">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => <button key={c} onClick={() => setP({ ...p, accent: c })} aria-label={c} className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-background', p.accent === c && 'ring-2 ring-foreground')} style={{ background: c }} />)}
            <input type="color" value={p.accent} onChange={(e) => setP({ ...p, accent: e.target.value })} aria-label="Custom colour" className="h-8 w-10 cursor-pointer rounded-lg border border-border bg-transparent" />
          </div>
        </Field>
      </Section>
      <Section title="Discovery & invites">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><span><span className="block text-sm font-medium">Listed in Discover</span><span className="text-xs text-muted-foreground">Off = invite link only.</span></span><Switch checked={p.isPublic} onCheckedChange={(isPublic) => setP({ ...p, isPublic })} /></label>
        <Field label="Tags" hint="Help people find you in Discover (up to 8)."><Chips value={p.tags} onChange={(tags) => setP({ ...p, tags })} placeholder="gaming, design…" max={8} /></Field>
        <Field label="Custom invite link" hint={link}>
          <div className="flex items-center rounded-xl border border-input bg-background pl-3 text-sm"><span className="shrink-0 text-muted-foreground">/join/</span><input value={p.vanity ?? ''} onChange={(e) => setP({ ...p, vanity: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} maxLength={32} placeholder="your-name" className="h-10 w-full bg-transparent px-1 outline-none" /></div>
        </Field>
        <button onClick={() => { navigator.clipboard.writeText(link); toast.success('Invite link copied'); }} className="text-sm font-medium text-primary">Copy invite link</button>
      </Section>
      <Section title="Quick reactions" desc="The emoji shown when members react to a message (up to 10).">
        <Chips value={p.quickReactions} onChange={(quickReactions) => setP({ ...p, quickReactions })} placeholder="Type an emoji, press Enter" max={10} />
      </Section>
      <SaveButton busy={busy === 'p'} onClick={() => {
        if (p.name.trim().length < 2) return toast.error('Name needs at least 2 characters');
        run('p', () => configureCommunity({ communityId: d.id, action: 'profile', profile: p }));
      }} />
    </div>
  );
}
