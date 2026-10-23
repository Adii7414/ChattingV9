import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@project/components/lib/utils';

export const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={{ opacity: 0, y: reduce ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }} transition={{ duration: reduce ? 0.3 : 0.8, ease, delay }}>
      {children}
    </motion.div>
  );
}

export function Avatar({ name, hue, size = 32, online }: { name: string; hue: number; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-full font-medium text-background"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 55% 72%)` }}>
      {name[0]}
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />}
    </span>
  );
}

export function Bubble({ me, children, className }: { me?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn('max-w-[78%] px-4 py-2.5 text-[15px] leading-snug',
      me ? 'ml-auto rounded-[20px] rounded-br-[6px] bg-primary text-primary-foreground'
         : 'rounded-[20px] rounded-bl-[6px] bg-secondary text-secondary-foreground', className)}>
      {children}
    </div>
  );
}

export function SectionHead({ eyebrow, title, body, center }: { eyebrow: string; title: ReactNode; body: string; center?: boolean }) {
  return (
    <Reveal className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-4 text-balance text-4xl sm:mt-5 sm:text-6xl lg:text-7xl">{title}</h2>
      <p className={cn('mt-5 max-w-md text-pretty text-base text-muted-foreground sm:mt-6 sm:text-lg', center && 'mx-auto')}>{body}</p>
    </Reveal>
  );
}

export const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
