import { useEffect, useState } from 'react';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { modOverview } from 'zitejs/api';
import SupportApp from './SupportApp';

/** /support is staff-only: sign in first, then confirm the account is on the staff list. */
export default function SupportGate() {
  const { user, isLoading } = useAuth();
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    if (isLoading) return;
    if (!user) { loginWithRedirect(); return; }
    modOverview({}).then(() => setState('ok')).catch(() => setState('denied'));
  }, [isLoading, user]);

  if (isLoading || !user || state === 'checking') {
    return <div className="grid h-[100dvh] place-items-center text-sm text-muted-foreground">Loading support panel…</div>;
  }
  if (state === 'denied') {
    return (
      <div className="grid h-[100dvh] place-items-center px-6 text-center">
        <div>
          <p className="text-2xl font-semibold tracking-tight">Staff only</p>
          <p className="mt-2 text-muted-foreground">{user.email} isn’t on the support staff list.</p>
          <button onClick={() => logout()} className="mt-6 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background">Sign out</button>
        </div>
      </div>
    );
  }
  return <SupportApp />;
}
