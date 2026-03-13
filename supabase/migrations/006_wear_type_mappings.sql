-- Wear type mappings: sub_brand × sub_category → wear_type
create table wear_type_mappings (
  id uuid primary key default uuid_generate_v4(),
  sub_brand text not null,
  sub_category text not null,
  wear_type text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(sub_brand, sub_category)
);

create index idx_wear_type_mappings_lookup on wear_type_mappings(sub_brand, sub_category);

-- RLS
alter table wear_type_mappings enable row level security;

-- All authenticated users can read
create policy "All authenticated read wear_type_mappings"
  on wear_type_mappings for select
  using (auth.uid() is not null);

-- Admin/Planning can manage
create policy "Admin/Planning manage wear_type_mappings"
  on wear_type_mappings for all
  using (get_user_role() in ('Admin', 'Planning'));

-- Make wear_types optional on otb_cycles (no longer required for activation)
alter table otb_cycles alter column wear_types set default '[]';
