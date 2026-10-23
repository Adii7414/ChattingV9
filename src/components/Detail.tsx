import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Copy, Pin, Forward, Check } from 'lucide-react';
import { SectionHead, Reveal } from './ui';

const actions = [[Reply, 'Reply'], [Copy, 'Copy'], [Pin, 'Pin'], [Forward, 'Forward']] as const;
const notes = [['Corner radius', '20 / 6 — the tail points to its speaker'], ['Type', '15px, tuned leading for long and short lines'], ['States', 'Sending · delivered · read, in one quiet glyph']];

export default function Detail() {
  const [menu, setMenu] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <section className="section-y mx-auto max-w-6xl px-5 sm:px-6">
      <SectionHead center eyebrow="Designed down to the last detail" title={<>Every pixel, <span className="text-muted-foreground">considered.</span></>} body="Up close, the craft shows. Tap the message to open its actions." />
      <Reveal className="mt-20 grid items-center gap-16 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative flex min-h-[380px] items-center justify-center rounded-[32px] border border-border bg-card p-6 pb-56 sm:rounded-[40px] sm:p-8 sm:pb-8 lg:pb-8">
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} className="focus-ring max-w-xs rounded-[28px] rounded-br-[8px] bg-primary px-6 py-4 text-left text-xl leading-snug text-primary-foreground transition active:scale-[0.98] sm:text-2xl">
              Let’s make it unforgettable.
              <span className="mt-2 flex items-center justify-end gap-1 text-xs opacity-60">9:41 <Check className="h-3 w-3" /><Check className="-ml-2 h-3 w-3" /></span>
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, scale: 0.9, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="glass absolute right-0 top-full z-10 mt-3 w-48 origin-top-right rounded-2xl p-1.5">
                  {actions.map(([I, l]) => (
                    <button key={l} onClick={() => setPicked(l)} className="focus-ring flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-secondary">
                      {l} {picked === l ? <Check className="h-4 w-4 text-primary" /> : <I className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <ol className="space-y-10">
          {notes.map(([t, d], i) => (
            <li key={t} className="flex gap-6 border-t border-border pt-6">
              <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
              <div><p className="text-xl font-medium tracking-tight">{t}</p><p className="mt-1 text-muted-foreground">{d}</p></div>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}
