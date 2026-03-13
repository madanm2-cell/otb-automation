import { createAdminClient } from '@/lib/supabase/server';

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REVERT'
  | 'LOGIN' | 'LOGOUT'
  | 'UPLOAD' | 'ACTIVATE' | 'ASSIGN';

interface AuditEntryInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId: string;
  userEmail: string;
  userRole: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

interface AuditEntry {
  entity_type: string;
  entity_id: string;
  action: string;
  user_id: string;
  user_email: string;
  user_role: string;
  details: Record<string, any>;
  ip_address: string | null;
}

export function buildAuditEntry(input: AuditEntryInput): AuditEntry {
  return {
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    user_id: input.userId,
    user_email: input.userEmail,
    user_role: input.userRole,
    details: input.details ?? {},
    ip_address: input.ipAddress ?? null,
  };
}

export async function logAudit(input: AuditEntryInput): Promise<void> {
  const admin = createAdminClient();
  const entry = buildAuditEntry(input);

  await admin.from('audit_logs').insert(entry);
  // Fire-and-forget — audit logging should never block the main operation
}

// Helper to extract IP from Next.js request
export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headers.get('x-real-ip')
    ?? 'unknown';
}
