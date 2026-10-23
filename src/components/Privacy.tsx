import { useState } from 'react';
import { motion } from 'framer-motion';
import { EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { SectionHead, Reveal } from './ui';

const points = [
  { Icon: Lock, t: 'Members only', b: 'Every message and file is encrypted in transit and at rest, and only people in the conversation can open it.' },
  { Icon: EyeOff, t: 'No ads. No tracking.', b: 'We never read, sell or profile your conversations. Ever.' },
  { Icon: KeyRound, t: 'Passwordless sign-in', b: 'A one-time link to your inbox. No passwords to leak.' },
  { Icon: ShieldCheck, t: 'You set the rules', b: 'Hide your online status, turn off read receipts, and delete or edit what you send.' },
];

function Cipher() {
  const [locked, setLocked] = useState(true);
  const plain = 'See you at 8.';
  const cipher = 'x9#Fq2!pL7vR@';
  return (
    <button onClick={() => setLocked(!locked)} className="focus-ring glass w-full rounded-[32px] p-8 text-left">
      <p className="text-sm text-muted-foreground">{locked ? 'What everyone else sees' : 'What Ava sees'}</p>
      <p className="mt-4 font-mono text-3xl tracking-tight sm:text-4xl">
        {plain.split('').map((c, i) => (
          <motion.span key={`${locked}-${i}`} className="inline-block" animate={{ opacity: [0.2, 1] }} transition={{ delay: i * 0.03, duration: 0.3 }} >
            {locked ? cipher[i] : c === ' ' ? '\u00a0' : c}
          </motion.span>
        ))}
      </p>
      <div className="mt-8 flex items-center gap-2 text-sm font-medium text-primary">
        <Lock className="h-4 w-4" /> {locked ? 'Tap to decrypt as the recipient' : 'Tap to lock again'}
      </div>
    </button>
  );
}

export default function Privacy() {
  return (
    <section id="privacy" className="section-y mx-auto max-w-6xl scroll-mt-20 px-5 sm:px-6">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        <SectionHead eyebrow="Privacy" title={<>Yours. <span className="text-muted-foreground">Only yours.</span></>}
          body="Privacy isn’t a setting in Chatting. It’s the foundation everything else is built on." />
        <Reveal delay={0.1}><Cipher /></Reveal>
      </div>
      <div className="mt-20 grid gap-px overflow-hidden rounded-[28px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {points.map(({ Icon, t, b }, i) => (
          <Reveal key={t} delay={i * 0.08} className="h-full bg-background p-7">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-5 font-semibold">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
