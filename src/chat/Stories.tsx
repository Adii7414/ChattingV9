import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { AlignCenter, AlignLeft, AlignRight, ChevronLeft, ChevronRight, Eye, ImagePlus, Loader2, Pause, Play, Plus, Send, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useUpload } from 'zitejs/upload';
import { createConversation, sendMessage, stories as storiesApi, type StoriesOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@project/components/ui/dialog';
import { MarkdownEditor } from '@project/components/markdown-editor';
import { Markdown } from '@project/components/markdown';
import { Slider } from '@project/components/ui/slider';
import { cn } from '@project/components/lib/utils';
import PersonAvatar from './Avatars';
import { useChat, usePoll } from './store';
import { errorMessage } from '../lib/errors';
import { encrypt, partnerKey } from '../lib/e2e';

type Author = StoriesOutputType['authors'][number];
type Story = Author['stories'][number];
type Style = { bg: string; font: keyof typeof FONTS; align: 'left' | 'center' | 'right'; color: string; size: keyof typeof SIZES; duration: number; pos: 'top' | 'center' | 'bottom'; sticker: string; box: boolean };

const GRADIENTS = ['linear-gradient(135deg,#f58529,#dd2a7b,#8134af)', 'linear-gradient(135deg,#0f766e,#22d3ee)', 'linear-gradient(135deg,#111827,#4b5563)', 'linear-gradient(135deg,#f59e0b,#ef4444)', 'linear-gradient(135deg,#6366f1,#ec4899)', 'linear-gradient(135deg,#16a34a,#a3e635)', 'linear-gradient(160deg,#0ea5e9,#1e3a8a)', 'radial-gradient(circle at 30% 20%,#fde68a,#f472b6 60%,#7c3aed)'];
const FONTS = { sans: { l: 'Clean', f: 'var(--font-sans, Geist), sans-serif' }, serif: { l: 'Serif', f: 'Newsreader, Georgia, serif' }, mono: { l: 'Type', f: '"JetBrains Mono", monospace' }, hand: { l: 'Hand', f: 'Caveat, cursive' }, display: { l: 'Bold', f: '"Bebas Neue", Impact, sans-serif' } };
const SIZES = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl', xl: 'text-5xl' };
const STICKERS = ['', '🔥', '✨', '💖', '😂', '🎉', '☕', '🌙', '🌈', '📍', '🎵', '👀'];
const REACTS = ['❤️', '😂', '😮', '😢', '🔥', '👏'];
const RING = 'conic-gradient(from 210deg,#f58529,#feda77,#dd2a7b,#8134af,#515bd4,#f58529)';
const DEFAULT: Style = { bg: GRADIENTS[0], font: 'sans', align: 'center', color: '#ffffff', size: 'md', duration: 6, pos: 'center', sticker: '', box: false };

const parseStyle = (raw: string): Style => {
  if (raw?.startsWith('{')) { try { return { ...DEFAULT, ...JSON.parse(raw) }; } catch { /* fall through */ } }
  return { ...DEFAULT, bg: raw || DEFAULT.bg };
};

/** Renders one story's visual layer — shared by the viewer and the composer's live preview. */
function Canvas({ s, style, video, muted, onVideo }: { s: { mediaType: string; mediaUrl: string; text: string }; style: Style; video?: React.Ref<HTMLVideoElement>; muted?: boolean; onVideo?: { time: (p: number) => void; end: () => void } }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: s.mediaType === 'text' ? style.bg : '#000' }}>
      {s.mediaType === 'image' && <img src={s.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {s.mediaType === 'video' && <video ref={video} src={s.mediaUrl} autoPlay playsInline muted={muted} loop={!onVideo} className="absolute inset-0 h-full w-full object-cover"
        onTimeUpdate={(e) => onVideo?.time(e.currentTarget.currentTime / (e.currentTarget.duration || 1))} onEnded={() => onVideo?.end()} />}
      {(s.text || style.sticker) && (
        <div className={cn('absolute inset-x-0 flex flex-col gap-3 p-7', style.pos === 'top' ? 'top-16' : style.pos === 'bottom' ? 'bottom-28' : 'top-1/2 -translate-y-1/2')} style={{ alignItems: style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center' }}>
          {style.sticker && <span className="text-6xl drop-shadow-lg">{style.sticker}</span>}
          {s.text && (
            <div className={cn('story-md max-w-full break-words leading-snug', SIZES[style.size], style.box && 'rounded-2xl bg-black/45 px-4 py-3 backdrop-blur-sm')}
              style={{ color: style.color, fontFamily: FONTS[style.font].f, textAlign: style.align, textShadow: style.box ? undefined : '0 1px 12px rgb(0 0 0 / .35)' }}>
              <Markdown>{s.text}</Markdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Instagram-style row of story circles at the top of the chat list. */
export default function StoriesBar() {
  const { me } = useChat();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [compose, setCompose] = useState(false);
  const load = useCallback(() => storiesApi({ action: 'list' }).then((r) => setAuthors(r.authors)).catch(() => {}), []);
  usePoll(load, 60000);
  const mine = authors.find((a) => a.userId === me.id);
  const others = authors.filter((a) => a.userId !== me.id);
  const list = mine ? [mine, ...others] : others;
  return (
    <>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
        <div className="flex w-16 shrink-0 flex-col items-center gap-1">
          <div className="relative">
            <button onClick={() => (mine ? setOpen(0) : setCompose(true))} className="rounded-full p-[3px]" style={{ background: mine ? RING : 'transparent' }} aria-label={mine ? 'View your story' : 'Add to your story'}>
              <span className="block rounded-full border-2 border-background"><PersonAvatar name={me.name} image={me.image} size={52} /></span>
            </button>
            <button onClick={() => setCompose(true)} aria-label="Add to your story" className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Plus className="h-3 w-3" /></button>
          </div>
          <span className="w-full truncate text-center text-[11px] text-muted-foreground">Your story</span>
        </div>
        {others.map((a) => (
          <button key={a.userId} onClick={() => setOpen(list.indexOf(a))} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="rounded-full p-[3px]" style={{ background: a.allSeen ? 'hsl(var(--border))' : RING }}>
              <span className="block rounded-full border-2 border-background"><PersonAvatar name={a.name} image={a.image} size={52} /></span>
            </span>
            <span className={cn('w-full truncate text-center text-[11px]', a.allSeen ? 'text-muted-foreground' : 'font-medium')}>{a.name.split(' ')[0]}</span>
          </button>
        ))}
        {!others.length && <p className="self-center pl-1 text-xs text-muted-foreground">Stories from your friends show up here for 24 hours.</p>}
      </div>
      <AnimatePresence>{open !== null && list[open] && <Viewer key="viewer" authors={list} start={open} onClose={() => { setOpen(null); load(); }} onChanged={load} />}</AnimatePresence>
      <Composer open={compose} onOpenChange={setCompose} onPosted={() => { setCompose(false); load(); }} />
    </>
  );
}

function Viewer({ authors, start, onClose, onChanged }: { authors: Author[]; start: number; onClose: () => void; onChanged: () => void }) {
  const { me } = useChat();
  const [pos, setPos] = useState(() => ({ a: start, s: Math.max(0, authors[start].stories.findIndex((x) => !x.seen)) }));
  const [holding, setHolding] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState({ id: '', ms: 0, video: 0 });
  const [muted, setMuted] = useState(false);
  const [reply, setReply] = useState('');
  const [typing, setTyping] = useState(false);
  const [viewers, setViewers] = useState<StoriesOutputType['viewers'] | null>(null);
  const [localReact, setLocalReact] = useState<Record<string, string | null>>({});
  const video = useRef<HTMLVideoElement>(null);
  const press = useRef(0);
  const a = authors[pos.a];
  const s: Story | undefined = a?.stories[pos.s];
  const style = parseStyle(s?.background ?? '');
  const isMine = a?.userId === me.id;
  const isVideo = s?.mediaType === 'video';
  const stopped = paused || holding || typing || !!viewers;
  const mineClock = clock.id === s?.id;
  const progress = !mineClock ? 0 : isVideo ? clock.video : Math.min(1, clock.ms / (style.duration * 1000));

  const next = useCallback(() => setPos((p) => {
    const au = authors[p.a];
    if (p.s < au.stories.length - 1) return { a: p.a, s: p.s + 1 };
    if (p.a < authors.length - 1) return { a: p.a + 1, s: 0 };
    setTimeout(onClose, 0);
    return p;
  }), [authors, onClose]);
  const prev = useCallback(() => setPos((p) => (p.s > 0 ? { a: p.a, s: p.s - 1 } : p.a > 0 ? { a: p.a - 1, s: authors[p.a - 1].stories.length - 1 } : p)), [authors]);

  // New story: reset timers and record the view once.
  useEffect(() => {
    setClock({ id: s?.id ?? '', ms: 0, video: 0 }); setViewers(null);
    if (s && !s.seen && !isMine) storiesApi({ action: 'view', id: s.id }).catch(() => {});
  }, [s?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Clock for photo/text stories.
  useEffect(() => {
    if (!s || isVideo || stopped) return;
    let last = performance.now();
    const t = setInterval(() => { const now = performance.now(); setClock((c) => (c.id === s.id ? { ...c, ms: c.ms + (now - last) } : c)); last = now; }, 50);
    return () => clearInterval(t);
  }, [s, isVideo, stopped]);
  useEffect(() => { if (!isVideo && progress >= 1) next(); }, [progress, isVideo, next]);
  useEffect(() => { const v = video.current; if (!v) return; if (stopped) v.pause(); else v.play().catch(() => {}); }, [stopped, s?.id]);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (typing) return; if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'Escape') onClose(); if (e.key === ' ') setPaused((p) => !p); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [next, prev, onClose, typing]);
  if (!a || !s) return null;

  const reaction = s.id in localReact ? localReact[s.id] : s.myReaction;
  const react = async (emoji: string) => {
    setLocalReact((r) => ({ ...r, [s.id]: reaction === emoji ? null : emoji }));
    try { await storiesApi({ action: 'react', id: s.id, emoji }); onChanged(); } catch (e) { toast.error(errorMessage(e, 'Couldn’t react')); }
  };
  const sendReply = async () => {
    const text = reply.trim(); if (!text) return;
    try {
      const { id } = await createConversation({ memberIds: [a.userId] });
      const body = `↩️ Replied to your story: ${text}`;
      const k = await partnerKey(a.userId);
      await sendMessage({ conversationId: id, body: k ? await encrypt(me.id, k, body) : body });
      setReply(''); setTyping(false); toast.success('Reply sent');
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t send your reply')); }
  };
  const remove = async () => {
    try { await storiesApi({ action: 'delete', id: s.id }); toast.success('Story deleted'); onChanged(); onClose(); } catch (e) { toast.error(errorMessage(e, 'Couldn’t delete')); }
  };
  const showViewers = async () => { setViewers([]); try { setViewers((await storiesApi({ action: 'viewers', id: s.id })).viewers); } catch { setViewers([]); } };
  const onDown = () => { press.current = Date.now(); setHolding(true); };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setHolding(false);
    if (Date.now() - press.current > 250) return; // a hold just pauses
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) prev(); else next();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center bg-black/95">
      <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-black sm:aspect-[9/16] sm:h-[92dvh] sm:w-auto sm:rounded-3xl">
        <Canvas s={s} style={style} video={video} muted={muted} onVideo={{ time: (v) => setClock((c) => (c.id === s.id ? { ...c, video: v } : c)), end: next }} />
        <div className="absolute inset-0 touch-none" onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => setHolding(false)} onContextMenu={(e) => e.preventDefault()} />
        <div className={cn('pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3 pb-10 transition-opacity', holding && 'opacity-0')}>
          <div className="flex gap-1">{a.stories.map((x, i) => <div key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"><div className="h-full bg-white" style={{ width: `${i < pos.s ? 100 : i === pos.s ? progress * 100 : 0}%` }} /></div>)}</div>
          <div className="pointer-events-auto mt-3 flex items-center gap-2 text-white">
            <PersonAvatar name={a.name} image={a.image} size={34} />
            <p className="min-w-0 flex-1 truncate text-sm"><span className="font-semibold">{isMine ? 'Your story' : a.name}</span> <span className="text-white/60">{formatDistanceToNowStrict(new Date(s.createdAt))}</span></p>
            {isVideo && <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="grid h-9 w-9 place-items-center">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>}
            <button onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'} className="grid h-9 w-9 place-items-center">{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
            {isMine && <button onClick={remove} aria-label="Delete story" className="grid h-9 w-9 place-items-center"><Trash2 className="h-4 w-4" /></button>}
            <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <button onClick={prev} aria-label="Previous story" className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur sm:grid"><ChevronLeft className="h-5 w-5" /></button>
        <button onClick={next} aria-label="Next story" className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur sm:grid"><ChevronRight className="h-5 w-5" /></button>
        <div className={cn('absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10 transition-opacity', holding && 'opacity-0')}>
          {s.caption && <p className="mb-3 text-center text-sm text-white">{s.caption}</p>}
          {isMine ? (
            <button onClick={showViewers} className="mx-auto flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm text-white backdrop-blur"><Eye className="h-4 w-4" /> {s.viewCount} {s.viewCount === 1 ? 'view' : 'views'} · See who viewed</button>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-center gap-2">{REACTS.map((e) => <button key={e} onClick={() => react(e)} className={cn('grid h-10 w-10 place-items-center rounded-full text-xl transition hover:scale-110', reaction === e && 'scale-110 bg-white/25')}>{e}</button>)}</div>
              <form onSubmit={(e) => { e.preventDefault(); sendReply(); }} className="flex items-center gap-2 rounded-full border border-white/40 bg-black/20 px-4 backdrop-blur">
                <input value={reply} onChange={(e) => setReply(e.target.value)} onFocus={() => setTyping(true)} onBlur={() => !reply && setTyping(false)} placeholder={`Reply to ${a.name.split(' ')[0]}…`} className="h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/60" />
                {reply && <button aria-label="Send reply" className="text-white"><Send className="h-4 w-4" /></button>}
              </form>
            </div>
          )}
        </div>
        <AnimatePresence>
          {viewers && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute inset-x-0 bottom-0 max-h-[65%] overflow-y-auto rounded-t-3xl bg-background p-4">
              <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Viewed by {viewers.length}</p><button onClick={() => setViewers(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button></div>
              {viewers.map((v) => <div key={v.userId} className="flex items-center gap-3 py-2"><PersonAvatar name={v.name} image={v.image} size={38} /><p className="flex-1 truncate text-sm font-medium">{v.name}</p>{v.reaction && <span className="text-lg">{v.reaction}</span>}<span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(v.at))} ago</span></div>)}
              {!viewers.length && <p className="py-6 text-center text-sm text-muted-foreground">No views yet.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const Chip = ({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) => (
  <button type="button" onClick={onClick} aria-label={label} className={cn('h-8 shrink-0 rounded-lg border px-2.5 text-xs font-medium transition', on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary')}>{children}</button>
);
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><div className="flex flex-wrap items-center gap-1.5">{children}</div></div>
);

function Composer({ open, onOpenChange, onPosted }: { open: boolean; onOpenChange: (o: boolean) => void; onPosted: () => void }) {
  const { upload, isUploading } = useUpload();
  const [text, setText] = useState('');
  const [style, setStyle] = useState<Style>(DEFAULT);
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setText(''); setMedia(null); setCaption(''); setStyle(DEFAULT); setEditorKey((k) => k + 1); } }, [open]);
  const set = (p: Partial<Style>) => setStyle((s) => ({ ...s, ...p }));
  const pick = async (f?: File) => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return toast.error('Pick a photo or video');
    try { const { url } = await upload(f); setMedia({ url, type: f.type.startsWith('video') ? 'video' : 'image' }); } catch (e) { toast.error(errorMessage(e, 'Upload failed')); }
  };
  const ready = !!media || !!text.trim();
  const post = async () => {
    setBusy(true);
    try {
      await storiesApi({ action: 'create', mediaType: media ? media.type : 'text', mediaUrl: media?.url, text, caption, background: JSON.stringify(style) });
      toast.success('Added to your story'); onPosted();
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t post')); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] w-[calc(100vw-1rem)] max-w-4xl gap-0 overflow-y-auto p-0">
        <div className="grid md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="flex items-center justify-center bg-secondary/60 p-4 md:p-6">
            <div className="relative aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-3xl shadow-xl md:max-w-none">
              <Canvas s={{ mediaType: media?.type ?? 'text', mediaUrl: media?.url ?? '', text: text || (media ? '' : '*Start typing…*') }} style={style} muted />
              {media && <button onClick={() => setMedia(null)} aria-label="Remove media" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white"><X className="h-4 w-4" /></button>}
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div><DialogTitle>New story</DialogTitle><DialogDescription>Your friends can see it for 24 hours, and you’ll see who viewed it.</DialogDescription></div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Text</p>
              <MarkdownEditor key={editorKey} content={text} onChange={setText} height="dynamic-sm" hideCode hideHorizontalRule hideOrderedList className="rounded-xl border border-input" />
            </div>
            <Row label="Background">
              <Chip on={!!media} onClick={() => file.current?.click()} label="Photo or video">{isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="flex items-center gap-1"><ImagePlus className="h-3.5 w-3.5" /> Photo / video</span>}</Chip>
              {GRADIENTS.map((g) => <button key={g} type="button" onClick={() => { set({ bg: g }); setMedia(null); }} aria-label="Gradient" className={cn('h-8 w-8 rounded-lg ring-offset-2 ring-offset-background', !media && style.bg === g && 'ring-2 ring-foreground')} style={{ background: g }} />)}
              <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-lg border border-border" title="Any colour" style={{ background: style.bg.startsWith('#') ? style.bg : 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
                <input type="color" onChange={(e) => { set({ bg: e.target.value }); setMedia(null); }} className="absolute inset-0 opacity-0" />
              </label>
              <input ref={file} type="file" accept="image/*,video/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </Row>
            <Row label="Font">{(Object.keys(FONTS) as Style['font'][]).map((f) => <Chip key={f} on={style.font === f} onClick={() => set({ font: f })}><span style={{ fontFamily: FONTS[f].f }}>{FONTS[f].l}</span></Chip>)}</Row>
            <div className="grid gap-4 sm:grid-cols-2">
              <Row label="Size">{(Object.keys(SIZES) as Style['size'][]).map((z) => <Chip key={z} on={style.size === z} onClick={() => set({ size: z })}>{z.toUpperCase()}</Chip>)}</Row>
              <Row label="Align">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([k, I]) => <Chip key={k} on={style.align === k} onClick={() => set({ align: k })} label={k}><I className="h-3.5 w-3.5" /></Chip>)}
              </Row>
              <Row label="Position">{(['top', 'center', 'bottom'] as const).map((p) => <Chip key={p} on={style.pos === p} onClick={() => set({ pos: p })}>{p[0].toUpperCase() + p.slice(1)}</Chip>)}</Row>
              <Row label="Text colour">
                {['#ffffff', '#111827', '#fde047', '#f472b6', '#67e8f9'].map((c) => <button key={c} type="button" onClick={() => set({ color: c })} aria-label={c} className={cn('h-7 w-7 rounded-full border border-border ring-offset-2 ring-offset-background', style.color === c && 'ring-2 ring-foreground')} style={{ background: c }} />)}
                <input type="color" value={style.color} onChange={(e) => set({ color: e.target.value })} aria-label="Custom text colour" className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                <Chip on={style.box} onClick={() => set({ box: !style.box })}>Box</Chip>
              </Row>
            </div>
            <Row label="Sticker">{STICKERS.map((e) => <Chip key={e || 'none'} on={style.sticker === e} onClick={() => set({ sticker: e })}>{e || 'None'}</Chip>)}</Row>
            {!media || media.type === 'image' ? (
              <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Show for {style.duration}s</p><Slider min={3} max={15} step={1} value={[style.duration]} onValueChange={([v]) => set({ duration: v })} /></div>
            ) : null}
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="Caption (optional)" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none" />
            <button onClick={post} disabled={!ready || busy || isUploading} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Share to story</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
