import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { reports, type ReportsOutputType } from 'zitejs/api';
import { Section, type TabProps } from './kit';
import { errorMessage } from '../../lib/errors';

/** Open message reports for moderators to review. */
export default function ReportsQueue({ d }: TabProps) {
  const [list, setList] = useState<ReportsOutputType['reports'] | null>(null);
  useEffect(() => { reports({ action: 'list', communityId: d.id }).then((r) => setList(r.reports)).catch(() => setList([])); }, [d.id]);
  const name = (id: string) => d.s.nicknames[id] ?? d.members.find((m) => m.id === id)?.name ?? 'Someone';
  const act = async (reportId: string, action: 'resolve' | 'dismiss') => {
    setList((l) => l && l.filter((x) => x.id !== reportId));
    try { await reports({ action, communityId: d.id, reportId }); toast.success(action === 'resolve' ? 'Marked as handled' : 'Report dismissed'); } catch (e) { toast.error(errorMessage(e, 'Couldn’t update the report')); }
  };
  if (!list) return null;
  return (
    <Section title={`Reports${list.length ? ` · ${list.length}` : ''}`} desc="Messages members flagged for review.">
      {!list.length ? <p className="text-sm text-muted-foreground">No open reports. 🎉</p> : list.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Flag className="h-3 w-3 text-destructive" /> {name(r.reporter)} reported {name(r.reportedUser)} · {formatDistanceToNowStrict(new Date(r.createdAt))} ago</p>
          <p className="mt-2 line-clamp-3 rounded-xl bg-secondary px-3 py-2 text-sm">{r.body || <i>Attachment</i>}</p>
          <p className="mt-2 text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/app/c/${r.conversationId}?m=${r.messageId}`} className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary">View in chat</Link>
            <button onClick={() => act(r.id, 'resolve')} className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">Mark handled</button>
            <button onClick={() => act(r.id, 'dismiss')} className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary">Dismiss</button>
          </div>
        </div>
      ))}
    </Section>
  );
}
