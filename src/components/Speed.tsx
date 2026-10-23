import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { SectionHead, Reveal, Bubble } from './ui';

const msgs = [
  { c: 'Ava Lin', t: 'The restaurant by the water — booked for 8.' },
  { c: 'Studio', t: 'Final cut is in the shared folder.' },
  { c: 'Family', t: 'Flight lands at 6:40, terminal 2.' },
  { c: 'Noor Haddad', t: 'Here’s the address for Saturday.' },
  { c: 'Climbing Crew', t: 'Meet at the trailhead at 6.' },
  { c: 'Ava Lin', t: 'Don’t forget the film camera.' },
];
const convos = ['Ava Lin', 'Studio', 'Family'];

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-primary/25 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default function Speed() {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const hits = msgs.filter((m) => !q || m.t.toLowerCase().includes(q.toLowerCase()) || m.c.toLowerCase().includes(q.toLowerCase()));
  return (
    <section id="demo" className="section-y mx-auto max-w-6xl scroll-mt-20 px-5 sm:px-6">
      <SectionHead eyebrow="Speed without friction" title={<>Find anything. <span className="text-muted-foreground">Instantly.</span></>} body="Search across every conversation as you type, and glide between chats without losing your place." />
      <div className="mt-16 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Reveal className="glass rounded-[32px] p-5">
          <label className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “film”, “Saturday” or “8”" aria-label="Search messages" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
          </label>
          <div className="mt-3 min-h-[300px]">
            <AnimatePresence initial={false}>
              {hits.map((m) => (
                <motion.div key={m.t} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl px-4 py-3 hover:bg-secondary">
                  <p className="text-xs text-muted-foreground"><Highlight text={m.c} q={q} /></p>
                  <p className="mt-0.5"><Highlight text={m.t} q={q} /></p>
                </motion.div>
              ))}
            </AnimatePresence>
            {!hits.length && <p className="px-4 py-10 text-center text-muted-foreground">No messages match “{q}”.</p>}
          </div>
        </Reveal>
        <Reveal delay={0.1} className="glass flex flex-col rounded-[32px] p-5">
          <div className="flex gap-2">{convos.map((c, i) => (
            <button key={c} onClick={() => setActive(i)} className={`focus-ring rounded-full px-3 py-1.5 text-sm transition ${active === i ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>{c.split(' ')[0]}</button>
          ))}</div>
          <div className="relative mt-5 flex-1 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={active} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="space-y-2">
                {msgs.filter((m) => m.c === convos[active]).map((m) => <Bubble key={m.t}>{m.t}</Bubble>)}
                <Bubble me>On it.</Bubble>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
