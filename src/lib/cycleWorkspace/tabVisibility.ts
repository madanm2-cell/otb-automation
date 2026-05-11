import type { CycleStatus, FileUpload } from '@/types/otb';

export function isPlanVisible(status: CycleStatus): boolean {
  return status !== 'Draft';
}

export function isReviewVisible(status: CycleStatus): boolean {
  return status !== 'Draft' && status !== 'Filling';
}

// Analyze requires full approval AND actuals to exist.
// upload-status synthesizes a virtual 'actuals' entry from otb_actuals, so
// checking uploads correctly reflects whether actuals have been uploaded.
export function isAnalyzeVisible(status: CycleStatus, uploads: FileUpload[]): boolean {
  return (
    status === 'Approved' &&
    uploads.some(u => u.file_type === 'actuals' && u.status === 'validated')
  );
}
