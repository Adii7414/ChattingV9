import { NavLink, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BarChart3, Building2, Flag, History, LifeBuoy, Megaphone, Menu, MessageSquareText, Shield, Users, Wrench, X } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { modOverview } from 'zitejs/api';
import Overview from './pages/Overview';
import Reports from './pages/Reports';
import UsersPage from './pages/Users';
import UserDetail from './pages/UserDetail';
import Communities from './pages/Communities';
import Support from './pages/Support';
import Macros from './pages/Macros';
import Announcements from './pages/Announcements';
import AuditLog from './pages/AuditLog';
import Toolkit from './pages/Toolkit';

const NAV = [
  { to: '/support', l: 'Overview', i: BarChart3, k: null },
  { to: '/support/tickets', l: 'Support inbox', i: LifeBuoy, k: 'openTickets' },
  { to: '/support/reports', l: 'Reports', i: Flag, k: 'openReports' },
  { to: '/support/users', l: 'Users', i: Users, k: null },
  { to: '/support/communities', l: 'Communities', i: Building2, k: null },
  { to: '/support/announcements', l: 'Announcements', i: Megaphone, k: null },
  { to: '/support/macros', l: 'Saved replies', i: MessageSquareText, k: null },
  { to: '/support/audit', l: 'Audit log', i: History, k: null },
  { to: '/support/toolkit', l: 'Toolkit', i: Wrench, k: null },
] as const;

function Sidebar({ counts, onNav }: { counts: Record<string, number>; onNav?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Shield className="h-4 w-4" /></span>
        <div><p className="text-sm font-semibold text-sidebar-accent-foreground">Chatting HQ</p><p className="text-[11px] opacity-60">Mod & Support</p></div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/support'} onClick={onNav}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition', isActive ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60')}>
            <n.i className="h-4 w-4" />{n.l}
            {n.k && counts[n.k] > 0 && <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 font-mono text-[10px] text-sidebar-primary-foreground">{counts[n.k]}</span>}
          </NavLink>
        ))}
      </nav>
      <p className="px-5 py-4 text-[11px] opacity-50">Staff only · every action is logged</p>
    </div>
  );
}

export default function SupportApp() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const load = () => modOverview({}).then((r) => { const { satisfaction: _s, ...rest } = r.stats; setCounts(rest); }).catch(() => {});
    load(); const t = setInterval(load, 60_000); return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden w-60 shrink-0 md:block"><Sidebar counts={counts} /></aside>
        {open && <div className="fixed inset-0 z-40 md:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} /><aside className="relative h-full w-64"><Sidebar counts={counts} onNav={() => setOpen(false)} /></aside></div>}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
            <button onClick={() => setOpen(!open)} className="rounded-md p-1.5 hover:bg-secondary">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            <span className="font-semibold">Chatting HQ</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Routes>
              <Route index element={<Overview />} />
              <Route path="tickets" element={<Support />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:userId" element={<UserDetail />} />
              <Route path="communities" element={<Communities />} />
              <Route path="macros" element={<Macros />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="toolkit" element={<Toolkit />} />
            </Routes>
          </div>
        </main>
      </div>
    </>
  );
}
