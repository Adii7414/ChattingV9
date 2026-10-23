import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Ban, Bell, Camera, ChevronRight, Loader2, LifeBuoy, Lock, LogOut, Moon, Palette, Search, Smile, Sun, User, UserCircle2 } from 'lucide-react';
import { logout } from 'zitejs/auth';
import { useUpload } from 'zitejs/upload';
import { blockUser, myProfile } from 'zitejs/api';
import { format } from 'date-fns';
import { Switch } from '@project/components/ui/switch';
import { Skeleton } from '@project/components/ui/skeleton';
import { cn } from '@project/components/lib/utils';
import PersonAvatar from './Avatars';
import PersonalPrefs, { ProfileBannerPicker } from './PersonalPrefs';
import HelpSupport from './HelpSupport';
import { bannerStyle } from './banners';
import PersonDialog from './PersonDialog';
import { ping, useChat, type Profile } from './store';
import { errorMessage } from '../lib/errors';

const field = 'focus-ring h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none';
const STATUSES = [['💬', 'Available'], ['🎧', 'Focusing'], ['🌴', 'On holiday'], ['🤒', 'Out sick'], ['🚗', 'Commuting']];

const NAV = [
  { k: 'profile', l: 'Profile', d: 'Name, photo, bio and banner', i: User, kw: 'name photo avatar bio pronouns banner' },
  { k: 'status', l: 'Status', d: 'What you’re up to', i: Smile, kw: 'status emoji clear away' },
  { k: 'appearance', l: 'Appearance', d: 'Theme, fonts, colours, layout', i: Palette, kw: 'theme dark light font accent colour wallpaper bubble compact contrast enter send' },
  { k: 'notifications', l: 'Notifications', d: 'Alerts, sounds, quiet hours', i: Bell, kw: 'notifications sound desktop dnd quiet' },
  { k: 'privacy', l: 'Privacy & safety', d: 'Friend requests, message requests, online status', i: Lock, kw: 'privacy online read receipts last seen friend requests message requests dm' },
  { k: 'blocked', l: 'Blocked people', d: 'People you’ve blocked', i: Ban, kw: 'block unblock' },
  { k: 'support', l: 'Help & support', d: 'Contact our team', i: LifeBuoy, kw: 'help support contact ticket report problem bug appeal' },
  { k: 'account', l: 'Account', d: 'Email, sign out, legal', i: UserCircle2, kw: 'account sign out logout email terms privacy policy' },
] as const;
type Key = (typeof NAV)[number]['k'];

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{desc}</span></span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const ACCENTS = ['#149077', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0f172a'];
const CLEAR = [{ k: 'never', l: 'Never' }, { k: '30', l: '30 min' }, { k: '60', l: '1 hour' }, { k: '240', l: '4 hours' }, { k: 'today', l: 'Today' }, { k: 'week', l: 'This week' }];
function expiryFor(k: string): string | null {
  if (k === 'never') return null;
  const d = new Date();
  if (k === 'today') { d.setHours(23, 59, 0, 0); return d.toISOString(); }
  if (k === 'week') { d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); d.setHours(23, 59, 0, 0); return d.toISOString(); }
  return new Date(Date.now() + Number(k) * 60_000).toISOString();
}

function BlockedPeople() {
  const { people } = useChat();
  const [blocked, setBlocked] = useState<string[] | null>(null);
  useEffect(() => { blockUser({}).then((r) => setBlocked(r.blocked)).catch(() => setBlocked([])); }, []);
  const unblock = async (id: string) => {
    setBlocked((b) => b && b.filter((x) => x !== id));
    try { await blockUser({ userId: id }); toast.success('Unblocked'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t unblock')); }
  };
  return (
    <Section title="Blocked people" desc="They can’t message you directly, and you won’t see their messages.">
      {blocked === null ? <Skeleton className="h-12 rounded-xl" /> : blocked.length === 0 ? (
        <p className="rounded-xl bg-secondary px-4 py-6 text-center text-sm text-muted-foreground">You haven’t blocked anyone.</p>
      ) : blocked.map((id) => (
        <div key={id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm">
          <span>{people.get(id)?.name ?? 'Someone'}</span>
          <button onClick={() => unblock(id)} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">Unblock</button>
        </div>
      ))}
    </Section>
  );
}

function SettingsNav({ active, onPick, q, setQ }: { active: Key | null; onPick: (k: Key) => void; q: string; setQ: (v: string) => void }) {
  const items = NAV.filter((n) => !q || `${n.l} ${n.d} ${n.kw}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <nav className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings" className={`${field} h-10 pl-9`} />
      </div>
      <div className="space-y-0.5">
        {items.map((n) => (
          <button key={n.k} onClick={() => onPick(n.k)} className={cn('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', active === n.k ? 'bg-primary/10 text-primary' : 'hover:bg-secondary')}>
            <n.i className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.l}</span><span className="block truncate text-xs text-muted-foreground">{n.d}</span></span>
            <ChevronRight className="h-4 w-4 text-muted-foreground md:hidden" />
          </button>
        ))}
        {items.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No settings match “{q}”.</p>}
      </div>
    </nav>
  );
}

export default function Settings() {
  const { me, profile, setProfile } = useChat();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('s') as Key | null;
  const active: Key | null = fromUrl && NAV.some((n) => n.k === fromUrl) ? fromUrl : null;
  const pick = (k: Key | null) => setParams(k ? { s: k } : {}, { replace: false });
  const [q, setQ] = useState('');
  const [d, setD] = useState<Profile | null>(profile);
  const [clear, setClear] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const { upload, isUploading } = useUpload();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => { if (profile && !d) setD(profile); }, [profile, d]);
  const current = useMemo(() => NAV.find((n) => n.k === (active ?? 'profile'))!, [active]);

  const save = async (update: Partial<Profile>, quiet = false) => {
    setSaving(!quiet);
    try { const p = await myProfile({ update }); setProfile(p); setD((cur) => (quiet && cur ? { ...cur, ...update } : p)); if (!quiet) toast.success('Profile saved'); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t save your changes')); }
    finally { setSaving(false); }
  };
  const toggle = (k: 'showOnlineStatus' | 'sendReadReceipts' | 'enterToSend') => (v: boolean) => { setD((x) => x && { ...x, [k]: v }); save({ [k]: v }, true); };
  const setTheme = (isDark: boolean) => { setDark(isDark); document.documentElement.classList.toggle('dark', isDark); localStorage.setItem('theme', isDark ? 'dark' : 'light'); };
  const pickPhoto = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.error('Choose an image file');
    try { const { url } = await upload(f); await save({ image: url }); } catch (e) { toast.error(errorMessage(e, 'Upload failed')); }
  };

  if (!d) return <section className="flex-1 space-y-4 p-8"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /></section>;
  const dirty = profile && (clear !== '' || (['firstName', 'lastName', 'bio', 'pronouns', 'statusText', 'statusEmoji'] as const).some((k) => d[k] !== profile[k]));
  const nameOk = d.firstName.trim().length > 0;
  const shown = active ?? 'profile';

  return (
    <section className="flex min-w-0 flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn('w-full shrink-0 overflow-y-auto border-r border-border bg-card/40 p-4 md:block md:w-72', active ? 'hidden' : 'block')}>
        <Link to="/app" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to chats</Link>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-secondary p-3">
          <PersonAvatar name={d.name} image={d.image} size={44} />
          <div className="min-w-0"><p className="truncate font-semibold">{d.name}</p><p className="truncate text-xs text-muted-foreground">{me.email}</p></div>
        </div>
        <SettingsNav active={active ? shown : null} onPick={pick} q={q} setQ={setQ} />
      </aside>

      {/* Content */}
      <div className={cn('min-w-0 flex-1 overflow-y-auto', active ? 'block' : 'hidden md:block')}>
        <div className="mx-auto w-full max-w-2xl space-y-5 px-5 py-6 sm:px-8 sm:py-10">
          <button onClick={() => pick(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground md:hidden"><ArrowLeft className="h-4 w-4" /> Settings</button>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><current.i className="h-5 w-5" /></span>
            <div><h1 className="text-2xl font-semibold tracking-tight">{current.l}</h1><p className="text-sm text-muted-foreground">{current.d}</p></div>
          </div>

          {shown === 'profile' && <>
            <Section title="About you" desc="This is how people see you in Chatting.">
              <div className="flex items-center gap-4">
                <label className="group relative cursor-pointer">
                  <PersonAvatar name={d.name} image={d.image} size={76} />
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">{isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </label>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{d.name}</p>
                  <p className="truncate text-sm text-muted-foreground">Click the photo to change it</p>
                  {d.image && <button onClick={() => save({ image: null })} className="mt-1 text-xs text-muted-foreground underline">Remove photo</button>}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><input value={d.firstName} onChange={(e) => setD({ ...d, firstName: e.target.value })} maxLength={40} placeholder="First name" className={field} />{!nameOk && <p className="mt-1 text-xs text-destructive">First name is required</p>}</div>
                <input value={d.lastName} onChange={(e) => setD({ ...d, lastName: e.target.value })} maxLength={40} placeholder="Last name" className={field} />
              </div>
              <input value={d.pronouns} onChange={(e) => setD({ ...d, pronouns: e.target.value })} maxLength={30} placeholder="Pronouns (optional)" className={field} />
              <div>
                <textarea value={d.bio} onChange={(e) => setD({ ...d, bio: e.target.value })} maxLength={300} rows={3} placeholder="A short bio" className={`${field} h-auto py-2.5`} />
                <p className="mt-1 text-right text-xs text-muted-foreground">{d.bio.length}/300</p>
              </div>
            </Section>
            <section className="space-y-3 overflow-hidden rounded-2xl border border-border bg-card">
              <div className="h-28" style={d.bannerImage ? { background: `url(${d.bannerImage}) center/cover` } : bannerStyle(d.banner)} />
              <div className="space-y-3 px-5 pb-5">
                <div><h2 className="font-semibold">Profile banner</h2><p className="text-sm text-muted-foreground">Shown at the top of your profile card.</p></div>
                <ProfileBannerPicker value={d.banner} onChange={(banner) => save({ banner, bannerImage: '' }, true)} />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-secondary">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Upload banner image
                    <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith('image/')) return toast.error('Choose an image file'); try { const { url } = await upload(f); await save({ bannerImage: url }, true); toast.success('Banner updated'); } catch (err) { toast.error(errorMessage(err, 'Upload failed')); } }} />
                  </label>
                  {d.bannerImage && <button onClick={() => save({ bannerImage: '' }, true)} className="text-xs text-muted-foreground underline">Remove image</button>}
                </div>
              </div>
            </section>
            <Section title="Profile colour" desc="Frames your avatar and tints the buttons on your profile card.">
              <div className="flex flex-wrap items-center gap-2">
                {ACCENTS.map((c) => <button key={c} onClick={() => save({ profileAccent: c }, true)} aria-label={`Colour ${c}`} className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition', d.profileAccent === c && 'ring-2 ring-foreground')} style={{ background: c }} />)}
                <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-dashed border-border" title="Custom colour"><input type="color" value={d.profileAccent || '#149077'} onChange={(e) => setD((x) => x && { ...x, profileAccent: e.target.value })} onBlur={(e) => save({ profileAccent: e.target.value }, true)} className="absolute -inset-2 h-12 w-12 cursor-pointer opacity-0" /><span className="grid h-full place-items-center text-xs text-muted-foreground">+</span></label>
                {d.profileAccent && <button onClick={() => save({ profileAccent: '' }, true)} className="text-xs text-muted-foreground underline">Reset</button>}
              </div>
              <button onClick={() => setPreview(true)} className="text-sm font-medium text-primary">Preview my profile →</button>
              <PersonDialog userId={preview ? me.id : null} onClose={() => setPreview(false)} />
            </Section>
          </>}

          {shown === 'status' && (
            <Section title="Your status" desc="Let people know what you’re up to.">
              <div className="flex gap-2">
                <input value={d.statusEmoji} onChange={(e) => setD({ ...d, statusEmoji: e.target.value })} maxLength={4} placeholder="🙂" aria-label="Status emoji" className={`${field} w-14 text-center text-lg`} />
                <input value={d.statusText} onChange={(e) => setD({ ...d, statusText: e.target.value })} maxLength={80} placeholder="What’s your status?" className={field} />
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(([e, t]) => <button key={t} onClick={() => setD({ ...d, statusEmoji: e, statusText: t })} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">{e} {t}</button>)}
                {(d.statusText || d.statusEmoji) && <button onClick={() => setD({ ...d, statusEmoji: '', statusText: '' })} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground underline">Clear</button>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Clear after</span>
                {CLEAR.map((c) => <button key={c.k} onClick={() => setClear(c.k)} className={`rounded-full border px-3 py-1 ${clear === c.k ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'}`}>{c.l}</button>)}
              </div>
              {profile?.statusExpiresAt && !clear && <p className="text-xs text-muted-foreground">Your status clears automatically {format(new Date(profile.statusExpiresAt), 'EEE d MMM, h:mm a')}.</p>}
            </Section>
          )}

          {shown === 'appearance' && <>
            <Section title="Basics">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Theme</span>
                <div className="flex rounded-xl bg-secondary p-1 text-sm">
                  {([[false, 'Light', Sun], [true, 'Dark', Moon]] as const).map(([v, l, I]) => (
                    <button key={l} onClick={() => setTheme(v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${dark === v ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}><I className="h-3.5 w-3.5" />{l}</button>
                  ))}
                </div>
              </div>
              <Toggle label="Press Enter to send" desc="If off, Enter adds a new line and ⌘/Ctrl + Enter sends." checked={d.enterToSend} onChange={toggle('enterToSend')} />
            </Section>
            <PersonalPrefs />
          </>}

          {shown === 'notifications' && <Notifications />}

          {shown === 'privacy' && (
            <Section title="Visibility" desc="Changes apply right away.">
              <Toggle label="Show when I’m online" desc="If off, nobody sees your green dot or last seen time — and you still see theirs." checked={d.showOnlineStatus} onChange={toggle('showOnlineStatus')} />
              <Toggle label="Send read receipts" desc="If off, people won’t see “Read” on messages they send you." checked={d.sendReadReceipts} onChange={toggle('sendReadReceipts')} />
            </Section>
          )}
          {shown === 'privacy' && (
            <Section title="Friends & messages" desc="Control who can reach you.">
              <Toggle label="Allow friend requests" desc="If off, nobody can send you a new friend request." checked={d.allowFriendRequests} onChange={(v) => { setD((x) => x && { ...x, allowFriendRequests: v }); save({ allowFriendRequests: v }, true); }} />
              <div>
                <p className="text-sm font-medium">Who can message you</p>
                <p className="text-sm text-muted-foreground">Messages from people who aren’t your friends arrive as message requests you can accept or delete.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([['Everyone', 'Everyone', 'Non-friends land in requests'], ['Friends only', 'Friends only', 'Nobody else can DM you']] as const).map(([v, l, h]) => (
                    <button key={v} onClick={() => { setD((x) => x && { ...x, messageRequestsFrom: v }); save({ messageRequestsFrom: v }, true); }} className={cn('rounded-xl border p-3 text-left text-sm transition', d.messageRequestsFrom === v ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary')}>
                      <p className="font-medium">{l}</p><p className="text-xs text-muted-foreground">{h}</p>
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {shown === 'blocked' && <BlockedPeople />}

          {shown === 'support' && <HelpSupport />}

          {shown === 'account' && (
            <Section title="Your account">
              <p className="text-sm text-muted-foreground">Signed in as <span className="text-foreground">{me.email}</span>. Read our <Link to="/privacy" className="underline">Privacy Policy</Link> and <Link to="/terms" className="underline">Terms</Link>.</p>
              <button onClick={() => logout()} className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-secondary"><LogOut className="h-4 w-4" /> Sign out</button>
            </Section>
          )}

          {dirty && (
            <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-2xl border border-border bg-background/90 p-3 pl-5 shadow-lg backdrop-blur">
              <span className="text-sm">You have unsaved changes</span>
              <div className="flex gap-2">
                <button onClick={() => { setD(profile); setClear(''); }} className="h-10 rounded-full px-4 text-sm">Discard</button>
                <button disabled={!nameOk || saving} onClick={() => save({ firstName: d.firstName, lastName: d.lastName, bio: d.bio, pronouns: d.pronouns, statusText: d.statusText, statusEmoji: d.statusEmoji, ...(clear ? { statusExpiresAt: expiryFor(clear) } : {}) }).then(() => setClear(''))}
                  className="flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Notifications() {
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));
  const [sound, setSound] = useState(() => localStorage.getItem('sound') !== 'off');
  return (
    <Section title="Alerts" desc="Muted chats never notify you. Do Not Disturb and quiet hours live under Appearance → personal preferences.">
      <Toggle label="Desktop notifications" desc={perm === 'denied' ? 'Blocked by your browser — allow notifications for this site in your browser settings.' : 'Get a pop-up for new messages while Chatting is in the background.'}
        checked={perm === 'granted'} onChange={async (v) => { if (v && 'Notification' in window) setPerm(await Notification.requestPermission()); else if (!v) toast('Turn notifications off in your browser’s site settings'); }} />
      <Toggle label="Message sound" desc="A soft chime when a new message arrives." checked={sound} onChange={(v) => { setSound(v); localStorage.setItem('sound', v ? 'on' : 'off'); if (v) ping(); }} />
      <UpdatesToggle />
    </Section>
  );
}

function UpdatesToggle() {
  const { profile, setProfile } = useChat();
  const on = !profile?.updatesOptOut;
  const change = async (v: boolean) => {
    if (profile) setProfile({ ...profile, updatesOptOut: !v });
    try { setProfile(await myProfile({ update: { updatesOptOut: !v } })); toast.success(v ? 'You’ll get updates from Chatting' : 'Updates from Chatting turned off'); }
    catch (e) { if (profile) setProfile(profile); toast.error(errorMessage(e, 'Couldn’t save')); }
  };
  return <Toggle label="Updates from Chatting" desc="Product news and tips in your Chatting DM. Your welcome message stays either way." checked={on} onChange={change} />;
}
