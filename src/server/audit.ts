import { zite } from 'zitejs/db';

export type AuditInput = {
  summary: string;
  category: 'Auth' | 'Account' | 'Message' | 'Community' | 'Moderation' | 'Support' | 'Verification' | 'Bot' | 'API' | 'System';
  action: string;
  actorType: 'User' | 'Staff' | 'Bot' | 'System';
  actorId?: string | null;
  actorLabel?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  targetUser?: string | null;
  communityId?: string | null;
  severity?: 'Info' | 'Notice' | 'Warning' | 'Critical';
  details?: Record<string, unknown> | null;
  sessionKey?: string | null;
};

/** Writes one entry to the platform-wide audit log. Never throws — auditing must not break the action itself. */
export async function audit(a: AuditInput) {
  try {
    await zite.auditLogs.create({
      record: {
        summary: a.summary.slice(0, 300), category: a.category, action: a.action, actorType: a.actorType,
        actor: a.actorType === 'User' || a.actorType === 'Staff' ? a.actorId ?? null : null,
        actorLabel: a.actorLabel ?? null, targetType: a.targetType ?? null, targetId: a.targetId ?? null,
        targetLabel: a.targetLabel ?? null, targetUser: a.targetUser ?? null, communityId: a.communityId ?? null,
        severity: a.severity ?? 'Info', details: a.details ? JSON.stringify(a.details).slice(0, 20000) : null,
        sessionKey: a.sessionKey ?? null, userAgent: null,
      } as never,
    });
  } catch (e) {
    console.error('audit failed', e);
  }
}

export const staffActor = (u: { id: string; email: string }) => ({ actorType: 'Staff' as const, actorId: u.id, actorLabel: u.email });
