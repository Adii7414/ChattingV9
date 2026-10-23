import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { AtSign, Check, Loader2, X } from 'lucide-react';
import { logout } from 'zitejs/auth';
import { username as usernameApi } from 'zitejs/api';
import { errorMessage } from '../lib/errors';
import Logo from '../components/Logo';

/** Full-screen step shown after sign-up until the person picks a unique @username. */
export default function PickUsername({ suggestion, onDone }: { suggestion: string; onDone: (u: string) => void }) {
  const [v, setV] = useState(suggestion.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20));
  const [state, setState] = useState<{ ok: boolean; reason: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const check = useDebouncedCallback(async (name: string) => {
    try { const r = await usernameApi({ action: 'check', username: name }); setState({ ok: r.available, reason: r.reason }); } catch { setState(null); }
    setChecking(false);
  }, 300);
  useEffect(() => { if (v) { setChecking(true); check(v); } else setState(null); }, [v, check]);
  const save = async () => {
    setSaving(true);
    try { const r = await usernameApi({ action: 'set', username: v }); onDone(r.username!); }
    catch (e) { setState({ ok: false, reason: errorMessage(e, 'Couldn’t save that username') }); setSaving(false); }
  };
  const ready = !!v && state?.ok && !checking;
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <h1 className="text-center text-2xl font-bold tracking-tight">Pick your username</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">It’s how people find you on Chatting. Only your username is searchable — never your email.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (ready) save(); }} className="mt-8 space-y-2">
          <label className="focus-within:ring-ring flex h-12 items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:ring-2">
            <AtSign className="h-4 w-4 text-muted-foreground" />
            <input autoFocus value={v} onChange={(e) => setV(e.target.value.toLowerCase().replace(/\s/g, '').slice(0, 20))} placeholder="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="w-full bg-transparent text-base outline-none" />
            {checking ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : state && (state.ok ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-destructive" />)}
          </label>
          <p className={`min-h-[1.25rem] text-xs ${state && !state.ok ? 'text-destructive' : 'text-muted-foreground'}`}>{state && !state.ok ? state.reason : state?.ok ? `@${v} is available` : '3–20 characters: letters, numbers, dots and underscores.'}</p>
          <button disabled={!ready || saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Continue</button>
        </form>
        <button onClick={() => logout()} className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground">Sign out</button>
      </div>
    </div>
  );
}
