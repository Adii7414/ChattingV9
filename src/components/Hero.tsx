import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, useScroll } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Play, Search, Image as ImageIcon, Mic, CheckCheck } from 'lucide-react';
import { Avatar, Bubble, ease, scrollTo } from './ui';

function Stage() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [14, 4]), { stiffness: 60, damping: 18 });
  const ry = useSpring(useTransform(mx, [-1, 1], [-14, 8]), { stiffness: 60, damping: 18 });
  const onMove = (e: React.PointerEvent) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1); my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const layer = (z: number) => ({ transform: `translateZ(${z}px)`, transformStyle: 'preserve-3d' as const });

  return (
    <div onPointerMove={onMove} onPointerLeave={() => { mx.set(0); my.set(0); }} className="relative mx-auto h-[520px] w-full max-w-6xl sm:h-[600px]" style={{ perspective: 1600 }}>
      <motion.div className="absolute inset-0" style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}>
        {/* conversation list */}
        <div style={layer(-90)} className="glass absolute left-0 top-[6%] hidden w-[240px] rounded-[28px] p-4 lg:block xl:left-[2%] xl:w-[260px]">
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground"><Search className="h-3.5 w-3.5" /> Search</div>
          {[['Ava Lin', 200, 'See you at 8 ✦'], ['Studio', 30, 'Kai: new cut is up'], ['Noor', 330, 'Typing…'], ['Theo', 100, 'Photo']].map(([n, h, m], i) => (
            <div key={n as string} className={`flex items-center gap-3 rounded-2xl p-2.5 ${i === 0 ? 'bg-secondary' : ''}`}>
              <Avatar name={n as string} hue={h as number} size={36} online={i !== 3} />
              <div className="min-w-0"><p className="text-sm font-medium">{n}</p><p className="truncate text-xs text-muted-foreground">{m}</p></div>
            </div>
          ))}
        </div>
        {/* main chat */}
        <div style={layer(0)} className="glass absolute inset-x-0 top-[4%] mx-auto w-[min(92%,440px)] rounded-[32px] p-5">
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <Avatar name="Ava" hue={200} online /><div><p className="text-sm font-semibold">Ava Lin</p><p className="text-xs text-primary">Here now</p></div>
          </div>
          <div className="space-y-2">
            <Bubble>Landed. The light here is unreal.</Bubble>
            <div className="h-36 w-[70%] rounded-[20px] rounded-bl-[6px] bg-[radial-gradient(120%_90%_at_20%_10%,hsl(var(--accent)/0.9),hsl(var(--chart-3)/0.5)_45%,hsl(var(--secondary))_100%)]" />
            <Bubble me>Send me everything.</Bubble>
            <Bubble me>Dinner at 8? I booked the place by the water.</Bubble>
            <div className="flex gap-1 px-2 pt-1">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" animate={reduce ? {} : { opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }} />)}</div>
          </div>
        </div>
        {/* group typing */}
        <div style={layer(40)} className="glass absolute right-0 top-[8%] hidden w-[250px] rounded-[24px] p-4 lg:block xl:right-[2%]">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Weekend crew</p><span className="text-xs text-muted-foreground">5 members</span></div>
          <div className="mt-3 flex -space-x-2">{[30, 200, 330, 100, 260].map((h, i) => <Avatar key={h} name={'KANTR'[i]} hue={h} size={28} />)}</div>
          <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Kai and Noor</span> are typing…</p>
        </div>
        {/* voice note */}
        <div style={layer(100)} className="glass absolute bottom-[10%] left-[1%] hidden w-[250px] items-center gap-3 rounded-full p-2 pr-4 lg:flex xl:left-[5%]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Mic className="h-4 w-4" /></span>
          <div className="flex h-8 flex-1 items-center gap-[3px]">{[6, 14, 22, 12, 26, 18, 9, 20, 28, 14, 8, 18, 24, 10, 16, 6].map((h, i) => (
            <motion.span key={i} className="w-[3px] rounded-full bg-foreground/70" style={{ height: h }} animate={reduce ? {} : { scaleY: [1, 0.45, 1] }} transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.07 }} />
          ))}</div>
          <span className="font-mono text-xs text-muted-foreground">0:14</span>
        </div>
        {/* read receipt */}
        <div style={layer(60)} className="glass absolute left-[3%] top-[62%] hidden items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium xl:flex">
          <CheckCheck className="h-4 w-4 text-primary" /> Read 9:41 PM
        </div>
        {/* floating reaction */}
        <div style={layer(120)} className="glass absolute right-[1%] top-[44%] hidden gap-1 rounded-full p-1.5 text-xl lg:flex xl:right-[8%]">
          {['❤️', '😂', '🔥', '👏'].map((e, i) => <span key={e} className={`grid h-10 w-10 place-items-center rounded-full ${i === 0 ? 'bg-secondary' : ''}`}>{e}</span>)}
        </div>
        {/* media chip */}
        <div style={layer(70)} className="glass absolute bottom-[6%] right-0 hidden items-center gap-3 rounded-2xl p-3 pr-5 lg:flex xl:right-[2%]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground"><ImageIcon className="h-4 w-4" /></span>
          <div><p className="text-sm font-medium">12 photos shared</p><p className="text-xs text-muted-foreground">Lisbon · just now</p></div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const o = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={ref} className="relative overflow-hidden px-5 pb-16 pt-28 sm:pb-24 sm:pt-40 lg:pt-44">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-10%] h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.12),transparent)]" />
      <motion.div style={{ y, opacity: o }} className="relative mx-auto max-w-4xl text-center">
        <motion.h1 initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.2, ease, delay: 0.1 }}
          className="display text-[clamp(2.75rem,9vw,7.5rem)]">A new dimension <span className="text-primary">of conversation.</span></motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease, delay: 0.35 }}
          className="mx-auto mt-7 max-w-lg text-lg text-muted-foreground sm:text-xl">Messages, people and every conversation you care about — brought together in one calm, spatial experience.</motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease, delay: 0.5 }} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={() => scrollTo('product')} className="focus-ring group flex h-12 items-center gap-2 rounded-full bg-foreground px-7 font-medium text-background transition active:scale-95">Explore Chatting <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></button>
          <button onClick={() => scrollTo('demo')} className="focus-ring flex h-12 items-center gap-2 rounded-full border border-border px-7 font-medium transition hover:bg-secondary active:scale-95"><Play className="h-3.5 w-3.5 fill-current" /> See it in action</button>
        </motion.div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 80, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1.6, ease, delay: 0.4 }} className="mt-16">
        <Stage />
      </motion.div>
    </section>
  );
}
