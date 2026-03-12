import { describe, it, expect } from 'vitest';
import { hasPermission, Role, Permission } from '../../src/lib/auth/roles';

describe('Role permissions (PRD 11.1)', () => {
  it('Admin has all permissions', () => {
    expect(hasPermission('Admin', 'create_cycle')).toBe(true);
    expect(hasPermission('Admin', 'upload_data')).toBe(true);
    expect(hasPermission('Admin', 'edit_otb')).toBe(true);
    expect(hasPermission('Admin', 'approve_otb')).toBe(true);
    expect(hasPermission('Admin', 'view_audit_logs')).toBe(true);
    expect(hasPermission('Admin', 'manage_users')).toBe(true);
    expect(hasPermission('Admin', 'manage_master_data')).toBe(true);
    expect(hasPermission('Admin', 'admin_override')).toBe(true);
  });

  it('Planning can create cycles, upload, assign GDs, view all, approve, upload actuals', () => {
    expect(hasPermission('Planning', 'create_cycle')).toBe(true);
    expect(hasPermission('Planning', 'upload_data')).toBe(true);
    expect(hasPermission('Planning', 'assign_gd')).toBe(true);
    expect(hasPermission('Planning', 'view_all_otbs')).toBe(true);
    expect(hasPermission('Planning', 'approve_otb')).toBe(true);
    expect(hasPermission('Planning', 'upload_actuals')).toBe(true);
    // Cannot
    expect(hasPermission('Planning', 'edit_otb')).toBe(false);
    expect(hasPermission('Planning', 'manage_users')).toBe(false);
    expect(hasPermission('Planning', 'view_audit_logs')).toBe(false);
  });

  it('GD can only edit and submit assigned brand OTB, approve own brand', () => {
    expect(hasPermission('GD', 'edit_otb')).toBe(true);
    expect(hasPermission('GD', 'submit_otb')).toBe(true);
    expect(hasPermission('GD', 'approve_otb')).toBe(true);
    expect(hasPermission('GD', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('GD', 'create_cycle')).toBe(false);
    expect(hasPermission('GD', 'upload_data')).toBe(false);
    expect(hasPermission('GD', 'view_all_otbs')).toBe(false);
  });

  it('Finance can view all OTBs, approve, view variance', () => {
    expect(hasPermission('Finance', 'view_all_otbs')).toBe(true);
    expect(hasPermission('Finance', 'approve_otb')).toBe(true);
    expect(hasPermission('Finance', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('Finance', 'create_cycle')).toBe(false);
    expect(hasPermission('Finance', 'edit_otb')).toBe(false);
  });

  it('CXO can view all, approve, view variance', () => {
    expect(hasPermission('CXO', 'view_all_otbs')).toBe(true);
    expect(hasPermission('CXO', 'approve_otb')).toBe(true);
    expect(hasPermission('CXO', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('CXO', 'create_cycle')).toBe(false);
  });

  it('ReadOnly can view approved OTBs and variance only', () => {
    expect(hasPermission('ReadOnly', 'view_approved_otbs')).toBe(true);
    expect(hasPermission('ReadOnly', 'view_variance')).toBe(true);
    // Cannot
    expect(hasPermission('ReadOnly', 'create_cycle')).toBe(false);
    expect(hasPermission('ReadOnly', 'approve_otb')).toBe(false);
  });
});
