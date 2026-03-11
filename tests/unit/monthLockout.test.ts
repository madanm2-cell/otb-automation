import { describe, it, expect, vi, afterEach } from 'vitest';
import { getLockedMonths } from '../../src/lib/monthLockout';

describe('monthLockout (PRD FR-3.4)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('Jan 10: Jan locked, Feb-Mar editable', () => {
    vi.setSystemTime(new Date('2026-01-10T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(true);
    expect(result['2026-02-01']).toBe(false);
    expect(result['2026-03-01']).toBe(false);
  });

  it('Jan 16: Jan locked, Feb locked, Mar editable', () => {
    vi.setSystemTime(new Date('2026-01-16T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(true);
    expect(result['2026-02-01']).toBe(true);
    expect(result['2026-03-01']).toBe(false);
  });

  it('Feb 5: Jan+Feb locked, Mar editable', () => {
    vi.setSystemTime(new Date('2026-02-05T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(true);
    expect(result['2026-02-01']).toBe(true);
    expect(result['2026-03-01']).toBe(false);
  });

  it('uses IST timezone: Jan 15 23:00 UTC = Jan 16 04:30 IST', () => {
    vi.setSystemTime(new Date('2026-01-15T23:00:00Z'));
    const result = getLockedMonths(['2026-02-01']);
    expect(result['2026-02-01']).toBe(true); // IST is past 15th
  });

  it('Mar 1: all three months locked (Jan, Feb past; Mar current)', () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(true);
    expect(result['2026-02-01']).toBe(true);
    expect(result['2026-03-01']).toBe(true);
  });

  it('Dec 10 2025: Jan 2026 editable', () => {
    vi.setSystemTime(new Date('2025-12-10T10:00:00+05:30'));
    const result = getLockedMonths(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(result['2026-01-01']).toBe(false);
    expect(result['2026-02-01']).toBe(false);
    expect(result['2026-03-01']).toBe(false);
  });
});
