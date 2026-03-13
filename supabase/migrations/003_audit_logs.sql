-- Audit log table for tracking all state-changing operations
-- PRD Section 11.3 — 7-year retention

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null,           -- 'cycle', 'plan_data', 'file_upload', 'user', 'master_data'
  entity_id uuid,
  action text not null,                -- 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'REVERT', 'LOGIN', 'LOGOUT'
  user_id uuid references profiles(id),
  user_email text,
  user_role text,
  details jsonb,                       -- action-specific metadata
  ip_address text,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index idx_audit_entity on audit_logs(entity_type, entity_id);
create index idx_audit_user on audit_logs(user_id);
create index idx_audit_action on audit_logs(action);
create index idx_audit_created on audit_logs(created_at);
