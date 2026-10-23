import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { useWaitlist, useCtaLabel } from './Waitlist';
import { scrollTo, ease } from './ui';

const links = [['Product', 'product'], ['Features', 'features'], ['Privacy', 'privacy'], ['FAQ', 'faq']] as const;

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const join = useWaitlist();
  const cta = useCtaLabel();
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 24);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const go = (id: string) => { setOpen(false); scrollTo(id); };

  return (
    <header className={`fixed inset-x-0 top-0 z-50 flex justify-center px-4 pb-3 pt-4 transition-colors duration-500 ${scrolled ? 'bg-gradient-to-b from-background from-30% via-background/70 to-transparent' : ''}`}>
      <nav className={`flex h-14 w-full max-w-5xl items-center justify-between rounded-full px-3 pl-5 transition-all duration-500 ${scrolled || open ? 'glass' : ''}`}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="focus-ring rounded-md" aria-label="Chatting home"><Logo /></button>
        <div className="hidden items-center gap-1 md:flex">
          {links.map(([l, id]) => (
            <button key={id} onClick={() => go(id)} className="focus-ring rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground">{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button onClick={() => join('nav')} className="focus-ring hidden h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90 active:scale-95 sm:block">{cta}</button>
          <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} className="focus-ring grid h-10 w-10 place-items-center rounded-full md:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease }}
            className="glass absolute inset-x-4 top-[84px] rounded-3xl p-3 md:hidden">
            {links.map(([l, id], i) => (
              <motion.button key={id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                onClick={() => go(id)} className="focus-ring block w-full rounded-2xl px-4 py-4 text-left text-2xl font-medium tracking-tight">{l}</motion.button>
            ))}
            <button onClick={() => { setOpen(false); join('nav-mobile'); }} className="focus-ring mt-2 h-14 w-full rounded-2xl bg-foreground font-medium text-background">{cta}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
