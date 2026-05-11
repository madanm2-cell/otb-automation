import type { FileUpload } from '@/types/otb';

export function isAnalyzeTabVisible(uploads: FileUpload[]): boolean {
  return uploads.some(u => u.file_type === 'actuals' && u.status === 'validated');
}
