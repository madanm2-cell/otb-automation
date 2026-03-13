import { describe, it, expect } from 'vitest';
import { buildAuditEntry } from '../../src/lib/auth/auditLogger';

describe('Audit Logger', () => {
  it('builds correct audit entry for cycle creation', () => {
    const entry = buildAuditEntry({
      entityType: 'cycle',
      entityId: 'cycle-123',
      action: 'CREATE',
      userId: 'user-456',
      userEmail: 'planner@bewakoof.com',
      userRole: 'Planning',
      details: { cycle_name: 'Bewakoof Q4 FY26' },
    });

    expect(entry.entity_type).toBe('cycle');
    expect(entry.entity_id).toBe('cycle-123');
    expect(entry.action).toBe('CREATE');
    expect(entry.user_id).toBe('user-456');
    expect(entry.details).toEqual({ cycle_name: 'Bewakoof Q4 FY26' });
  });

  it('builds correct audit entry for bulk update', () => {
    const entry = buildAuditEntry({
      entityType: 'plan_data',
      entityId: 'cycle-123',
      action: 'UPDATE',
      userId: 'user-789',
      userEmail: 'gd@bewakoof.com',
      userRole: 'GD',
      details: { rows_updated: 15, months_affected: ['2026-01-01', '2026-02-01'] },
    });

    expect(entry.action).toBe('UPDATE');
    expect(entry.details.rows_updated).toBe(15);
  });

  it('defaults details to empty object and ip_address to null', () => {
    const entry = buildAuditEntry({
      entityType: 'user',
      entityId: 'user-abc',
      action: 'DELETE',
      userId: 'admin-1',
      userEmail: 'admin@bewakoof.com',
      userRole: 'Admin',
    });

    expect(entry.details).toEqual({});
    expect(entry.ip_address).toBeNull();
  });

  it('passes through ipAddress when provided', () => {
    const entry = buildAuditEntry({
      entityType: 'cycle',
      entityId: 'cycle-1',
      action: 'ACTIVATE',
      userId: 'u-1',
      userEmail: 'p@b.com',
      userRole: 'Planning',
      ipAddress: '192.168.1.1',
    });

    expect(entry.ip_address).toBe('192.168.1.1');
  });
});
