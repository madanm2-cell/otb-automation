import type { CycleStatus } from '@/types/otb';

export type WorkspaceTab = 'setup' | 'plan' | 'review' | 'analyze';

export interface DefaultTabInputs {
  status: CycleStatus;
  needsMyApproval: boolean;
  hasActuals: boolean;
}

export function resolveDefaultTab({ status, needsMyApproval, hasActuals }: DefaultTabInputs): WorkspaceTab {
  switch (status) {
    case 'Draft':    return 'setup';
    case 'Filling':  return 'plan';
    case 'InReview': return needsMyApproval ? 'review' : 'plan';
    case 'Approved': return hasActuals ? 'analyze' : 'plan';
    default:         return 'setup';
  }
}
