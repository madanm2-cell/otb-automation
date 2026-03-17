-- 009_master_defaults.sql
-- Master data default tables for ASP, COGS, Return%, Tax%, Sellex%, Standard DoH
-- These store brand-scoped defaults that get copied into each cycle.

-- 1. Master defaults: ASP (sub_brand × sub_category × channel)
CREATE TABLE master_default_asp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  channel text NOT NULL,
  asp numeric NOT NULL CHECK (asp > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category, channel)
);

-- 2. Master defaults: COGS (sub_brand × sub_category)
CREATE TABLE master_default_cogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  cogs numeric NOT NULL CHECK (cogs >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category)
);

-- 3. Master defaults: Return % (sub_brand × sub_category × channel)
CREATE TABLE master_default_return_pct (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  channel text NOT NULL,
  return_pct numeric NOT NULL CHECK (return_pct >= 0 AND return_pct <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category, channel)
);

-- 4. Master defaults: Tax % (sub_category only — GST/HSN driven)
CREATE TABLE master_default_tax_pct (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_category text NOT NULL,
  tax_pct numeric NOT NULL CHECK (tax_pct >= 0 AND tax_pct <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_category)
);

-- 5. Master defaults: Sellex % (sub_brand × sub_category × channel)
CREATE TABLE master_default_sellex_pct (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  channel text NOT NULL,
  sellex_pct numeric NOT NULL CHECK (sellex_pct >= 0 AND sellex_pct <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category, channel)
);

-- 6. Master defaults: Standard DoH (sub_brand × sub_category)
CREATE TABLE master_default_doh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sub_brand text NOT NULL,
  sub_category text NOT NULL,
  doh numeric NOT NULL CHECK (doh >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (brand_id, sub_brand, sub_category)
);

-- 7. Per-cycle defaults snapshot (copied from master, editable per cycle)
CREATE TABLE cycle_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES otb_cycles(id) ON DELETE CASCADE,
  default_type text NOT NULL CHECK (default_type IN ('asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh')),
  sub_brand text,       -- null for tax_pct
  sub_category text NOT NULL,
  channel text,          -- null for cogs, standard_doh, tax_pct
  value numeric NOT NULL,
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cycle_id, default_type, sub_brand, sub_category, channel)
);

-- Track whether cycle defaults have been confirmed
ALTER TABLE otb_cycles ADD COLUMN defaults_confirmed boolean DEFAULT false;

-- Indexes
CREATE INDEX idx_master_default_asp_brand ON master_default_asp(brand_id);
CREATE INDEX idx_master_default_cogs_brand ON master_default_cogs(brand_id);
CREATE INDEX idx_master_default_return_pct_brand ON master_default_return_pct(brand_id);
CREATE INDEX idx_master_default_tax_pct_brand ON master_default_tax_pct(brand_id);
CREATE INDEX idx_master_default_sellex_pct_brand ON master_default_sellex_pct(brand_id);
CREATE INDEX idx_master_default_doh_brand ON master_default_doh(brand_id);
CREATE INDEX idx_cycle_defaults_cycle ON cycle_defaults(cycle_id);
CREATE INDEX idx_cycle_defaults_type ON cycle_defaults(cycle_id, default_type);

-- RLS policies (same pattern as existing master data tables)
ALTER TABLE master_default_asp ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_cogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_return_pct ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_tax_pct ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_sellex_pct ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_default_doh ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_defaults ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read master defaults
CREATE POLICY "read_master_defaults_asp" ON master_default_asp FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_cogs" ON master_default_cogs FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_return_pct" ON master_default_return_pct FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_tax_pct" ON master_default_tax_pct FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_sellex_pct" ON master_default_sellex_pct FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_master_defaults_doh" ON master_default_doh FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_cycle_defaults" ON cycle_defaults FOR SELECT TO authenticated USING (true);

-- Admin and Planning can write master defaults
CREATE POLICY "write_master_defaults_asp" ON master_default_asp FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_cogs" ON master_default_cogs FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_return_pct" ON master_default_return_pct FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_tax_pct" ON master_default_tax_pct FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_sellex_pct" ON master_default_sellex_pct FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
CREATE POLICY "write_master_defaults_doh" ON master_default_doh FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));

-- Cycle defaults follow cycle visibility (Admin/Planning can write)
CREATE POLICY "write_cycle_defaults" ON cycle_defaults FOR ALL TO authenticated
  USING ((SELECT get_user_role()) IN ('Admin', 'Planning'));
