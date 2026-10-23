import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const RULE = /^[a-z0-9_.]{3,20}$/;
const RESERVED = new Set(['admin', 'support', 'chatting', 'moderation', 'staff', 'official', 'system', 'everyone', 'here', 'root', 'help']);
const bad = (m: string) => new ZiteError({ code: 'BAD_REQUEST', message: m, userFacingMessage: m });

async function taken(name: string, me: string) {
  const r = await zite.sql({ query: `SELECT 1 FROM "Profiles" WHERE LOWER("username") = $1 AND "userKey" <> $2 LIMIT 1`, params: [name, me] });
  return r.rows.length > 0;
}

export default createEndpoint({
  description: 'Reads, checks or sets the signed-in user’s unique @username',
  authenticated: true,
  inputSchema: z.object({ action: z.enum(['get', 'check', 'set']), username: z.string().max(40).optional() }),
  outputSchema: z.object({ username: z.string().nullable(), available: z.boolean(), reason: z.string() }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    if (input.action === 'get') {
      const r = await zite.sql({ query: `SELECT "username" FROM "Profiles" WHERE "userKey" = $1 LIMIT 1`, params: [me] });
      return { username: (r.rows[0]?.username as string) || null, available: false, reason: '' };
    }
    const name = (input.username ?? '').trim().toLowerCase().replace(/^@/, '');
    let reason = '';
    if (!RULE.test(name)) reason = '3–20 characters: letters, numbers, dots and underscores only.';
    else if (/^[._]|[._]$|\.\./.test(name)) reason = 'Can’t start or end with a dot or underscore, or use two dots in a row.';
    else if (RESERVED.has(name)) reason = 'That username is reserved.';
    else if (await taken(name, me)) reason = 'That username is taken.';
    if (input.action === 'check') return { username: name, available: !reason, reason };
    if (reason) throw bad(reason);
    await zite.profiles.bulkCreate({ records: [{ userKey: me, person: me, username: name } as never], matchOn: ['userKey'] });
    return { username: name, available: true, reason: '' };
  },
});
