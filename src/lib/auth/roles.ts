import type { Role } from '@/types/otb';

export type Permission =
  | 'create_cycle' | 'upload_data' | 'assign_gd'
  | 'edit_otb' | 'submit_otb'
  | 'view_all_otbs' | 'view_approved_otbs'
  | 'approve_otb' | 'upload_actuals' | 'view_variance'
  | 'view_audit_logs' | 'manage_users' | 'manage_master_data'
  | 'admin_override';

// PRD Section 11.1 — permission matrix
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: [
    'create_cycle', 'upload_data', 'assign_gd',
    'edit_otb', 'submit_otb',
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'upload_actuals', 'view_variance',
    'view_audit_logs', 'manage_users', 'manage_master_data',
    'admin_override',
  ],
  Planning: [
    'create_cycle', 'upload_data', 'assign_gd',
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'upload_actuals', 'view_variance',
  ],
  GD: [
    'edit_otb', 'submit_otb',
    'approve_otb', 'view_variance',
  ],
  Finance: [
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'view_variance',
  ],
  CXO: [
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'view_variance',
  ],
  ReadOnly: [
    'view_approved_otbs', 'view_variance',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export { type Role };
