import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';

const UPDATED = '16 October 2026';
type Block = { h: string; p?: string[]; list?: string[] };

const privacy: Block[] = [
  { h: 'Who we are', p: ['Chatting (“we”, “us”) provides the Chatting messaging service at this website. This policy explains what personal data we collect when you use Chatting, why, and the choices you have.'] },
  { h: 'What we collect', list: [
    'Account details — your email address (used to sign you in with a one-time link), and the first name, last name and profile photo you choose to add.',
    'Profile details you add — bio, pronouns and status (emoji and text).',
    'Content you send — messages, thread replies, edits, emoji reactions, and the photos and files you attach.',
    'Conversation data — the direct messages, groups, channels and communities you create or join, their names, descriptions and emoji, and who is a member or admin.',
    'Activity signals — when you were last active (used to show the green “online” dot) and when you last read each conversation (used for unread counts and read receipts).',
    'Your settings — online-status visibility, read-receipt preference and “Enter to send”. Your light/dark theme choice is stored only in your browser.',
    'Technical data — basic logs (such as request times and errors) needed to operate, secure and debug the service.',
  ] },
  { h: 'What we don’t collect', list: ['We don’t show ads or use advertising trackers.', 'We don’t sell, rent or trade your personal data.', 'We don’t read your conversations for marketing or profiling.'] },
  { h: 'How we use it', list: [
    'To run Chatting: deliver messages and files, show conversations, unread counts, presence and read receipts.',
    'To sign you in and keep your account secure.',
    'To prevent abuse, enforce our Terms and fix problems.',
    'To send essential service emails, such as sign-in links. We don’t send marketing email without asking.',
  ] },
  { h: 'Who can see what', list: [
    'Messages and files are visible to the members of the conversation they were sent in. Anyone who joins a community channel can see its earlier messages.',
    'Your name, photo, email, bio, pronouns and status are visible to people you share a conversation or community with.',
    'If you turn off “Show when I’m online”, others won’t see your online dot or last-seen time. If you turn off “Send read receipts”, others won’t see when you’ve read their messages.',
    'Public communities, including their name, emoji, description and member count, can be found by any signed-in user.',
  ] },
  { h: 'Legal basis (EEA/UK users)', p: ['We process your data to perform our contract with you (providing the service), for our legitimate interests (security, abuse prevention and improving reliability), and to comply with legal obligations.'] },
  { h: 'Service providers', p: ['We use carefully selected providers to host the app, store data and files, and send sign-in emails. They process data only on our instructions. Data is encrypted in transit (HTTPS) and at rest.'] },
  { h: 'Retention and deletion', p: ['We keep your data while your account is active. You can edit or delete your own messages at any time; deleted messages are removed for everyone. If you leave a group or community, messages you already sent stay visible to its members. To delete your account and profile, contact us; we’ll remove them within 30 days, except where we must keep data by law.'] },
  { h: 'Your rights', p: ['Depending on where you live, you may have the right to access, correct, export or delete your personal data, or to object to or restrict certain processing. You can update most of your profile in Profile & settings. For anything else, contact us and we’ll respond within 30 days. You may also complain to your local data protection authority.'] },
  { h: 'Children', p: ['Chatting isn’t meant for children under 13 (or the minimum age in your country). We don’t knowingly collect their data.'] },
  { h: 'Changes', p: ['If we make material changes to this policy, we’ll tell you in the app before they take effect.'] },
  { h: 'Contact', p: ['Questions or requests: privacy@chatting.app'] },
];

const terms: Block[] = [
  { h: 'Agreement', p: ['By creating an account or using Chatting, you agree to these Terms and our Privacy Policy. If you don’t agree, please don’t use the service.'] },
  { h: 'Your account', list: ['You must be at least 13 (or the minimum age in your country).', 'Give accurate information and keep access to your email account secure — anyone who controls your inbox can sign in as you.', 'You’re responsible for activity on your account.'] },
  { h: 'Your content', p: ['You own the messages and files you send. You give us a limited licence to store, process and deliver that content to the people you send it to, only to provide the service. You confirm you have the right to share whatever you upload.'] },
  { h: 'Acceptable use', p: ['Don’t use Chatting to:'], list: [
    'Harass, threaten, bully or impersonate others, or promote violence or hatred.',
    'Share illegal content, including child sexual abuse material, or content that infringes someone else’s rights.',
    'Send spam, scams, phishing or malware.',
    'Scrape the service, try to get around security, or disrupt it for others.',
  ] },
  { h: 'Groups and communities', p: ['People who create a group or community, and admins they appoint, can rename it, add or remove members and manage channels. Community owners can delete a community, which removes its channels and messages for everyone.'] },
  { h: 'Enforcement', p: ['We may remove content or suspend accounts that break these Terms or the law, or that put others at risk. Where it’s appropriate, we’ll tell you why.'] },
  { h: 'The service', p: ['Chatting is free today. We may add, change or remove features, and may introduce optional paid plans; if we do, we’ll tell you first and never charge you without your agreement. We work hard to keep Chatting available, but it’s provided “as is”, without guaranteed uptime.'] },
  { h: 'Liability', p: ['To the extent the law allows, we aren’t liable for indirect or consequential losses, or for content other users send. Nothing in these Terms limits liability that can’t be limited by law.'] },
  { h: 'Ending your use', p: ['You can stop using Chatting at any time and ask us to delete your account. We may end these Terms if you seriously or repeatedly break them.'] },
  { h: 'Changes', p: ['We may update these Terms. For material changes we’ll notify you in the app, and continuing to use Chatting means you accept the new Terms.'] },
  { h: 'Contact', p: ['legal@chatting.app'] },
];

export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const blocks = kind === 'privacy' ? privacy : terms;
  const title = kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  useEffect(() => { document.title = `${title} · Chatting`; window.scrollTo(0, 0); }, [title]);
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <p className="eyebrow">Legal</p>
        <h1 className="display mt-3 text-4xl sm:text-6xl">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated {UPDATED}</p>
        <div className="mt-12 space-y-10">
          {blocks.map((b, i) => (
            <section key={b.h}>
              <h2 className="text-xl font-semibold tracking-tight"><span className="mr-2 font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>{b.h}</h2>
              {b.p?.map((t) => <p key={t} className="mt-3 leading-relaxed text-muted-foreground">{t}</p>)}
              {b.list && <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground marker:text-primary">{b.list.map((t) => <li key={t}>{t}</li>)}</ul>}
            </section>
          ))}
        </div>
        <div className="mt-16 flex gap-6 border-t border-border pt-8 text-sm text-muted-foreground">
          <Link to={kind === 'privacy' ? '/terms' : '/privacy'} className="hover:text-foreground">{kind === 'privacy' ? 'Terms of Service' : 'Privacy Policy'} →</Link>
        </div>
      </main>
    </div>
  );
}
