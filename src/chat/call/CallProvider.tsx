import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { call as callApi, type CallOutputType } from 'zitejs/api';
import { useChat } from '../store';
import { errorMessage } from '../../lib/errors';

/**
 * Voice/video calls. Media flows directly between devices (a full mesh of WebRTC connections),
 * encrypted with DTLS-SRTP keys only the participants hold — the server only relays the handshake.
 * Everyone uses one certificate per call, so all participants can derive the same privacy code.
 */
const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

export type Participant = CallOutputType['participants'][number];
type Peer = { pc: RTCPeerConnection; ice: RTCIceCandidateInit[]; stream: MediaStream };
export type CallState = {
  conversationId: string; video: boolean; startedAt: number;
  participants: Participant[]; remote: Record<string, MediaStream>; states: Record<string, RTCPeerConnectionState>;
  local: MediaStream | null; muted: boolean; camera: boolean; screen: boolean; privacyCode: string[] | null;
};
type Ctx = {
  call: CallState | null;
  start: (conversationId: string, video: boolean) => Promise<void>;
  leave: () => void;
  toggleMute: () => void; toggleCamera: () => Promise<void>; toggleScreen: () => Promise<void>;
};
const CallCtx = createContext<Ctx | null>(null);
export const useCall = () => useContext(CallCtx)!;

const fp = (sdp?: string) => sdp?.match(/a=fingerprint:\S+ (\S+)/)?.[1] ?? null;

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { me } = useChat();
  const [call, setCall] = useState<CallState | null>(null);
  const s = useRef({
    cid: '', peers: new Map<string, Peer>(), early: new Map<string, RTCIceCandidateInit[]>(), after: 0, alive: false,
    audio: null as MediaStreamTrack | null, cam: null as MediaStreamTrack | null, scr: null as MediaStreamTrack | null,
    muted: false, camera: false, cert: null as RTCCertificate | null,
  });
  const patch = (p: Partial<CallState> | ((c: CallState) => Partial<CallState>)) => setCall((c) => (c ? { ...c, ...(typeof p === 'function' ? p(c) : p) } : c));

  const videoTrack = () => s.current.scr ?? (s.current.camera ? s.current.cam : null);
  const localStream = () => new MediaStream([s.current.audio, videoTrack()].filter(Boolean) as MediaStreamTrack[]);
  const attach = (pc: RTCPeerConnection) => {
    for (const t of pc.getTransceivers()) {
      const kind = t.receiver.track.kind;
      t.direction = 'sendrecv';
      t.sender.replaceTrack(kind === 'audio' ? s.current.audio : videoTrack()).catch(() => {});
    }
  };
  const refreshVideo = () => {
    for (const p of s.current.peers.values()) for (const t of p.pc.getTransceivers()) if (t.receiver.track.kind === 'video') t.sender.replaceTrack(videoTrack()).catch(() => {});
    patch({ local: localStream() });
  };
  const send = (to: string, kind: string, payload: unknown) => callApi({ action: 'signal', conversationId: s.current.cid, to, kind, payload: JSON.stringify(payload) }).catch(() => {});

  const computeCode = async () => {
    const mine = s.current.cert?.getFingerprints?.()[0]?.value;
    const theirs = [...s.current.peers.values()].map((p) => fp(p.pc.remoteDescription?.sdp)).filter(Boolean) as string[];
    if (!mine || !theirs.length) return patch({ privacyCode: null });
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode([mine, ...theirs].map((x) => x.toUpperCase()).sort().join('|'))));
    const groups: string[] = [];
    for (let i = 0; i < 6; i++) { let n = 0; for (let j = 0; j < 5; j++) n = (n * 256 + h[i * 5 + j]) % 100000; groups.push(String(n).padStart(5, '0')); }
    patch({ privacyCode: groups });
  };

  const drop = (uid: string) => {
    const p = s.current.peers.get(uid);
    if (!p) return;
    p.pc.close(); s.current.peers.delete(uid);
    patch((c) => { const remote = { ...c.remote }; delete remote[uid]; const states = { ...c.states }; delete states[uid]; return { remote, states }; });
    computeCode();
  };

  const makePeer = (uid: string) => {
    drop(uid);
    const pc = new RTCPeerConnection({ iceServers: ICE, certificates: s.current.cert ? [s.current.cert] : undefined });
    const peer: Peer = { pc, ice: s.current.early.get(uid) ?? [], stream: new MediaStream() };
    s.current.early.delete(uid);
    s.current.peers.set(uid, peer);
    pc.onicecandidate = (e) => { if (e.candidate) send(uid, 'ice', e.candidate.toJSON()); };
    pc.ontrack = (e) => { peer.stream.addTrack(e.track); patch((c) => ({ remote: { ...c.remote, [uid]: new MediaStream(peer.stream.getTracks()) } })); e.track.onunmute = () => patch((c) => ({ remote: { ...c.remote, [uid]: new MediaStream(peer.stream.getTracks()) } })); };
    pc.onconnectionstatechange = () => {
      patch((c) => ({ states: { ...c.states, [uid]: pc.connectionState } }));
      if (pc.connectionState === 'connected') computeCode();
      if (pc.connectionState === 'failed' && s.current.peers.get(uid)?.pc === pc) drop(uid); // the initiator reconnects on the next tick
    };
    return peer;
  };
  const flush = async (p: Peer) => { for (const c of p.ice.splice(0)) await p.pc.addIceCandidate(c).catch(() => {}); };

  const offerTo = async (uid: string) => {
    const p = makePeer(uid);
    p.pc.addTransceiver('audio', { direction: 'sendrecv' });
    p.pc.addTransceiver('video', { direction: 'sendrecv' });
    attach(p.pc);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    send(uid, 'offer', p.pc.localDescription);
  };

  const onSignal = async (sig: CallOutputType['signals'][number]) => {
    const data = JSON.parse(sig.payload);
    if (sig.kind === 'offer') {
      const p = makePeer(sig.from);
      await p.pc.setRemoteDescription(data);
      attach(p.pc);
      await p.pc.setLocalDescription(await p.pc.createAnswer());
      send(sig.from, 'answer', p.pc.localDescription);
      await flush(p);
    } else if (sig.kind === 'answer') {
      const p = s.current.peers.get(sig.from);
      if (p && p.pc.signalingState === 'have-local-offer') { await p.pc.setRemoteDescription(data); await flush(p); }
    } else if (sig.kind === 'ice') {
      const p = s.current.peers.get(sig.from);
      if (p?.pc.remoteDescription) await p.pc.addIceCandidate(data).catch(() => {});
      else if (p) p.ice.push(data);
      else s.current.early.set(sig.from, [...(s.current.early.get(sig.from) ?? []), data]);
    }
  };

  const tick = async () => {
    const st = s.current;
    const r = await callApi({ action: 'poll', conversationId: st.cid, after: st.after, muted: st.muted, camera: !!videoTrack(), screen: !!st.scr });
    if (!st.alive) return;
    for (const sig of r.signals) { st.after = Math.max(st.after, sig.seq); await onSignal(sig).catch(() => {}); }
    const others = r.participants.filter((p) => p.userId !== me.id);
    for (const uid of st.peers.keys()) if (!others.some((o) => o.userId === uid)) drop(uid);
    // The person with the "smaller" id starts each connection, so two people never both offer.
    for (const o of others) if (!st.peers.has(o.userId) && me.id < o.userId) await offerTo(o.userId).catch(() => {});
    patch({ participants: r.participants });
  };

  const stopAll = () => {
    const st = s.current;
    st.alive = false;
    for (const uid of [...st.peers.keys()]) { st.peers.get(uid)?.pc.close(); st.peers.delete(uid); }
    [st.audio, st.cam, st.scr].forEach((t) => t?.stop());
    st.audio = st.cam = st.scr = null;
  };

  const leave = useCallback(() => {
    const cid = s.current.cid;
    stopAll();
    setCall(null);
    if (cid) callApi({ action: 'leave', conversationId: cid }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (conversationId: string, video: boolean) => {
    if (s.current.alive) { if (s.current.cid === conversationId) return; leave(); }
    let media: MediaStream;
    try { media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: 1280, height: 720 } : false }); }
    catch {
      if (!video) { toast.error('Chatting needs microphone access to call. Allow it in your browser settings.'); return; }
      try { media = await navigator.mediaDevices.getUserMedia({ audio: true }); toast('Camera unavailable — joining with voice only'); video = false; }
      catch { toast.error('Chatting needs microphone access to call. Allow it in your browser settings.'); return; }
    }
    const st = s.current;
    Object.assign(st, { cid: conversationId, after: 0, alive: true, muted: false, camera: video, audio: media.getAudioTracks()[0] ?? null, cam: media.getVideoTracks()[0] ?? null, scr: null });
    st.cert = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' } as EcKeyGenParams);
    setCall({ conversationId, video, startedAt: Date.now(), participants: [], remote: {}, states: {}, local: localStream(), muted: false, camera: video, screen: false, privacyCode: null });
    try {
      const r = await callApi({ action: 'join', conversationId, video });
      patch({ participants: r.participants });
    } catch (e) { toast.error(errorMessage(e, 'Couldn’t join the call')); stopAll(); setCall(null); return; }
    (async () => { while (st.alive && st.cid === conversationId) { await tick().catch(() => {}); await new Promise((r) => setTimeout(r, 900)); } })();
  };

  const toggleMute = () => { const st = s.current; st.muted = !st.muted; if (st.audio) st.audio.enabled = !st.muted; patch({ muted: st.muted }); };
  const toggleCamera = async () => {
    const st = s.current;
    if (!st.camera && !st.cam) {
      try { st.cam = (await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })).getVideoTracks()[0]; }
      catch { toast.error('Couldn’t turn on your camera'); return; }
    }
    st.camera = !st.camera;
    if (!st.camera) { st.cam?.stop(); st.cam = null; }
    patch({ camera: st.camera }); refreshVideo();
  };
  const toggleScreen = async () => {
    const st = s.current;
    if (st.scr) { st.scr.stop(); st.scr = null; patch({ screen: false }); refreshVideo(); return; }
    try {
      const d = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      st.scr = d.getVideoTracks()[0];
      st.scr.onended = () => { if (st.scr) { st.scr = null; patch({ screen: false }); refreshVideo(); } };
      patch({ screen: true }); refreshVideo();
    } catch { /* cancelled */ }
  };

  useEffect(() => {
    const bye = () => leave();
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [leave]);

  return <CallCtx.Provider value={{ call, start, leave, toggleMute, toggleCamera, toggleScreen }}>{children}</CallCtx.Provider>;
}
