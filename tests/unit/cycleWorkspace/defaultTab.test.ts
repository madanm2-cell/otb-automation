import { describe, it, expect } from 'vitest';
import { resolveDefaultTab, type WorkspaceTab } from '@/lib/cycleWorkspace/defaultTab';
import type { CycleStatus } from '@/types/otb';

describe('resolveDefaultTab', () => {
  it('Draft → setup', () => {
    expect(resolveDefaultTab({ status: 'Draft', needsMyApproval: false, hasActuals: false })).toBe<WorkspaceTab>('setup');
  });

  it('Filling → plan', () => {
    expect(resolveDefaultTab({ status: 'Filling', needsMyApproval: false, hasActuals: false })).toBe('plan');
  });

  it('InReview without my approval → plan', () => {
    expect(resolveDefaultTab({ status: 'InReview', needsMyApproval: false, hasActuals: false })).toBe('plan');
  });

  it('InReview with my approval → review', () => {
    expect(resolveDefaultTab({ status: 'InReview', needsMyApproval: true, hasActuals: false })).toBe('review');
  });

  it('Approved without actuals → plan', () => {
    expect(resolveDefaultTab({ status: 'Approved', needsMyApproval: false, hasActuals: false })).toBe('plan');
  });

  it('Approved with actuals → analyze', () => {
    expect(resolveDefaultTab({ status: 'Approved', needsMyApproval: false, hasActuals: true })).toBe('analyze');
  });

  it('unknown status → setup as safe fallback', () => {
    expect(resolveDefaultTab({ status: 'Unknown' as CycleStatus, needsMyApproval: false, hasActuals: false })).toBe('setup');
  });
});
