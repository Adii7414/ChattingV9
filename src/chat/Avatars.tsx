import { cn } from '@project/components/lib/utils';
import { Hash } from 'lucide-react';
import { useChat, type Conversation } from './store';

const hueOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export default function PersonAvatar({ name, image, size = 40, online, className }: { name: string; image?: string | null; size?: number; online?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.4, background: image ? undefined : `hsl(${hueOf(name)} 45% 55%)` }}>
      {image ? <img src={image} alt="" className="h-full w-full rounded-full object-cover" /> : (name[0] ?? '?').toUpperCase()}
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />}
    </span>
  );
}

export function GroupAvatar({ names, size = 40 }: { names: string[]; size?: number }) {
  if (names.length < 2) return <PersonAvatar name={names[0] ?? '?'} size={size} />;
  const s = size * 0.68;
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <PersonAvatar name={names[0]} size={s} className="absolute left-0 top-0" />
      <PersonAvatar name={names[1]} size={s} className="absolute bottom-0 right-0 ring-2 ring-background" />
    </span>
  );
}

/** The right avatar for any conversation: channel, emoji group, group, or the other person. */
export function ConvAvatar({ c, size = 40 }: { c: Conversation; size?: number }) {
  const { othersOf } = useChat();
  const others = othersOf(c);
  if (c.communityId) return <span className="grid shrink-0 place-items-center rounded-2xl bg-secondary" style={{ width: size, height: size }}><Hash className="text-muted-foreground" style={{ width: size * 0.42, height: size * 0.42 }} /></span>;
  if (c.isGroup && c.emoji) return <span className="grid shrink-0 place-items-center rounded-full bg-secondary" style={{ width: size, height: size, fontSize: size * 0.5 }}>{c.emoji}</span>;
  if (c.isGroup) return <GroupAvatar names={others.map((o) => o.name)} size={size} />;
  return <PersonAvatar name={others[0]?.name ?? '?'} image={others[0]?.image} online={others[0]?.online} size={size} />;
}
