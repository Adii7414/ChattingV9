import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, MessageCircle, Sparkles, Users } from 'lucide-react';
import { loginWithRedirect } from 'zitejs/auth';
import Logo from '../components/Logo';

const PERKS = [
  { i: MessageCircle, t: 'DMs, groups and threads' },
  { i: Users, t: 'Communities you can fully customise' },
  { i: Lock, t: 'No password to remember, just a secure email link' },
];

/** Chatting-branded sign-in screen shown before the secure email step. */
export default function SignIn() {
  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <Link to="/" className="relative w-fit"><Logo /></Link>
        <div className="relative">
          <p className="text-5xl font-semibold leading-tight tracking-tight">Where your people<br />already are.</p>
          <ul className="mt-10 space-y-4">
            {PERKS.map(({ i: I, t }) => <li key={t} className="flex items-center gap-3 text-primary-foreground/90"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/15"><I className="h-4 w-4" /></span>{t}</li>)}
          </ul>
        </div>
        <p className="relative text-sm text-primary-foreground/70">© {new Date().getFullYear()} Chatting</p>
      </div>
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
          <Link to="/" className="mb-10 block w-fit lg:hidden"><Logo /></Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5" /> Welcome to Chatting</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in or create an account</h1>
          <p className="mt-2 text-muted-foreground">Enter your email on the next screen and we’ll send you a one-tap sign-in link. New here? The same link creates your account.</p>
          <button onClick={() => loginWithRedirect()} className="focus-ring mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98]">
            Continue with email <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-6 text-center text-xs text-muted-foreground">By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
        </motion.div>
      </div>
    </div>
  );
}
