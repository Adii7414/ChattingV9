import { useEffect } from 'react';
import { Ban, ShieldAlert } from 'lucide-react';
import { logout } from 'zitejs/auth';
import Logo from '../components/Logo';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null);

/** Banned accounts are signed out and can't use Chatting at all. */
export function BannedScreen({ reason }: { reason: string }) {
  useEffect(() => {
    // End the session so the account stays signed out.
    const t = setTimeout(() => { logout(); }, 15000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="grid h-[100dvh] place-items-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <Logo className="justify-center" />
        <div className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive"><Ban className="h-7 w-7" /></div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">This account has been banned</h1>
        <p className="mt-2 text-sm text-muted-foreground">You can no longer sign in to or use Chatting with this account.</p>
        {reason && <p className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm"><span className="text-muted-foreground">Reason: </span>{reason}</p>}
        <p className="mt-4 text-xs text-muted-foreground">You’ll be signed out automatically.</p>
        <button onClick={() => logout()} className="mt-6 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background">Sign out now</button>
      </div>
    </div>
  );
}

export function SuspendedBanner({ until, reason }: { until: string | null; reason: string }) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="min-w-0">
        <span className="font-medium">Your account is suspended{until ? ` until ${fmt(until)}` : ''}.</span>{' '}
        <span className="text-muted-foreground">Your chats are hidden until then{reason ? ` — reason: ${reason}` : ''}. You can still message Chatting Support to appeal.</span>
      </p>
    </div>
  );
}
