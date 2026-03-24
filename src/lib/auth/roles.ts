import type { Role } from '@/types/otb';

export type Permission =
  | 'create_cycle' | 'upload_data' | 'assign_gd'
  | 'edit_otb' | 'submit_otb'
  | 'view_all_otbs' | 'view_approved_otbs'
  | 'approve_otb' | 'upload_actuals' | 'view_variance'
  | 'view_audit_logs' | 'manage_users' | 'manage_master_data'
  | 'admin_override'
  | 'view_cross_brand_summary' | 'request_reopen'
  | 'export_otb' | 'view_cycle';

// PRD Section 11.1 — permission matrix
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: [
    'create_cycle', 'upload_data', 'assign_gd',
    'edit_otb', 'submit_otb',
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'upload_actuals', 'view_variance',
    'view_audit_logs', 'manage_users', 'manage_master_data',
    'admin_override',
    'view_cross_brand_summary', 'request_reopen',
    'export_otb', 'view_cycle',
  ],
  Planning: [
    'create_cycle', 'upload_data', 'assign_gd',
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'upload_actuals', 'view_variance',
    'manage_master_data',
    'view_cross_brand_summary', 'export_otb', 'view_cycle',
  ],
  GD: [
    'edit_otb', 'submit_otb',
    'approve_otb', 'view_variance',
    'request_reopen', 'export_otb', 'view_cycle',
  ],
  Finance: [
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'view_variance',
    'view_cross_brand_summary', 'export_otb', 'view_cycle',
  ],
  CXO: [
    'view_all_otbs', 'view_approved_otbs',
    'approve_otb', 'view_variance',
    'view_cross_brand_summary', 'export_otb', 'view_cycle',
  ],
  ReadOnly: [
    'view_approved_otbs', 'view_variance',
    'view_cycle',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export { type Role };
