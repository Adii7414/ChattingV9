import { BarChart3, Check } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import type { Msg } from './messages';
import { useChat } from './store';

export default function PollCard({ poll, onVote }: { poll: NonNullable<Msg['poll']>; onVote?: (option: number) => void }) {
  const { me, people } = useChat();
  const voters = new Set(poll.options.flatMap((o) => o.votes));
  const max = Math.max(1, ...poll.options.map((o) => o.votes.length));
  const name = (id: string) => (id === me.id ? 'You' : people.get(id)?.name ?? 'Someone');
  return (
    <div className="w-72 max-w-full rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-sm">
      <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" /> Poll{poll.multi && ' · pick any'}</p>
      <p className="mb-2.5 font-semibold leading-snug">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((o, i) => {
          const mine = o.votes.includes(me.id);
          return (
            <button key={i} disabled={!onVote} onClick={() => onVote?.(i)} title={o.votes.map(name).join(', ')}
              className={cn('relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition', mine ? 'border-primary' : 'border-border hover:border-primary/50')}>
              <span className={cn('absolute inset-y-0 left-0 transition-all', mine ? 'bg-primary/15' : 'bg-secondary')} style={{ width: `${(o.votes.length / max) * 100}%` }} />
              <span className="relative flex items-center gap-2">
                <span className={cn('grid h-4 w-4 shrink-0 place-items-center border', poll.multi ? 'rounded' : 'rounded-full', mine ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50')}>{mine && <Check className="h-3 w-3" />}</span>
                <span className="flex-1">{o.text}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{o.votes.length}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{voters.size} {voters.size === 1 ? 'vote' : 'votes'}</p>
    </div>
  );
}
