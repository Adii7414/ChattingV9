import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { modCannedReplies, type ModCannedRepliesInputType, type ModCannedRepliesOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Empty, PageHeader, input } from '../kit';
import { errorMessage } from '../../lib/errors';

type Cat = NonNullable<ModCannedRepliesInputType['create']>['category'];
const CATS: Cat[] = ['Account', 'Bug', 'Abuse', 'Billing', 'Feature request', 'Other'];

export default function Macros() {
  const [list, setList] = useState<ModCannedRepliesOutputType['replies'] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<Cat>('Other');
  const [busy, setBusy] = useState(false);
  useEffect(() => { modCannedReplies({}).then((r) => setList(r.replies)); }, []);
  const add = async () => {
    setBusy(true);
    try { setList((await modCannedReplies({ create: { title: title.trim(), body: body.trim(), category } })).replies); setTitle(''); setBody(''); toast.success('Saved reply added'); }
    catch (e) { toast.error(errorMessage(e, 'Couldn’t save')); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { setList((l) => l && l.filter((x) => x.id !== id)); try { await modCannedReplies({ deleteId: id }); } catch (e) { toast.error(errorMessage(e, 'Couldn’t delete')); } };
  return (
    <div>
      <PageHeader title="Saved replies" desc="Reusable answers for the support inbox. Use {name} to insert the customer’s first name." />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          {list === null ? <Skeleton className="h-40 rounded-xl" /> : list.length === 0 ? <Empty>No saved replies yet</Empty> : list.map((r) => (
            <div key={r.id} className="group rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><p className="font-medium">{r.title}</p><span className="rounded bg-secondary px-1.5 text-[11px] text-muted-foreground">{r.category}</span>
                <button onClick={() => remove(r.id)} className="ml-auto rounded-md p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button></div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
        <div className="h-fit space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">New saved reply</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={100} className={`${input} w-full`} />
          <Select value={category} onValueChange={(v) => setCategory(v as Cat)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Hi {name}, …" />
          <Button className="w-full" disabled={title.trim().length < 2 || body.trim().length < 2 || busy} onClick={add}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add</Button>
        </div>
      </div>
    </div>
  );
}
