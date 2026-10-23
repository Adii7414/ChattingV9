import { ZiteError } from 'zitejs/backend';

/** An error whose message is safe and friendly to show to the person using the app. */
export function fail(message: string, code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'CONFLICT' | 'RATE_LIMITED' = 'BAD_REQUEST') {
  return new ZiteError({ code, message, userFacingMessage: message });
}
