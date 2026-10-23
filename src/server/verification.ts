import { zite } from 'zitejs/db';
import { standingOf } from './official';

export const VERIFY_RULES = { members: 25, ageDays: 14, messages30d: 100, descriptionChars: 20 };

export type Criterion = { key: string; label: string; met: boolean; detail: string };

/** Checks whether a community currently meets the requirements to apply for verification. */
export async function verificationCriteria(communityId: string): Promise<{ criteria: Criterion[]; eligible: boolean }> {
  const r = await zite.sql({
    query: `SELECT COALESCE(c."isPublic", true) AS "isPublic", COALESCE(c."description",'') AS description, c.created_at AS "createdAt", COALESCE(c."owner"->>0,'') AS "ownerId",
        COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(c."members") = 'array' THEN c."members" ELSE '[]'::jsonb END), 0) AS members,
        (SELECT COUNT(*) FROM "Conversations" cv JOIN "ConversationsMessages" l ON l."conversationsId" = cv.id JOIN "Messages" m ON m.id = l."messagesId"
          WHERE cv."communityId" = c.id::text AND m.created_at >= now() - interval '30 days') AS msgs,
        (SELECT COUNT(*) FROM "Reports" rp WHERE rp."communityId" = c.id::text AND COALESCE(rp."status",'Open') = 'Open') AS reports
      FROM "Communities" c WHERE c.id = $1::uuid`,
    params: [communityId],
  });
  const c = r.rows[0];
  if (!c) return { criteria: [], eligible: false };
  const ageDays = Math.floor((Date.now() - new Date(String(c.createdAt)).getTime()) / 86_400_000);
  const owner = c.ownerId ? await standingOf(String(c.ownerId)) : { state: 'Good' };
  const R = VERIFY_RULES;
  const criteria: Criterion[] = [
    { key: 'public', label: 'Public community', met: !!c.isPublic, detail: c.isPublic ? 'Anyone can find and join' : 'Make it public in Profile settings' },
    { key: 'members', label: `At least ${R.members} members`, met: Number(c.members) >= R.members, detail: `${Number(c.members)} members` },
    { key: 'age', label: `At least ${R.ageDays} days old`, met: ageDays >= R.ageDays, detail: `${ageDays} day${ageDays === 1 ? '' : 's'} old` },
    { key: 'activity', label: `${R.messages30d}+ messages in the last 30 days`, met: Number(c.msgs) >= R.messages30d, detail: `${Number(c.msgs)} messages` },
    { key: 'description', label: 'Has a clear description', met: String(c.description).trim().length >= R.descriptionChars, detail: `At least ${R.descriptionChars} characters` },
    { key: 'reports', label: 'No open reports', met: Number(c.reports) === 0, detail: `${Number(c.reports)} open` },
    { key: 'owner', label: 'Owner in good standing', met: owner.state === 'Good', detail: owner.state === 'Good' ? 'No account restrictions' : 'Owner account is restricted' },
  ];
  return { criteria, eligible: criteria.every((x) => x.met) };
}
