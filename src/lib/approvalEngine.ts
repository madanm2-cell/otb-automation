import type { ApproverRole, ApprovalRecord, ApprovalStatus, Role } from '@/types/otb';

export const APPROVER_ROLES: ApproverRole[] = ['Planning', 'GD', 'Finance', 'CXO'];

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

  for (const role of APPROVER_ROLES) {
    const record = records.find(r => r.role === role);
    const status = record?.status ?? 'Pending';
    byRole[role] = status;
    if (status === 'Approved') approved++;
    else if (status === 'RevisionRequested') revisionRequested++;
    else pending++;
  }

  return {
    total: APPROVER_ROLES.length,
    approved,
    pending,
    revisionRequested,
    isFullyApproved: approved === APPROVER_ROLES.length,
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

/** Check if a user with the given role can still approve/request revision */
export function canUserApprove(userRole: Role, records: ApprovalRecord[]): boolean {
  // Only APPROVER_ROLES can approve
  if (!APPROVER_ROLES.includes(userRole as ApproverRole)) return false;
  const record = records.find(r => r.role === userRole);
  // Can approve if no record yet or still Pending
  return !record || record.status === 'Pending';
}

/** Map a user's Role to the corresponding ApproverRole, or null if not an approver */
export function roleToApproverRole(role: Role): ApproverRole | null {
  if (APPROVER_ROLES.includes(role as ApproverRole)) return role as ApproverRole;
  // Admin can't directly approve (they manage the system)
  return null;
}

/** Build initial approval records for a cycle submission */
export function buildInitialApprovalRecords(cycleId: string): Omit<ApprovalRecord, 'id' | 'created_at' | 'updated_at'>[] {
  return APPROVER_ROLES.map(role => ({
    cycle_id: cycleId,
    role,
    user_id: null,
    status: 'Pending' as ApprovalStatus,
    comment: null,
    decided_at: null,
  }));
}
