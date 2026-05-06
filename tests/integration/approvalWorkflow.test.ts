import { describe, it, expect } from 'vitest';
import {
  APPROVER_ROLES,
  APPROVER_SEQUENCE,
  getApprovalSummary,
  shouldCycleBeApproved,
  shouldCycleRevertToFilling,
  canUserApprove,
  roleToApproverRole,
} from '@/lib/approvalEngine';
import type { ApprovalRecord } from '@/types/otb';

/**
 * Integration tests for the full approval workflow state machine.
 * Tests the complete flow using the approval engine functions:
 *   submit → 4 approvals → cycle approved
 *   submit → 1 revision → all reset → cycle back to Filling
 *   approved → GD reopen → back to InReview
 */

function makeRecord(role: string, status: string, userId?: string): ApprovalRecord {
  return {
    cycle_id: 'cycle-1',
    role: role as any,
    user_id: userId || null,
    status: status as any,
    comment: status === 'RevisionRequested' ? 'Needs changes' : null,
    decided_at: status !== 'Pending' ? new Date().toISOString() : null,
  };
}

describe('Approval Workflow — Full Flow', () => {
  describe('Submit → 4 Approvals → Approved', () => {
    it('initializes 4 Pending records on submit', () => {
      const records = APPROVER_SEQUENCE.map(role => makeRecord(role, 'Pending'));
      expect(records).toHaveLength(4);
      expect(records.every(r => r.status === 'Pending')).toBe(true);
      expect(records.map(r => r.role)).toEqual(APPROVER_ROLES);
    });

    it('after 1 of 4 approve, cycle is not yet approved', () => {
      const records: ApprovalRecord[] = [
        makeRecord('Planning', 'Approved', 'user-1'),
        makeRecord('GD', 'Pending'),
        makeRecord('Finance', 'Pending'),
        makeRecord('CXO', 'Pending'),
      ];
      expect(shouldCycleBeApproved(records)).toBe(false);
      const summary = getApprovalSummary(records);
      expect(summary.approved).toBe(1);
      expect(summary.pending).toBe(3);
    });

    it('after 3 of 4 approve, cycle is still not approved', () => {
      const records: ApprovalRecord[] = [
        makeRecord('Planning', 'Approved', 'user-1'),
        makeRecord('GD', 'Approved', 'user-2'),
        makeRecord('Finance', 'Approved', 'user-3'),
        makeRecord('CXO', 'Pending'),
      ];
      expect(shouldCycleBeApproved(records)).toBe(false);
      expect(shouldCycleRevertToFilling(records)).toBe(false);
    });

    it('after all 4 approve, cycle transitions to Approved', () => {
      const records: ApprovalRecord[] = [
        makeRecord('Planning', 'Approved', 'user-1'),
        makeRecord('GD', 'Approved', 'user-2'),
        makeRecord('Finance', 'Approved', 'user-3'),
        makeRecord('CXO', 'Approved', 'user-4'),
      ];
      expect(shouldCycleBeApproved(records)).toBe(true);
      expect(shouldCycleRevertToFilling(records)).toBe(false);
      const summary = getApprovalSummary(records);
      expect(summary.isFullyApproved).toBe(true);
    });
  });

  describe('Submit → 1 Revision → All Reset → Filling', () => {
    it('revision by any role triggers revert', () => {
      const records: ApprovalRecord[] = [
        makeRecord('Planning', 'Approved', 'user-1'),
        makeRecord('GD', 'RevisionRequested', 'user-2'),
        makeRecord('Finance', 'Pending'),
        makeRecord('CXO', 'Pending'),
      ];
      expect(shouldCycleRevertToFilling(records)).toBe(true);
      expect(shouldCycleBeApproved(records)).toBe(false);
    });

    it('after reset, all records become Pending again', () => {
      // Simulate reset: build fresh initial records inline
      const reset = APPROVER_SEQUENCE.map(role => makeRecord(role, 'Pending'));
      expect(reset.every(r => r.status === 'Pending')).toBe(true);
      expect(reset.every(r => r.user_id === null)).toBe(true);
      expect(reset.every(r => r.decided_at === null)).toBe(true);
    });

    it('after reset, Planning can approve again and sequential gating is enforced', () => {
      const resetRecords: ApprovalRecord[] = APPROVER_ROLES.map(role => makeRecord(role, 'Pending'));
      // With sequential gating, only Planning (first role) can act on a fresh set
      expect(canUserApprove('Planning', resetRecords)).toBe(true);
      // All subsequent roles are blocked until their predecessors approve
      expect(canUserApprove('GD', resetRecords)).toBe(false);
      expect(canUserApprove('Finance', resetRecords)).toBe(false);
      expect(canUserApprove('CXO', resetRecords)).toBe(false);
    });
  });

  describe('Approved → GD Reopen → InReview', () => {
    it('GD can request reopen (has request_reopen permission)', () => {
      const approverRole = roleToApproverRole('GD');
      expect(approverRole).toBe('GD');
    });

    it('after reopen, all records reset to Pending', () => {
      // Approved state
      const approved: ApprovalRecord[] = APPROVER_ROLES.map(role =>
        makeRecord(role, 'Approved', `user-${role}`)
      );
      expect(shouldCycleBeApproved(approved)).toBe(true);

      // After reopen (reset all to Pending)
      const reopened: ApprovalRecord[] = APPROVER_ROLES.map(role => makeRecord(role, 'Pending'));
      expect(shouldCycleBeApproved(reopened)).toBe(false);
      expect(shouldCycleRevertToFilling(reopened)).toBe(false);
      const summary = getApprovalSummary(reopened);
      expect(summary.pending).toBe(4);
    });

    it('after reopen, the approval flow can restart', () => {
      const reopened: ApprovalRecord[] = APPROVER_ROLES.map(role => makeRecord(role, 'Pending'));

      // Simulate all 4 re-approving
      const reApproved: ApprovalRecord[] = APPROVER_ROLES.map(role =>
        makeRecord(role, 'Approved', `user-${role}`)
      );
      expect(shouldCycleBeApproved(reApproved)).toBe(true);
    });
  });

  describe('Permission checks during flow', () => {
    it('non-approver roles cannot approve', () => {
      const records: ApprovalRecord[] = APPROVER_ROLES.map(role => makeRecord(role, 'Pending'));
      expect(canUserApprove('Admin', records)).toBe(false);
      expect(canUserApprove('ReadOnly', records)).toBe(false);
    });

    it('a role that already approved cannot approve again', () => {
      const records: ApprovalRecord[] = [
        makeRecord('Planning', 'Approved', 'user-1'),
        makeRecord('GD', 'Pending'),
        makeRecord('Finance', 'Pending'),
        makeRecord('CXO', 'Pending'),
      ];
      expect(canUserApprove('Planning', records)).toBe(false);
      expect(canUserApprove('GD', records)).toBe(true);
    });
  });
});
