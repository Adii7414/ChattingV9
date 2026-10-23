import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Laptop, Smartphone, Tablet, Watch } from 'lucide-react';
import { SectionHead, Bubble } from './ui';

const devices = [
  { k: 'Phone', Icon: Smartphone, w: 'w-[230px] h-[400px] rounded-[40px]' },
  { k: 'Tablet', Icon: Tablet, w: 'w-[420px] h-[300px] rounded-[32px]' },
  { k: 'Laptop', Icon: Laptop, w: 'w-[560px] h-[300px] sm:h-[340px] rounded-[20px]' },
  { k: 'Watch', Icon: Watch, w: 'w-[180px] h-[210px] rounded-[48px]' },
] as const;

export default function Everywhere() {
  const [d, setD] = useState(0);
  const dev = devices[d];
  return (
    <section className="section-y overflow-hidden bg-card">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead center eyebrow="Everywhere" title={<>One conversation. <span className="text-muted-foreground">Every screen.</span></>}
          body="Start on your phone, pick it up on your laptop. Everything stays in sync, instantly." />
        <div className="mx-auto mt-12 flex w-fit gap-1 rounded-full bg-secondary p-1">
          {devices.map(({ k, Icon }, i) => (
            <button key={k} onClick={() => setD(i)} className="focus-ring relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
              {d === i && <motion.span layoutId="dev" className="absolute inset-0 rounded-full bg-background shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <Icon className={`relative h-4 w-4 ${d === i ? '' : 'text-muted-foreground'}`} />
              <span className={`relative hidden sm:inline ${d === i ? '' : 'text-muted-foreground'}`}>{k}</span>
            </button>
          ))}
        </div>
        <div className="mt-14 flex h-[440px] items-center justify-center">
          <motion.div layout transition={{ type: 'spring', stiffness: 160, damping: 24 }}
            className={`max-w-full border-[10px] border-secondary bg-background p-4 shadow-lg ring-1 ring-border ${dev.w}`}>
            <AnimatePresence mode="wait">
              <motion.div key={dev.k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex h-full flex-col justify-end gap-2 overflow-hidden">
                {dev.k !== 'Watch' && <Bubble>Did you get the photos?</Bubble>}
                <Bubble me>Just opened them on my {dev.k.toLowerCase()}.</Bubble>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
