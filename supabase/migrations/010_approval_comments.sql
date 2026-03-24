-- ============================================================
-- Migration 010: Approval Tracking & Comments Tables
-- Date: 2026-03-24
-- Sprint 7-8, Task 2: Approval workflow + threaded comments
-- ============================================================

-- ============================================================
-- APPROVAL TRACKING
-- ============================================================

create table approval_tracking (
  id uuid default gen_random_uuid() primary key,
  cycle_id uuid not null references otb_cycles(id) on delete cascade,
  role text not null check (role in ('Planning', 'GD', 'Finance', 'CXO')),
  user_id uuid references auth.users(id),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'RevisionRequested')),
  comment text,
  decided_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cycle_id, role)
);

-- Indexes
create index idx_approval_tracking_cycle on approval_tracking(cycle_id);

-- ============================================================
-- COMMENTS (threaded, linked to cycle/row/metric)
-- ============================================================

create table comments (
  id uuid default gen_random_uuid() primary key,
  cycle_id uuid not null references otb_cycles(id) on delete cascade,
  parent_id uuid references comments(id),
  comment_type text not null check (comment_type in ('brand', 'metric', 'general')),
  row_id uuid references otb_plan_rows(id),
  month text,
  field text,
  text text not null,
  author_id uuid not null references auth.users(id),
  author_name text not null,
  author_role text not null,
  created_at timestamptz default now()
);

-- Indexes
create index idx_comments_cycle on comments(cycle_id);
create index idx_comments_parent on comments(parent_id);
create index idx_comments_row on comments(row_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table approval_tracking enable row level security;
alter table comments enable row level security;

-- ---- APPROVAL_TRACKING policies ----

-- SELECT: all authenticated users can see approval status
create policy "Authenticated users can read approval tracking"
  on approval_tracking for select
  using (auth.uid() is not null);

-- INSERT: service role only (no policy = denied for non-service-role)
-- No INSERT policy means only service_role key can insert

-- UPDATE: user's profile role must match the row's approval role
create policy "Approvers can update their role rows"
  on approval_tracking for update
  using (get_user_role() = role);

-- DELETE: none (no policy = denied)

-- ---- COMMENTS policies ----

-- SELECT: all authenticated users can read comments
create policy "Authenticated users can read comments"
  on comments for select
  using (auth.uid() is not null);

-- INSERT: authenticated users, author_id must match their uid
create policy "Authenticated users can insert own comments"
  on comments for insert
  with check (author_id = auth.uid());

-- UPDATE: none (comments are immutable, no policy = denied)

-- DELETE: author can delete own comments
create policy "Authors can delete own comments"
  on comments for delete
  using (author_id = auth.uid());
