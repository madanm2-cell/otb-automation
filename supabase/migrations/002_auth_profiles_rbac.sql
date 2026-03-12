-- ============================================================
-- USER PROFILES (extends auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null default 'ReadOnly'
    check (role in ('Admin', 'Planning', 'GD', 'Finance', 'CXO', 'ReadOnly')),
  assigned_brands jsonb not null default '[]',  -- array of brand UUIDs (for GDs)
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for role-based queries
create index idx_profiles_role on profiles(role);
create index idx_profiles_active on profiles(is_active) where is_active = true;

-- Auto-create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'ReadOnly')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update assigned_gd_id in otb_cycles to reference profiles
-- (Sprint 1-4 used text; now it's a proper UUID)
alter table otb_cycles
  alter column assigned_gd_id type uuid using assigned_gd_id::uuid;

alter table otb_cycles
  add constraint fk_assigned_gd foreign key (assigned_gd_id) references profiles(id);

-- Add created_by to otb_cycles
alter table otb_cycles add column if not exists created_by uuid references profiles(id);

-- Add user references to version_history
alter table version_history
  alter column created_by type uuid using created_by::uuid;

alter table version_history
  add constraint fk_version_created_by foreign key (created_by) references profiles(id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table otb_cycles enable row level security;
alter table otb_plan_rows enable row level security;
alter table otb_plan_data enable row level security;
alter table file_uploads enable row level security;
alter table version_history enable row level security;
alter table brands enable row level security;
alter table sub_brands enable row level security;
alter table sub_categories enable row level security;
alter table channels enable row level security;
alter table genders enable row level security;
alter table master_mappings enable row level security;

-- Helper function: get current user's role
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Helper function: get current user's assigned brand IDs
create or replace function public.get_assigned_brands()
returns jsonb as $$
  select assigned_brands from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ---- PROFILES policies ----
-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select using (id = auth.uid());

-- Admin can read all profiles
create policy "Admin can read all profiles"
  on profiles for select using (get_user_role() = 'Admin');

-- Admin can insert/update profiles
create policy "Admin can manage profiles"
  on profiles for all using (get_user_role() = 'Admin');

-- ---- OTB_CYCLES policies ----
-- Admin, Planning, Finance, CXO can see all cycles
create policy "Privileged roles see all cycles"
  on otb_cycles for select using (
    get_user_role() in ('Admin', 'Planning', 'Finance', 'CXO')
  );

-- GD sees only assigned brand cycles
create policy "GD sees assigned brand cycles"
  on otb_cycles for select using (
    get_user_role() = 'GD'
    and brand_id::text in (select jsonb_array_elements_text(get_assigned_brands()))
  );

-- ReadOnly sees only approved cycles
create policy "ReadOnly sees approved cycles"
  on otb_cycles for select using (
    get_user_role() = 'ReadOnly' and status = 'Approved'
  );

-- Admin/Planning can insert/update cycles
create policy "Admin/Planning manage cycles"
  on otb_cycles for all using (
    get_user_role() in ('Admin', 'Planning')
  );

-- ---- PLAN ROWS / DATA policies ----
-- Follow cycle visibility (join via cycle_id)
create policy "Plan rows follow cycle access"
  on otb_plan_rows for select using (
    exists (
      select 1 from otb_cycles c
      where c.id = otb_plan_rows.cycle_id
    )
  );

create policy "Plan data follows row access"
  on otb_plan_data for select using (
    exists (
      select 1 from otb_plan_rows r
      join otb_cycles c on c.id = r.cycle_id
      where r.id = otb_plan_data.row_id
    )
  );

-- GD can update plan data for their assigned brand's filling cycles
create policy "GD can update plan data"
  on otb_plan_data for update using (
    get_user_role() in ('Admin', 'GD')
    and exists (
      select 1 from otb_plan_rows r
      join otb_cycles c on c.id = r.cycle_id
      where r.id = otb_plan_data.row_id
        and c.status = 'Filling'
        and (
          get_user_role() = 'Admin'
          or c.brand_id::text in (select jsonb_array_elements_text(get_assigned_brands()))
        )
    )
  );

-- ---- MASTER DATA policies ----
-- Everyone can read master data
create policy "All authenticated read master data"
  on brands for select using (auth.uid() is not null);
create policy "All authenticated read sub_brands"
  on sub_brands for select using (auth.uid() is not null);
create policy "All authenticated read sub_categories"
  on sub_categories for select using (auth.uid() is not null);
create policy "All authenticated read channels"
  on channels for select using (auth.uid() is not null);
create policy "All authenticated read genders"
  on genders for select using (auth.uid() is not null);
create policy "All authenticated read mappings"
  on master_mappings for select using (auth.uid() is not null);

-- Admin can manage master data
create policy "Admin manages brands"
  on brands for all using (get_user_role() = 'Admin');
create policy "Admin manages sub_brands"
  on sub_brands for all using (get_user_role() = 'Admin');
create policy "Admin manages sub_categories"
  on sub_categories for all using (get_user_role() = 'Admin');
create policy "Admin manages channels"
  on channels for all using (get_user_role() = 'Admin');
create policy "Admin manages genders"
  on genders for all using (get_user_role() = 'Admin');
create policy "Admin manages mappings"
  on master_mappings for all using (get_user_role() = 'Admin');

-- ---- FILE UPLOADS / VERSION HISTORY ----
create policy "File uploads follow cycle access"
  on file_uploads for select using (
    exists (select 1 from otb_cycles c where c.id = file_uploads.cycle_id)
  );

create policy "Admin/Planning manage uploads"
  on file_uploads for all using (get_user_role() in ('Admin', 'Planning'));

create policy "Version history follows cycle access"
  on version_history for select using (
    exists (select 1 from otb_cycles c where c.id = version_history.cycle_id)
  );
