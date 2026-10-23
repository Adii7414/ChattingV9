import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ids, requireActive } from '../server/chat';
import { fail } from '../server/errors';
import { verificationCriteria } from '../server/verification';

export default createEndpoint({
  description: 'Shows a community’s verification status and requirements, and lets its owner apply',
  authenticated: true,
  inputSchema: z.object({ communityId: z.string(), action: z.enum(['status', 'apply', 'withdraw']), message: z.string().max(1000).optional() }),
  outputSchema: z.object({
    status: z.enum(['None', 'Pending', 'Verified', 'Rejected']),
    decisionNote: z.string(), requestedAt: z.string().nullable(), verifiedAt: z.string().nullable(), isOwner: z.boolean(), eligible: z.boolean(),
    criteria: z.array(z.object({ key: z.string(), label: z.string(), met: z.boolean(), detail: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await requireActive(me);
    const c = await zite.communities.findOne({ id: input.communityId });
    if (!c) throw fail('That community no longer exists.', 'NOT_FOUND');
    const isOwner = ids(c.owner as string | string[] | null)[0] === me;
    let status = (c.verificationStatus as string | null) ?? 'None';
    const { criteria, eligible } = await verificationCriteria(c.id);
    if (input.action !== 'status') {
      if (!isOwner) throw fail('Only the community owner can manage verification.', 'FORBIDDEN');
      if (input.action === 'apply') {
        if (status === 'Verified') throw fail('This community is already verified.');
        if (status === 'Pending') throw fail('Your application is already being reviewed.');
        if (!eligible) throw fail('Your community doesn’t meet all the requirements yet.');
        await zite.communities.update({ id: c.id, record: { verificationStatus: 'Pending', verificationRequestedAt: new Date().toISOString(), verificationApplication: input.message?.trim() || null, verificationDecisionNote: null } as never });
        status = 'Pending';
      } else {
        if (status !== 'Pending') throw fail('There’s no pending application to withdraw.');
        await zite.communities.update({ id: c.id, record: { verificationStatus: null } as never });
        status = 'None';
      }
    }
    const fresh = input.action === 'status' ? c : await zite.communities.findOne({ id: c.id });
    return {
      status: status as 'None' | 'Pending' | 'Verified' | 'Rejected',
      decisionNote: String(fresh?.verificationDecisionNote ?? ''),
      requestedAt: fresh?.verificationRequestedAt ? String(fresh.verificationRequestedAt) : null,
      verifiedAt: fresh?.verifiedAt ? String(fresh.verifiedAt) : null,
      isOwner, eligible, criteria,
    };
  },
});
