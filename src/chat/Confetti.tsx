import { useEffect, useState } from 'react';

const BITS = ['🎉', '✨', '🎊', '💥', '⭐', '🥳'];

/** Full-screen emoji burst fired by the /confetti command. */
export default function Confetti() {
  const [bursts, setBursts] = useState<number[]>([]);
  useEffect(() => {
    const f = () => { const id = Date.now(); setBursts((b) => [...b, id]); setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 1600); };
    window.addEventListener('chat:confetti', f); return () => window.removeEventListener('chat:confetti', f);
  }, []);
  if (!bursts.length || document.documentElement.classList.contains('reduce-motion')) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      {bursts.map((id) => Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2, d = 160 + Math.random() * 260;
        return (
          <span key={`${id}-${i}`} className="absolute left-1/2 top-2/3 text-2xl"
            style={{ ['--x' as string]: `${Math.cos(a) * d}px`, ['--y' as string]: `${Math.sin(a) * d - 200}px`, ['--r' as string]: `${Math.random() * 720 - 360}deg`, animation: `burst ${1 + Math.random() * 0.5}s cubic-bezier(.2,.7,.3,1) forwards` }}>
            {BITS[i % BITS.length]}
          </span>
        );
      }))}
    </div>
  );
}
