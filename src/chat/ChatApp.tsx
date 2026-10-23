import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'zitejs/auth';
import { useSessionGuard } from '../lib/session';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { heartbeat, manageCommunity, username as usernameApi } from 'zitejs/api';
import PickUsername from './PickUsername';
import { ChatProvider, useChat, usePoll } from './store';
import { PERSONAL_FONTS, usePrefs } from './prefs';
import Sidebar from './Sidebar';
import Thread from './Thread';
import EmptyThread from './EmptyThread';
import Discover from './Discover';
import Settings from './Settings';
import Saved from './Saved';
import Palette from './Palette';
import Confetti from './Confetti';
import SignIn from './SignIn';
import CommunitySettings from './community/CommunitySettings';
import Friends from './Friends';
import { CallProvider } from './call/CallProvider';
import CallWindow from './call/CallWindow';
import IncomingCall from './call/IncomingCall';
import { BannedScreen, SuspendedBanner } from './Standing';
import { errorMessage } from '../lib/errors';

const Spinner = () => <div className="grid h-[100dvh] flex-1 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

export default function ChatApp() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <SignIn />;
  return <Gate user={user} />;
}

function Gate({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const [handle, setHandle] = useState<string | null | undefined>(undefined);
  useEffect(() => { usernameApi({ action: 'get' }).then((r) => setHandle(r.username)).catch(() => setHandle(null)); }, [user.id]);
  const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];
  if (handle === undefined) return <Spinner />;
  if (!handle) return <PickUsername suggestion={user.email.split('@')[0]} onDone={setHandle} />;
  return (
    <ChatProvider me={{ id: user.id, name, email: user.email, image: user.image }}>
      <CallProvider><Shell /></CallProvider>
    </ChatProvider>
  );
}

function Join() {
  const { communityId = '' } = useParams();
  const { refresh } = useChat();
  const navigate = useNavigate();
  useEffect(() => {
    manageCommunity({ communityId, action: 'join' })
      .then(async (r) => {
        if (r.status === 'pending') { toast.success('Request sent — a moderator will review it'); return navigate('/app', { replace: true }); }
        await refresh(); toast.success('Welcome to the community!'); navigate(r.channelId ? `/app/c/${r.channelId}` : '/app', { replace: true }); })
      .catch((e) => { toast.error(errorMessage(e, 'That invite link isn’t valid')); navigate('/app', { replace: true }); });
  }, [communityId, navigate, refresh]);
  return <Spinner />;
}

function Shell() {
  const prefs = usePrefs();
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.accent) { root.style.setProperty('--primary', prefs.accent); root.style.setProperty('--ring', prefs.accent); }
    else { root.style.removeProperty('--primary'); root.style.removeProperty('--ring'); }
    root.style.fontSize = { sm: '14.5px', md: '16px', lg: '17.5px' }[prefs.fontSize];
    root.classList.toggle('compact', prefs.compact);
    root.classList.toggle('reduce-motion', prefs.reduceMotion);
    root.classList.toggle('high-contrast', prefs.highContrast);
    root.classList.toggle('blur-media', prefs.blurMedia);
    root.classList.toggle('bubble-square', prefs.bubble === 'square');
    const font = PERSONAL_FONTS[prefs.font];
    if (font) root.style.setProperty('--font-sans', font); else root.style.removeProperty('--font-sans');
    return () => { root.style.fontSize = ''; root.style.removeProperty('--font-sans'); root.classList.remove('compact', 'reduce-motion', 'high-contrast', 'blur-media', 'bubble-square'); root.style.removeProperty('--primary'); root.style.removeProperty('--ring'); };
  }, [prefs.accent, prefs.fontSize, prefs.compact, prefs.reduceMotion, prefs.highContrast, prefs.blurMedia, prefs.bubble, prefs.font]);
  usePoll(() => heartbeat({}).catch(() => {}), 30000);
  useSessionGuard(true);
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 60000); return () => clearInterval(t); }, []);
  const { standing } = useChat();
  if (standing?.state === 'Banned') return <BannedScreen reason={standing.reason} />;
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
    {standing?.state === 'Suspended' && <SuspendedBanner until={standing.until} reason={standing.reason} />}
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <Routes>
        <Route index element={<><Sidebar /><EmptyThread /></>} />
        <Route path="c/:id" element={<><Sidebar hideOnMobile /><Thread /></>} />
        <Route path="discover" element={<><Sidebar hideOnMobile /><Discover /></>} />
        <Route path="friends" element={<><Sidebar hideOnMobile /><Friends /></>} />
        <Route path="saved" element={<><Sidebar hideOnMobile /><Saved /></>} />
        <Route path="settings" element={<><Sidebar hideOnMobile /><Settings /></>} />
        <Route path="community/:communityId" element={<><Sidebar wideOnly /><CommunitySettings /></>} />
        <Route path="join/:communityId" element={<Join />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      <Palette />
      <Confetti />
      <CallWindow />
      <IncomingCall />
    </div>
    </div>
  );
}
