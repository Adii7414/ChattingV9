import { Bot, Brush, Dices, Highlighter, Palette, ShieldCheck, SlidersHorizontal, Type } from 'lucide-react';

const ITEMS = [
  { i: Brush, t: 'Communities that look like you', d: 'Fonts, bubble styles, wallpapers, banners and accent colours — set once, seen by every member.' },
  { i: SlidersHorizontal, t: 'Every feature is a switch', d: 'Turn GIFs, uploads, polls, reactions, threads or edits on and off per community.' },
  { i: Bot, t: 'Auto-responders', d: 'Type a trigger like !rules and Chatting replies for you, instantly.' },
  { i: ShieldCheck, t: 'Smarter auto-mod', d: 'Minimum length, caps-lock blocking, mention and emoji limits on top of blocked words and slow mode.' },
  { i: Type, t: 'Read it your way', d: 'Five fonts including an easy-read option, high contrast, square bubbles and a 24-hour clock.' },
  { i: Highlighter, t: 'Richer formatting', d: '==Highlight== and __underline__ join bold, italics, spoilers and code blocks.' },
  { i: Dices, t: 'Playful commands', d: '/roll, /flip, /8ball, /pick, /mock and more — plus new food and sports stickers.' },
  { i: Palette, t: 'Any colour you like', d: 'A full colour picker for your accent, and three new wallpapers: sunset, paper and aurora.' },
];

/** Landing section highlighting how far Chatting can be customised. */
export default function Customize() {
  return (
    <section id="customize" className="section-y mx-auto max-w-6xl px-5 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Make it yours</p>
      <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Change absolutely everything.</h2>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">From the font in your DMs to the rules of a ten-thousand-member community, Chatting bends to fit.</p>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ i: I, t, d }) => (
          <div key={t} className="rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><I className="h-5 w-5" /></span>
            <p className="mt-5 font-semibold">{t}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
