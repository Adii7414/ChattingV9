import { motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';
import { Avatar, Bubble } from './ui';

const script = [
  { me: false, t: 'Are we still on for Saturday?' },
  { me: true, t: 'Always. Bringing the film camera.' },
  { me: false, t: 'Perfect. I found the route —' },
  { me: false, t: 'map', media: true },
  { me: true, t: 'That ridge at sunrise 🌄', react: '🔥' },
  { me: false, t: 'Setting three alarms.' },
];
const chapters = ['Type that breathes.', 'Media, in place.', 'Reactions with feeling.'];

export default function Unfold() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [n, setN] = useState(reduce ? script.length : 1);
  useMotionValueEvent(scrollYProgress, 'change', (v) => { if (!reduce) setN(Math.max(1, Math.min(script.length, Math.ceil(v * (script.length + 0.5))))); });
  const rot = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -4]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [0.92, 1]);
  const chapter = n <= 2 ? 0 : n <= 4 ? 1 : 2;

  return (
    <section id="product" className="relative z-10 bg-background">
      <div id="demo" ref={ref} className="relative h-[300vh]">
        <div className="sticky top-0 z-10 flex min-h-[100svh] items-center overflow-x-clip bg-background px-5 py-20 lg:py-24">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-6 lg:gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="eyebrow leading-normal">Conversations, reimagined</p>
              <h2 className="display mt-3 text-3xl leading-[1.05] sm:text-5xl lg:mt-5 lg:text-6xl xl:text-7xl">Everyday words, <span className="text-muted-foreground">beautifully set.</span></h2>
              <div className="relative mt-4 hidden h-8 overflow-hidden sm:block lg:mt-6">
                {chapters.map((c, i) => (
                  <motion.p key={c} className="absolute text-xl text-muted-foreground" animate={{ y: (i - chapter) * 32, opacity: i === chapter ? 1 : 0 }} transition={{ duration: 0.6 }}>{c}</motion.p>
                ))}
              </div>
              <div className="mt-4 hidden gap-1.5 lg:flex">{chapters.map((c, i) => <span key={c} className={`h-1 rounded-full transition-all duration-500 ${i === chapter ? 'w-10 bg-foreground' : 'w-4 bg-border'}`} />)}</div>
            </div>
            <motion.div style={{ rotateY: rot, scale, transformPerspective: 1400 }} className="glass mx-auto w-full max-w-[460px] rounded-[32px] p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-3 sm:mb-5"><Avatar name="Jun" hue={160} online /><div><p className="text-sm font-semibold">Jun Park</p><p className="text-xs text-muted-foreground">Active now</p></div></div>
              <div className="flex min-h-[240px] flex-col sm:min-h-[300px] [@media(min-height:820px)]:sm:min-h-[340px] justify-end gap-2">
                {script.slice(0, n).map((m, i) => (
                  <motion.div key={i} layout initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="relative">
                    {m.media ? (
                      <div className="relative h-24 w-[72%] sm:h-32 overflow-hidden rounded-[20px] rounded-bl-[6px] bg-secondary">
                        <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="h-full w-full"><path d="M0 80 L40 50 L70 65 L110 25 L150 55 L200 35 L200 100 L0 100Z" fill="hsl(var(--muted))" /><path d="M10 85 C60 70 90 40 140 45 S190 30 195 28" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeDasharray="4 4" /><circle cx="195" cy="28" r="4" fill="hsl(var(--accent))" /></svg>
                        <span className="absolute bottom-2 left-3 text-xs font-medium">Ridge trail · 6.2 km</span>
                      </div>
                    ) : <Bubble me={m.me}>{m.t}</Bubble>}
                    {m.react && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }} className="absolute -bottom-3 right-3 grid h-7 w-7 place-items-center rounded-full bg-card text-sm ring-2 ring-background">{m.react}</motion.span>}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
