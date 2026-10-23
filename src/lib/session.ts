import { useEffect } from 'react';
import { logout } from 'zitejs/auth';
import { trackSession } from 'zitejs/api';

export function sessionKey() {
  let k = localStorage.getItem('chatting:session');
  if (!k) { k = `s_${crypto.randomUUID()}`; localStorage.setItem('chatting:session', k); }
  return k;
}

export function deviceInfo() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const device = /iPad|Tablet/.test(ua) ? 'Tablet' : /Mobi|iPhone|Android/.test(ua) ? 'Phone' : 'Computer';
  return {
    sessionKey: sessionKey(), browser, os, device, userAgent: ua.slice(0, 400),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '', language: navigator.language ?? '', screen: `${screen.width}x${screen.height}`,
  };
}

export async function checkSession(extra: { signOutOthers?: boolean; revokeKey?: string } = {}) {
  const r = await trackSession({ ...deviceInfo(), ...extra });
  if (r.revoked) { localStorage.removeItem('chatting:session'); logout(); }
  return r;
}

/** Records this device as a session and signs out if staff or the user revoked it. */
export function useSessionGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const run = () => { if (!document.hidden) checkSession().catch(() => {}); };
    run();
    document.addEventListener('visibilitychange', run);
    const t = setInterval(run, 120_000);
    return () => { document.removeEventListener('visibilitychange', run); clearInterval(t); };
  }, [enabled]);
}
