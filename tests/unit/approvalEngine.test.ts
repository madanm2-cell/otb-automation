import { describe, it, expect } from 'vitest';
import type { ApprovalRecord, Role } from '@/types/otb';
import {
  APPROVER_ROLES,
  getApprovalSummary,
  shouldCycleBeApproved,
  shouldCycleRevertToFilling,
  canUserApprove,
  roleToApproverRole,
  buildInitialApprovalRecords,
} from '@/lib/approvalEngine';

function makeRecord(
  role: ApprovalRecord['role'],
  status: ApprovalRecord['status'] = 'Pending',
): ApprovalRecord {
  return {
    cycle_id: 'cycle-1',
    role,
    user_id: status === 'Pending' ? null : 'user-1',
    status,
    comment: null,
    decided_at: status === 'Pending' ? null : '2026-03-24T00:00:00Z',
  };
}

describe('getApprovalSummary', () => {
  it('returns all pending when no records exist', () => {
    const summary = getApprovalSummary([]);
    expect(summary.total).toBe(4);
    expect(summary.approved).toBe(0);
    expect(summary.pending).toBe(4);
    expect(summary.revisionRequested).toBe(0);
    expect(summary.isFullyApproved).toBe(false);
    expect(summary.hasRevisionRequest).toBe(false);
    expect(summary.byRole).toEqual({
      Planning: 'Pending',
      GD: 'Pending',
      Finance: 'Pending',
      CXO: 'Pending',
    });
  });

  it('returns mixed statuses correctly', () => {
    const records = [
      makeRecord('Planning', 'Approved'),
      makeRecord('GD', 'Pending'),
      makeRecord('Finance', 'Approved'),
    ];
    const summary = getApprovalSummary(records);
    expect(summary.approved).toBe(2);
    expect(summary.pending).toBe(2); // GD explicit pending + CXO missing
    expect(summary.revisionRequested).toBe(0);
    expect(summary.isFullyApproved).toBe(false);
    expect(summary.hasRevisionRequest).toBe(false);
  });

  it('returns fully approved when all roles approved', () => {
    const records = APPROVER_ROLES.map(role => makeRecord(role, 'Approved'));
    const summary = getApprovalSummary(records);
    expect(summary.approved).toBe(4);
    expect(summary.pending).toBe(0);
    expect(summary.isFullyApproved).toBe(true);
    expect(summary.hasRevisionRequest).toBe(false);
  });

  it('detects revision requests', () => {
    const records = [
      makeRecord('Planning', 'Approved'),
      makeRecord('GD', 'RevisionRequested'),
      makeRecord('Finance', 'Pending'),
    ];
    const summary = getApprovalSummary(records);
    expect(summary.revisionRequested).toBe(1);
    expect(summary.hasRevisionRequest).toBe(true);
    expect(summary.isFullyApproved).toBe(false);
  });
});

describe('shouldCycleBeApproved', () => {
  it('returns true when all approved', () => {
    const records = APPROVER_ROLES.map(role => makeRecord(role, 'Approved'));
    expect(shouldCycleBeApproved(records)).toBe(true);
  });

  it('returns false when not all approved', () => {
    const records = [
      makeRecord('Planning', 'Approved'),
      makeRecord('GD', 'Approved'),
      makeRecord('Finance', 'Approved'),
    ];
    expect(shouldCycleBeApproved(records)).toBe(false);
  });

  it('returns false with empty records', () => {
    expect(shouldCycleBeApproved([])).toBe(false);
  });
});

describe('shouldCycleRevertToFilling', () => {
  it('returns true when any revision requested', () => {
    const records = [
      makeRecord('Planning', 'Approved'),
      makeRecord('Finance', 'RevisionRequested'),
    ];
    expect(shouldCycleRevertToFilling(records)).toBe(true);
  });

  it('returns false when no revision requested', () => {
    const records = [
      makeRecord('Planning', 'Approved'),
      makeRecord('GD', 'Pending'),
    ];
    expect(shouldCycleRevertToFilling(records)).toBe(false);
  });

  it('returns false with empty records', () => {
    expect(shouldCycleRevertToFilling([])).toBe(false);
  });
});

describe('canUserApprove', () => {
  it('returns true for an approver role with pending status', () => {
    const records = [makeRecord('Planning', 'Pending')];
    expect(canUserApprove('Planning', records)).toBe(true);
  });

  it('returns true for an approver role with no record yet', () => {
    expect(canUserApprove('GD', [])).toBe(true);
  });

  it('returns false for an approver role that already decided', () => {
    const records = [makeRecord('Finance', 'Approved')];
    expect(canUserApprove('Finance', records)).toBe(false);
  });

  it('returns false for non-approver roles', () => {
    expect(canUserApprove('Admin', [])).toBe(false);
    expect(canUserApprove('ReadOnly', [])).toBe(false);
  });
});

describe('roleToApproverRole', () => {
  it('maps Planning to Planning', () => {
    expect(roleToApproverRole('Planning')).toBe('Planning');
  });

  it('maps GD to GD', () => {
    expect(roleToApproverRole('GD')).toBe('GD');
  });

  it('maps Finance to Finance', () => {
    expect(roleToApproverRole('Finance')).toBe('Finance');
  });

  it('maps CXO to CXO', () => {
    expect(roleToApproverRole('CXO')).toBe('CXO');
  });

  it('returns null for Admin', () => {
    expect(roleToApproverRole('Admin')).toBeNull();
  });

  it('returns null for ReadOnly', () => {
    expect(roleToApproverRole('ReadOnly')).toBeNull();
  });
});

describe('buildInitialApprovalRecords', () => {
  it('creates 4 records for all approver roles', () => {
    const records = buildInitialApprovalRecords('cycle-123');
    expect(records).toHaveLength(4);
  });

  it('sets correct cycle_id on all records', () => {
    const records = buildInitialApprovalRecords('cycle-123');
    for (const record of records) {
      expect(record.cycle_id).toBe('cycle-123');
    }
  });

  it('sets all records to Pending with null user/comment/decided_at', () => {
    const records = buildInitialApprovalRecords('cycle-123');
    for (const record of records) {
      expect(record.status).toBe('Pending');
      expect(record.user_id).toBeNull();
      expect(record.comment).toBeNull();
      expect(record.decided_at).toBeNull();
    }
  });

  it('includes all four approver roles in order', () => {
    const records = buildInitialApprovalRecords('cycle-123');
    const roles = records.map(r => r.role);
    expect(roles).toEqual(['Planning', 'GD', 'Finance', 'CXO']);
  });
});
