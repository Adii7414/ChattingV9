import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'zitejs/auth';

/** Every "Get Chatting" button sends visitors into the app (sign-in happens there). */
export const useWaitlist = () => {
  const navigate = useNavigate();
  return useCallback((_source: string) => navigate('/app'), [navigate]);
};

/** "Open Chatting" for signed-in visitors, "Get Chatting" for everyone else. */
export const useCtaLabel = () => {
  const { user } = useAuth();
  return user ? 'Open Chatting' : 'Get Chatting';
};
