import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Avatar, Bubble, SectionHead, Reveal } from './ui';

const people = [['Maya', 14, 'Typing'], ['Kai', 166, 'Here'], ['Theo', 45, 'Read 2m ago'], ['Noor', 330, 'Away']] as const;

export default function Presence() {
  const reduce = useReducedMotion();
  const [waved, setWaved] = useState(false);
  return (
    <section className="section-y relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5"><SectionHead center eyebrow="Presence that feels real" title={<>Together, <span className="text-muted-foreground">even apart.</span></>} body="Quiet signals tell you who’s here, who’s reading and who’s about to reply — never louder than the conversation." /></div>
      <Reveal className="mx-auto mt-14 grid sm:mt-20 grid max-w-5xl gap-6 px-5 md:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-row flex-wrap justify-center gap-6 md:flex-col md:justify-center">
          {people.map(([n, h, s], i) => (
            <div key={n} className="flex items-center gap-4">
              <div className="relative">
                {i < 2 && !reduce && <motion.span className="absolute inset-0 rounded-full border border-primary" animate={{ scale: [1, 1.5], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.6 }} />}
                <Avatar name={n} hue={h} size={52} online={i < 2} />
              </div>
              <div><p className="font-medium">{n}</p><p className={`text-sm ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>{s}</p></div>
            </div>
          ))}
        </div>
        <div className="glass rounded-[32px] p-5 sm:p-6">
          <p className="mb-5 text-sm font-semibold">Climbing Crew <span className="font-normal text-muted-foreground">· 4 here</span></p>
          <div className="space-y-2">
            <p className="pl-1 text-xs text-muted-foreground">Theo</p>
            <Bubble>Forecast looks clear for Sunday.</Bubble>
            <Bubble me>I’m in. Kai?</Bubble>
            <p className="pl-1 text-xs text-muted-foreground">Kai</p>
            <Bubble>Only if someone brings coffee ☕</Bubble>
            {waved && <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}><Bubble me className="w-fit bg-transparent text-4xl">👋</Bubble></motion.div>}
            <div className="flex items-center justify-between pt-3">
              <div className="flex -space-x-2">{people.slice(0, 3).map(([n, h]) => <Avatar key={n} name={n} hue={h} size={20} />)}<span className="pl-3 text-xs text-muted-foreground">Seen by 3</span></div>
              <button onClick={() => setWaved((w) => !w)} className="focus-ring rounded-full border border-border px-4 py-1.5 text-sm transition hover:bg-secondary active:scale-95">{waved ? 'Undo wave' : 'Wave 👋'}</button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
