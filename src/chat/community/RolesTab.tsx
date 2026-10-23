import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { configureCommunity } from 'zitejs/api';
import { Checkbox } from '@project/components/ui/checkbox';
import { Switch } from '@project/components/ui/switch';
import { cn } from '@project/components/lib/utils';
import { ACCENTS, ALL_PERMS, PERMS, uid, type Role } from '../../lib/community';
import { SaveButton, Section, input, useRun, type TabProps } from './kit';

export default function RolesTab({ d, reload }: TabProps) {
  const [roles, setRoles] = useState<Role[]>(d.s.roles);
  const [sel, setSel] = useState<string | null>(d.s.roles[0]?.id ?? null);
  const { busy, run } = useRun(reload);
  const role = roles.find((r) => r.id === sel);
  const set = (patch: Partial<Role>) => setRoles((rs) => rs.map((r) => (r.id === sel ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) => setRoles((rs) => { const n = [...rs]; const j = i + dir; if (j < 0 || j >= n.length) return rs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const add = () => { const r: Role = { id: uid(), name: 'New role', color: ACCENTS[roles.length % ACCENTS.length], perms: [], hoist: true }; setRoles([...roles, r]); setSel(r.id); };
  const count = (id: string) => Object.values(d.s.memberRoles).filter((x) => x.includes(id)).length;

  return (
    <div className="space-y-5">
      <Section title="Roles" desc="Roles higher in the list win — their colour shows on member names. The owner always has every permission.">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-1">
            {roles.map((r, i) => (
              <div key={r.id} className={cn('flex items-center gap-1 rounded-xl px-2 py-1.5', sel === r.id ? 'bg-secondary' : 'hover:bg-secondary/60')}>
                <button onClick={() => setSel(r.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} /><span className="truncate">{r.name}</span><span className="text-xs text-muted-foreground">{count(r.id)}</span>
                </button>
                <button onClick={() => move(i, -1)} aria-label="Move up" className="text-muted-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(i, 1)} aria-label="Move down" className="text-muted-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button onClick={add} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium text-primary hover:bg-secondary/60"><Plus className="h-4 w-4" /> Add role</button>
          </div>
          {role ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input type="color" value={role.color} onChange={(e) => set({ color: e.target.value })} aria-label="Role colour" className="h-10 w-12 cursor-pointer rounded-xl border border-input bg-transparent" />
                <input value={role.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} className={input} aria-label="Role name" />
                <button onClick={() => { setRoles(roles.filter((r) => r.id !== sel)); setSel(null); }} aria-label="Delete role" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"><span>Show members with this role separately in the member list</span><Switch checked={role.hoist} onCheckedChange={(hoist) => set({ hoist })} /></label>
              <div className="divide-y divide-border rounded-xl border border-border">
                {ALL_PERMS.map((p) => (
                  <label key={p} className="flex cursor-pointer items-center justify-between gap-3 p-3 text-sm">
                    {PERMS[p]}
                    <Checkbox checked={role.perms.includes(p)} onCheckedChange={(v) => set({ perms: v ? [...role.perms, p] : role.perms.filter((x) => x !== p) })} />
                  </label>
                ))}
              </div>
            </div>
          ) : <p className="py-10 text-center text-sm text-muted-foreground">Create a role like Moderator, VIP or Artist, then give it to members.</p>}
        </div>
      </Section>
      <SaveButton busy={busy === 'r'} onClick={() => run('r', () => configureCommunity({ communityId: d.id, action: 'roles', roles: roles.map((r) => ({ ...r, name: r.name.trim() || 'Role' })) }), 'Roles saved')} />
    </div>
  );
}
