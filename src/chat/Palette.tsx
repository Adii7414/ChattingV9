import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Compass, Keyboard, LifeBuoy, Settings, SquarePen, Star } from 'lucide-react';
import { openSupport } from './official';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { ConvAvatar } from './Avatars';
import { useChat } from './store';

const SHORTCUTS = [
  ['Ctrl / ⌘ + K', 'Quick switch between chats'], ['Ctrl / ⌘ + F', 'Search in the open chat'], ['Alt + ↑ / ↓', 'Previous / next chat'],
  ['Enter', 'Send (or Shift + Enter for a new line)'], ['Esc', 'Close a thread or cancel a reply'], ['@', 'Mention someone in a group'],
  ['Alt + Shift + ↓', 'Jump to the next unread chat'], ['Ctrl / ⌘ + Shift + E', 'Export the open chat'],
  ['Double-click a message', 'Reply to it'], ['＋ in the composer', 'Create a poll or send later'], ['? or Ctrl / ⌘ + /', 'Show this list'],
];

/** Ctrl+K command palette, Alt+↑/↓ chat switching and the "?" shortcuts sheet. */
export default function Palette() {
  const { conversations, titleOf, refresh } = useChat();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const list = (conversations ?? []).filter((c) => !c.archived);

  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA'].includes(t.tagName));
    const f = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      else if ((e.key === '?' && !typing(e.target)) || ((e.metaKey || e.ctrlKey) && e.key === '/')) { e.preventDefault(); setHelp(true); }
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); window.dispatchEvent(new CustomEvent('chat:export')); }
      else if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const next = list.find((c) => c.unread > 0 && !location.pathname.endsWith(c.id));
        if (next) navigate(`/app/c/${next.id}`); else toast('You’re all caught up 🎉');
      }
      else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const cur = list.findIndex((c) => location.pathname.endsWith(c.id));
        const next = list[(cur + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
        if (next) navigate(`/app/c/${next.id}`);
      }
    };
    const o = () => setOpen(true);
    window.addEventListener('keydown', f); window.addEventListener('open-palette', o);
    return () => { window.removeEventListener('keydown', f); window.removeEventListener('open-palette', o); };
  }, [list, navigate]);

  const go = (to: string) => { setOpen(false); navigate(to); };
  const item = 'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm aria-selected:bg-secondary';

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Quick switch</DialogTitle>
          <Command className="flex flex-col" loop>
            <Command.Input autoFocus placeholder="Jump to a chat or action…" className="h-14 border-b border-border bg-transparent px-5 text-[15px] outline-none" />
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">No matches.</Command.Empty>
              <Command.Group heading="Chats" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                {list.map((c) => (
                  <Command.Item key={c.id} value={`${titleOf(c)} ${c.id}`} onSelect={() => go(`/app/c/${c.id}`)} className={item}>
                    <ConvAvatar c={c} size={28} /><span className="flex-1 truncate">{titleOf(c)}</span>{c.unread > 0 && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                <Command.Item onSelect={() => { setOpen(false); window.dispatchEvent(new Event('new-chat')); }} className={item}><SquarePen className="h-4 w-4" /> New conversation</Command.Item>
                <Command.Item onSelect={() => go('/app/saved')} className={item}><Star className="h-4 w-4" /> Saved messages</Command.Item>
                <Command.Item onSelect={() => go('/app/discover')} className={item}><Compass className="h-4 w-4" /> Discover communities</Command.Item>
                <Command.Item onSelect={() => go('/app/settings')} className={item}><Settings className="h-4 w-4" /> Profile & settings</Command.Item>
                <Command.Item onSelect={() => { setOpen(false); openSupport(navigate, refresh); }} className={item}><LifeBuoy className="h-4 w-4" /> Contact support</Command.Item>
                <Command.Item onSelect={() => { setOpen(false); setHelp(true); }} className={item}><Keyboard className="h-4 w-4" /> Keyboard shortcuts</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle><DialogDescription>Move around Chatting without the mouse.</DialogDescription></DialogHeader>
          <div className="divide-y divide-border">{SHORTCUTS.map(([k, d]) => <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-sm"><span>{d}</span><kbd className="shrink-0 rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs">{k}</kbd></div>)}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
