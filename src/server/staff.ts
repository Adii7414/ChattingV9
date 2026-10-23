import { ZiteError } from 'zitejs/backend';

/** Only emails listed in the ZITE_SUPPORT_STAFF_EMAILS secret (comma-separated) can use /support. */
export function isStaff(email: string | undefined | null) {
  const list = (process.env.ZITE_SUPPORT_STAFF_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

export function requireStaff(user: { email: string } | undefined | null) {
  if (!isStaff(user?.email)) {
    throw new ZiteError({ code: 'FORBIDDEN', message: 'Not staff', userFacingMessage: 'Only Chatting staff can use the support panel.' });
  }
}
