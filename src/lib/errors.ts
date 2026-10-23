/**
 * Turns anything thrown by an endpoint call (or the browser) into a short, friendly message.
 * Endpoint failures arrive as `API call failed (400): {json}` — we dig the user-facing text out of that.
 */
function find(v: unknown, keys: string[], depth = 0): string | null {
  if (!v || typeof v !== 'object' || depth > 4) return null;
  const o = v as Record<string, unknown>;
  for (const k of keys) if (typeof o[k] === 'string' && (o[k] as string).trim()) return (o[k] as string).trim();
  for (const val of Object.values(o)) { const hit = find(val, keys, depth + 1); if (hit) return hit; }
  return null;
}

const looksTechnical = (s: string) => /(\bat\s+\S+\s+\(|stack|undefined|null|TypeError|ReferenceError|SyntaxError|sql|relation "|column "|uuid|ECONN|fetch|JSON|status code|\{|\})/i.test(s) || s.length > 220;

export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (!raw) return fallback;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) return 'You seem to be offline. Check your connection and try again.';
  const m = raw.match(/^API call failed \((\d+)\):\s*([\s\S]*)$/);
  if (!m) return looksTechnical(raw) ? fallback : raw;
  const status = Number(m[1]);
  let body: unknown = m[2];
  try { body = JSON.parse(m[2]); } catch { /* plain text */ }
  const friendly = typeof body === 'object' ? find(body, ['userFacingMessage']) : null;
  if (friendly) return friendly;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You don’t have permission to do that.';
  if (status === 404) return 'That couldn’t be found — it may have been deleted.';
  if (status === 413) return 'That’s too large to send.';
  if (status === 429) return 'You’re going a bit fast — wait a moment and try again.';
  if (status >= 500) return fallback;
  const msg = typeof body === 'object' ? find(body, ['message', 'error']) : String(body || '');
  return msg && !looksTechnical(msg) ? msg : fallback;
}
