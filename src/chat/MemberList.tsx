import { Crown } from 'lucide-react';
import type { CommunitySettings } from '../lib/community';
import PersonAvatar from './Avatars';
import { useChat } from './store';

/** Discord-style member list: hoisted roles first, then Online, then Offline. */
export default function MemberList({ memberIds, cs, ownerId, onPerson }: { memberIds: string[]; cs: CommunitySettings; ownerId: string | null; onPerson: (id: string) => void }) {
  const { people } = useChat();
  const hoisted = cs.roles.filter((r) => r.hoist);
  const groups = new Map<string, { label: string; color?: string; ids: string[] }>();
  hoisted.forEach((r) => groups.set(r.id, { label: r.name, color: r.color, ids: [] }));
  groups.set('online', { label: 'Online', ids: [] });
  groups.set('offline', { label: 'Offline', ids: [] });
  for (const id of memberIds) {
    const p = people.get(id);
    if (!p?.online) { groups.get('offline')!.ids.push(id); continue; }
    const held = cs.memberRoles[id] ?? [];
    const top = hoisted.find((r) => held.includes(r.id));
    groups.get(top?.id ?? 'online')!.ids.push(id);
  }
  const colorOf = (id: string) => cs.roles.find((r) => (cs.memberRoles[id] ?? []).includes(r.id))?.color;
  return (
    <aside className="hidden w-60 shrink-0 overflow-y-auto border-l border-border bg-secondary/30 px-2 py-4 xl:block">
      {[...groups.values()].filter((g) => g.ids.length).map((g) => (
        <div key={g.label} className="mb-4">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label} — {g.ids.length}</p>
          {g.ids.sort((a, b) => (people.get(a)?.name ?? '').localeCompare(people.get(b)?.name ?? '')).map((id) => {
            const p = people.get(id);
            const nick = cs.nicknames?.[id];
            return (
              <button key={id} onClick={() => onPerson(id)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-secondary ${g.label === 'Offline' ? 'opacity-50 hover:opacity-100' : ''}`}>
                <PersonAvatar name={p?.name ?? '?'} image={p?.image ?? null} size={32} online={!!p?.online} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-medium" style={{ color: colorOf(id) }}>{nick || p?.name || 'Member'}{id === ownerId && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}</span>
                  {(p?.statusText || p?.statusEmoji) && <span className="block truncate text-[11px] text-muted-foreground">{p.statusEmoji} {p.statusText}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
