/**
 * End-to-end encryption for direct messages.
 * Each browser holds a private P-256 key that never leaves the device (stored non-extractable in IndexedDB).
 * Only the public key is published. Both people derive the same AES-256-GCM key via ECDH, so the
 * server only ever stores ciphertext: `e2e1.<senderPub>.<recipientPub>.<iv>.<ciphertext>`.
 */
import { e2eKeys } from 'zitejs/api';

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const ALG = { name: 'ECDH', namedCurve: 'P-256' } as const;

type Identity = { priv: CryptoKey; pub: string };
let identity: Promise<Identity> | null = null;
let identityFor = '';

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('chatting-e2e', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('keys');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const q = fn(d.transaction('keys', mode).objectStore('keys')); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); });
}

async function loadIdentity(userId: string): Promise<Identity> {
  const saved = await idb<Identity | undefined>('readonly', (s) => s.get(userId));
  if (saved?.priv && saved.pub) return saved;
  const pair = await crypto.subtle.generateKey(ALG, false, ['deriveKey']);
  const pub = b64(await crypto.subtle.exportKey('raw', pair.publicKey));
  const id = { priv: pair.privateKey, pub };
  await idb('readwrite', (s) => s.put(id, userId));
  return id;
}

export function getIdentity(userId: string) {
  if (!identity || identityFor !== userId) { identityFor = userId; identity = loadIdentity(userId); }
  return identity;
}

/** Creates this device's key if needed and makes sure the published key matches it. */
export async function initE2E(userId: string) {
  const { pub } = await getIdentity(userId);
  const { publicKey } = await e2eKeys({ action: 'get', userId });
  if (publicKey !== pub) await e2eKeys({ action: 'publish', publicKey: pub });
}

const partnerKeys = new Map<string, Promise<string | null>>();
export function partnerKey(userId: string, fresh = false) {
  if (fresh || !partnerKeys.has(userId)) partnerKeys.set(userId, e2eKeys({ action: 'get', userId }).then((r) => r.publicKey).catch(() => null));
  return partnerKeys.get(userId)!;
}

const shared = new Map<string, Promise<CryptoKey>>();
async function sharedKey(me: string, theirPub: string) {
  const k = `${me}|${theirPub}`;
  if (!shared.has(k)) shared.set(k, (async () => {
    const { priv } = await getIdentity(me);
    const pub = await crypto.subtle.importKey('raw', unb64(theirPub), ALG, false, []);
    return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  })());
  return shared.get(k)!;
}

export const isSealed = (body: string) => body.startsWith('e2e1.');

export async function encrypt(me: string, theirPub: string, text: string) {
  const { pub } = await getIdentity(me);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sharedKey(me, theirPub), new TextEncoder().encode(text));
  return `e2e1.${pub}.${theirPub}.${b64(iv)}.${b64(ct)}`;
}

export const UNREADABLE = '🔒 Waiting for this message. It was encrypted for another device.';
export async function decrypt(me: string, body: string) {
  const [, from, to, iv, ct] = body.split('.');
  const { pub } = await getIdentity(me);
  const other = pub === from ? to : pub === to ? from : null;
  if (!other || !ct) return UNREADABLE;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await sharedKey(me, other), unb64(ct));
    return new TextDecoder().decode(pt);
  } catch { return UNREADABLE; }
}

/** WhatsApp-style 60-digit security code: 30 digits per person, ordered by user id so both sides match. */
async function fingerprint(userId: string, pub: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-512', new TextEncoder().encode(`${userId}:${pub}`)));
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    let n = 0;
    for (let j = 0; j < 5; j++) n = (n * 256 + h[i * 5 + j]) % 100000;
    out.push(String(n).padStart(5, '0'));
  }
  return out;
}
export async function securityCode(a: { id: string; pub: string }, b: { id: string; pub: string }) {
  const [x, y] = [a, b].sort((p, q) => p.id.localeCompare(q.id));
  const groups = [...(await fingerprint(x.id, x.pub)), ...(await fingerprint(y.id, y.pub))];
  return { groups, qr: `chatting-e2e:1:${x.id}:${x.pub}:${y.id}:${y.pub}` };
}

const vKey = (me: string, them: string) => `e2e-verified:${me}:${them}`;
const sKey = (me: string, them: string) => `e2e-seen:${me}:${them}`;
export const isVerified = (me: string, them: string, pub: string) => localStorage.getItem(vKey(me, them)) === pub;
export const setVerified = (me: string, them: string, pub: string | null) => (pub ? localStorage.setItem(vKey(me, them), pub) : localStorage.removeItem(vKey(me, them)));
/** Returns true when the partner's key differs from the last one this device saw (they reinstalled or switched device). */
export function noteKey(me: string, them: string, pub: string) {
  const prev = localStorage.getItem(sKey(me, them));
  localStorage.setItem(sKey(me, them), pub);
  return !!prev && prev !== pub;
}
