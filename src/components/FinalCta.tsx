import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Logo from './Logo';
import { useWaitlist, useCtaLabel } from './Waitlist';
import { Reveal, Bubble, scrollTo } from './ui';

const socials = [['X', 'https://x.com'], ['Instagram', 'https://instagram.com'], ['LinkedIn', 'https://linkedin.com']];

export default function FinalCta() {
  const join = useWaitlist();
  const cta = useCtaLabel();
  return (
    <>
      <section id="about" className="section-y mx-auto max-w-4xl px-5 text-center sm:px-6">
        <Reveal>
          <p className="eyebrow">About</p>
          <p className="mt-8 text-3xl font-medium leading-tight tracking-tight sm:text-5xl">We believe the tools we talk through should <span className="text-primary">disappear</span> — leaving only the people on the other side.</p>
        </Reveal>
      </section>
      <section className="relative overflow-hidden px-5 pb-40 pt-16 text-center">
        <Reveal className="mx-auto mb-16 flex max-w-sm flex-col gap-2">
          <Bubble className="w-fit">So… what’s next?</Bubble>
          <Bubble me className="w-fit">Something better.</Bubble>
        </Reveal>
        <Reveal>
          <h2 className="display mx-auto max-w-5xl text-[clamp(3rem,9vw,8rem)]">Your conversations <span className="text-primary">deserve better.</span></h2>
          <p className="mx-auto mt-8 max-w-md text-lg text-muted-foreground">Free to start. Direct messages, groups, threads and communities — all in one calm place.</p>
          <button onClick={() => join('final')} className="focus-ring group mx-auto mt-10 flex h-14 items-center gap-2 rounded-full bg-primary px-9 text-lg font-medium text-primary-foreground transition hover:opacity-90 active:scale-95">{cta} <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></button>
        </Reveal>
      </section>
      <footer className="border-t border-border px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {[['Product', 'product'], ['Features', 'features'], ['About', 'about']].map(([l, id]) => <button key={id} onClick={() => scrollTo(id)} className="focus-ring rounded hover:text-foreground">{l}</button>)}
            <Link to="/privacy" className="focus-ring rounded hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="focus-ring rounded hover:text-foreground">Terms</Link>
          </nav>
          <div className="flex gap-5 text-sm text-muted-foreground">{socials.map(([l, h]) => <a key={l} href={h} target="_blank" rel="noreferrer" className="focus-ring rounded hover:text-foreground">{l}</a>)}</div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-xs text-muted-foreground">© {new Date().getFullYear()} Chatting.</p>
      </footer>
    </>
  );
}
