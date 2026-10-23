import { Check, Volume2 } from 'lucide-react';
import { Switch } from '@project/components/ui/switch';
import { cn } from '@project/components/lib/utils';
import { hexToHsl } from '../lib/community';
import { ACCENT_CHOICES, PERSONAL_FONTS, setPrefs, usePrefs, WALLPAPERS, type Prefs } from './prefs';
import { BANNERS } from './banners';
import { ping } from './store';

const Box = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <section className="space-y-4 rounded-3xl border border-border p-5">
    <div><h2 className="font-semibold">{title}</h2>{desc && <p className="text-sm text-muted-foreground">{desc}</p>}</div>
    {children}
  </section>
);
const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>{children}</div>
);
function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-secondary p-1 text-xs font-medium">
      {options.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={cn('rounded-lg px-2.5 py-1 transition', value === v ? 'bg-background shadow-sm' : 'text-muted-foreground')}>{l}</button>)}
    </div>
  );
}

export function ProfileBannerPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(BANNERS).map(([k, bg]) => (
        <button key={k} onClick={() => onChange(k)} aria-label={`${k} banner`} title={k} className={cn('grid h-9 w-14 place-items-center rounded-xl ring-offset-2 ring-offset-background transition', value === k && 'ring-2 ring-foreground')} style={{ background: bg }}>
          {value === k && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}

/** Appearance, sound and notification preferences — saved on this device. */
export default function PersonalPrefs() {
  const p = usePrefs();
  return (
    <>
      <Box title="Appearance" desc="Make Chatting yours. Saved on this device.">
        <div>
          <p className="mb-2 text-sm font-medium">Accent colour</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPrefs({ accent: null })} className={cn('h-8 rounded-full border border-border px-3 text-xs font-medium', !p.accent && 'ring-2 ring-foreground')}>Default</button>
            {ACCENT_CHOICES.map((a) => (
              <button key={a.v} onClick={() => setPrefs({ accent: a.v })} aria-label={a.name} title={a.name}
                className={cn('grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-background', p.accent === a.v && 'ring-2 ring-foreground')} style={{ background: `hsl(${a.v})` }}>
                {p.accent === a.v && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
            <label title="Any colour" className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-border" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
              <input type="color" aria-label="Custom accent colour" className="absolute inset-0 opacity-0" onChange={(e) => { const v = hexToHsl(e.target.value); if (v) setPrefs({ accent: v }); }} />
            </label>
          </div>
        </div>
        <Row label="Font"><Seg value={p.font} options={(Object.keys(PERSONAL_FONTS) as Prefs['font'][]).map((f) => [f, f === 'readable' ? 'Easy-read' : f[0].toUpperCase() + f.slice(1)])} onChange={(font) => setPrefs({ font })} /></Row>
        <Row label="Bubble shape"><Seg value={p.bubble} options={[['round', 'Round'], ['square', 'Square']]} onChange={(bubble) => setPrefs({ bubble })} /></Row>
        <Row label="High contrast" hint="Stronger text and borders"><Switch checked={p.highContrast} onCheckedChange={(highContrast) => setPrefs({ highContrast })} /></Row>
        <Row label="24-hour clock"><Switch checked={p.clock24} onCheckedChange={(clock24) => setPrefs({ clock24 })} /></Row>
        <Row label="Hide avatars in groups"><Switch checked={p.hideAvatars} onCheckedChange={(hideAvatars) => setPrefs({ hideAvatars })} /></Row>
        <Row label="Text size"><Seg value={p.fontSize} options={[['sm', 'Small'], ['md', 'Default'], ['lg', 'Large']]} onChange={(fontSize) => setPrefs({ fontSize })} /></Row>
        <Row label="Compact messages" hint="Fit more messages on screen"><Switch checked={p.compact} onCheckedChange={(compact) => setPrefs({ compact })} /></Row>
        <Row label="Reduce motion" hint="Turn off animations"><Switch checked={p.reduceMotion} onCheckedChange={(reduceMotion) => setPrefs({ reduceMotion })} /></Row>
        <Row label="Emoji shortcodes" hint="Type :smile: or :fire: to insert emoji"><Switch checked={p.emojiShortcodes} onCheckedChange={(emojiShortcodes) => setPrefs({ emojiShortcodes })} /></Row>
        <div>
          <p className="mb-2 text-sm font-medium">Chat wallpaper</p>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(WALLPAPERS) as Prefs['wallpaper'][]).map((w) => (
              <button key={w} onClick={() => setPrefs({ wallpaper: w })} className={cn('h-14 rounded-xl border border-border bg-background text-[11px] capitalize text-muted-foreground', p.wallpaper === w && 'ring-2 ring-foreground')} style={WALLPAPERS[w]}>{w}</button>
            ))}
          </div>
        </div>
      </Box>
      <Box title="Chat behaviour" desc="Saved on this device.">
        <Row label="Link previews" hint="Show cards for links in messages"><Switch checked={p.linkPreviews} onCheckedChange={(linkPreviews) => setPrefs({ linkPreviews })} /></Row>
        <Row label="Blur photos until hovered" hint="Handy in public places"><Switch checked={p.blurMedia} onCheckedChange={(blurMedia) => setPrefs({ blurMedia })} /></Row>
        <Row label="Spell check" hint="Underline typos while you type"><Switch checked={p.spellCheck} onCheckedChange={(spellCheck) => setPrefs({ spellCheck })} /></Row>
        <Row label="Character counter" hint="Always show how long your message is"><Switch checked={p.charCounter} onCheckedChange={(charCounter) => setPrefs({ charCounter })} /></Row>
        <Row label="Message previews in sidebar"><Switch checked={p.sidebarPreviews} onCheckedChange={(sidebarPreviews) => setPrefs({ sidebarPreviews })} /></Row>
      </Box>
      <Box title="Sounds & notifications">
        <Row label="Private notifications" hint="Hide message text in desktop notifications"><Switch checked={p.privateNotifs} onCheckedChange={(privateNotifs) => setPrefs({ privateNotifs })} /></Row>
        <Row label="Message sound">
          <div className="flex items-center gap-2">
            <Seg value={p.sound} options={[['chime', 'Chime'], ['pop', 'Pop'], ['bell', 'Bell'], ['off', 'Off']]} onChange={(sound) => { setPrefs({ sound }); if (sound !== 'off') ping(sound); }} />
            {p.sound !== 'off' && <button onClick={() => ping(p.sound as 'chime')} aria-label="Preview sound" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><Volume2 className="h-4 w-4" /></button>}
          </div>
        </Row>
        <Row label="Do not disturb" hint="Silence sounds and desktop notifications"><Switch checked={p.dnd} onCheckedChange={(dnd) => setPrefs({ dnd })} /></Row>
        <Row label="Quiet hours" hint={p.quiet ? `Silent ${p.quiet.start}–${p.quiet.end} every day` : 'Automatically silence at night'}>
          <Switch checked={!!p.quiet} onCheckedChange={(on) => setPrefs({ quiet: on ? { start: '22:00', end: '07:00' } : null })} />
        </Row>
        {p.quiet && (
          <div className="flex items-center gap-2 text-sm">
            <input type="time" value={p.quiet.start} onChange={(e) => setPrefs({ quiet: { ...p.quiet!, start: e.target.value } })} className="h-9 rounded-lg border border-input bg-background px-2" />
            <span className="text-muted-foreground">to</span>
            <input type="time" value={p.quiet.end} onChange={(e) => setPrefs({ quiet: { ...p.quiet!, end: e.target.value } })} className="h-9 rounded-lg border border-input bg-background px-2" />
          </div>
        )}
      </Box>
    </>
  );
}
