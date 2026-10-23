import { useState } from 'react';
import { toast } from 'sonner';
import { Bot, ExternalLink, Loader2 } from 'lucide-react';
import { botInteraction } from 'zitejs/api';
import { cn } from '@project/components/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import type { Msg } from './messages';
import { RichText } from './MessageItem';
import { errorMessage } from '../lib/errors';
import { withTimes, type Button as Btn, type Embed, type Select as Sel } from '../lib/bots';

export function BotBadge() {
  return <span className="inline-flex items-center gap-0.5 rounded bg-primary px-1 py-px text-[9px] font-bold uppercase tracking-wide text-primary-foreground"><Bot className="h-2.5 w-2.5" />Bot</span>;
}

export function BotAvatar({ name, avatar, size = 28 }: { name: string; avatar?: string | null; size?: number }) {
  if (avatar && /^https?:\/\//.test(avatar)) return <img src={avatar} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return <span className="grid shrink-0 place-items-center rounded-full bg-primary/15 text-primary" style={{ width: size, height: size, fontSize: size * 0.5 }}>{avatar || <Bot className="h-1/2 w-1/2" />}</span>;
}


function EmbedCard({ e }: { e: Embed }) {
  return (
    <div className="max-w-md overflow-hidden rounded-xl border border-border bg-card" style={{ borderLeft: `4px solid ${e.color || 'hsl(var(--primary))'}` }}>
      <div className="flex gap-3 p-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {e.author && <p className="flex items-center gap-1.5 text-xs font-medium">{e.author.iconUrl && <img src={e.author.iconUrl} alt="" className="h-4 w-4 rounded-full" />}{e.author.name}</p>}
          {e.title && (e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">{e.title}<ExternalLink className="h-3 w-3" /></a> : <p className="text-sm font-semibold">{e.title}</p>)}
          {e.description && <div className="text-sm text-muted-foreground"><RichText text={withTimes(e.description)} /></div>}
          {!!e.fields?.length && (
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
              {e.fields.slice(0, 25).map((f, i) => <div key={i} className={f.inline ? '' : 'sm:col-span-3'}><p className="text-xs font-semibold">{f.name}</p><p className="text-xs text-muted-foreground"><RichText text={withTimes(f.value)} /></p></div>)}
            </div>
          )}
        </div>
        {e.thumbnail && <img src={e.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
      </div>
      {e.image && <img src={e.image} alt="" loading="lazy" className="max-h-64 w-full object-cover" />}
      {(e.footer || e.timestamp) && <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">{[e.footer, e.timestamp && new Date(e.timestamp).toLocaleString()].filter(Boolean).join(' · ')}</p>}
    </div>
  );
}

const STYLE: Record<string, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  success: 'bg-emerald-600 text-white hover:opacity-90',
  danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  link: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
};

export function BotCard({ m }: { m: Msg }) {
  const [busy, setBusy] = useState<string | null>(null);
  const embeds = (m.embeds ?? []) as Embed[];
  const rows = (m.components ?? []) as (Btn | Sel)[][];
  if (!embeds.length && !rows.length) return null;
  const fire = async (componentId: string, values?: string[]) => {
    setBusy(componentId);
    try { const r = await botInteraction({ messageId: m.id, componentId, values }); toast.success(r.message || 'Sent to the bot'); }
    catch (e) { toast.error(errorMessage(e, 'That didn’t work')); } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-col gap-2">
      {embeds.map((e, i) => <EmbedCard key={i} e={e} />)}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap gap-1.5">
          {row.map((c) => c.type === 'button' ? (
            c.style === 'link' && c.url
              ? <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className={cn('flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium', STYLE.link)}>{c.emoji}{c.label}<ExternalLink className="h-3 w-3" /></a>
              : <button key={c.id} disabled={c.disabled || !!busy || m.pending} onClick={() => fire(c.id)} className={cn('flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:opacity-50', STYLE[c.style ?? 'secondary'])}>
                  {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c.emoji}{c.label}
                </button>
          ) : (
            <Select key={c.id} onValueChange={(v) => fire(c.id, [v])} disabled={!!busy}>
              <SelectTrigger className="h-8 w-64 text-sm"><SelectValue placeholder={c.placeholder || 'Choose…'} /></SelectTrigger>
              <SelectContent>{c.options.filter((o) => o.value).map((o) => <SelectItem key={o.value} value={o.value}>{o.emoji} {o.label}</SelectItem>)}</SelectContent>
            </Select>
          ))}
        </div>
      ))}
    </div>
  );
}
