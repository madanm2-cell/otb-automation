import { describe, it, expect } from 'vitest';
import { isAnalyzeTabVisible } from '@/lib/cycleWorkspace/tabVisibility';
import type { FileUpload } from '@/types/otb';

const actualsValidated: FileUpload = { file_type: 'actuals', status: 'validated' } as FileUpload;
const actualsFailed:    FileUpload = { file_type: 'actuals', status: 'failed' }    as FileUpload;
const referenceValidated: FileUpload = { file_type: 'ly_sales', status: 'validated' } as FileUpload;

describe('isAnalyzeTabVisible', () => {
  it('hidden when no uploads', () => {
    expect(isAnalyzeTabVisible([])).toBe(false);
  });
  it('hidden when only reference uploads validated', () => {
    expect(isAnalyzeTabVisible([referenceValidated])).toBe(false);
  });
  it('hidden when actuals exist but failed', () => {
    expect(isAnalyzeTabVisible([actualsFailed])).toBe(false);
  });
  it('visible when at least one validated actuals row exists', () => {
    expect(isAnalyzeTabVisible([referenceValidated, actualsValidated])).toBe(true);
  });
});
