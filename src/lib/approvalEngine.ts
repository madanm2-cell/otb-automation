import type { ApproverRole, ApprovalRecord, ApprovalStatus, Role } from '@/types/otb';

export const APPROVER_SEQUENCE: ApproverRole[] = ['Planning', 'GD', 'Finance', 'CXO'];
// Backward-compatible alias — existing imports continue to work
export const APPROVER_ROLES = APPROVER_SEQUENCE;

export interface ApprovalSummary {
  total: number;
  approved: number;
  pending: number;
  revisionRequested: number;
  isFullyApproved: boolean;
  hasRevisionRequest: boolean;
  byRole: Record<ApproverRole, ApprovalStatus>;
}

export function getApprovalSummary(records: ApprovalRecord[]): ApprovalSummary {
  const byRole = {} as Record<ApproverRole, ApprovalStatus>;
  let approved = 0;
  let pending = 0;
  let revisionRequested = 0;

  for (const role of APPROVER_SEQUENCE) {
    const record = records.find(r => r.role === role);
    const status = record?.status ?? 'Pending';
    byRole[role] = status;
    if (status === 'Approved') approved++;
    else if (status === 'RevisionRequested') revisionRequested++;
    else pending++;
  }

  return {
    total: APPROVER_SEQUENCE.length,
    approved,
    pending,
    revisionRequested,
    isFullyApproved: approved === APPROVER_SEQUENCE.length,
    hasRevisionRequest: revisionRequested > 0,
    byRole,
  };
}

export function shouldCycleBeApproved(records: ApprovalRecord[]): boolean {
  return getApprovalSummary(records).isFullyApproved;
}

export function shouldCycleRevertToFilling(records: ApprovalRecord[]): boolean {
  return getApprovalSummary(records).hasRevisionRequest;
}

/** All roles that must approve before the given role can act. */
export function getPredecessorRoles(role: ApproverRole): ApproverRole[] {
  const idx = APPROVER_SEQUENCE.indexOf(role);
  return APPROVER_SEQUENCE.slice(0, idx);
}

/** True if any predecessor has not yet approved — this role cannot act yet. */
export function isRoleBlocked(role: ApproverRole, records: ApprovalRecord[]): boolean {
  return getPredecessorRoles(role).some(pred => {
    const record = records.find(r => r.role === pred);
    return !record || record.status !== 'Approved';
  });
}

/** True if the user's role is next in sequence and their own record is still Pending. */
export function canUserApprove(userRole: Role, records: ApprovalRecord[]): boolean {
  if (!APPROVER_SEQUENCE.includes(userRole as ApproverRole)) return false;
  const role = userRole as ApproverRole;
  if (isRoleBlocked(role, records)) return false;
  const ownRecord = records.find(r => r.role === role);
  return !ownRecord || ownRecord.status === 'Pending';
}

/** Map a user's Role to the corresponding ApproverRole, or null if not an approver. */
export function roleToApproverRole(role: Role): ApproverRole | null {
  if (APPROVER_SEQUENCE.includes(role as ApproverRole)) return role as ApproverRole;
  return null;
}

/** Build initial approval records for a cycle submission. */
export function buildInitialApprovalRecords(cycleId: string): Omit<ApprovalRecord, 'id' | 'created_at' | 'updated_at'>[] {
  return APPROVER_SEQUENCE.map(role => ({
    cycle_id: cycleId,
    role,
    user_id: null,
    status: 'Pending',
    comment: null,
    decided_at: null,
  }));
}
