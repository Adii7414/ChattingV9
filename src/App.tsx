import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from '@project/components/ui/sonner';
import Landing from './pages/Landing';
import ChatApp from './chat/ChatApp';
import Legal from './pages/Legal';
import SupportGate from './support/SupportGate';
import Developers from './pages/Developers';

function Oops() {
  return (
    <div className="grid h-[100dvh] place-items-center px-6 text-center">
      <div>
        <p className="text-2xl font-semibold tracking-tight">Something went wrong</p>
        <p className="mt-2 text-muted-foreground">Please refresh the page. Your messages are safe.</p>
        <button onClick={() => location.reload()} className="mt-6 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background">Refresh</button>
      </div>
    </div>
  );
}

/** Deep links like /features land on the home page, scrolled to that section. */
function LandingAt({ id }: { id: string }) {
  useEffect(() => {
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 300);
    return () => clearTimeout(t);
  }, [id]);
  return <Landing />;
}

function NotFound() {
  return (
    <div className="grid h-[100dvh] place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm text-primary">404</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">This page doesn’t exist</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background">Back home</Link>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => { document.documentElement.classList.toggle('dark', localStorage.getItem('theme') !== 'light'); }, []);
  return (
    <ErrorBoundary FallbackComponent={Oops}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            {['product', 'features', 'faq'].map((id) => <Route key={id} path={`/${id}`} element={<LandingAt id={id} />} />)}
            <Route path="/app/*" element={<ChatApp />} />
            <Route path="/support/*" element={<SupportGate />} />
            <Route path="/developers/*" element={<Developers />} />
            <Route path="/privacy" element={<Legal kind="privacy" />} />
            <Route path="/terms" element={<Legal kind="terms" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </MotionConfig>
    </ErrorBoundary>
  );
}
