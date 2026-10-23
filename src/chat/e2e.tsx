import { useEffect, useState } from 'react';
import { useChat, type Conversation } from './store';
import { decrypt, isSealed, isVerified, noteKey, partnerKey, setVerified } from '../lib/e2e';

/** Encryption state for a conversation. Only 1:1 DMs (not groups, channels or official accounts) are end-to-end encrypted. */
export function useE2E(conv?: Conversation | null) {
  const { me } = useChat();
  const them = conv && !conv.isGroup && !conv.communityId && !conv.official ? conv.memberIds.find((id) => id !== me.id) : undefined;
  const [pub, setPub] = useState<string | null | undefined>(undefined);
  const [changed, setChanged] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    setPub(undefined); setChanged(false);
    if (!them) return;
    let on = true;
    partnerKey(them, true).then((k) => {
      if (!on) return;
      setPub(k);
      if (k && noteKey(me.id, them, k)) { setChanged(true); setVerified(me.id, them, null); }
    });
    return () => { on = false; };
  }, [them, me.id]);
  return {
    them, enabled: !!them, theirPub: pub, changed, dismissChanged: () => setChanged(false),
    verified: !!(them && pub && isVerified(me.id, them, pub)),
    setVerified: (v: boolean) => { if (them && pub) { setVerified(me.id, them, v ? pub : null); setTick((t) => t + 1); } },
  };
}

/** Decrypts a single stored message body for display outside the main thread (saved items, shared content). */
export function usePlain(body: string) {
  const { me } = useChat();
  const [text, setText] = useState(isSealed(body) ? '🔒 Encrypted message' : body);
  useEffect(() => {
    if (!isSealed(body)) { setText(body); return; }
    let on = true;
    decrypt(me.id, body).then((t) => on && setText(t));
    return () => { on = false; };
  }, [body, me.id]);
  return text;
}

/** Render-prop wrapper around usePlain. */
export function Plain({ body, children }: { body: string; children: (text: string) => React.ReactNode }) {
  return <>{children(usePlain(body))}</>;
}
