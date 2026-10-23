import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Switch } from '@project/components/ui/switch';
import { Button } from '@project/components/ui/button';
import type { PollDraft } from './messages';

export default function PollCreator({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (p: PollDraft) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && filled.length >= 2 && new Set(filled).size === filled.length;
  const submit = () => {
    if (!valid) return;
    onCreate({ question: question.trim(), options: filled, multi });
    setQuestion(''); setOptions(['', '']); setMulti(false); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create a poll</DialogTitle></DialogHeader>
        <input autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Ask a question" className="h-11 rounded-xl border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" />
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} maxLength={120} placeholder={`Option ${i + 1}`} className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              {options.length > 2 && <button onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Remove option" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-secondary"><X className="h-4 w-4" /></button>}
            </div>
          ))}
          {options.length < 10 && <button onClick={() => setOptions([...options, ''])} className="flex items-center gap-1.5 text-sm font-medium text-primary"><Plus className="h-4 w-4" /> Add option</button>}
        </div>
        {filled.length !== new Set(filled).size && <p className="text-xs text-destructive">Options must be different.</p>}
        <label className="flex items-center justify-between text-sm">Allow multiple answers <Switch checked={multi} onCheckedChange={setMulti} /></label>
        <Button onClick={submit} disabled={!valid}>Send poll</Button>
      </DialogContent>
    </Dialog>
  );
}
