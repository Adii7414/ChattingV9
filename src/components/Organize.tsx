import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pin } from 'lucide-react';
import { Avatar, SectionHead, Reveal } from './ui';

const tabs = ['All', 'Groups', 'Media', 'Pinned'] as const;
const items = [
  { n: 'Ava Lin', h: 200, m: 'See you at 8 ✦', t: '9:41', g: false, p: true },
  { n: 'Studio', h: 30, m: 'Kai: new cut is up', t: '9:12', g: true, p: false },
  { n: 'Family', h: 120, m: 'Mom: who’s bringing dessert?', t: 'Tue', g: true, p: true },
  { n: 'Noor Haddad', h: 330, m: 'Voice note · 0:42', t: 'Mon', g: false, p: false },
  { n: 'Climbing Crew', h: 260, m: 'Theo: forecast looks clear', t: 'Sun', g: true, p: false },
];
const media = [14, 166, 45, 200, 330, 100];

export default function Organize() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('All');
  const list = items.filter((i) => tab === 'All' || (tab === 'Groups' ? i.g : i.p));
  return (
    <section id="features" className="section-y scroll-mt-20 mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:gap-16">
      <SectionHead eyebrow="Everything in its place" title={<>Order, <span className="text-muted-foreground">without effort.</span></>}
        body="Conversations, groups, shared media and the messages that matter — sorted the moment they arrive. Try the tabs." />
      <Reveal className="glass rounded-[32px] p-4 sm:p-5">
        <div role="tablist" className="relative mb-4 flex rounded-full bg-secondary p-1">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="focus-ring relative flex-1 rounded-full py-2 text-sm font-medium">
              {tab === t && <motion.span layoutId="tab" className="absolute inset-0 rounded-full bg-background" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span className={`relative ${tab === t ? '' : 'text-muted-foreground'}`}>{t}</span>
            </button>
          ))}
        </div>
        <div className="min-h-[340px]">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
              {tab === 'Media' ? (
                <div className="grid grid-cols-3 gap-2">{media.map((h, i) => <div key={i} className="aspect-square rounded-2xl" style={{ background: `linear-gradient(140deg, hsl(${h} 70% 68%), hsl(${h + 30} 40% 22%))` }} />)}</div>
              ) : list.map((i) => (
                <div key={i.n} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-secondary">
                  <Avatar name={i.n} hue={i.h} size={44} />
                  <div className="min-w-0 flex-1"><p className="font-medium">{i.n}</p><p className="truncate text-sm text-muted-foreground">{i.m}</p></div>
                  <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">{i.t}{i.p && <Pin className="h-3 w-3 text-primary" />}</div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </Reveal>
    </section>
  );
}
