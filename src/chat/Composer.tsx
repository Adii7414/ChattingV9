import { useEffect, useRef, useState } from 'react';
import { ArrowUp, BarChart3, CalendarClock, FileText, Loader2, Paperclip, Plus, Slash, Smile, Sticker, X } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { useUpload } from 'zitejs/upload';
import { draft as draftApi, setTyping } from 'zitejs/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import VoiceRecorder from './VoiceRecorder';
import { applySlash, confetti, SHORTCODES, SLASH, STICKERS } from './composerExtras';
import { usePrefs } from './prefs';
import GifPicker from './GifPicker';
import PollCreator from './PollCreator';
import ScheduleSend from './ScheduleSend';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import PersonAvatar from './Avatars';
import type { Draft, Msg } from './messages';
import { useChat, type Person } from './store';
import { errorMessage } from '../lib/errors';
export type { Draft };

const EMOJIS = '😀 😂 🥹 😊 😍 🥰 😘 😎 🤩 🥳 😇 🙂 😉 😌 🤔 🤨 😐 🙄 😏 😴 😮 😢 😭 😤 😡 🤯 😱 🤗 🤭 🫡 👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 🤞 👀 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 ✨ 🔥 💯 🎉 🎂 🎁 ☕ 🍕 🍜 🌮 🌴 ☀️ 🌙 ⭐ 🌈 ⚡ 🚀 ✅ ❌ ⚠️ 📌 📎 💡 🎧 📷 🎮 ⚽ 🏆'.split(' ');

type Props = {
  onSend: (d: Draft) => void; placeholder?: string; autoFocus?: boolean; draftKey: string; typingKey: string;
  replyTo?: Msg | null; onCancelReply?: () => void; dropped?: File[] | null; mentionable?: Person[];
  /** Enables polls, send-later and drafts synced across devices for this chat. */
  conversationId?: string;
  /** Community switches; anything false is hidden from the composer. */
  features?: { gifs: boolean; files: boolean; polls: boolean; imagesOnly?: boolean };
};

export default function Composer({ onSend, placeholder = 'Message', autoFocus, draftKey, typingKey, replyTo, onCancelReply, dropped, mentionable = [], conversationId, features = { gifs: true, files: true, polls: true } }: Props) {
  const { profile, people, me } = useChat();
  const enterSends = profile?.enterToSend ?? true;
  const [body, setBody] = useState(() => localStorage.getItem(`draft:${draftKey}`) ?? '');
  const [files, setFiles] = useState<Draft['files']>([]);
  const [mention, setMention] = useState<string | null>(null);
  const { upload, isUploading } = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const lastTyping = useRef(0);
  const [pollOpen, setPollOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const can = (body.trim() || files.length) && !isUploading;
  const pushDraft = useDebouncedCallback((v: string) => { if (conversationId) draftApi({ conversationId, body: v }).catch(() => {}); }, 1200);
  // Pull the draft saved on another device when this one has none.
  useEffect(() => {
    if (!conversationId || localStorage.getItem(`draft:${draftKey}`)) return;
    draftApi({ conversationId }).then((d) => { if (d.body) setBody((b) => b || d.body); }).catch(() => {});
  }, [conversationId, draftKey]);

  useEffect(() => { body ? localStorage.setItem(`draft:${draftKey}`, body) : localStorage.removeItem(`draft:${draftKey}`); }, [body, draftKey]);
  const firstRun = useRef(true);
  useEffect(() => { if (firstRun.current) { firstRun.current = false; return; } pushDraft(body); }, [body]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (replyTo) text.current?.focus(); }, [replyTo]);
  useEffect(() => { if (dropped?.length) addFiles(dropped); }, [dropped]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxFiles = features.imagesOnly ? 4 : 10;
  const addFiles = async (list: File[]) => {
    if (features.imagesOnly && list.some((f) => !f.type.startsWith('image/'))) toast.error('Only images can be sent here.');
    for (const f of list.filter((f) => !features.imagesOnly || f.type.startsWith('image/')).slice(0, maxFiles - files.length)) {
      try { const { url } = await upload(f); setFiles((s) => [...s, { url, filename: f.name || 'pasted-image.png', mimeType: f.type }]); }
      catch (e) { toast.error(errorMessage(e, `Couldn’t upload ${f.name || 'that file'}`)); }
    }
    if (input.current) input.current.value = '';
  };
  const prefs = usePrefs();
  const [stickers, setStickers] = useState(false);
  const change = (raw: string) => {
    const v = prefs.emojiShortcodes ? raw.replace(/:([a-z0-9_+]+):/g, (all, k: string) => SHORTCODES[k] ?? all) : raw;
    setBody(v);
    const m = /(?:^|\s)@([\w.-]*)$/.exec(v.slice(0, text.current?.selectionStart ?? v.length));
    setMention(m ? m[1].toLowerCase() : null);
    if (v && Date.now() - lastTyping.current > 3000) { lastTyping.current = Date.now(); setTyping({ where: typingKey }).catch(() => {}); }
  };
  const insert = (s: string) => {
    const el = text.current; const at = el?.selectionStart ?? body.length;
    setBody(body.slice(0, at) + s + body.slice(at));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + s.length, at + s.length); });
  };
  const pickMention = (p: Person) => {
    const at = text.current?.selectionStart ?? body.length;
    const before = body.slice(0, at).replace(/@[\w.-]*$/, `@${p.id.startsWith('@') ? p.name : p.name.split(' ')[0]} `);
    setBody(before + body.slice(at)); setMention(null); text.current?.focus();
  };
  const submit = () => {
    if (!can || sending.current) return;
    sending.current = true;
    setTimeout(() => { sending.current = false; }, 300);
    const { body: out, confetti: boom } = applySlash(body.trim());
    onSend({ body: out, files, replyTo });
    if (boom) confetti();
    pushDraft.flush();
    setBody(''); setFiles([]); onCancelReply?.(); lastTyping.current = 0;
  };
  const special = mentionable.length > 1 && mention !== null ? (['here', 'everyone'] as const).filter((k) => k.startsWith(mention)).map((k) => ({ id: `@${k}`, name: k, email: '', image: null, online: false, statusText: null, statusEmoji: null })) : [];
  const matches = mention === null ? [] : [...special, ...mentionable.filter((p) => p.id !== me.id && p.name.toLowerCase().includes(mention))].slice(0, 6);
  const slash = /^\/\w*$/.test(body) ? SLASH.filter((c) => c.cmd.startsWith(body.toLowerCase())) : [];

  return (
    <div className="relative shrink-0 border-t border-border px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {matches.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mx-auto mb-2 max-w-sm overflow-hidden rounded-2xl border border-border bg-popover p-1 shadow-lg sm:left-6">
            {matches.map((p) => <button key={p.id} onMouseDown={(e) => { e.preventDefault(); pickMention(p); }} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-secondary"><PersonAvatar name={p.name} image={p.image} size={24} />{p.name}</button>)}
          </div>
        )}
        {slash.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mx-auto mb-2 max-w-sm overflow-hidden rounded-2xl border border-border bg-popover p-1 shadow-lg sm:left-6">
            {slash.map((c) => <button key={c.cmd} onMouseDown={(e) => { e.preventDefault(); setBody(`${c.cmd} `); text.current?.focus(); }} className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-left text-sm hover:bg-secondary"><span className="font-mono font-medium">{c.cmd}</span><span className="truncate text-xs text-muted-foreground">{c.desc}</span></button>)}
          </div>
        )}
        {stickers && (
          <div className="mb-2 rounded-2xl border border-border bg-card p-2">
            <div className="mb-1 flex items-center justify-between px-1"><p className="text-xs font-medium text-muted-foreground">Stickers</p><button onClick={() => setStickers(false)} aria-label="Close stickers"><X className="h-4 w-4 text-muted-foreground" /></button></div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {STICKERS.map((g) => (
                <div key={g.name}><p className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">{g.name}</p>
                  <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">{g.items.map((e) => <button key={e} onClick={() => { onSend({ body: e, files: [], replyTo }); setStickers(false); }} className="grid h-12 place-items-center rounded-xl text-3xl transition hover:scale-110 hover:bg-secondary">{e}</button>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {replyTo && (
          <div className="mb-2 flex items-center gap-3 rounded-2xl border-l-4 border-primary bg-secondary px-3 py-2">
            <div className="min-w-0 flex-1"><p className="text-xs font-medium text-primary">Replying to {replyTo.senderId === me.id ? 'yourself' : people.get(replyTo.senderId)?.name ?? 'Someone'}</p><p className="truncate text-sm text-muted-foreground">{replyTo.body || 'Attachment'}</p></div>
            <button onClick={onCancelReply} aria-label="Cancel reply"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        )}
        {(files.length > 0 || isUploading) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={f.url} className="relative">
                {f.mimeType.startsWith('image/') ? <img src={f.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  : <div className="flex h-16 w-40 items-center gap-2 rounded-xl border border-border px-2 text-xs"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{f.filename}</span></div>}
                <button onClick={() => setFiles((s) => s.filter((_, j) => j !== i))} aria-label="Remove" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {isUploading && <div className="grid h-16 w-16 place-items-center rounded-xl bg-secondary"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <input ref={input} type="file" multiple hidden accept={features.imagesOnly ? 'image/*' : undefined} onChange={(e) => addFiles(Array.from(e.target.files ?? []))} />
          {conversationId && (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More options" title="Poll, send later" className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><Plus className="h-5 w-5" /></DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                {features.polls && <DropdownMenuItem onClick={() => setPollOpen(true)}><BarChart3 className="mr-2 h-4 w-4" /> Create poll</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setLaterOpen(true)}><CalendarClock className="mr-2 h-4 w-4" /> Send later</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStickers((v) => !v)}><Sticker className="mr-2 h-4 w-4" /> Stickers</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setBody('/'); text.current?.focus(); }}><Slash className="mr-2 h-4 w-4" /> Commands</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {features.files && <button onClick={() => input.current?.click()} disabled={isUploading || files.length >= maxFiles} aria-label="Attach" title={features.imagesOnly ? 'Attach images' : 'Attach files'} className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-40"><Paperclip className="h-5 w-5" /></button>}
          <div className="relative flex-1">
            <textarea ref={text} value={body} onChange={(e) => change(e.target.value)} rows={1} maxLength={5000} placeholder={placeholder} spellCheck={prefs.spellCheck} autoFocus={autoFocus}
              onPaste={(e) => { const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/')); if (imgs.length) { e.preventDefault(); addFiles(imgs); } }}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && replyTo) onCancelReply?.();
                if (e.key === 'Tab' && matches[0]) { e.preventDefault(); pickMention(matches[0]); }
                if ((e.key === 'Tab' || (e.key === 'Enter' && body.trim() === slash[0]?.cmd.slice(0, body.length) && body !== slash[0]?.cmd)) && slash[0]) { e.preventDefault(); setBody(`${slash[0].cmd} `); return; }
                if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.repeat) return;
                if (matches[0]) { e.preventDefault(); pickMention(matches[0]); return; }
                if (enterSends ? !e.shiftKey : e.metaKey || e.ctrlKey) { e.preventDefault(); submit(); }
              }}
              className="block max-h-40 min-h-10 w-full resize-none rounded-[20px] border border-input bg-background py-2 pl-4 pr-10 text-[15px] outline-none [field-sizing:content] focus:ring-2 focus:ring-ring" />
            {(body.length > 4000 || (prefs.charCounter && body.length > 0)) && <span className={`absolute -top-5 right-2 text-[11px] tabular-nums ${body.length >= 5000 ? 'text-destructive' : 'text-muted-foreground'}`}>{5000 - body.length}</span>}
            <Popover>
              <PopoverTrigger aria-label="Emoji" title="Emoji" className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><Smile className="h-5 w-5" /></PopoverTrigger>
              <PopoverContent side="top" align="end" className="grid w-72 grid-cols-8 gap-0.5 p-2">
                {EMOJIS.map((e) => <button key={e} onClick={() => insert(e)} className="grid h-8 w-8 place-items-center rounded-lg text-xl hover:bg-secondary">{e}</button>)}
              </PopoverContent>
            </Popover>
          </div>
          {features.gifs && <span className="max-sm:hidden"><GifPicker onPick={(url) => onSend({ body: url, files: [], replyTo })} /></span>}
          {!body.trim() && !files.length && features.files && !features.imagesOnly && <VoiceRecorder disabled={isUploading} onDone={(f) => onSend({ body: '', files: [f], replyTo })} />}
          <button onClick={submit} disabled={!can} aria-label="Send" className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-90 disabled:opacity-30"><ArrowUp className="h-5 w-5" /></button>
        </div>
        <p className="mt-1.5 hidden text-center text-[11px] text-muted-foreground sm:block">**bold** · _italic_ · __underline__ · ==highlight== · `code` · @mention · paste or drop images</p>
      </div>
      {conversationId && <>
        <PollCreator open={pollOpen} onOpenChange={setPollOpen} onCreate={(poll) => onSend({ body: '', files: [], replyTo, poll })} />
        <ScheduleSend open={laterOpen} onOpenChange={setLaterOpen} conversationId={conversationId} body={body} onScheduled={() => { setBody(''); setLaterOpen(false); }} />
      </>}
    </div>
  );
}
