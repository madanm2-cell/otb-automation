-- ============================================================
-- 008: Brand-Scoped Master Data
-- Restructure so brand owns all master data.
-- New wear_types table, drop wear_type_mappings junction table,
-- drop otb_cycles.wear_types column.
-- ============================================================

-- Step 1: Create wear_types table
CREATE TABLE wear_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  brand_id uuid REFERENCES brands(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, name)
);

CREATE INDEX idx_wear_types_brand ON wear_types(brand_id);

ALTER TABLE wear_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read wear_types"
  ON wear_types FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manages wear_types"
  ON wear_types FOR ALL USING (get_user_role() IN ('Admin', 'Planning'));

-- Step 2: Seed wear_types from existing wear_type_mappings
INSERT INTO wear_types (name, brand_id)
SELECT DISTINCT wm.wear_type, b.id
FROM wear_type_mappings wm
CROSS JOIN brands b
WHERE b.name = 'Bewakoof'
ON CONFLICT (brand_id, name) DO NOTHING;

-- Step 3: Add brand_id to sub_categories, channels, genders
ALTER TABLE sub_categories ADD COLUMN brand_id uuid REFERENCES brands(id);
ALTER TABLE channels ADD COLUMN brand_id uuid REFERENCES brands(id);
ALTER TABLE genders ADD COLUMN brand_id uuid REFERENCES brands(id);

-- Step 4: Add wear_type_id to sub_categories
ALTER TABLE sub_categories ADD COLUMN wear_type_id uuid REFERENCES wear_types(id);

-- Step 5: Migrate existing data — duplicate across all brands
DO $$
DECLARE
  b record;
  r record;
  wt_id uuid;
BEGIN
  -- sub_categories: for each brand, copy global rows
  FOR b IN SELECT id, name FROM brands LOOP
    FOR r IN SELECT name FROM sub_categories WHERE brand_id IS NULL LOOP
      -- Look up wear_type from wear_type_mappings for this brand
      SELECT wt.id INTO wt_id
      FROM wear_type_mappings wtm
      JOIN wear_types wt ON wt.name = wtm.wear_type AND wt.brand_id = b.id
      WHERE wtm.sub_category = r.name
      LIMIT 1;

      INSERT INTO sub_categories (name, brand_id, wear_type_id)
      VALUES (r.name, b.id, wt_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  DELETE FROM sub_categories WHERE brand_id IS NULL;

  -- channels: duplicate across all brands
  FOR b IN SELECT id FROM brands LOOP
    FOR r IN SELECT name FROM channels WHERE brand_id IS NULL LOOP
      INSERT INTO channels (name, brand_id)
      VALUES (r.name, b.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  DELETE FROM channels WHERE brand_id IS NULL;

  -- genders: duplicate across all brands
  FOR b IN SELECT id FROM brands LOOP
    FOR r IN SELECT name FROM genders WHERE brand_id IS NULL LOOP
      INSERT INTO genders (name, brand_id)
      VALUES (r.name, b.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  DELETE FROM genders WHERE brand_id IS NULL;
END $$;

-- Step 6: Make columns NOT NULL, replace unique constraints

-- sub_categories
ALTER TABLE sub_categories ALTER COLUMN brand_id SET NOT NULL;
-- wear_type_id stays nullable — non-Bewakoof brands won't have it set yet
ALTER TABLE sub_categories DROP CONSTRAINT sub_categories_name_key;
ALTER TABLE sub_categories ADD CONSTRAINT sub_categories_brand_wt_name_key UNIQUE(brand_id, wear_type_id, name);

-- channels
ALTER TABLE channels ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE channels DROP CONSTRAINT channels_name_key;
ALTER TABLE channels ADD CONSTRAINT channels_brand_name_key UNIQUE(brand_id, name);

-- genders
ALTER TABLE genders ALTER COLUMN brand_id SET NOT NULL;
ALTER TABLE genders DROP CONSTRAINT genders_name_key;
ALTER TABLE genders ADD CONSTRAINT genders_brand_name_key UNIQUE(brand_id, name);

-- Step 7: Convert master_mappings.brand from text to brand_id uuid
ALTER TABLE master_mappings ADD COLUMN brand_id uuid REFERENCES brands(id);

UPDATE master_mappings SET brand_id = b.id
FROM brands b WHERE b.name = master_mappings.brand;

ALTER TABLE master_mappings DROP CONSTRAINT master_mappings_mapping_type_raw_value_brand_key;
ALTER TABLE master_mappings DROP COLUMN brand;
ALTER TABLE master_mappings ADD CONSTRAINT master_mappings_type_raw_brand_key
  UNIQUE(mapping_type, raw_value, brand_id);

-- Prevent duplicate global mappings where brand_id IS NULL
CREATE UNIQUE INDEX idx_master_mappings_global
  ON master_mappings(mapping_type, raw_value) WHERE brand_id IS NULL;

-- Step 8: Drop wear_type_mappings table and otb_cycles.wear_types column
DROP TABLE IF EXISTS wear_type_mappings;
ALTER TABLE otb_cycles DROP COLUMN IF EXISTS wear_types;

-- Step 9: No action needed — RLS policies on wear_type_mappings dropped with the table
