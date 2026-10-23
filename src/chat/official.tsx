import { BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { officialChat } from 'zitejs/api';
import { cn } from '@project/components/lib/utils';
import { errorMessage } from '../lib/errors';

export const isOfficialId = (id: string | null | undefined) => !!id && id.startsWith('official:');

/** Blue check for Chatting's own accounts; gold check for verified communities. */
export function Verified({ className, community }: { className?: string; community?: boolean }) {
  return (
    <BadgeCheck aria-label={community ? 'Verified community' : 'Verified official account'}
      className={cn('h-4 w-4 shrink-0 text-white', community ? 'fill-[hsl(var(--verified-community))]' : 'fill-[hsl(var(--verified))]', className)}>
      <title>{community ? 'Verified community' : 'Official Chatting account'}</title>
    </BadgeCheck>
  );
}

/** Opens (or reopens) the Chatting Support chat and navigates to it. */
export async function openSupport(navigate: (to: string) => void, refresh: () => Promise<void>) {
  try {
    const r = await officialChat({ action: 'openSupport' });
    await refresh();
    if (r.conversationId) navigate(`/app/c/${r.conversationId}`);
  } catch (e) {
    toast.error(errorMessage(e, 'Couldn’t open support right now'));
  }
}
