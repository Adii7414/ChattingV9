import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Checkbox } from '@project/components/ui/checkbox';
import { Button } from '@project/components/ui/button';
import { setPrefs, uidFolder, type Folder } from './prefs';
import { useChat } from './store';

/** Create or edit a custom chat folder (saved on this device). */
export default function FolderDialog({ folder, open, onOpenChange }: { folder: Folder | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { conversations, titleOf } = useChat();
  const [name, setName] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { if (open) { setName(folder?.name ?? ''); setIds(folder?.ids ?? []); } }, [open, folder]);
  const chats = (conversations ?? []).filter((c) => !c.communityId);
  const save = () => {
    const f: Folder = { id: folder?.id ?? uidFolder(), name: name.trim(), ids };
    setPrefs((p) => ({ folders: folder ? p.folders.map((x) => (x.id === f.id ? f : x)) : [...p.folders, f] }));
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{folder ? 'Edit folder' : 'New folder'}</DialogTitle></DialogHeader>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Folder name (e.g. Work, Family)" className="h-11 rounded-xl border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" />
        <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1">
          {chats.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary">
              <Checkbox checked={ids.includes(c.id)} onCheckedChange={(v) => setIds((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))} />{titleOf(c)}
            </label>
          ))}
          {!chats.length && <p className="p-4 text-center text-sm text-muted-foreground">No chats yet.</p>}
        </div>
        <div className="flex items-center justify-between gap-2">
          {folder ? <Button variant="ghost" className="text-destructive" onClick={() => { setPrefs((p) => ({ folders: p.folders.filter((x) => x.id !== folder.id) })); onOpenChange(false); }}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button> : <span />}
          <Button onClick={save} disabled={!name.trim() || !ids.length}>{folder ? 'Save' : 'Create folder'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
