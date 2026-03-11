-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- MASTER DATA
-- ============================================================

create table brands (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

create table sub_brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand_id uuid references brands(id) not null,
  created_at timestamptz default now(),
  unique(brand_id, name)
);

create table sub_categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

create table channels (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

create table genders (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

-- Standardization mappings (PRD 4.3): raw names → standard names
create table master_mappings (
  id uuid primary key default uuid_generate_v4(),
  mapping_type text not null,           -- 'sub_brand', 'sub_category', 'channel'
  raw_value text not null,
  standard_value text not null,
  brand text,                           -- optional: brand-specific mappings
  unique(mapping_type, raw_value, brand)
);

-- ============================================================
-- OTB CYCLES
-- ============================================================

create table otb_cycles (
  id uuid primary key default uuid_generate_v4(),
  cycle_name text not null,
  brand_id uuid references brands(id) not null,
  planning_quarter text not null,       -- e.g. 'Q4-FY26'
  planning_period_start date not null,
  planning_period_end date not null,
  wear_types jsonb not null default '[]', -- ['NWW', 'WW'] free-form
  fill_deadline date,
  approval_deadline date,
  assigned_gd_id text,                  -- user ID (text until auth in Sprint 5-6)
  status text not null default 'Draft', -- Draft, Active, Filling, InReview, Approved
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FILE UPLOADS
-- ============================================================

create table file_uploads (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references otb_cycles(id) not null,
  file_type text not null,              -- opening_stock, cogs, asp, doh, ly_sales, etc.
  file_name text not null,
  storage_path text not null,           -- Supabase Storage path
  status text default 'pending',        -- pending, validated, failed
  row_count int,
  errors jsonb,                         -- validation error details
  uploaded_at timestamptz default now()
);

-- ============================================================
-- OTB PLAN DATA
-- ============================================================

-- One row per dimension combination per cycle
create table otb_plan_rows (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references otb_cycles(id) not null,
  sub_brand text not null,
  wear_type text not null,
  sub_category text not null,
  gender text not null,
  channel text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(cycle_id, sub_brand, wear_type, sub_category, gender, channel)
);

-- Month-wise metrics per row (3 records per row for a quarter)
create table otb_plan_data (
  id uuid primary key default uuid_generate_v4(),
  row_id uuid references otb_plan_rows(id) not null,
  month date not null,                  -- first day of month

  -- Reference data (pre-filled from uploads)
  asp numeric(12,2),
  cogs numeric(12,2),
  opening_stock_qty int,
  ly_sales_gmv numeric(15,2),
  recent_sales_nsq int,
  soft_forecast_nsq int,
  return_pct numeric(5,2),
  tax_pct numeric(5,2),
  sellex_pct numeric(5,2),
  standard_doh int,

  -- GD inputs (3 editable fields)
  nsq int,
  inwards_qty int,
  perf_marketing_pct numeric(5,2),

  -- Calculated fields (stored on save for query performance)
  sales_plan_gmv numeric(15,2),
  goly_pct numeric(8,2),
  nsv numeric(15,2),
  inwards_val_cogs numeric(15,2),
  opening_stock_val numeric(15,2),
  closing_stock_qty int,
  fwd_30day_doh numeric(8,2),
  gm_pct numeric(5,2),
  gross_margin numeric(15,2),
  cm1 numeric(15,2),
  cm2 numeric(15,2),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(row_id, month)
);

-- ============================================================
-- VERSION HISTORY
-- ============================================================

create table version_history (
  id uuid primary key default uuid_generate_v4(),
  cycle_id uuid references otb_cycles(id) not null,
  version_number int not null,
  snapshot jsonb not null,              -- full plan data snapshot
  change_summary text,
  created_by text,                      -- user identifier (text until auth)
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================

create index idx_plan_rows_cycle on otb_plan_rows(cycle_id);
create index idx_plan_data_row on otb_plan_data(row_id);
create index idx_file_uploads_cycle on file_uploads(cycle_id);
create index idx_versions_cycle on version_history(cycle_id);
